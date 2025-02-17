import { getTable } from '@/backend/src/airtable/tables';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const table = getTable('PORTFOLIO_SNAPSHOTS');

    // Get current snapshot and historical snapshots
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const records = await table
      .select({
        filterByFormula: `AND(
          {timestamp} >= '${sevenDaysAgo.toISOString()}',
          {timestamp} <= '${now.toISOString()}'
        )`,
        sort: [{ field: 'timestamp', direction: 'desc' }]
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

    const latest = records[0];
    const oneDayOld = records.find(r =>
      new Date(r.get('timestamp') as string) <= oneDayAgo
    );
    const sevenDayOld = records.find(r =>
      new Date(r.get('timestamp') as string) <= sevenDaysAgo
    );

    const totalValue = latest.get('totalValue') as number;
    const change24h = oneDayOld
      ? ((totalValue - (oneDayOld.get('totalValue') as number)) / (oneDayOld.get('totalValue') as number)) * 100
      : 0;
    const change7d = sevenDayOld
      ? ((totalValue - (sevenDayOld.get('totalValue') as number)) / (sevenDayOld.get('totalValue') as number)) * 100
      : 0;

    // Get hourly data points for the chart
    const history = records.map(record => ({
      timestamp: record.get('timestamp'),
      value: record.get('totalValue')
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
        filterByFormula: `IS_AFTER({timestamp}, '${sevenDaysAgo.toISOString()}')`,
        sort: [{ field: 'timestamp', direction: 'desc' }]
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
      new Date(r.get('timestamp') as string) <= oneDayAgo
    );
    const change24h = oneDayRecord 
      ? ((totalValue - (oneDayRecord.get('totalValue') as number)) / (oneDayRecord.get('totalValue') as number)) * 100
      : 0;

    // Calculate 7d change
    const sevenDayRecord = records.find(r => 
      new Date(r.get('timestamp') as string) <= sevenDaysAgo
    );
    const change7d = sevenDayRecord
      ? ((totalValue - (sevenDayRecord.get('totalValue') as number)) / (sevenDayRecord.get('totalValue') as number)) * 100
      : 0;

    // Format historical data
    const history = records.map(record => ({
      timestamp: record.get('timestamp') as string,
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
