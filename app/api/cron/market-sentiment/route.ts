import { NextResponse } from 'next/server';
import { getTable } from '@/backend/src/airtable/tables';

export async function GET(request: Request) {
  try {
    // Verify cron secret if needed
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET_KEY}`) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    console.log('Starting scheduled market sentiment analysis...');
    
    // Get token data
    const tokens = await getTable('TOKENS').select({
      filterByFormula: '{isActive} = 1'
    }).all();

    // Calculate metrics
    const tokensAboveAvg = tokens.filter(t => 
      (t.get('price') || 0) > (t.get('price7dAvg') || 0)
    ).length;

    const volumeOnUpDays = tokens.filter(t => 
      t.get('volumeOnUpDay') === true
    ).length;

    // Calculate AI vs SOL performance
    const solToken = tokens.find(t => t.get('symbol') === 'SOL');
    const aiTokens = tokens.filter(t => t.get('symbol') !== 'SOL');
    const solPerformance = solToken?.get('priceChange24h') || 0;
    const aiPerformance = aiTokens.reduce((sum, t) => 
      sum + (t.get('priceChange24h') || 0), 0
    ) / aiTokens.length;

    // Calculate metrics
    const metrics = {
      tokensAbove7dAvg: tokensAboveAvg,
      totalTokens: tokens.length,
      volumeGrowth: 0, // Simplified for now
      percentVolumeOnUpDays: (volumeOnUpDays / tokens.length) * 100,
      aiVsSolPerformance: aiPerformance - solPerformance
    };

    // Determine sentiment
    let sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
    let confidence = 50;
    const reasons: string[] = [];

    if (tokensAboveAvg > tokens.length * 0.6) {
      sentiment = 'BULLISH';
      confidence += 20;
      reasons.push(`${tokensAboveAvg}/${tokens.length} tokens above 7d average`);
    } else if (tokensAboveAvg < tokens.length * 0.4) {
      sentiment = 'BEARISH';
      confidence += 20;
      reasons.push(`Only ${tokensAboveAvg}/${tokens.length} tokens above 7d average`);
    }

    if (volumeOnUpDays > tokens.length * 0.6) {
      if (sentiment === 'BULLISH') confidence += 20;
      sentiment = 'BULLISH';
      reasons.push('Majority of volume on up days');
    } else if (volumeOnUpDays < tokens.length * 0.4) {
      if (sentiment === 'BEARISH') confidence += 20;
      sentiment = 'BEARISH';
      reasons.push('Majority of volume on down days');
    }

    // Store result in Airtable
    const sentimentTable = getTable('MARKET_SENTIMENT');
    await sentimentTable.create([{
      fields: {
        classification: sentiment,
        confidence: Math.min(confidence, 100),
        tokensAbove7dAvg: tokensAboveAvg,
        totalTokens: tokens.length,
        weeklyVolume: 0, // Simplified
        prevWeekVolume: 0, // Simplified
        solPerformance,
        aiTokensPerformance: aiPerformance,
        notes: reasons.join('\n'),
        weekEndDate: new Date().toISOString()
      }
    }]);

    return NextResponse.json({
      sentiment,
      confidence: Math.min(confidence, 100),
      reasons,
      metrics
    });

  } catch (error) {
    console.error('Failed to analyze market sentiment:', error);
    return NextResponse.json(
      { error: 'Failed to analyze market sentiment' },
      { status: 500 }
    );
  }
}
