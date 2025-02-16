import { getTable } from '@/backend/src/airtable/tables';
import { NextResponse } from 'next/server';

// Check for required environment variables
if (!process.env.KINKONG_AIRTABLE_API_KEY || !process.env.KINKONG_AIRTABLE_BASE_ID) {
  console.error('Missing required environment variables:', {
    hasApiKey: !!process.env.KINKONG_AIRTABLE_API_KEY,
    hasBaseId: !!process.env.KINKONG_AIRTABLE_BASE_ID
  });
}

export async function GET() {
  try {
    console.log('Fetching signals...');
    const table = getTable('SIGNALS');
    const records = await table
      .select({
        sort: [{ field: 'timestamp', direction: 'desc' }],
        maxRecords: 100 // Limit to last 100 signals
      })
      .all();

    const signals = records.map(record => ({
      id: record.id,
      timestamp: record.get('timestamp'),
      token: record.get('token'),
      type: record.get('type'),
      wallet: record.get('wallet'),
      reason: record.get('reason'),
      url: record.get('url'),
    }));

    return NextResponse.json(signals);
  } catch (error) {
    console.error('Failed to fetch signals:', error);
    return NextResponse.json(
      { error: 'Failed to fetch signals' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { token, direction, reason, url, wallet } = body;

    if (!token || !direction || !reason || !wallet) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const table = getTable('SIGNALS');
    const record = await table.create([
      {
        fields: {
          token: token.toUpperCase(),
          type: direction,
          reason,
          url: url || '',
          wallet,
          timestamp: new Date().toISOString(),
        },
      },
    ]);

    return NextResponse.json({ success: true, record: record[0] });
  } catch (error) {
    console.error('Failed to create signal:', error);
    return NextResponse.json(
      { error: 'Failed to create signal' },
      { status: 500 }
    );
  }
}
