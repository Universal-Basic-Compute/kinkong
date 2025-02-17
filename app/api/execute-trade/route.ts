import { NextResponse } from 'next/server';
import { executeTrade } from '@/backend/src/utils/jupiter_trade';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
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
    
  } catch (error) {
    console.error('Trade execution failed:', error);
    return NextResponse.json(
      { error: 'Trade execution failed' },
      { status: 500 }
    );
  }
}
