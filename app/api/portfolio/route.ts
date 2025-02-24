import { Connection, PublicKey } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { NextResponse } from 'next/server';
import { getTable } from '@/backend/src/airtable/tables';
import type { Record } from 'airtable';

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
    
    return records.reduce((acc, record) => {
      const fields = record.fields;
      acc[fields.mint] = {
        name: fields.name || fields.token,
        token: fields.token,
        image: fields.image,
        mint: fields.mint
      };
      return acc;
    }, {} as Record<string, {name: string; token: string; image: string; mint: string}>);
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
    const balances: TokenBalance[] = tokenAccounts.value.map(account => {
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
        filterByFormula: "IS_AFTER({createdAt}, DATEADD(NOW(), -1, 'hours'))"
      })
      .all();

    // Create price map from snapshots
    const priceMap: Record<string, number> = {};
    for (const record of snapshotRecords) {
      const token = record.get('token');
      const mint = record.get('mint');
      if (mint && !priceMap[mint]) {  // Only keep first (most recent) price
        priceMap[mint] = record.get('price') || 0;
      }
    }

    // Fetch tokens metadata
    const tokensMetadata = await getTokensMetadata();
    console.log('Tokens metadata loaded:', Object.keys(tokensMetadata).length, 'tokens');

    // Add USD values and metadata
    const balancesWithUSD = await Promise.all(nonZeroBalances.map(async balance => {
      let price = 0;
      
      // Check if it's a known token first
      const knownToken = Object.values(KNOWN_TOKENS).find(t => t.mint === balance.mint);
      if (knownToken) {
        price = knownToken.price;
      } else {
        // Get price from snapshots
        price = priceMap[balance.mint] || 0;
      
        // If no price in snapshots, try Jupiter as fallback
        if (price === 0) {
          console.log(`Attempting Jupiter fallback for ${balance.token || balance.mint}`);
          price = await getJupiterPrice(balance.mint);
        }
      }

      const usdValue = balance.uiAmount * price;
      
      // Get metadata from our tokens table
      const metadata = tokensMetadata[balance.mint] || {
        name: balance.token || balance.mint,
        token: balance.token || balance.mint,
        image: '',
        mint: balance.mint
      };

      console.log(`Token ${metadata.token}:`, {
        uiAmount: balance.uiAmount,
        price,
        usdValue,
        isStablecoin: !!knownToken,
        source: knownToken ? 'fixed' : (price === priceMap[balance.mint] ? 'snapshot' : 'jupiter'),
        metadata
      });

      return {
        ...balance,
        usdValue,
        price,
        name: metadata.name,
        token: metadata.token,
        imageUrl: metadata.image,
        mint: balance.mint
      };
    }));

    console.log('Returning portfolio data');
    return NextResponse.json(balancesWithUSD, { headers });

  } catch (error) {
    console.error('Failed to fetch portfolio:', error);
    return NextResponse.json(
      { error: 'Failed to fetch portfolio data' },
      { status: 500, headers }
    );
  }
}
