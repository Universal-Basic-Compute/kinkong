import { NextResponse } from 'next/server';
import { getTable } from '@/backend/src/airtable/tables';

export async function GET() {
  try {
    const table = getTable('PORTFOLIO_SNAPSHOTS');

    // Get current snapshot and historical snapshots
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const records = await table
      .select({
        filterByFormula: `IS_AFTER({createdAt}, '${sevenDaysAgo.toISOString()}')`,
        sort: [{ field: 'createdAt', direction: 'desc' }]
      })
      .all();

    if (records.length === 0) {
      return NextResponse.json({
        totalValue: 0,
        change24h: 0,
        change7d: 0,
        history: []
      });
    }

    // Get latest value
    const latestRecord = records[0];
    const totalValue = latestRecord.get('totalValue') as number;

    // Calculate 24h change
    const oneDayRecord = records.find(r => 
      new Date(r.get('createdAt') as string) <= oneDayAgo
    );
    const change24h = oneDayRecord 
      ? ((totalValue - (oneDayRecord.get('totalValue') as number)) / (oneDayRecord.get('totalValue') as number)) * 100
      : 0;

    // Calculate 7d change
    const sevenDayRecord = records.find(r => 
      new Date(r.get('createdAt') as string) <= sevenDaysAgo
    );
    const change7d = sevenDayRecord
      ? ((totalValue - (sevenDayRecord.get('totalValue') as number)) / (sevenDayRecord.get('totalValue') as number)) * 100
      : 0;

    // Format historical data
    const history = records.map(record => ({
      timestamp: record.get('createdAt') as string,
      value: record.get('totalValue') as number
    }));

    return NextResponse.json({
      totalValue,
      change24h,
      change7d,
      history
    });
  } catch (error) {
    console.error('Failed to fetch portfolio metrics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch portfolio metrics' },
      { status: 500 }
    );
  }
}
