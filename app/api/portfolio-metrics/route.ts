import { NextResponse } from 'next/server';
import { getTable } from '@/backend/src/airtable/tables';
import type { Record as AirtableRecord, FieldSet } from 'airtable';

// Use a different name for our dictionary type to avoid confusion
type HistoryDictionary = {
  [date: string]: { 
    createdAt: string;
    value: number 
  };
};

interface TradeRecord extends FieldSet {
  roi: string;
  realizedPnl: string;
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
    let returns: number[] = []; // Explicit type annotation
    let maxDrawdown = 0;
    let currentDrawdown = 0;
    let peakValue = 0;

    // Debug log
    console.log('First trade data:', trades[0]?.fields);

    trades.forEach((trade: AirtableRecord<TradeRecord>) => {
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
    const history = trades.reduce<HistoryDictionary>((acc, trade) => {
      try {
        // Safely parse the createdAt timestamp
        const createdAt = trade.get('createdAt');
        if (!createdAt || typeof createdAt !== 'string') {
          console.warn('Invalid createdAt format:', createdAt);
          return acc;
        }

        // Get the date part only for the key
        const dateStr = createdAt.split('T')[0];
        
        // Get the value
        const value = parseFloat(trade.get('value') as string) || 0;

        // Initialize or update the accumulator entry
        if (!acc[dateStr]) {
          acc[dateStr] = {
            createdAt: createdAt,
            value: 0
          };
        }
        acc[dateStr].value += value;

        return acc;
      } catch (error) {
        console.error('Error processing trade:', error);
        return acc;
      }
    }, {} as HistoryDictionary);

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
