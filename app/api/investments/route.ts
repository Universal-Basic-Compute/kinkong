import { getInvestments } from '@/backend/src/airtable/investments';
import { NextResponse } from 'next/server';

if (!process.env.KINKONG_AIRTABLE_API_KEY || !process.env.KINKONG_AIRTABLE_BASE_ID) {
  console.error('Missing required environment variables:', {
    hasApiKey: !!process.env.KINKONG_AIRTABLE_API_KEY,
    hasBaseId: !!process.env.KINKONG_AIRTABLE_BASE_ID
  });
}

export async function GET() {
  try {
    console.log('Fetching investments...');
    const investments = await getInvestments();
    console.log('Investments fetched successfully:', investments);
    return NextResponse.json(investments);
  } catch (error) {
    console.error('Failed to fetch investments:', error);
    // If error is an Error object, include its message and stack
    const errorMessage = error instanceof Error ? 
      `${error.message}\n${error.stack}` : 
      'Unknown error';
    console.error('Detailed error:', errorMessage);
    
    return NextResponse.json(
      { error: 'Failed to fetch investments', details: errorMessage },
      { status: 500 }
    );
  }
}
