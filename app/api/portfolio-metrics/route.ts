import { NextResponse } from 'next/server';
import { getTable } from '@/backend/src/airtable/tables';
import type { Record as AirtableRecord, FieldSet } from 'airtable';

// Use a different name for our dictionary type to avoid confusion
type HistoryDictionary = {
  [date: string]: { 
    createdAt: string;
    value: number 
  };
};

interface TradeRecord extends FieldSet {
  roi: string;
  realizedPnl: string;
  createdAt: string;
  value: number;
}

export async function GET() {
  try {
    const snapshotsTable = getTable('WALLET_SNAPSHOTS');
    
    // Get snapshots sorted by date
    const snapshots = await snapshotsTable.select({
      sort: [{ field: 'createdAt', direction: 'desc' }],
      maxRecords: 30 // Last 30 days
    }).all();

    if (!snapshots.length) {
      return NextResponse.json({
        totalValue: 0,
        change24h: 0,
        change7d: 0,
        history: []
      });
    }

    // Calculate metrics
    const latestSnapshot = snapshots[0];
    const oneDayAgoSnapshot = snapshots.find(s => {
      const date = new Date(s.get('createdAt'));
      const now = new Date();
      const diffDays = (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);
      return diffDays >= 1;
    });
    const sevenDaysAgoSnapshot = snapshots.find(s => {
      const date = new Date(s.get('createdAt'));
      const now = new Date();
      const diffDays = (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);
      return diffDays >= 7;
    });

    // Calculate changes
    const totalValue = latestSnapshot.get('totalValue') || 0;
    const oneDayAgoValue = oneDayAgoSnapshot?.get('totalValue') || totalValue;
    const sevenDaysAgoValue = sevenDaysAgoSnapshot?.get('totalValue') || totalValue;

    const change24h = oneDayAgoValue ? ((totalValue - oneDayAgoValue) / oneDayAgoValue) * 100 : 0;
    const change7d = sevenDaysAgoValue ? ((totalValue - sevenDaysAgoValue) / sevenDaysAgoValue) * 100 : 0;

    // Format history data
    const history = snapshots.map(snapshot => ({
      timestamp: snapshot.get('createdAt'),
      value: snapshot.get('totalValue') || 0
    })).reverse(); // Oldest to newest

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
