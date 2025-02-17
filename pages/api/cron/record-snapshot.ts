import { recordPortfolioSnapshot } from '@/backend/src/strategy/snapshots';
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  try {
    console.log('🤖 Starting portfolio snapshot recording...');
    
    // Log environment variables (without exposing values)
    console.log('🔑 Environment check:', {
      hasApiKey: !!process.env.KINKONG_AIRTABLE_API_KEY,
      hasBaseId: !!process.env.KINKONG_AIRTABLE_BASE_ID
    });
    
    const snapshot = await recordPortfolioSnapshot();
    console.log('📸 Recorded snapshot:', snapshot);
    
    return NextResponse.json({ 
      success: true, 
      snapshot 
    });
  } catch (error) {
    console.error('❌ Failed to record snapshot:', error);
    return NextResponse.json(
      { 
        error: 'Failed to record snapshot',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 
      { status: 500 }
    );
  }
}
