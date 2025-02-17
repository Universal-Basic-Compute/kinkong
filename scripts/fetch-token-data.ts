import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const BIRDEYE_API_KEY = process.env.BIRDEYE_API_KEY;
const TOKENS = [
  {
    symbol: 'COMPUTE',
    mint: 'B1N1HcMm4RysYz4smsXwmk2UnS8NziqKCM6Ho8i62vXo'
  },
  {
    symbol: 'UBC',
    mint: '9psiRdn9cXYVps4F1kFuoNjd2EtmqNJXrCPmRppJpump'
  },
  {
    symbol: 'BOME',
    mint: '5gPYkwzk4nc1uqV8V4RNxN6iLg8UrLqtkxN5BvPBgQ1'
  },
  {
    symbol: 'MYRO',
    mint: 'MYRoXwQVRnAMrwUiKHFbdmSpZoaT9xtL9pqQyKKWMZN'
  }
];

interface TokenData {
  symbol: string;
  mint: string;
  isActive: boolean;
  volume7d: number;
  liquidity: number;
  volumeGrowth: number;
  pricePerformance: number;
  holderCount: number;
}

async function getBirdeyeData(mint: string) {
  const response = await fetch(`https://public-api.birdeye.so/public/token_list/token_meta?address=${mint}`, {
    headers: {
      'X-API-KEY': BIRDEYE_API_KEY!
    }
  });
  return await response.json();
}

async function getJupiterData(mint: string) {
  const response = await fetch(`https://price.jup.ag/v4/price?ids=${mint}`);
  return await response.json();
}

async function fetchTokenData(): Promise<TokenData[]> {
  const tokenData: TokenData[] = [];

  for (const token of TOKENS) {
    try {
      console.log(`Fetching data for ${token.symbol}...`);
      
      // Get Birdeye data
      const birdeyeData = await getBirdeyeData(token.mint);
      
      // Get Jupiter data
      const jupiterData = await getJupiterData(token.mint);

      // Calculate 7-day metrics
      const volume7d = birdeyeData.volume24h * 7; // Estimate based on 24h volume
      const volumeGrowth = Math.random() * 50; // TODO: Calculate actual growth
      const pricePerformance = Math.random() * 30; // TODO: Calculate actual performance

      tokenData.push({
        symbol: token.symbol,
        mint: token.mint,
        isActive: true,
        volume7d,
        liquidity: jupiterData.data[token.mint]?.liquidity || 0,
        volumeGrowth,
        pricePerformance,
        holderCount: birdeyeData.holder || 0
      });

      // Add delay between requests
      await new Promise(resolve => setTimeout(resolve, 1000));

    } catch (error) {
      console.error(`Error fetching data for ${token.symbol}:`, error);
    }
  }

  return tokenData;
}

async function main() {
  try {
    // Fetch token data
    const tokenData = await fetchTokenData();

    // Create CSV content
    const csvContent = [
      'symbol,mint,isActive,volume7d,liquidity,volumeGrowth,pricePerformance,holderCount',
      ...tokenData.map(token => 
        `${token.symbol},${token.mint},${token.isActive},${token.volume7d},${token.liquidity},${token.volumeGrowth},${token.pricePerformance},${token.holderCount}`
      )
    ].join('\n');

    // Write to CSV file
    const filePath = path.join(process.cwd(), 'data', 'initial-tokens.csv');
    fs.writeFileSync(filePath, csvContent);

    console.log('Token data has been written to initial-tokens.csv');
    console.log('\nToken Summary:');
    tokenData.forEach(token => {
      console.log(`\n${token.symbol}:`);
      console.log(`  Volume (7d): $${(token.volume7d).toLocaleString()}`);
      console.log(`  Liquidity: $${(token.liquidity).toLocaleString()}`);
      console.log(`  Holders: ${token.holderCount.toLocaleString()}`);
    });

  } catch (error) {
    console.error('Error in main:', error);
  }
}

main();
