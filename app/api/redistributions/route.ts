import { NextRequest, NextResponse } from 'next/server';
import { getTable } from '@/backend/src/airtable/tables';

export async function GET(request: NextRequest) {
  try {
    if (!process.env.KINKONG_AIRTABLE_API_KEY || !process.env.KINKONG_AIRTABLE_BASE_ID) {
      return NextResponse.json(
        { error: 'Airtable configuration is missing' },
        { status: 500 }
      );
    }

    // Get the redistributions table
    const redistributionsTable = getTable('INVESTOR_REDISTRIBUTIONS');
    
    // Get all records, sorted by createdAt in descending order
    const records = await redistributionsTable
      .select({
        sort: [{ field: 'createdAt', direction: 'desc' }],
        filterByFormula: 'NOT({amount} = 0)' // Filter out zero amounts
      })
      .all();

    // Map the records to the expected format
    const redistributions = records.map(record => ({
      investmentId: record.id, // Use the record ID as the investment ID
      wallet: record.get('wallet') as string,
      token: record.get('token') as string, // Get the token field
      amount: record.get('amount') as number, // Get the amount field
      percentage: record.get('percentage') as number,
      date: record.get('createdAt') as string,
      claimed: record.get('claimed') as boolean || false,
      hasSubscription: record.get('hasSubscription') as boolean || false,
      effectiveRate: record.get('effectiveRate') as number || 75,
      redistributionId: record.get('redistributionId') as string
    }));

    return NextResponse.json(redistributions);
  } catch (error) {
    console.error('Error fetching redistributions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch redistributions' },
      { status: 500 }
    );
  }
}
