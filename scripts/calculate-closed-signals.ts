import Airtable from 'airtable';
import { config } from 'dotenv';
import fetch from 'node-fetch';

// Initialize environment variables
config();

// Interfaces

interface SignalFields {
  token: string;
  type: 'BUY' | 'SELL';
  timeframe: string;
  entryPrice: number;
  targetPrice: number;
  stopLoss: number;
  createdAt: string;
  expiryDate: string;
  exitPrice?: number;
  actualReturn?: number;
}

interface PriceData {
  value: number;
  timestamp: number;
}

interface TradeResult {
  exitPrice: number;
  exitReason: 'COMPLETED' | 'STOPPED' | 'EXPIRED';
  timeToExit: number;
  actualReturn: number;
  success: boolean;
}

interface TokenRecord {
  fields: {
    symbol: string;
    mint: string;
  };
}

async function getHistoricalPrices(
  tokenMint: string,
  startTime: Date,
  endTime: Date
): Promise<PriceData[]> {
  try {
    // Validate dates
    const now = new Date();
    if (startTime > now || endTime > now) {
      console.log("⚠️ Warning: Future dates detected, adjusting to current time window");
      const duration = endTime.getTime() - startTime.getTime();
      endTime = now;
      startTime = new Date(endTime.getTime() - duration);
    }

    const url = "https://public-api.birdeye.so/defi/history_price";
    const params = new URLSearchParams({
      address: tokenMint,
      address_type: "token",
      type: "1m",
      time_from: Math.floor(startTime.getTime() / 1000).toString(),
      time_to: Math.floor(endTime.getTime() / 1000).toString()
    });

    console.log(`Fetching price history for ${tokenMint}`);
    console.log(`Adjusted time range: ${startTime.toISOString()} to ${endTime.toISOString()}`);

    const response = await fetch(`${url}?${params}`, {
      headers: {
        'X-API-KEY': process.env.BIRDEYE_API_KEY || '',
        'x-chain': 'solana',
        'accept': 'application/json',
        'User-Agent': 'Mozilla/5.0'
      }
    });

    if (response.ok) {
      const data = await response.json();
      const items = data?.data?.items || [];
      if (!items.length) {
        console.log("⚠️ No price data returned from Birdeye");
        return [];
      }
      console.log(`✅ Retrieved ${items.length} price points`);
      return items;
    } else {
      console.log(`❌ Birdeye API error: ${response.status}`);
      console.log(`Response: ${await response.text()}`);
      return [];
    }
  } catch (error) {
    console.error("❌ Error fetching historical prices:", error);
    return [];
  }
}

function simulateTrade(prices: PriceData[], signalData: SignalFields): TradeResult {
  const entryPrice = signalData.entryPrice;
  const targetPrice = signalData.targetPrice;
  const stopLoss = signalData.stopLoss;
  const signalType = signalData.type;

  // Default to last price if no exit conditions met
  let exitPrice = prices.length ? prices[prices.length - 1].value : entryPrice;
  let exitReason: 'COMPLETED' | 'STOPPED' | 'EXPIRED' = 'EXPIRED';
  let timeToExit = prices.length;

  for (let i = 0; i < prices.length; i++) {
    const price = prices[i].value;

    if (signalType === 'BUY') {
      if (price >= targetPrice) {
        exitPrice = price;
        exitReason = 'COMPLETED';
        timeToExit = i;
        break;
      } else if (price <= stopLoss) {
        exitPrice = price;
        exitReason = 'STOPPED';
        timeToExit = i;
        break;
      }
    } else { // SELL
      if (price <= targetPrice) {
        exitPrice = price;
        exitReason = 'COMPLETED';
        timeToExit = i;
        break;
      } else if (price >= stopLoss) {
        exitPrice = price;
        exitReason = 'STOPPED';
        timeToExit = i;
        break;
      }
    }
  }

  // Calculate returns and success
  const actualReturn = signalType === 'BUY'
    ? ((exitPrice - entryPrice) / entryPrice) * 100
    : ((entryPrice - exitPrice) / entryPrice) * 100;

  const success = signalType === 'BUY'
    ? exitPrice > entryPrice
    : exitPrice < entryPrice;

  return {
    exitPrice,
    exitReason,
    timeToExit,
    actualReturn,
    success
  };
}

async function calculateClosedSignals() {
  try {
    // Verify environment variables
    if (!process.env.BIRDEYE_API_KEY) {
      throw new Error("BIRDEYE_API_KEY not found in environment variables");
    }

    if (!process.env.KINKONG_AIRTABLE_API_KEY || !process.env.KINKONG_AIRTABLE_BASE_ID) {
      throw new Error("Missing Airtable configuration");
    }

    // Initialize Airtable
    const base = new Airtable({ apiKey: process.env.KINKONG_AIRTABLE_API_KEY })
      .base(process.env.KINKONG_AIRTABLE_BASE_ID);

    const signalsTable = base.table('SIGNALS');
    const tokensTable = base.table('TOKENS');

    console.log("\n📊 Checking Airtable for signals...");

    // Get signals that need evaluation
    const signals = await signalsTable.select({
      filterByFormula: "AND(" +
        "expiryDate<NOW(), " +
        "actualReturn=BLANK(), " +
        "entryPrice>0, " +
        "targetPrice>0" +
        ")"
    }).all();

    console.log("\n🔍 Signal Filter Results:");
    console.log(`Found ${signals.length} signals to evaluate that match criteria:`);
    console.log("- Past expiry date");
    console.log("- Missing actualReturn or accuracy");
    console.log("- Has valid entry and target prices");

    for (const signal of signals) {
      try {
        const fields = signal.fields as SignalFields;
        const signalId = signal.id;

        console.log(`\n⚙️ Processing signal ${signalId}:`);
        console.log(`Token: ${fields.token}`);
        console.log(`Type: ${fields.type}`);
        console.log(`Entry: $${fields.entryPrice.toFixed(4)}`);

        // Get token mint address
        const tokenRecords = await tokensTable.select({
          filterByFormula: `{symbol}='${fields.token}'`
        }).all() as TokenRecord[];

        if (!tokenRecords.length) {
          console.log(`❌ No token record found for ${fields.token}`);
          continue;
        }

        const tokenMint = tokenRecords[0].fields.mint;
        console.log(`Found mint address: ${tokenMint}`);

        // Get historical prices
        const activationTime = new Date(fields.createdAt);
        const expiryTime = new Date(fields.expiryDate);

        const prices = await getHistoricalPrices(tokenMint, activationTime, expiryTime);
        if (!prices.length) {
          console.log(`❌ No price data available for ${fields.token}`);
          continue;
        }

        // Simulate trade with actual price data
        const results = simulateTrade(prices, fields);

        // Update signal with results
        await signalsTable.update(signalId, {
          exitPrice: results.exitPrice,
          actualReturn: Math.round(results.actualReturn * 100) / 100
        });

        console.log(`\n✅ Updated signal ${signalId}:`);
        console.log(`Exit Price: $${results.exitPrice.toFixed(4)}`);
        console.log(`Actual Return: ${results.actualReturn.toFixed(2)}%`);
        console.log(`Success: ${results.success ? '✅' : '❌'}`);
        console.log(`Time to Exit: ${results.timeToExit} minutes`);

      } catch (error) {
        console.error(`❌ Error processing signal ${signal.id}:`, error);
        continue;
      }
    }

    console.log("\n✅ Finished processing signals");

  } catch (error) {
    console.error("\n❌ Error:", error);
    throw error;
  }
}

// Run the script
console.log("\n🚀 Starting closed signals calculation...");
calculateClosedSignals().catch(console.error);
