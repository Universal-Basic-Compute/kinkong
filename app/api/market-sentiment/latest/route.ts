import { getTable } from '@/backend/src/airtable/tables';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const table = getTable('MARKET_SENTIMENT');
    const records = await table
      .select({
        maxRecords: 1,
        sort: [{ field: 'createdAt', direction: 'desc' }]
      })
      .firstPage();

    if (records.length === 0) {
      return NextResponse.json(
        { error: 'No sentiment data found' },
        { status: 404 }
      );
    }

    // Get the latest record
    const record = records[0];
    
    // Get all fields from the record
    const latestSentiment = {
      classification: record.get('classification'),
      confidence: record.get('confidence'),
      notes: record.get('notes'),
      weekEndDate: record.get('weekEndDate'),
      indicators: record.get('indicators') // Get the raw indicators string
    };

    // Log the data for debugging
    console.log('Fetched sentiment data:', {
      ...latestSentiment,
      hasIndicators: !!latestSentiment.indicators
    });

    return NextResponse.json(latestSentiment);
  } catch (error) {
    console.error('Failed to fetch latest sentiment:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sentiment data' },
      { status: 500 }
    );
  }
}
