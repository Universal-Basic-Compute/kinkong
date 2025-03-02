import { NextRequest, NextResponse } from 'next/server';
import Airtable from 'airtable';

// Initialize Airtable
const base = new Airtable({ apiKey: process.env.KINKONG_AIRTABLE_API_KEY }).base(
  process.env.KINKONG_AIRTABLE_BASE_ID as string
);

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const wallet = searchParams.get('wallet');
    
    if (!wallet) {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 400 }
      );
    }
    
    // Get current date in ISO format
    const now = new Date().toISOString();
    
    // Check for active subscription in SUBSCRIPTIONS table
    const records = await base('SUBSCRIPTIONS')
      .select({
        filterByFormula: `AND({wallet}='${wallet}', {status}='active', {endDate} > '${now}')`
      })
      .firstPage();
    
    const isActive = records.length > 0;
    
    return NextResponse.json({ isActive });
  } catch (error) {
    console.error('Error checking subscription:', error);
    return NextResponse.json(
      { error: 'Failed to check subscription' },
      { status: 500 }
    );
  }
}
