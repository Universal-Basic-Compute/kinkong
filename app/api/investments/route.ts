import { NextRequest, NextResponse } from 'next/server';
import { getTable } from '@/backend/src/airtable/tables';

export async function GET(request: NextRequest) {
  try {
    // Initialize Airtable
    const redistributionsTable = getTable('INVESTOR_REDISTRIBUTIONS');
    
    // Get the latest 100 redistributions, sorted by createdAt in descending order
    const redistributionsRecords = await redistributionsTable.select({
      maxRecords: 100,
      sort: [{ field: 'createdAt', direction: 'desc' }]
    }).all();
    
    console.log(`Found ${redistributionsRecords.length} redistributions`);
    
    // Map redistributions to the format expected by the frontend
    const redistributions = redistributionsRecords.map(record => {
      return {
        investmentId: record.id, // Use redistribution ID as the investment ID
        amount: parseFloat(record.get('investmentValue') || '0'), // Use investmentValue as amount
        token: 'USDC', // Default to USDC
        date: record.get('createdAt') || '',
        wallet: record.get('wallet') || '',
        username: record.get('username') || '',
        // Return data is already in the redistribution record
        ubcReturn: parseFloat(record.get('ubcAmount') || '0'),
        return: parseFloat(record.get('amount') || '0'),
        redistributionId: record.get('redistributionId'),
        redistributionDate: record.get('createdAt'),
        percentage: parseFloat(record.get('percentage') || '0'),
        claimed: record.get('claimed') || false
      };
    });
    
    console.log(`Returning ${redistributions.length} redistributions`);
    return NextResponse.json(redistributions);
  } catch (error) {
    console.error('Error fetching redistributions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch redistributions' },
      { status: 500 }
    );
  }
}
