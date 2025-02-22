import { Connection, PublicKey } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { NextResponse } from 'next/server';

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
    // Force fresh data with commitment: 'confirmed'
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

    // Get prices for all tokens
    const mints = nonZeroBalances.map(b => b.mint);
    
    console.log('Fetching prices for mints:', mints);

    try {
      // Fetch prices using DexScreener API
      console.log('Fetching prices from DexScreener for mints:', mints);
        
      // Add timestamp to URL to prevent caching
      const timestamp = Date.now();
      const dexscreenerUrl = `${DEXSCREENER_API}/${mints.join(',')}?t=${timestamp}`;
      
      console.log('Fetching from DexScreener:', dexscreenerUrl);
      const pricesResponse = await fetch(dexscreenerUrl, {
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
        
      if (!pricesResponse.ok) {
        throw new Error(`Failed to fetch token prices: ${pricesResponse.status}`);
      }

      const pricesData = await pricesResponse.json();

      // Create price map from DexScreener response
      const priceMap: Record<string, number> = {};
      if (pricesData.pairs) {
        for (const pair of pricesData.pairs) {
          if (pair.baseToken) {
            priceMap[pair.baseToken.address] = Number(pair.priceUsd) || 0;
          }
        }
      }

      // Add USD values
      const balancesWithUSD = nonZeroBalances.map(balance => {
        const price = priceMap[balance.mint] || 0;
        const usdValue = balance.uiAmount * price;
          
        console.log(`Token ${balance.token || balance.mint}:`, {
          uiAmount: balance.uiAmount,
          price,
          usdValue
        });

        return {
          ...balance,
          usdValue
        };
      });

      console.log('Returning portfolio data');
      return NextResponse.json(balancesWithUSD, { headers });

    } catch (priceError) {
      console.error('Error fetching prices:', priceError);
      return NextResponse.json(nonZeroBalances.map(balance => ({
        ...balance,
        usdValue: 0
      })), { headers });
    }

  } catch (error) {
    console.error('Failed to fetch portfolio:', error);
    return NextResponse.json(
      { error: 'Failed to fetch portfolio data' },
      { status: 500, headers }
    );
  }
}
