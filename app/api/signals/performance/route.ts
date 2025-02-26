import { NextResponse } from 'next/server';
import { getTable } from '@/backend/src/airtable/tables';

export async function GET() {
  try {
    console.log('Fetching signal performance metrics...');
    
    const table = getTable('PERFORMANCES');
    
    // Get the most recent performance metrics record
    const records = await table
      .select({
        filterByFormula: "{type}='signals'",
        sort: [{ field: 'createdAt', direction: 'desc' }],
        maxRecords: 1
      })
      .all();
    
    if (!records || records.length === 0) {
      return NextResponse.json(
        { error: 'No performance metrics found' },
        { status: 404 }
      );
    }
    
    const latestRecord = records[0];
    const metricsJson = latestRecord.get('metrics') as string;
    
    // Parse the JSON string into an object
    const metrics = JSON.parse(metricsJson);
    
    // Add the record ID and creation date
    const response = {
      id: latestRecord.id,
      createdAt: latestRecord.get('createdAt'),
      metrics
    };
    
    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching performance metrics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch performance metrics' },
      { status: 500 }
    );
  }
}
