import { getTable, TABLES } from '@/backend/src/airtable/tables';
import { NextResponse } from 'next/server';
import { parseAndFormatDate } from '@/backend/src/utils/dates';
import type { Record, FieldSet } from 'airtable';

interface SignalRecord extends FieldSet {
  timestamp: string;
  token: string;
  type: 'BUY' | 'SELL';
  timeframe: 'SCALP' | 'INTRADAY' | 'SWING' | 'POSITION';
  entryPrice?: number;
  targetPrice?: number;
  stopLoss?: number;
  confidence: 'LOW' | 'MEDIUM' | 'HIGH';
  wallet: string;
  reason: string;
  url?: string;
  success?: boolean;
}

export async function GET() {
  try {
    console.log('Starting GET request for signals...');
    console.log('Environment variables:', {
      hasApiKey: !!process.env.KINKONG_AIRTABLE_API_KEY,
      hasBaseId: !!process.env.KINKONG_AIRTABLE_BASE_ID
    });

    const table = getTable('SIGNALS');
    console.log('Got Airtable table reference');

    // Specific try/catch for the Airtable query
    try {
      const records = await table
        .select({
          sort: [{ field: 'timestamp', direction: 'desc' }],
          maxRecords: 100
        })
        .all();
      console.log(`Retrieved ${records.length} signals`);

      const signals = records.map((record: Record<SignalRecord>) => ({
        id: record.id,
        timestamp: parseAndFormatDate(record.get('timestamp')),
        token: record.get('token') as string,
        type: record.get('type') as 'BUY' | 'SELL',
        timeframe: record.get('timeframe') as 'SCALP' | 'INTRADAY' | 'SWING' | 'POSITION' || 'INTRADAY', // Default to INTRADAY if missing
        entryPrice: record.get('entryPrice') ? Number(record.get('entryPrice')) : undefined,
        targetPrice: record.get('targetPrice') ? Number(record.get('targetPrice')) : undefined,
        stopLoss: record.get('stopLoss') ? Number(record.get('stopLoss')) : undefined,
        confidence: record.get('confidence') as 'LOW' | 'MEDIUM' | 'HIGH' || 'MEDIUM', // Default to MEDIUM if missing
        success: record.get('success') as boolean | null,
        wallet: record.get('wallet') as string,
        reason: record.get('reason') as string || '',
        url: record.get('url') as string || undefined,
      }));

      console.log('Formatted first signal:', signals[0]); // Debug log
      return NextResponse.json(signals);
    } catch (queryError) {
      console.error('Error querying Airtable:', {
        error: queryError,
        message: queryError instanceof Error ? queryError.message : 'Unknown query error',
        stack: queryError instanceof Error ? queryError.stack : undefined
      });
      throw queryError; // Rethrow to be caught by outer try/catch
    }
  } catch (error) {
    console.error('Detailed error in GET /api/signals:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      fullError: error // Log the complete error
    });
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch signals', 
        details: error instanceof Error ? error.message : 'Unknown error',
        errorType: error instanceof Error ? error.name : typeof error
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    console.log('Starting POST request for signals...');
    const body = await request.json();
    console.log('Request body:', body);

    const { 
      token, 
      direction, 
      timeframe,
      entryPrice,
      targetPrice,
      stopLoss,
      confidence,
      reason, 
      url, 
      wallet 
    } = body;

    if (!token || !direction || !timeframe || !confidence || !reason || !wallet) {
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
          timeframe,
          entryPrice: entryPrice || null,
          targetPrice: targetPrice || null,
          stopLoss: stopLoss || null,
          confidence,
          reason,
          url: url || '',
          wallet,
          timestamp: parseAndFormatDate(new Date()),
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
