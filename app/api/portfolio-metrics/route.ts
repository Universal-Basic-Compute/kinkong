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
    let returns: number[] = []; // Explicit type annotation
    let maxDrawdown = 0;
    let currentDrawdown = 0;
    let peakValue = 0;

    // Debug log
    console.log('First trade data:', trades[0]?.fields);

    trades.forEach(trade => {
      const roi = parseFloat(trade.get('roi') as string) || 0;
      const realizedPnl = parseFloat(trade.get('realizedPnl') as string) || 0;

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

    // Calculate Sharpe Ratio (avoiding division by zero)
    let sharpeRatio = 0;
    if (returns.length > 0) {
      const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
      const stdDev = Math.sqrt(
        returns.reduce((a, b) => a + Math.pow(b - avgReturn, 2), 0) / returns.length
      ) || 1; // Use 1 if stdDev is 0 to avoid division by zero
      sharpeRatio = avgReturn / stdDev;
    }

    // Get performance history (daily points)
    const history = trades.reduce((acc, trade) => {
      try {
        // Safely parse the timestamp
        const timestamp = trade.get('timestamp');
        if (!timestamp || typeof timestamp !== 'string') {
          console.warn('Invalid timestamp format:', timestamp);
          return acc;
        }

        let date;
        try {
          // Try parsing as ISO string
          date = new Date(timestamp).toISOString().split('T')[0];
        } catch (e) {
          console.warn('Invalid date format:', timestamp);
          return acc;
        }

        const value = parseFloat(trade.get('value') as string) || 0;
        
        if (!acc[date]) {
          acc[date] = { timestamp: date, value: 0 };
        }
        acc[date].value += value;
        return acc;
      } catch (e) {
        console.error('Error processing trade:', e);
        return acc;
      }
    }, {} as Record<string, { timestamp: string; value: number }>);

    // Debug logs
    console.log('Metrics calculated:', {
      totalTrades,
      winningTrades,
      totalReturn,
      maxDrawdown,
      sharpeRatio
    });
    console.log('History points:', Object.keys(history).length);

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
    console.error('Failed to fetch portfolio metrics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch portfolio metrics' },
      { status: 500 }
    );
  }
}
