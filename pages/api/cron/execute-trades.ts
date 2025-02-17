import { NextResponse } from 'next/server';
import { getCurrentPortfolio, calculateTrades } from '@/backend/src/strategy/portfolio';
import { executeTrades, updateTradeHistory } from '@/backend/src/strategy/trading';

export async function GET() {
  try {
    console.log('Starting trade execution...');
    
    // Get current portfolio
    const portfolio = await getCurrentPortfolio();
    
    // Calculate needed trades
    const trades = await calculateTrades(portfolio);
    
    // Execute trades
    const results = await executeTrades(trades);
    
    // Update trade history
    await updateTradeHistory(results);
    
    return NextResponse.json({ 
      success: true,
      tradesExecuted: results.length 
    });
  } catch (error) {
    console.error('Failed to execute trades:', error);
    return NextResponse.json(
      { error: 'Failed to execute trades' },
      { status: 500 }
    );
  }
}
