import { NextResponse } from 'next/server';
import { getTable } from '@/backend/src/airtable/tables';
import type { Record, FieldSet } from 'airtable';

interface TradeRecord extends FieldSet {
  returnPercent: number;
  createdAt: string;
  value: number;
}

export async function GET() {
  try {
    const tradesTable = getTable('TRADES');
    const trades = await tradesTable.select({
      sort: [{ field: 'timestamp', direction: 'desc' }]
    }).all();

    // Calculate metrics
    let totalTrades = trades.length;
    let winningTrades = 0;
    let totalReturn = 0;
    let returns: number[] = [];
    let maxDrawdown = 0;
    let currentDrawdown = 0;
    let peakValue = 0;

    trades.forEach((trade: Record<TradeRecord>) => {
      const returnPct = trade.get('returnPercent') as number;
      if (returnPct > 0) winningTrades++;
      totalReturn += returnPct;
      returns.push(returnPct);

      // Update drawdown calculation
      const value = 1 + (returnPct / 100);
      if (value > peakValue) {
        peakValue = value;
        currentDrawdown = 0;
      } else {
        currentDrawdown = (peakValue - value) / peakValue * 100;
        if (currentDrawdown > maxDrawdown) {
          maxDrawdown = currentDrawdown;
        }
      }
    });

    // Calculate Sharpe Ratio
    const avgReturn = totalReturn / totalTrades;
    const stdDev = Math.sqrt(
      returns.reduce((sum, ret) => sum + Math.pow(ret - avgReturn, 2), 0) / returns.length
    );
    const sharpeRatio = (avgReturn - 2) / stdDev; // Using 2% risk-free rate

    return NextResponse.json({
      totalTrades,
      winRate: (winningTrades / totalTrades * 100).toFixed(2),
      totalReturn: totalReturn.toFixed(2),
      sharpeRatio: sharpeRatio.toFixed(2),
      maxDrawdown: maxDrawdown.toFixed(2)
    });

  } catch (error) {
    console.error('Failed to fetch performance metrics:', error);
    // Log more details about the error
    if (error instanceof Error) {
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
    }
    return NextResponse.json(
      { error: 'Failed to fetch performance metrics' },
      { status: 500 }
    );
  }
}
