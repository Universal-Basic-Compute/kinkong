import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { getTable } from '../backend/src/airtable/tables';
import { FieldSet } from 'airtable';
import fetch from 'node-fetch';
import { Response } from 'node-fetch';

// Add debug logging BEFORE config
console.log('Current working directory:', process.cwd());
console.log('.env path:', path.resolve(process.cwd(), '.env'));

interface DexScreenerResponse {
  pairs?: Array<{
    baseToken?: {
      address: string;
      symbol: string;
    };
    priceUsd?: string;
    liquidity?: {
      usd: number;
    };
    volume?: {
      h24: number;
    };
    priceChange?: {
      h24: number;
    };
  }>;
}

// Add debug logging BEFORE config
console.log('Current working directory:', process.cwd());
console.log('.env path:', path.resolve(process.cwd(), '.env'));

// Load .env file
const result = dotenv.config({ path: path.resolve(process.cwd(), '.env') });
console.log('dotenv result:', result);

// Check if variables are loaded
console.log('Environment variables after dotenv:', {
  KINKONG_AIRTABLE_API_KEY: process.env.KINKONG_AIRTABLE_API_KEY?.slice(0, 10) + '...',
  KINKONG_AIRTABLE_BASE_ID: process.env.KINKONG_AIRTABLE_BASE_ID,
});

// Additional environment checks
console.log('Environment check:', {
  cwd: process.cwd(),
  hasAirtableKey: !!process.env.KINKONG_AIRTABLE_API_KEY,
  hasAirtableBase: !!process.env.KINKONG_AIRTABLE_BASE_ID,
  hasBirdeyeKey: !!process.env.BIRDEYE_API_KEY,
  envKeys: Object.keys(process.env).filter(key => key.includes('KINKONG'))
});
console.log('dotenv result:', result);

// Check if variables are loaded
console.log('Environment variables after dotenv:', {
  KINKONG_AIRTABLE_API_KEY: process.env.KINKONG_AIRTABLE_API_KEY?.slice(0, 10) + '...',
  KINKONG_AIRTABLE_BASE_ID: process.env.KINKONG_AIRTABLE_BASE_ID,
});

// Additional environment checks
console.log('Environment check:', {
  cwd: process.cwd(),
  hasAirtableKey: !!process.env.KINKONG_AIRTABLE_API_KEY,
  hasAirtableBase: !!process.env.KINKONG_AIRTABLE_BASE_ID,
  hasBirdeyeKey: !!process.env.BIRDEYE_API_KEY,
  envKeys: Object.keys(process.env).filter(key => key.includes('KINKONG'))
});

