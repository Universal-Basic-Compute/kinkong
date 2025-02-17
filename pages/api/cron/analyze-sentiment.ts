import { NextResponse } from 'next/server';
import { getTable } from '@/backend/src/airtable/tables';
import { Connection, PublicKey } from '@solana/web3.js';
import { getCurrentPortfolio, calculateCurrentAllocations } from '@/utils/portfolio';
import type { MarketClassification } from '@/scripts/analyze-market-sentiment';

export async function GET() {
  try {
    console.log('Starting market sentiment analysis...');
    
    // Get actual portfolio data
    const connection = new Connection(process.env.SOLANA_RPC_URL!);
    const walletPubkey = new PublicKey(process.env.STRATEGY_WALLET!);
    
    const portfolio = await getCurrentPortfolio(connection, walletPubkey);
    const allocations = calculateCurrentAllocations(portfolio);
    
    console.log('Current Portfolio:', allocations);
    
    // Calculate metrics using real data
    const metrics = {
      percentAboveAvg: calculatePercentAboveAverage(allocations),
      volumeGrowth: await calculateVolumeGrowth(allocations),
      percentVolumeOnUpDays: await calculateUpDayVolume(allocations),
      aiVsSolPerformance: await calculateRelativePerformance(allocations)
    };
    
    // Analyze sentiment with real data
    const classification = analyzeMarketSentiment(metrics, allocations);
    
    // Save to Airtable with portfolio snapshot
    const sentimentTable = getTable('MARKET_SENTIMENT');
    await sentimentTable.create([
      {
        fields: {
          weekEndDate: new Date().toISOString(),
          classification: classification.sentiment,
          confidence: classification.confidence,
          reasons: classification.reasons.join('\n'),
          portfolioSnapshot: JSON.stringify(allocations),
          ...metrics
        }
      }
    ]);
    
    return NextResponse.json({ 
      success: true,
      classification,
      metrics,
      currentPortfolio: allocations
    });
  } catch (error) {
    console.error('Failed to analyze market sentiment:', error);
    return NextResponse.json(
      { error: 'Failed to analyze market sentiment' },
      { status: 500 }
    );
  }
}
