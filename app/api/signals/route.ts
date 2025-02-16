import { getTable, TABLES } from '@/backend/src/airtable/tables';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    console.log('Starting GET request for signals...');
    console.log('Environment variables:', {
      hasApiKey: !!process.env.KINKONG_AIRTABLE_API_KEY,
      hasBaseId: !!process.env.KINKONG_AIRTABLE_BASE_ID
    });

    const table = getTable(TABLES.SIGNALS);
    console.log('Got Airtable table reference');

    const records = await table
      .select({
        sort: [{ field: 'timestamp', direction: 'desc' }],
        maxRecords: 100
      })
      .all();
    console.log(`Retrieved ${records.length} signals`);

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
    console.error('Detailed error in GET /api/signals:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    
    return NextResponse.json(
      { error: 'Failed to fetch signals', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    console.log('Starting POST request for signals...');
    const body = await request.json();
    console.log('Request body:', body);

    const { token, direction, reason, url, wallet } = body;

    if (!token || !direction || !reason || !wallet) {
      console.log('Missing required fields:', { token, direction, reason, wallet });
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const table = getTable(TABLES.SIGNALS);
    console.log('Got Airtable table reference');

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
    console.log('Created signal record:', record);

    return NextResponse.json({ success: true, record: record[0] });
  } catch (error) {
    console.error('Detailed error in POST /api/signals:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });

    return NextResponse.json(
      { error: 'Failed to create signal', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
