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
    description: 'Virtual Protocol',
    mint: 'NETH'
  },
  {
    symbol: 'AI16Z',
    description: 'ai16z',
    mint: 'SOL'
  },
  {
    symbol: 'FARTCOIN',
    description: 'Fartcoin',
    mint: 'SOL'
  },
  {
    symbol: 'AIXBT',
    description: 'aixbt by Virtuals',
    mint: 'USDC'
  },
  {
    symbol: 'GRIFFAIN',
    description: 'test griffain.com',
    mint: 'SOL'
  },
  {
    symbol: 'GOAT',
    description: 'Goatseus Maximus',
    mint: 'SOL'
  },
  {
    symbol: 'ARC',
    description: 'AI Rig Complex',
    mint: 'SOL'
  },
  {
    symbol: 'ZEREBRO',
    description: 'zerebro',
    mint: 'SOL'
  },
  {
    symbol: 'GAME',
    description: 'GAME by Virtuals',
    mint: 'VIRTUAL'
  },
  {
    symbol: 'ALCH',
    description: 'Alchemist AI',
    mint: 'SOL'
  },
  {
    symbol: 'HAT',
    description: 'TOP HAT',
    mint: 'SOL'
  },
  {
    symbol: 'AKA',
    description: 'She Rises',
    mint: 'SOL'
  }
];

interface TokenData extends FieldSet {
  symbol: string;
  description: string;
  mint: string;
  isActive: boolean;
  volume7d: number;
  liquidity: number;
  volumeGrowth: number;
  pricePerformance: number;
  holderCount: number;
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
      
      // Only use actual data from DexScreener, no defaults
      tokenData.push({
        symbol: token.symbol,        // This will go in 'name' field
        description: token.description, // This will go in 'description' field
        mint: token.mint,           // Actual mint address
        isActive: true,
        volume7d: pair?.volume?.h24 ? pair.volume.h24 * 7 : 0,
        liquidity: pair?.liquidity?.usd || 0,
        volumeGrowth: pair?.priceChange?.h24 || 0,
        pricePerformance: pair?.priceChange?.h24 || 0,
        holderCount: 0  // Don't set a default
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
  
  for (const token of tokenData) {
    try {
      // Check if token exists using symbol as the name field
      const records = await table.select({
        filterByFormula: `{name} = '${token.symbol}'`
      }).firstPage();

      const fields = {
        name: token.symbol,           // Primary field
        description: token.description,
        mint: token.mint,
        isActive: token.isActive,
        volume7d: token.volume7d,
        liquidity: token.liquidity,
        volumeGrowth: token.volumeGrowth,
        pricePerformance: token.pricePerformance,
        holderCount: token.holderCount
      };

      if (records.length > 0) {
        // Update existing record
        await table.update([{
          id: records[0].id,
          fields
        }]);
        console.log(`Updated ${token.symbol} in Airtable`);
      } else {
        // Create new record
        await table.create([{ fields }]);
        console.log(`Created ${token.symbol} in Airtable`);
      }
    } catch (error) {
      console.warn(`Warning: Failed to update Airtable for ${token.symbol}:`, error);
      // Log more details about the error
      console.warn('Error details:', {
        name: error instanceof Error ? error.name : 'Unknown',
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      // Continue with next token
      continue;
    }
  }
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
