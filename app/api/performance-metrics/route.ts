import { NextResponse } from 'next/server';
import { getTable } from '@/backend/src/airtable/tables';

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
    let returns = [];
    let maxDrawdown = 0;
    let currentDrawdown = 0;
    let peakValue = 0;

    trades.forEach(trade => {
      const roi = trade.get('roi') as number;
      const realizedPnl = trade.get('realizedPnl') as number;

      if (roi > 0) winningTrades++;
      totalReturn += realizedPnl;
      returns.push(roi);

      // Update peak and drawdown
      if (totalReturn > peakValue) {
        peakValue = totalReturn;
        currentDrawdown = 0;
      } else {
        currentDrawdown = (peakValue - totalReturn) / peakValue;
        maxDrawdown = Math.max(maxDrawdown, currentDrawdown);
      }
    });

    // Calculate Sharpe Ratio (assuming risk-free rate of 0 for simplicity)
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const stdDev = Math.sqrt(
      returns.reduce((a, b) => a + Math.pow(b - avgReturn, 2), 0) / returns.length
    );
    const sharpeRatio = avgReturn / stdDev;

    // Get performance history (daily points)
    const history = trades.reduce((acc, trade) => {
      const date = new Date(trade.get('timestamp') as string).toISOString().split('T')[0];
      const value = trade.get('value') as number;
      
      if (!acc[date]) {
        acc[date] = { timestamp: date, value: 0 };
      }
      acc[date].value += value;
      return acc;
    }, {});

    return NextResponse.json({
      metrics: {
        totalReturn: (totalReturn * 100).toFixed(2),
        winRate: ((winningTrades / totalTrades) * 100).toFixed(2),
        sharpeRatio: sharpeRatio.toFixed(2),
        maxDrawdown: (maxDrawdown * 100).toFixed(2),
        totalTrades
      },
      history: Object.values(history)
    });

  } catch (error) {
    console.error('Failed to fetch performance metrics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch performance metrics' },
      { status: 500 }
    );
  }
}
