import { getTable } from '../airtable/tables';
import { getCurrentPortfolio } from './portfolio';
import { getTokenPrices } from '../utils/jupiter';

interface TokenSnapshot {
  token: string;
  mint: string;
  timestamp: string;
  price: number;
  price7dAvg: number;
  volume24h: number;
  volumeOnUpDay: boolean;
  liquidity: number;
  priceChange24h: number;
  isActive: boolean;
}

export async function recordPortfolioSnapshot() {
  try {
    console.log('Starting portfolio snapshot recording...');
    
    // Get current portfolio
    console.log('Fetching current portfolio...');
    const portfolio = await getCurrentPortfolio();
    console.log('Current portfolio:', portfolio);
    
    // Get token prices and metrics
    console.log('Fetching token data...');
    const tokens = await getTable('TOKENS').select({
      filterByFormula: '{isActive} = 1'
    }).all();

    // Current timestamp
    const timestamp = new Date().toISOString();

    // Create snapshots for each token
    const snapshots: TokenSnapshot[] = [];
    for (const token of tokens) {
      try {
        // Get DexScreener data for current metrics
        const dexScreenerData = await getDexScreenerData(token.get('mint') as string);
        const pair = dexScreenerData.pairs?.[0];

        // Get historical price data for 7d average
        const historicalPrices = await getHistoricalPrices(token.get('mint') as string);
        const price7dAvg = calculatePriceAverage(historicalPrices);

        // Create snapshot
        const snapshot: TokenSnapshot = {
          token: token.get('symbol') as string,
          mint: token.get('mint') as string,
          timestamp,
          price: Number(pair?.priceUsd || 0),
          price7dAvg,
          volume24h: pair?.volume?.h24 || 0,
          volumeOnUpDay: (pair?.priceChange?.h24 || 0) > 0,
          liquidity: pair?.liquidity?.usd || 0,
          priceChange24h: pair?.priceChange?.h24 || 0,
          isActive: true
        };

        snapshots.push(snapshot);
      } catch (error) {
        console.error(`Error processing snapshot for ${token.get('symbol')}:`, error);
      }
    }

    // Save snapshots to Airtable
    const snapshotsTable = getTable('TOKEN_SNAPSHOTS');
    for (const snapshot of snapshots) {
      try {
        await snapshotsTable.create([{
          fields: {
            token: snapshot.token,
            mint: snapshot.mint,
            timestamp: snapshot.timestamp,
            price: snapshot.price,
            price7dAvg: snapshot.price7dAvg,
            volume24h: snapshot.volume24h,
            volumeOnUpDay: snapshot.volumeOnUpDay,
            liquidity: snapshot.liquidity,
            priceChange24h: snapshot.priceChange24h,
            isActive: snapshot.isActive
          }
        }]);
        console.log(`Created snapshot for ${snapshot.token}`);
      } catch (error) {
        console.error(`Error saving snapshot for ${snapshot.token}:`, error);
      }
    }

    // Calculate and store portfolio value
    const totalValue = portfolio.reduce((sum, holding) => {
      const tokenSnapshot = snapshots.find(s => s.token === holding.token);
      return sum + (holding.allocation * (tokenSnapshot?.price || 0));
    }, 0);

    // Save portfolio snapshot
    const portfolioSnapshotsTable = getTable('PORTFOLIO_SNAPSHOTS');
    await portfolioSnapshotsTable.create([{
      fields: {
        timestamp,
        totalValue,
        holdingsJson: JSON.stringify(portfolio.map(holding => {
          const tokenSnapshot = snapshots.find(s => s.token === holding.token);
          return {
            token: holding.token,
            amount: holding.allocation,
            price: tokenSnapshot?.price || 0,
            value: holding.allocation * (tokenSnapshot?.price || 0)
          };
        }))
      }
    }]);

    console.log('Successfully recorded all snapshots');
    return { totalValue, snapshots };

  } catch (error) {
    console.error('Failed to record portfolio snapshot:', error);
    throw error;
  }
}

// Helper function to get historical prices (implement based on your data source)
async function getHistoricalPrices(mint: string): Promise<number[]> {
  // TODO: Implement historical price fetching from your preferred source
  // This should return an array of prices for the last 7 days
  return [];
}

// Helper function to calculate average price
function calculatePriceAverage(prices: number[]): number {
  if (prices.length === 0) return 0;
  return prices.reduce((sum, price) => sum + price, 0) / prices.length;
}

// Helper function to get DexScreener data (already defined in your token fetching script)
async function getDexScreenerData(mint: string, retries = 3) {
  const DEXSCREENER_API = 'https://api.dexscreener.com/latest/dex/tokens';
  
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(`${DEXSCREENER_API}/${mint}`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
    }
  }
  return {};
}
