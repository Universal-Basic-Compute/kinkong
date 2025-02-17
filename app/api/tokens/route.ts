import { getTable } from '@/backend/src/airtable/tables';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const table = getTable('TOKENS');
    const records = await table
      .select({
        filterByFormula: '{isActive} = 1',
        sort: [{ field: 'volume7d', direction: 'desc' }]
      })
      .all();

    const tokens = records.map(record => ({
      symbol: record.get('symbol'),
      mint: record.get('mint'),
      volume7d: record.get('volume7d'),
      liquidity: record.get('liquidity'),
      volumeGrowth: record.get('volumeGrowth'),
      pricePerformance: record.get('pricePerformance'),
      holderCount: record.get('holderCount')
    }));

    return NextResponse.json(tokens);
  } catch (error) {
    console.error('Failed to fetch tokens:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tokens' },
      { status: 500 }
    );
  }
}