const BIRDEYE_API_KEY = process.env.BIRDEYE_API_KEY;
const TOKENS = [
  {
    symbol: 'VIRTUAL',
    name: 'Virtual Protocol',
    mint: '0x0b3e328455c4059EEb9e3f84b5543F74E24e7E1b'
  },
  {
    symbol: 'AI16Z',
    name: 'ai16z',
    mint: 'HeLp6NuQkmYB4pYWo2zYs22mESHXPQYzXbB8n4V98jwC'
  },
  {
    symbol: 'FARTCOIN',
    name: 'Fartcoin',
    mint: '9BB6NFEcjBCtnNLFko2FqVQBq8HHM13kCyYcdQbgpump'
  },
  {
    symbol: 'AIXBT',
    name: 'aixbt by Virtuals',
    mint: '0x4F9Fd6Be4a90f2620860d680c0d4d5Fb53d1A825'
  },
  {
    symbol: 'GRIFFAIN',
    name: 'test griffain.com',
    mint: 'KENJSUYLASHUMfHyy5o4Hp2FdNqZg1AsUPhfH2kYvEP'
  },
  {
    symbol: 'GOAT',
    name: 'Goatseus Maximus',
    mint: 'CzLSujWBLFsSjncfkh59rUFqvafWcY5tzedWJSuypump'
  },
  {
    symbol: 'ARC',
    name: 'AI Rig Complex',
    mint: '61V8vBaqAGMpgDQi4JcAwo1dmBGHsyhzodcPqnEVpump'
  },
  {
    symbol: 'ZEREBRO',
    name: 'zerebro',
    mint: '8x5VqbHA8D7NkD52uNuS5nnt3PwA8pLD34ymskeSo2Wn'
  },
  {
    symbol: 'GAME',
    name: 'GAME by Virtuals',
    mint: '0x1C4CcA7C5DB003824208aDDA61Bd749e55F463a3'
  },
  {
    symbol: 'ALCH',
    name: 'Alchemist AI',
    mint: 'HNg5PYJmtqcmzXrv6S9zP1CDKk5BgDuyFBxbvNApump'
  },
  {
    symbol: 'HAT',
    name: 'TOP HAT',
    mint: 'AxGAbdFtdbj2oNXa4dKqFvwHzgFtW9mFHWmd7vQfpump'
  },
  {
    symbol: 'AKA',
    name: 'She Rises',
    mint: '4TwC4AiF1uUSHES2eBftGqemp6TqjEnKghqiH6dFpump'
  },
  {
    symbol: 'USDT',
    name: 'Tether USD',
    mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB'
  },
  {
    symbol: 'UBC',
    name: 'UBC',
    mint: '9psiRdn9cXYVps4F1kFuoNjd2EtmqNJXrCPmRppJpump'
  },
  {
    symbol: 'COMPUTE',
    name: 'Compute',
    mint: 'B1N1HcMm4RysYz4smsXwmk2UnS8NziqKCM6Ho8i62vXo'
  }
];

interface TokenData extends FieldSet {
  symbol: string;
  name: string;
  mint: string;
  isActive: boolean;
  volume7d: number;
  liquidity: number;
  volumeGrowth: number;
  pricePerformance: number;
  holderCount: number;
  price: number;
  price7dAvg: number;
  volumeOnUpDay: boolean;
  priceChange24h: number;
}

