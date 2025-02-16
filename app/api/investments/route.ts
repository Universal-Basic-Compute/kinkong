import { getInvestments } from '@/backend/src/airtable/investments';
import { NextResponse } from 'next/server';

if (!process.env.KINKONG_AIRTABLE_API_KEY || !process.env.KINKONG_AIRTABLE_BASE_ID) {
  console.error('Missing required environment variables:', {
    hasApiKey: !!process.env.KINKONG_AIRTABLE_API_KEY,
    hasBaseId: !!process.env.KINKONG_AIRTABLE_BASE_ID
  });
}

export async function GET() {
  // Add debug logging at the start of the function
  console.log('API Route Handler: Environment check', {
    hasApiKey: !!process.env.KINKONG_AIRTABLE_API_KEY,
    hasBaseId: !!process.env.KINKONG_AIRTABLE_BASE_ID,
    nodeEnv: process.env.NODE_ENV
  });

  try {
    console.log('Fetching investments...');
    const investments = await getInvestments();
    console.log('Investments fetched successfully:', investments);
    return NextResponse.json(investments);
  } catch (error) {
    // Enhanced error logging
    const errorDetails = {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      type: error instanceof Error ? error.constructor.name : typeof error
    };
    
    console.error('Failed to fetch investments:', errorDetails);
    
    return NextResponse.json(
      { error: 'Failed to fetch investments', details: errorDetails },
      { status: 500 }
    );
  }
}
