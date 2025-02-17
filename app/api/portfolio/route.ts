import { Connection, PublicKey } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { NextResponse } from 'next/server';
import { getTokenPrices } from '@/backend/src/utils/jupiter';

import { getTable } from '../airtable/tables';

const DEXSCREENER_API = 'https://api.dexscreener.com/latest/dex/tokens';

const TREASURY_WALLET = new PublicKey('FnWyN4t1aoZWFjEEBxopMaAgk5hjL5P3K65oc2T9FBJY');

interface TokenBalance {
  mint: string;
  amount: number;
  decimals: number;
  uiAmount: number;
  symbol?: string;
  usdValue?: number;
}

export async function GET() {
  try {
    if (!process.env.NEXT_PUBLIC_HELIUS_RPC_URL) {
      throw new Error('RPC URL not configured');
    }

    const connection = new Connection(process.env.NEXT_PUBLIC_HELIUS_RPC_URL);

    // Get all token accounts
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
      TREASURY_WALLET,
      { programId: TOKEN_PROGRAM_ID }
    );

    // Format balances
    const balances: TokenBalance[] = tokenAccounts.value.map(account => {
      const parsedInfo = account.account.data.parsed.info;
      return {
        mint: parsedInfo.mint,
        amount: parsedInfo.tokenAmount.amount,
        decimals: parsedInfo.tokenAmount.decimals,
        uiAmount: parsedInfo.tokenAmount.uiAmount,
        symbol: parsedInfo.symbol || undefined
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
        
      const pricesResponse = await fetch(`${DEXSCREENER_API}/${mints.join(',')}`);
        
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
          
        console.log(`Token ${balance.symbol || balance.mint}:`, {
          uiAmount: balance.uiAmount,
          price,
          usdValue
        });

        return {
          ...balance,
          usdValue
        };
      });

      return NextResponse.json(balancesWithUSD);
    } catch (priceError) {
      console.error('Error fetching prices:', priceError);
      // Return the balances without USD values instead of throwing
      return NextResponse.json(nonZeroBalances.map(balance => ({
        ...balance,
        usdValue: 0
      })));
    }
  } catch (error) {
    console.error('Failed to fetch portfolio:', error);
    return NextResponse.json(
      { error: 'Failed to fetch portfolio data' },
      { status: 500 }
    );
  }
}
