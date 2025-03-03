import { NextResponse } from 'next/server';
import { executeTrade } from '@/backend/src/utils/jupiter_trade';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Check if this is a token-native strategy request
    if (body.strategy === 'token-native') {
      // Validate token-native parameters
      if (!body.ubcScore || !body.computeScore || !body.wallet) {
        return NextResponse.json(
          { error: 'Missing required parameters for token-native strategy' },
          { status: 400 }
        );
      }
      
      // Execute token-native strategy (this would call your Python backend)
      // This is a placeholder - you would need to implement this function
      const result = await executeTokenNativeStrategy({
        ubcScore: body.ubcScore,
        computeScore: body.computeScore,
        wallet: body.wallet
      });
      
      return NextResponse.json(result);
    } else {
      // Regular trade execution
      // Validate request parameters
      if (!body.inputToken || !body.outputToken || !body.amount || !body.wallet) {
        return NextResponse.json(
          { error: 'Missing required parameters' },
          { status: 400 }
        );
      }

      // Execute trade
      const result = await executeTrade({
        inputToken: body.inputToken,
        outputToken: body.outputToken,
        amount: body.amount,
        slippage: body.slippage || 0.01,
        wallet: body.wallet
      });

      return NextResponse.json(result);
    }
    
  } catch (error) {
    console.error('Trade execution failed:', error);
    return NextResponse.json(
      { error: 'Trade execution failed' },
      { status: 500 }
    );
  }
}

// Placeholder function for token-native strategy execution
// You would need to implement this to call your Python backend
async function executeTokenNativeStrategy(params: {
  ubcScore: number;
  computeScore: number;
  wallet: string;
}) {
  // This would make a call to your Python backend to execute the token-native strategy
  // For now, just return a placeholder response
  return {
    success: true,
    message: 'Token-native strategy execution initiated',
    params
  };
}
