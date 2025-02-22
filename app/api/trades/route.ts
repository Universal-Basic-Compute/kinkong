import { NextResponse } from 'next/server';
import { getTable } from '@/backend/src/airtable/tables';

export async function GET() {
  try {
    const tradesTable = getTable('TRADES');
    const trades = await tradesTable.select({
      sort: [{ field: 'createdAt', direction: 'desc' }],
      maxRecords: 50 // Limit to most recent 50 trades
    }).all();

    const formattedTrades = trades.map(record => ({
      id: record.id,
      createdAt: record.get('createdAt'),
      token: record.get('token'),
      value: record.get('value'),
      exitValue: record.get('exitValue'),
      status: record.get('status'),
      exitReason: record.get('exitReason'),
      realizedPnl: record.get('realizedPnl'),
      signature: record.get('signature')
    }));

    return NextResponse.json(formattedTrades);
  } catch (error) {
    console.error('Failed to fetch trades:', error);
    return NextResponse.json(
      { error: 'Failed to fetch trades' },
      { status: 500 }
    );
  }
}
