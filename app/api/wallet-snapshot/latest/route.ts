import { getTable } from '@/backend/src/airtable/tables';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    console.log('Fetching latest wallet snapshot...');
    
    const table = getTable('WALLET_SNAPSHOTS');
    
    // Get the most recent snapshot
    const records = await table
      .select({
        sort: [{ field: 'createdAt', direction: 'desc' }],
        maxRecords: 1
      })
      .firstPage();
    
    if (records.length === 0) {
      return NextResponse.json(
        { error: 'No wallet snapshots found' },
        { status: 404 }
      );
    }
    
    const snapshot = records[0];
    
    return NextResponse.json({
      id: snapshot.id,
      totalValue: snapshot.get('totalValue') || 0,
      createdAt: snapshot.get('createdAt') || new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Failed to fetch wallet snapshot:', error);
    return NextResponse.json(
      { error: 'Failed to fetch wallet snapshot' },
      { status: 500 }
    );
  }
}
