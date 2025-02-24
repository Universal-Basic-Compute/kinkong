import { Connection, PublicKey } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { NextResponse } from 'next/server';
import { getTable } from '@/backend/src/airtable/tables';
import type { Record, FieldSet } from 'airtable';

// Define interfaces for our record types
interface TokenMetadata {
  name: string;
  token: string;
  image: string;
  mint: string;
}

interface TokenBalance {
  mint: string;
  amount: number;
  decimals: number;
  uiAmount: number;
  token?: string;
  usdValue?: number;
  price?: number;
  name?: string;
  imageUrl?: string;
  percentage?: number;
}

const KNOWN_TOKENS = {
  USDC: {
    mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    price: 1.00
  },
  USDT: {
    mint: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", 
    price: 1.00
  }
};

async function getTokenSymbol(mint: string, tokensMetadata: any): Promise<string> {
  // Check known tokens first
  const knownToken = Object.entries(KNOWN_TOKENS).find(([_, data]) => data.mint === mint);
  if (knownToken) {
    return knownToken[0]; // Return the symbol (key) of the known token
  }

  // Check our metadata
  if (tokensMetadata[mint]) {
    return tokensMetadata[mint].token || 'Unknown';
  }

  // If we still don't have a symbol, try to get it from our TOKENS table
  try {
    const tokensTable = getTable('TOKENS');
    const records = await tokensTable.select({
      filterByFormula: `{mint}='${mint}'`
    }).firstPage();

    if (records && records.length > 0) {
      return records[0].get('token') || 'Unknown';
    }
  } catch (e) {
    console.error(`Error fetching token symbol for mint ${mint}:`, e);
  }

  return 'Unknown';
}

async function getTokensMetadata() {
  try {
    const tokensTable = getTable('TOKENS');
    const records = await tokensTable.select().all();
    
    return records.reduce((acc, record: Record<FieldSet>) => {
      const fields = record.fields;
      acc[fields.mint] = {
        name: fields.name || fields.token,
        token: fields.token,
        image: fields.image,
        mint: fields.mint
      };
      return acc;
    }, {} as Record<string, TokenMetadata>);
  } catch (error) {
    console.error('Failed to fetch tokens metadata:', error);
    return {};
  }
}

async function getJupiterPrice(mint: string): Promise<number> {
  try {
    const response = await fetch(`https://price.jup.ag/v4/price?ids=${mint}`);
    if (!response.ok) return 0;
    const data = await response.json();
    return data.data[mint]?.price || 0;
  } catch (e) {
    console.error('Jupiter price fetch failed:', e);
    return 0;
  }
}

const TREASURY_WALLET = new PublicKey('FnWyN4t1aoZWFjEEBxopMaAgk5hjL5P3K65oc2T9FBJY');
const DEXSCREENER_API = 'https://api.dexscreener.com/latest/dex/tokens';

interface TokenBalance {
  mint: string;
  amount: number;
  decimals: number;
  uiAmount: number;
  token?: string;
  usdValue?: number;
}

