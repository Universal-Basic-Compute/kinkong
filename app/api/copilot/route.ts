import { NextRequest, NextResponse } from 'next/server';
import { verifySubscription } from '@/utils/subscription';

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

    // Get copilot response by calling kinkong-copilot endpoint directly
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/kinkong-copilot`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message,
        context
      })
    });

    if (!response.ok) {
      throw new Error('Failed to get copilot response');
    }

    const data = await response.json();

    // Return response
    return NextResponse.json({
      response: data.response,
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

// Add OPTIONS handler for CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS', 
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}
