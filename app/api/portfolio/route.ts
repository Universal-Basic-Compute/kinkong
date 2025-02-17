import { Connection, PublicKey } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { NextResponse } from 'next/server';
import { getTokenPrices } from '@/backend/src/utils/jupiter';

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
    
    // Log the mints we're fetching prices for
    console.log('Fetching prices for mints:', mints);

    // Fetch prices using Jupiter API directly
    const pricesResponse = await fetch('https://price.jup.ag/v4/price', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ids: mints,
        vsToken: 'USDC'
      })
    });

    if (!pricesResponse.ok) {
      throw new Error('Failed to fetch token prices');
    }

    const pricesData = await pricesResponse.json();
    console.log('Received price data:', pricesData);

    // Add USD values
    const balancesWithUSD = nonZeroBalances.map(balance => {
      const price = pricesData.data[balance.mint]?.price || 0;
      const usdValue = balance.uiAmount * price;
      console.log(`Token ${balance.symbol || balance.mint}: Price=${price}, USD Value=${usdValue}`);
      
      return {
        ...balance,
        usdValue
      };
    });

    return NextResponse.json(balancesWithUSD);
  } catch (error) {
    console.error('Failed to fetch portfolio:', error);
    return NextResponse.json(
      { error: 'Failed to fetch portfolio data' },
      { status: 500 }
    );
  }
}
