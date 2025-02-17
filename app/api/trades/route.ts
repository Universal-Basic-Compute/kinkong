import { NextResponse } from 'next/server';
import { getTable } from '@/backend/src/airtable/tables';

export async function GET() {
  try {
    const tradesTable = getTable('TRADES');
    const trades = await tradesTable.select({
      sort: [{ field: 'timestamp', direction: 'desc' }],
      maxRecords: 50 // Limit to most recent 50 trades
    }).all();

    const formattedTrades = trades.map(record => ({
      id: record.id,
      timestamp: record.get('timestamp'),
      token: record.get('token'),
      type: record.get('action'),
      amount: record.get('amount'),
      price: record.get('price'),
      value: record.get('value'),
      status: record.get('status') || 'SUCCESS',
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
