import { Connection, PublicKey } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { NextResponse } from 'next/server';
import { getTable } from '@/backend/src/airtable/tables';
import type { Record, FieldSet } from 'airtable';

// Global price cache to avoid duplicate API calls
let priceMap: { [key: string]: number } = {};

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
      const token = records[0].get('token');
      if (token) {
        console.log(`Found token symbol for ${mint} in TOKENS table: ${token}`);
        return token;
      }
    }
  } catch (e) {
    console.error(`Error fetching token symbol for mint ${mint}:`, e);
  }

  console.log(`Could not find token symbol for mint ${mint}, using 'Unknown'`);
  return 'Unknown';
}

interface TokenFields extends FieldSet {
  name: string;
  token: string;
  image: string;
  mint: string;
}

async function getTokensMetadata() {
  try {
    const tokensTable = getTable('TOKENS');
    const records = await tokensTable.select().all();
    
    return records.reduce((acc, record: Record<TokenFields>) => {
      const fields = record.fields;
      acc[fields.mint] = {
        name: fields.name || fields.token,
        token: fields.token,
        image: fields.image,
        mint: fields.mint
      };
      return acc;
    }, {} as { [key: string]: TokenMetadata });
  } catch (error) {
    console.error('Failed to fetch tokens metadata:', error);
    return {};
  }
}

async function getTokenPrice(mint: string): Promise<number> {
  console.log(`Getting price for token ${mint}`);
  
  // Check cache first
  if (priceMap[mint] && priceMap[mint] > 0) {
    console.log(`Using cached price for ${mint}: ${priceMap[mint]}`);
    return priceMap[mint];
  }
  
  // Try known tokens first (fastest)
  const knownToken = Object.values(KNOWN_TOKENS).find(t => t.mint === mint);
  if (knownToken) {
    console.log(`Using known token price for ${mint}: ${knownToken.price}`);
    priceMap[mint] = knownToken.price;
    return knownToken.price;
  }
  
  // Try Jupiter API
  try {
    const jupiterPrice = await getJupiterPrice(mint);
    if (jupiterPrice > 0) {
      console.log(`Using Jupiter price for ${mint}: ${jupiterPrice}`);
      priceMap[mint] = jupiterPrice;
      return jupiterPrice;
    }
  } catch (error) {
    console.error(`Jupiter price fetch failed for ${mint}:`, error);
  }
  
  // Try Birdeye API
  try {
    const birdeyePrice = await getBirdeyePrice(mint);
    if (birdeyePrice > 0) {
      console.log(`Using Birdeye price for ${mint}: ${birdeyePrice}`);
      priceMap[mint] = birdeyePrice;
      return birdeyePrice;
    }
  } catch (error) {
    console.error(`Birdeye price fetch failed for ${mint}:`, error);
  }
  
  // Try DexScreener API as a last resort
  try {
    console.log(`Fetching DexScreener price for ${mint}`);
    const response = await fetch(`${DEXSCREENER_API}/${mint}`);
    if (response.ok) {
      const data = await response.json();
      if (data.pairs && data.pairs.length > 0) {
        // Use the first pair with USDC or USDT as quote token
        const usdPair = data.pairs.find(p => 
          p.quoteToken?.symbol === 'USDC' || 
          p.quoteToken?.symbol === 'USDT'
        );
        
        if (usdPair && usdPair.priceUsd) {
          const price = parseFloat(usdPair.priceUsd);
          console.log(`Using DexScreener price for ${mint}: ${price}`);
          priceMap[mint] = price;
          return price;
        }
      }
    }
  } catch (error) {
    console.error(`DexScreener price fetch failed for ${mint}:`, error);
  }
  
  console.log(`No price found for ${mint} from any source`);
  return 0;
}