export async function GET() {
  console.log('Portfolio API called:', new Date().toISOString());
  
  const headers = {
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  };
  
  try {
    if (!process.env.NEXT_PUBLIC_HELIUS_RPC_URL) {
      throw new Error('RPC URL not configured');
    }

    console.log('Creating RPC connection...');
    const connection = new Connection(process.env.NEXT_PUBLIC_HELIUS_RPC_URL, {
      commitment: 'confirmed',
      confirmTransactionInitialTimeout: 60000
    });

    console.log('Fetching token accounts...');
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
      TREASURY_WALLET,
      { programId: TOKEN_PROGRAM_ID }
    );

    console.log(`Found ${tokenAccounts.value.length} token accounts`);

    // Format balances
    const balances: TokenBalance[] = tokenAccounts.value.map((account: any) => {
      const parsedInfo = account.account.data.parsed.info;
      return {
        mint: parsedInfo.mint,
        amount: parsedInfo.tokenAmount.amount,
        decimals: parsedInfo.tokenAmount.decimals,
        uiAmount: parsedInfo.tokenAmount.uiAmount,
        token: parsedInfo.token || undefined
      };
    });

    // Filter non-zero balances
    const nonZeroBalances = balances.filter(b => b.uiAmount > 0);
    const mints = nonZeroBalances.map(b => b.mint);

    // Get latest snapshots from TOKEN_SNAPSHOTS
    const snapshotsTable = getTable('TOKEN_SNAPSHOTS');
    const snapshotRecords = await snapshotsTable
      .select({
        sort: [{ field: 'createdAt', direction: 'desc' }],
        filterByFormula: "IS_AFTER({createdAt}, DATEADD(NOW(), -12, 'hours'))"  // Changed from -1 to -12 hours
      })
      .all();

    // Create price map from snapshots using mint addresses
    const priceMap: Record<string, number> = {};
    for (const record of snapshotRecords) {
      const token = record.get('token');
      const mint = record.get('mint');
      // Only store if we don't have this token yet (since records are sorted by date desc)
      if (mint && !priceMap[mint]) {
        priceMap[mint] = record.get('price') || 0;
      }
    }

    // Add debug logging for snapshot data
    console.log('Snapshot data loaded:', {
      recordsFound: snapshotRecords.length,
      uniquePrices: Object.keys(priceMap).length,
      timeWindow: '12 hours'
    });

    // Fetch tokens metadata
    const tokensMetadata = await getTokensMetadata();
    console.log('Tokens metadata loaded:', Object.keys(tokensMetadata).length, 'tokens');

    // Add USD values and metadata
    const balancesWithUSD = await Promise.all(nonZeroBalances.map(async (balance: TokenBalance) => {
      let price = 0;
      
      // Check if it's a known stablecoin first
      const knownToken = Object.values(KNOWN_TOKENS).find(t => t.mint === balance.mint);
      if (knownToken) {
        price = knownToken.price;
      } else {
        // Get price from snapshots using mint address
        price = priceMap[balance.mint] || 0;
      
        // If no price in snapshots, try Jupiter as fallback
        if (price === 0) {
          console.log(`Attempting Jupiter fallback for ${balance.token || balance.mint}`);
          price = await getJupiterPrice(balance.mint);
        }
      }

      // Add debug logging
      console.log('Price calculation:', {
        mint: balance.mint,
        uiAmount: balance.uiAmount,
        knownToken: !!knownToken,
        snapshotPrice: priceMap[balance.mint],
        finalPrice: price
      });

      // Calculate USD value using uiAmount (which is already adjusted for decimals)
      const usdValue = balance.uiAmount * price;
      
      // Get token symbol and metadata
      const tokenSymbol = await getTokenSymbol(balance.mint, tokensMetadata);
      const metadata = tokensMetadata[balance.mint] || {
        name: tokenSymbol,
        token: tokenSymbol,
        image: '',
        mint: balance.mint
      };

      return {
        ...balance,
        usdValue,
        price,
        name: metadata.name,
        token: tokenSymbol,
        imageUrl: metadata.image,
        mint: balance.mint
      };
    }));

    // Calculate total portfolio value
    const totalValue = balancesWithUSD.reduce((sum, b) => sum + (b.usdValue || 0), 0);

    // Add portfolio percentages
    const balancesWithPercentages = balancesWithUSD.map(balance => ({
      ...balance,
      percentage: totalValue > 0 ? ((balance.usdValue || 0) / totalValue) * 100 : 0
    }));

    console.log('Portfolio Summary:', {
      totalValue,
      balances: balancesWithPercentages.map(b => ({
        token: b.token,
        amount: b.uiAmount,
        price: b.price,
        usdValue: b.usdValue,
        percentage: b.percentage
      }))
    });

    return NextResponse.json(balancesWithPercentages, { headers });

  } catch (error) {
    console.error('Failed to fetch portfolio:', error);
    return NextResponse.json(
      { error: 'Failed to fetch portfolio data' },
      { status: 500, headers }
    );
  }
}
