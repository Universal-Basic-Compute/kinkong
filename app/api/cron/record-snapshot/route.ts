import { NextResponse } from 'next/server';
import { Connection, PublicKey } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { getTable } from '@/backend/src/airtable/tables';

const TREASURY_WALLET = new PublicKey('FnWyN4t1aoZWFjEEBxopMaAgk5hjL5P3K65oc2T9FBJY');

export async function GET(req: Request) {
  try {
    console.log('🤖 Starting portfolio snapshot recording...');
    
    // Log environment variables (without exposing values)
    console.log('🔑 Environment check:', {
      hasApiKey: !!process.env.KINKONG_AIRTABLE_API_KEY,
      hasBaseId: !!process.env.KINKONG_AIRTABLE_BASE_ID,
      hasRpc: !!process.env.NEXT_PUBLIC_HELIUS_RPC_URL
    });

    if (!process.env.NEXT_PUBLIC_HELIUS_RPC_URL) {
      throw new Error('RPC URL not configured');
    }

    const connection = new Connection(process.env.NEXT_PUBLIC_HELIUS_RPC_URL);

    // Get token accounts
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
      TREASURY_WALLET,
      { programId: TOKEN_PROGRAM_ID }
    );

    // Format holdings
    const holdings = tokenAccounts.value.map(account => {
      const parsedInfo = account.account.data.parsed.info;
      return {
        mint: parsedInfo.mint,
        amount: parsedInfo.tokenAmount.uiAmount,
        decimals: parsedInfo.tokenAmount.decimals
      };
    }).filter(h => h.amount > 0);

    // Get token prices from DexScreener
    const mints = holdings.map(h => h.mint);
    const pricesResponse = await fetch(
      `https://api.dexscreener.com/latest/dex/tokens/${mints.join(',')}`
    );
    
    if (!pricesResponse.ok) {
      throw new Error(`Failed to fetch token prices: ${pricesResponse.status}`);
    }

    const pricesData = await pricesResponse.json();
    const priceMap: Record<string, number> = {};
    
    if (pricesData.pairs) {
      for (const pair of pricesData.pairs) {
        if (pair.baseToken) {
          priceMap[pair.baseToken.address] = Number(pair.priceUsd) || 0;
        }
      }
    }

    // Calculate values and prepare snapshot
    const timestamp = new Date().toISOString();
    let totalValue = 0;
    const formattedHoldings = holdings.map(holding => {
      const price = priceMap[holding.mint] || 0;
      const value = holding.amount * price;
      totalValue += value;

      return {
        token: holding.mint,
        amount: holding.amount,
        price,
        value
      };
    });

    // Get tables
    const portfolioTable = getTable('PORTFOLIO');
    const snapshotsTable = getTable('PORTFOLIO_SNAPSHOTS');

    // Update current portfolio
    for (const holding of formattedHoldings) {
      await portfolioTable.update(holding.token, {
        amount: holding.amount,
        price: holding.price,
        value: holding.value,
        lastUpdate: timestamp
      });
    }

    // Create snapshot
    await snapshotsTable.create([{
      fields: {
        timestamp,
        totalValue,
        holdings: JSON.stringify(formattedHoldings)
      }
    }]);

    console.log('✅ Portfolio snapshot recorded:', {
      timestamp,
      totalValue,
      holdingsCount: formattedHoldings.length
    });

    return NextResponse.json({
      success: true,
      timestamp,
      totalValue,
      holdingsCount: formattedHoldings.length
    });

  } catch (error) {
    console.error('❌ Failed to record portfolio snapshot:', error);
    return NextResponse.json(
      { error: 'Failed to record portfolio snapshot' },
      { status: 500 }
    );
  }
}
