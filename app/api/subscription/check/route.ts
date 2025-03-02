import { NextRequest, NextResponse } from 'next/server';
import Airtable from 'airtable';

// Initialize Airtable with proper type assertion
const base = new Airtable({ 
  apiKey: process.env.KINKONG_AIRTABLE_API_KEY as string 
}).base(process.env.KINKONG_AIRTABLE_BASE_ID as string);

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
    // Fix the base usage to use table() method
    const subscriptionsTable = base.table('SUBSCRIPTIONS');
    const records = await subscriptionsTable
      .select({
        filterByFormula: `AND({wallet}='${wallet}', LOWER({status})='active', {endDate} > '${now}')`
      })
      .firstPage();
    
    // Add debugging logs
    console.log('Subscription check for wallet:', wallet);
    console.log('Current date:', now);
    console.log('Records found:', records.length);
    if (records.length > 0) {
      console.log('Subscription status:', records[0].fields.status);
      console.log('Subscription end date:', records[0].fields.endDate);
    }
    
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
