export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { getTable } from '@/backend/src/airtable/tables';

interface TokenBalance {
  token: string;
  mint: string;
  amount: number;
  price: number;
  value: number;
  isLpPosition?: boolean;
  lpDetails?: {
    name: string;
    token0: string;
    token1: string;
    amount0: number;
    amount1: number;
    valueUSD: number;
    notes?: string;
  };
}

export async function GET() {
  console.log('Portfolio API called:', new Date().toISOString());
  
  const headers = {
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  };
  
  try {
    // Get the most recent wallet snapshot
    const snapshotsTable = getTable('WALLET_SNAPSHOTS');
    
    console.log('Fetching latest wallet snapshot...');
    const snapshots = await snapshotsTable
      .select({
        sort: [{ field: 'createdAt', direction: 'desc' }],
        maxRecords: 1
      })
      .firstPage();
    
    if (snapshots.length === 0) {
      return NextResponse.json(
        { error: 'No wallet snapshots found' },
        { status: 404, headers }
      );
    }
    
    const snapshot = snapshots[0];
    const holdingsJson = snapshot.get('holdings');
    
    // Parse holdings JSON
    let holdings: TokenBalance[] = [];
    try {
      holdings = JSON.parse(holdingsJson || '[]');
      console.log(`Parsed ${holdings.length} holdings from snapshot`);
    } catch (e) {
      console.error('Failed to parse holdings JSON:', e);
      return NextResponse.json(
        { error: 'Failed to parse holdings data' },
        { status: 500, headers }
      );
    }
    
    // Get token metadata from TOKENS table to fill in missing symbols
    const tokensTable = getTable('TOKENS');
    const tokenRecords = await tokensTable.select().all();
    
    // Create a map of mint address to token symbol
    const mintToSymbol: {[key: string]: string} = {};
    tokenRecords.forEach(record => {
      const mint = record.get('mint');
      const symbol = record.get('token');
      if (mint && symbol) {
        mintToSymbol[mint] = symbol;
      }
    });
    
    // Process holdings to create portfolio data
    const balances = holdings.map(holding => {
      // For LP positions, use the token name as is (it's already formatted as "LP: token0/token1")
      if (holding.isLpPosition) {
        return {
          token: holding.token,
          mint: holding.mint || 'LP_POSITION',
          amount: holding.amount,
          price: holding.price,
          usdValue: holding.value,
          isLpPosition: true,
          lpDetails: holding.lpDetails
        };
      }
      
      // For regular tokens, look up the symbol if it's "Unknown"
      let tokenSymbol = holding.token;
      if (tokenSymbol === 'Unknown' && mintToSymbol[holding.mint]) {
        tokenSymbol = mintToSymbol[holding.mint];
        console.log(`Found symbol for mint ${holding.mint}: ${tokenSymbol}`);
      }
      
      return {
        token: tokenSymbol,
        mint: holding.mint,
        amount: holding.amount,
        price: holding.price,
        usdValue: holding.value,
        decimals: 0, // Default value
        uiAmount: holding.amount // For compatibility with existing components
      };
    });
    
    // Calculate total value
    const totalValue = balances.reduce((sum, balance) => sum + (balance.usdValue || 0), 0);
    
    // Add portfolio percentages
    const balancesWithPercentages = balances.map(balance => ({
      ...balance,
      percentage: totalValue > 0 ? ((balance.usdValue || 0) / totalValue) * 100 : 0
    }));
    
    console.log('Portfolio Summary:', {
      totalValue,
      balances: balancesWithPercentages.map(b => ({
        token: b.token,
        amount: b.amount,
        price: b.price,
        usdValue: b.usdValue,
        percentage: b.percentage,
        isLpPosition: b.isLpPosition || false
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
