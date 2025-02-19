import { NextRequest, NextResponse } from 'next/server';
import { verifySubscription } from '@/utils/subscription';
import { askKinKongCopilot } from '@/utils/kinkong-copilot';

export async function POST(request: NextRequest) {
  try {
    // Parse request
    const body = await request.json();
    const { message, wallet, context } = body;

    if (!message || !wallet) {
      return NextResponse.json(
        { error: 'Message and wallet are required' },
        { status: 400 }
      );
    }

    // Verify subscription
    const subscription = await verifySubscription(wallet);
    if (!subscription.active) {
      return NextResponse.json(
        { error: 'Active subscription required' },
        { status: 403 }
      );
    }

    // Get copilot response
    const response = await askKinKongCopilot(message, context);

    // Return response
    return NextResponse.json({
      response,
      subscription: {
        active: true,
        expiresAt: subscription.subscription?.endDate
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
