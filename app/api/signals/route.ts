import { getTable } from '@/backend/src/airtable/tables';
import { NextResponse } from 'next/server';

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
