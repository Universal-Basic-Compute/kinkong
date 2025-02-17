import { recordPortfolioSnapshot } from '@/backend/src/strategy/snapshots';

export async function GET(req: Request) {
  try {
    // Add logging for debugging
    console.log('Starting portfolio snapshot recording...');
    
    const snapshot = await recordPortfolioSnapshot();
    
    console.log('Successfully recorded snapshot:', snapshot);
    
    return NextResponse.json({ 
      success: true, 
      snapshot 
    });
  } catch (error) {
    console.error('Failed to record snapshot:', error);
    return NextResponse.json(
      { 
        error: 'Failed to record snapshot',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 
      { status: 500 }
    );
  }
}
