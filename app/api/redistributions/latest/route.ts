import { NextResponse } from 'next/server';
import { getTable } from '@/backend/src/airtable/tables';

export async function GET() {
  try {
    console.log('Fetching latest redistributions...');
    
    const table = getTable('REDISTRIBUTIONS');
    
    // Get the most recent redistributions for COMPUTE and UBC
    const records = await table
      .select({
        filterByFormula: "OR({token}='COMPUTE', {token}='UBC')",
        sort: [{ field: 'createdAt', direction: 'desc' }],
        maxRecords: 10
      })
      .all();
    
    if (!records || records.length === 0) {
      return NextResponse.json(
        { error: 'No redistributions found' },
        { status: 404 }
      );
    }
    
    // Find the latest redistribution for each token
    const latestRedistributions: Record<string, any> = {};
    
    records.forEach(record => {
      const token = record.get('token') as string;
      if (!latestRedistributions[token]) {
        latestRedistributions[token] = {
          id: record.id,
          token,
          amount: record.get('amount'),
          createdAt: record.get('createdAt')
        };
      }
    });
    
    return NextResponse.json(latestRedistributions);
  } catch (error) {
    console.error('Error fetching latest redistributions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch latest redistributions' },
      { status: 500 }
    );
  }
}
