import { NextRequest, NextResponse } from 'next/server';
import { verifySubscription } from '@/utils/subscription';
import { askKinKongCopilot } from '@/utils/kinkong-copilot';

export async function POST(request: NextRequest) {
  try {
    // Parse request
    const body = await request.json();
    const { message, context } = body;

    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    // Get copilot response
    const response = await askKinKongCopilot(message, context);

    // Return response
    return NextResponse.json({
      response,
      subscription: {
        active: true,
        expiresAt: null
      }
    });

  } catch (error) {
    console.error('Copilot error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to process request',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
