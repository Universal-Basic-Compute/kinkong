import { NextRequest, NextResponse } from 'next/server';
import { getTable } from '@/backend/src/airtable/tables';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const wallet = searchParams.get('wallet');

  if (!wallet) {
    return NextResponse.json(
      { error: 'Wallet address is required' },
      { status: 400 }
    );
  }

  try {
    console.log(`Fetching investments for wallet: ${wallet}`);
    
    const table = getTable('INVESTMENTS');
    
    // Get all investments for this wallet
    const records = await table
      .select({
        filterByFormula: `{wallet}='${wallet}'`,
        sort: [{ field: 'createdAt', direction: 'desc' }]
      })
      .all();
    
    if (records.length === 0) {
      return NextResponse.json([]);
    }
    
    // Map records to investments
    const investments = records.map(record => {
      const token = record.get('token') as string;
      const amount = record.get('amount') as number;
      
      return {
        investmentId: record.id,
        amount: amount,
        token: token || 'USDC', // Default to USDC only if token is null/undefined
        date: record.get('createdAt') as string,
        solscanUrl: record.get('solscanUrl') as string,
        usdAmount: record.get('usdAmount') as number || null,
        // Add debug info
        rawToken: record.get('token')
      };
    });
    
    return NextResponse.json(investments);
    
  } catch (error) {
    console.error('Error fetching user investments:', error);
    return NextResponse.json(
      { error: 'Failed to fetch investments' },
      { status: 500 }
    );
  }
}
