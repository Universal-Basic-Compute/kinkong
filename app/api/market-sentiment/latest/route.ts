import { getTable } from '@/backend/src/airtable/tables';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const table = getTable('MARKET_SENTIMENT');
    const records = await table
      .select({
        maxRecords: 1,
        sort: [{ field: 'weekEndDate', direction: 'desc' }]
      })
      .firstPage();

    if (records.length === 0) {
      return NextResponse.json(
        { error: 'No sentiment data found' },
        { status: 404 }
      );
    }

    const latestSentiment = {
      classification: records[0].get('classification'),
      confidence: records[0].get('confidence'),
      notes: records[0].get('notes'),
      weekEndDate: records[0].get('weekEndDate'),
      solPerformance: records[0].get('solPerformance'),
      aiTokensPerformance: records[0].get('aiTokensPerformance')
    };

    return NextResponse.json(latestSentiment);
  } catch (error) {
    console.error('Failed to fetch latest sentiment:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sentiment data' },
      { status: 500 }
    );
  }
}