async function getJupiterPrice(mint: string): Promise<number> {
  try {
    console.log(`Fetching Jupiter price for ${mint}`);
    const response = await fetch(`https://price.jup.ag/v4/price?ids=${mint}`);
    
    if (!response.ok) {
      console.log(`Jupiter API returned status ${response.status}`);
      return 0;
    }
    
    const data = await response.json();
    console.log(`Jupiter price data for ${mint}:`, data);
    
    if (data.data && data.data[mint] && data.data[mint].price) {
      console.log(`Jupiter price for ${mint}: ${data.data[mint].price}`);
      return data.data[mint].price;
    } else {
      console.log(`Jupiter returned no price data for ${mint}`);
      return 0;
    }
  } catch (e) {
    console.error(`Jupiter price fetch failed for ${mint}:`, e);
    return 0;
  }
}

async function getBirdeyePrice(mint: string): Promise<number> {
  try {
    console.log(`Fetching Birdeye price for ${mint}`);
    
    if (!process.env.BIRDEYE_API_KEY) {
      console.log('BIRDEYE_API_KEY not configured, skipping Birdeye price fetch');
      return 0;
    }
    
    const response = await fetch(`https://public-api.birdeye.so/public/price?address=${mint}`, {
      headers: {
        'X-API-KEY': process.env.BIRDEYE_API_KEY
      }
    });
    
    if (!response.ok) {
      console.log(`Birdeye API returned status ${response.status}`);
      return 0;
    }
    
    const data = await response.json();
    console.log(`Birdeye price data for ${mint}:`, data);
    
    if (data.success && data.data && data.data.value) {
      console.log(`Birdeye price for ${mint}: ${data.data.value}`);
      return data.data.value;
    } else {
      console.log(`Birdeye returned no price data for ${mint}`);
      return 0;
    }
  } catch (e) {
    console.error(`Birdeye price fetch failed for ${mint}:`, e);
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
    console.log('Fetching token snapshots...');

    // First, get all active tokens from the TOKENS table
    const tokensTable = getTable('TOKENS');
    const tokenRecords = await tokensTable.select({
      filterByFormula: '{isActive}=1'
    }).all();

    const activeTokens = tokenRecords.map(record => ({
      mint: record.get('mint') as string,
      token: record.get('token') as string
    }));

    console.log(`Found ${activeTokens.length} active tokens`);

    // Create a map of mint addresses to token symbols
    const mintToTokenMap = activeTokens.reduce((acc, token) => {
      acc[token.mint] = token.token;
      return acc;
    }, {} as Record<string, string>);

    // For each active token, get the latest snapshot
    const priceMap: { [key: string]: number } = {};
    for (const token of activeTokens) {
      try {
        console.log(`Fetching latest snapshot for ${token.token} (${token.mint})`);
        const snapshots = await snapshotsTable.select({
          filterByFormula: `{mint}='${token.mint}'`,
          sort: [{ field: 'createdAt', direction: 'desc' }],
          maxRecords: 1
        }).all();
        
        if (snapshots.length > 0) {
          const price = snapshots[0].get('price');
          if (price) {
            priceMap[token.mint] = price;
            console.log(`Found price for ${token.token} (${token.mint}): $${price}`);
          } else {
            console.log(`No price found in snapshot for ${token.token} (${token.mint})`);
          }
        } else {
          console.log(`No snapshots found for ${token.token} (${token.mint})`);
        }
      } catch (error) {
        console.error(`Error fetching price for ${token.token}:`, error);
      }
    }

    console.log(`Loaded prices for ${Object.keys(priceMap).length} tokens`);

    // Fetch tokens metadata
    const tokensMetadata = await getTokensMetadata();
    console.log('Tokens metadata loaded:', Object.keys(tokensMetadata).length, 'tokens');

    // Add USD values and metadata
    const balancesWithUSD = await Promise.all(nonZeroBalances.map(async (balance: TokenBalance) => {
      // Add debug logging
      console.log('Processing token:', {
        mint: balance.mint,
        token: balance.token || mintToTokenMap[balance.mint] || 'Unknown',
        uiAmount: balance.uiAmount
      });

      // Get price from our comprehensive price function
      const price = await getTokenPrice(balance.mint);
      
      // Calculate USD value using uiAmount (which is already adjusted for decimals)
      const usdValue = balance.uiAmount * price;
      console.log(`Calculated USD value for ${balance.mint}: ${usdValue} (${balance.uiAmount} * ${price})`);
      
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
