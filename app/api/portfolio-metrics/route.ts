import { NextResponse } from 'next/server';
import { getTable } from '@/backend/src/airtable/tables';

export async function GET() {
  console.log('🎯 API route handler started');
  try {
    const table = getTable('PORTFOLIO_SNAPSHOTS');
    console.log('📋 Got Airtable table reference');
    
    // Get snapshots from the last 7 days
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const records = await table
      .select({
        filterByFormula: `IS_AFTER({createdAt}, '${sevenDaysAgo.toISOString()}')`,
        sort: [{ field: 'createdAt', direction: 'desc' }]
      })
      .all();

    console.log(`Found ${records.length} snapshots`);

    if (records.length === 0) {
      return NextResponse.json({
        totalValue: 0,
        change24h: 0,
        change7d: 0,
        history: []
      });
    }

    // Get latest snapshot
    const latestSnapshot = records[0];
    const totalValue = latestSnapshot.get('totalValue') as number;
    const latestHoldings = JSON.parse(latestSnapshot.get('holdingsJson') as string);
    
    console.log('Latest snapshot:', {
      totalValue,
      holdings: latestHoldings
    });

    // Find 24h old snapshot
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const dayOldSnapshot = records.find(r => 
      new Date(r.get('createdAt') as string) <= oneDayAgo
    );

    // Calculate 24h change
    const change24h = dayOldSnapshot 
      ? ((totalValue - (dayOldSnapshot.get('totalValue') as number)) / (dayOldSnapshot.get('totalValue') as number)) * 100
      : 0;

    // Find 7d old snapshot
    const sevenDaySnapshot = records.find(r => 
      new Date(r.get('createdAt') as string) <= sevenDaysAgo
    );

    // Calculate 7d change
    const change7d = sevenDaySnapshot
      ? ((totalValue - (sevenDaySnapshot.get('totalValue') as number)) / (sevenDaySnapshot.get('totalValue') as number)) * 100
      : 0;

    // Format history data
    const history = records.map(record => ({
      timestamp: record.get('createdAt') as string,
      value: record.get('totalValue') as number
    }));

    const response = {
      totalValue,
      change24h,
      change7d,
      history
    };

    console.log('Sending response:', response);
    return NextResponse.json(response);

  } catch (error) {
    console.error('Failed to fetch portfolio metrics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch portfolio metrics' },
      { status: 500 }
    );
  }
}
