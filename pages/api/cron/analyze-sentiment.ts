import { NextResponse } from 'next/server';
import { getTable } from '@/backend/src/airtable/tables';
import { Connection, PublicKey } from '@solana/web3.js';
import { getCurrentPortfolio, calculateCurrentAllocations } from '@/utils/portfolio';
import { getTokenMetrics } from '@/utils/metrics';
import { generateTokenChart } from '@/utils/charts';
import { analyzeTradingOpportunity } from '@/utils/llm-analysis';
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
    
    // Collect detailed data for each token
    const tokenAnalyses = await Promise.all(
      Object.keys(allocations).map(async (token) => {
        const metrics = await getTokenMetrics(token);
        const chart = await generateTokenChart(token);
        return analyzeTradingOpportunity({ token, metrics, chart });
      })
    );

    // Calculate aggregate sentiment
    const classification = {
      sentiment: calculateOverallSentiment(tokenAnalyses),
      confidence: calculateAverageConfidence(tokenAnalyses),
      reasons: extractKeyReasons(tokenAnalyses)
    };

    // Select top performers
    const topPerformers = tokenAnalyses
      .sort((a, b) => (b.score * b.confidence) - (a.score * a.confidence))
      .slice(0, 3);
    
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
      tokenAnalyses,
      topPerformers,
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