async function getDexScreenerData(mint: string, retries = 3): Promise<DexScreenerResponse> {
  const DEXSCREENER_API = 'https://api.dexscreener.com/latest/dex/tokens';
  
  for (let i = 0; i < retries; i++) {
    try {
      console.log(`Attempting to fetch DexScreener data for ${mint} (attempt ${i + 1}/${retries})...`);
      
      const response = await fetch(`${DEXSCREENER_API}/${mint}`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json() as DexScreenerResponse;
      console.log(`Successfully fetched DexScreener data for ${mint}`);
      return data;

    } catch (error) {
      console.warn(`Attempt ${i + 1}/${retries} failed for ${mint}:`, error);
      
      if (i === retries - 1) {
        console.warn(`All ${retries} attempts failed for ${mint}`);
        return {};
      }
      
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
    }
  }
  
  return {};
}

async function fetchTokenData(): Promise<TokenData[]> {
  const tokenData: TokenData[] = [];

  for (const token of TOKENS) {
    try {
      console.log(`Processing ${token.symbol}...`);
      
      // Get DexScreener data
      const dexScreenerData = await getDexScreenerData(token.mint);
      const pair = dexScreenerData.pairs?.[0];
      
      if (!pair) {
        console.warn(`No pair data found for ${token.symbol}`);
        continue;
      }

      // Calculate if volume is on up day based on price change
      const volumeOnUpDay = (pair.priceChange?.h24 || 0) > 0;

      // Extract current price and calculate 7d average (if available)
      const currentPrice = Number(pair.priceUsd || 0);
      const price7dAvg = currentPrice * (1 - (pair.priceChange?.h24 || 0) / 100); // Approximate 7d avg using 24h change

      tokenData.push({
        symbol: token.symbol,
        name: token.name,
        mint: token.mint,
        isActive: true,
        volume7d: pair.volume?.h24 ? pair.volume.h24 * 7 : 0,
        liquidity: pair.liquidity?.usd || 0,
        volumeGrowth: pair.priceChange?.h24 || 0,
        pricePerformance: pair.priceChange?.h24 || 0,
        holderCount: 0,  // Keep as is
        price: currentPrice,
        price7dAvg: price7dAvg,
        volumeOnUpDay: volumeOnUpDay,
        priceChange24h: pair.priceChange?.h24 || 0
      });

      console.log(`Processed ${token.symbol}:`, {
        price: currentPrice,
        price7dAvg: price7dAvg,
        volumeOnUpDay: volumeOnUpDay,
        priceChange24h: pair.priceChange?.h24
      });

      // Add delay between requests
      await new Promise(resolve => setTimeout(resolve, 1000));

    } catch (error) {
      console.warn(`Warning: Error processing ${token.symbol}:`, error);
      // Continue with next token
      continue;
    }
  }

  return tokenData;
}

async function updateAirtable(tokenData: TokenData[]) {
  const table = getTable('TOKENS');
  const createdAt = new Date().toISOString();
  
  console.log('\n📝 Creating new token snapshots...');
  
  for (const token of tokenData) {
    try {
      // Always create a new record with createdAt
      const fields = {
        name: token.symbol,           // Primary field
        description: token.name,
        mint: token.mint,
        isActive: token.isActive,
        volume7d: token.volume7d,
        liquidity: token.liquidity,
        volumeGrowth: token.volumeGrowth,
        pricePerformance: token.pricePerformance,
        holderCount: token.holderCount,
        price: token.price,
        price7dAvg: token.price7dAvg,
        volumeOnUpDay: token.volumeOnUpDay,
        priceChange24h: token.priceChange24h,
        createdAt: createdAt
      };

      // Create new record
      await table.create([{ fields }]);
      console.log(`✅ Created new snapshot for ${token.symbol}`);
      console.log(`   Price: $${token.price.toFixed(4)}`);
      console.log(`   7d Avg: $${token.price7dAvg.toFixed(4)}`);
      console.log(`   24h Change: ${token.priceChange24h.toFixed(2)}%`);
      console.log(`   Volume 7d: $${token.volume7d.toLocaleString()}`);
      console.log(`   Liquidity: $${token.liquidity.toLocaleString()}`);
      console.log(`   Volume on Up Day: ${token.volumeOnUpDay ? 'Yes' : 'No'}`);

    } catch (error) {
      console.error(`❌ Failed to create snapshot for ${token.symbol}:`, error);
      // Log more details about the error
      console.error('Error details:', {
        name: error instanceof Error ? error.name : 'Unknown',
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      // Continue with next token
      continue;
    }
  }

  console.log(`\n✨ Created ${tokenData.length} new token snapshots at ${createdAt}`);
}

async function main() {
  try {
    // Fetch token data
    const tokenData = await fetchTokenData();
    console.log('\nToken data fetched successfully');

    // Update Airtable
    await updateAirtable(tokenData);
    console.log('\nAirtable updated successfully');

    // Create CSV content
    const csvContent = [
      'symbol,description,mint,isActive,volume7d,liquidity,volumeGrowth,pricePerformance,holderCount',
      ...tokenData.map(token => 
        `${token.symbol},${token.description},${token.mint},${token.isActive},${token.volume7d},${token.liquidity},${token.volumeGrowth},${token.pricePerformance},${token.holderCount}`
      )
    ].join('\n');

    // Write to CSV file
    const filePath = path.join(process.cwd(), 'data', 'initial-tokens.csv');
    fs.writeFileSync(filePath, csvContent);
    console.log('\nToken data has been written to initial-tokens.csv');

    // Print summary
    console.log('\nToken Summary:');
    tokenData.forEach(token => {
      console.log(`\n${token.symbol}:`);
      console.log(`  Volume (7d): $${(token.volume7d).toLocaleString()}`);
      console.log(`  Liquidity: $${(token.liquidity).toLocaleString()}`);
      console.log(`  Holders: ${token.holderCount.toLocaleString()}`);
    });

  } catch (error) {
    console.error('Error in main:', error);
    // Exit with error code but after completing as much as possible
    process.exit(1);
  }
}

main();
