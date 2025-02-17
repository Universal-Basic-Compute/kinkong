import { selectInitialTokens } from '@/backend/src/strategy/token-selection';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    // Verify admin authorization here
    const selectedTokens = await selectInitialTokens();
    
    return NextResponse.json({
      success: true,
      tokens: selectedTokens
    });
  } catch (error) {
    console.error('Failed to select initial tokens:', error);
    return NextResponse.json(
      { error: 'Failed to select tokens' },
      { status: 500 }
    );
  }
}
