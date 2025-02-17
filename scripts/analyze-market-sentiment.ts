import { getTable } from '../backend/src/airtable/tables';
import dotenv from 'dotenv';
import path from 'path';

interface MarketClassification {
  sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  confidence: number;
  reasons: string[];
}

// Load environment variables
console.log('🔧 Initializing environment...');
const envPath = path.resolve(process.cwd(), '.env');
const result = dotenv.config({ path: envPath });
console.log('📁 Environment path:', envPath);
console.log('✅ Environment loaded:', {
  hasError: result.error ? true : false,
  hasAirtableKey: !!process.env.KINKONG_AIRTABLE_API_KEY,
  hasAirtableBase: !!process.env.KINKONG_AIRTABLE_BASE_ID
});

interface TokenMetrics {
  symbol: string;
  price: number;
  price7dAvg: number;
  volume24h: number;
  volumeOnUpDay: boolean;
  priceChange24h: number;
}

interface WeeklyAnalysis {
  sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  metrics: {
    percentAboveAvg: number;
    volumeGrowth: number;
    percentVolumeOnUpDays: number;
    aiVsSolPerformance: number;
    tokensAnalyzed: number;
    totalVolume: number;
    upDayVolume: number;
  };
  criteria: {
    bullish: boolean[];
    bearish: boolean[];
  };
}

async function getWeeklyMetrics(): Promise<{ [key: string]: TokenMetrics[] }> {
  console.log('📊 Fetching weekly metrics...');
  try {
    const tokensTable = getTable('TOKENS');
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    console.log('🔍 Querying tokens since:', sevenDaysAgo.toISOString());
    const records = await tokensTable.select({
      filterByFormula: `IS_AFTER({createdAt}, '${sevenDaysAgo.toISOString()}')`,
      sort: [{ field: 'createdAt', direction: 'desc' }]
    }).all();

    console.log(`📝 Found ${records.length} snapshots`);

    // Group snapshots by token
    const tokenSnapshots: { [key: string]: TokenMetrics[] } = {};
    
    records.forEach(record => {
      const token = record.get('symbol') as string;
      if (!token) {
        console.log('Warning: Record missing symbol:', record.id);
        return;
      }

      if (!tokenSnapshots[token]) {
        tokenSnapshots[token] = [];
      }
      
      tokenSnapshots[token].push({
        symbol: token,
        price: record.get('price') as number || 0,
        price7dAvg: record.get('price7dAvg') as number || 0,
        volume24h: record.get('volume7d') as number / 7 || 0,
        volumeOnUpDay: record.get('volumeOnUpDay') as boolean || false,
        priceChange24h: record.get('priceChange24h') as number || 0
      });
    });

    // Log data quality for each token
    Object.entries(tokenSnapshots).forEach(([token, snapshots]) => {
      console.log(`📈 ${token}:`, {
        snapshots: snapshots.length,
        latestPrice: snapshots[0]?.price.toFixed(4),
        latestChange: snapshots[0]?.priceChange24h.toFixed(2) + '%',
        hasVolume: snapshots[0]?.volume24h > 0,
        has7dAvg: snapshots[0]?.price7dAvg > 0
      });
    });

    return tokenSnapshots;
  } catch (error) {
    console.error('❌ Error fetching weekly metrics:', error);
    throw new Error(`Failed to fetch weekly metrics: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

function classifyMarket(metrics: {
  percentAboveAvg: number;
  volumeGrowth: number;
  percentVolumeOnUpDays: number;
  aiVsSolPerformance: number;
}): MarketClassification {
  const reasons: string[] = [];
  
  // Check bullish criteria
  const bullishCriteria = [
    { 
      condition: metrics.percentAboveAvg > 60,
      reason: `${metrics.percentAboveAvg.toFixed(1)}% of tokens above 7d average (>60% is bullish)`
    },
    {
      condition: metrics.volumeGrowth > 0,
      reason: `Volume growth is ${metrics.volumeGrowth.toFixed(1)}% (positive is bullish)`
    },
    {
      condition: metrics.percentVolumeOnUpDays > 60,
      reason: `${metrics.percentVolumeOnUpDays.toFixed(1)}% of volume on up days (>60% is bullish)`
    },
    {
      condition: metrics.aiVsSolPerformance > 0,
      reason: `AI tokens outperforming SOL by ${metrics.aiVsSolPerformance.toFixed(1)}% (outperformance is bullish)`
    }
  ];

  // Check bearish criteria
  const bearishCriteria = [
    {
      condition: metrics.percentAboveAvg < 40,
      reason: `${metrics.percentAboveAvg.toFixed(1)}% of tokens above 7d average (<40% is bearish)`
    },
    {
      condition: metrics.volumeGrowth < 0,
      reason: `Volume growth is ${metrics.volumeGrowth.toFixed(1)}% (negative is bearish)`
    },
    {
      condition: metrics.percentVolumeOnUpDays < 40,
      reason: `${metrics.percentVolumeOnUpDays.toFixed(1)}% of volume on up days (<40% is bearish)`
    },
    {
      condition: metrics.aiVsSolPerformance < 0,
      reason: `AI tokens underperforming SOL by ${Math.abs(metrics.aiVsSolPerformance).toFixed(1)}% (underperformance is bearish)`
    }
  ];

  const bullishCount = bullishCriteria.filter(c => c.condition).length;
  const bearishCount = bearishCriteria.filter(c => c.condition).length;

  // Add relevant reasons to the output
  if (bullishCount >= 3) {
    reasons.push(...bullishCriteria.filter(c => c.condition).map(c => c.reason));
  } else if (bearishCount >= 3) {
    reasons.push(...bearishCriteria.filter(c => c.condition).map(c => c.reason));
  } else {
    reasons.push(
      `Mixed signals: ${bullishCount} bullish and ${bearishCount} bearish criteria met`,
      `Percentages: ${metrics.percentAboveAvg.toFixed(1)}% above avg, ${metrics.volumeGrowth.toFixed(1)}% vol growth`,
      `Volume on up days: ${metrics.percentVolumeOnUpDays.toFixed(1)}%`,
      `AI vs SOL: ${metrics.aiVsSolPerformance > 0 ? '+' : ''}${metrics.aiVsSolPerformance.toFixed(1)}%`
    );
  }

  // Calculate confidence based on criteria strength
  const confidence = Math.max(bullishCount, bearishCount) / 4 * 100;

  return {
    sentiment: bullishCount >= 3 ? 'BULLISH' : bearishCount >= 3 ? 'BEARISH' : 'NEUTRAL',
    confidence,
    reasons
  };
}

async function analyzeMarketSentiment(): Promise<WeeklyAnalysis> {
  console.log('\n🔄 Starting market sentiment analysis...');
  
  try {
    const tokenSnapshots = await getWeeklyMetrics();
    const tokens = Object.keys(tokenSnapshots);
    
    if (tokens.length === 0) {
      throw new Error('No token data available for analysis');
    }
    
    // Initialize counters
    let tokensAboveAvg = 0;
    let volumeOnUpDays = 0;
    let totalVolumeDays = 0;
    let totalVolumeThisWeek = 0;
    let totalVolumePrevWeek = 0;
    
    // Get SOL performance for comparison
    const solSnapshots = tokenSnapshots['SOL'] || [];
    const solPerformance = solSnapshots.length > 0 ? solSnapshots[0].priceChange24h : 0;
    
    // Calculate AI token average performance (SINGLE calculation used throughout)
    const aiTokenPerformance = tokens
      .filter(t => t !== 'SOL')
      .reduce((sum, token) => {
        const snapshots = tokenSnapshots[token];
        return snapshots.length > 0 ? sum + snapshots[0].priceChange24h : sum;
      }, 0) / (tokens.length - 1);

    // Process each token's data
    tokens.forEach(token => {
      const snapshots = tokenSnapshots[token];
      if (snapshots.length === 0) return;

      const latestSnapshot = snapshots[0];
      
      const isAboveAvg = latestSnapshot.price > latestSnapshot.price7dAvg;
      const tokenUpDays = snapshots.filter(s => s.volumeOnUpDay).length;
      
      // Check if above 7-day average
      if (isAboveAvg) {
        tokensAboveAvg++;
      }

      // Process volume data
      volumeOnUpDays += snapshots.filter(s => s.volumeOnUpDay).length;
      totalVolumeDays += snapshots.length;
      totalVolumeThisWeek += snapshots.reduce((sum, s) => sum + s.volume24h, 0);
      
      if (snapshots.length > 7) {
        const prevWeekVolume = snapshots.slice(7).reduce((sum, s) => sum + s.volume24h, 0);
        totalVolumePrevWeek += prevWeekVolume;
      }

      console.log(`${token}:
        Price: $${latestSnapshot.price.toFixed(4)}
        Above 7d Avg: ${latestSnapshot.price > latestSnapshot.price7dAvg ? '✅' : '❌'}
        24h Change: ${latestSnapshot.priceChange24h.toFixed(2)}%
      `.replace(/^\s+/gm, ''));
    });
    
    // Calculate percentages
    const percentAboveAvg = (tokensAboveAvg / tokens.length) * 100;
    const percentVolumeOnUpDays = (volumeOnUpDays / totalVolumeDays) * 100;
    const volumeGrowth = totalVolumePrevWeek > 0 
      ? ((totalVolumeThisWeek - totalVolumePrevWeek) / totalVolumePrevWeek) * 100 
      : 0;
    
    // Calculate AI performance
    const aiPerformance = tokens
      .filter(t => t !== 'SOL')
      .reduce((sum, token) => {
        const snapshots = tokenSnapshots[token];
        return sum + (snapshots[0]?.priceChange24h || 0);
      }, 0) / (tokens.length - 1);
    
    // Check criteria
    const bullishCriteria = [
      percentAboveAvg > 60,
      volumeGrowth > 0,
      percentVolumeOnUpDays > 60,
      aiPerformance > solPerformance
    ];
    
    const bearishCriteria = [
      percentAboveAvg < 40,
      volumeGrowth < 0,
      percentVolumeOnUpDays < 40,
      aiPerformance < solPerformance
    ];
    
    const bullishCount = bullishCriteria.filter(Boolean).length;
    const bearishCount = bearishCriteria.filter(Boolean).length;
    
    // Determine sentiment
    let sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    if (bullishCount >= 3) {
      sentiment = 'BULLISH';
    } else if (bearishCount >= 3) {
      sentiment = 'BEARISH';
    } else {
      sentiment = 'NEUTRAL';
    }
    
    // Prepare analysis results
    const analysis: WeeklyAnalysis = {
      sentiment,
      metrics: {
        percentAboveAvg,
        volumeGrowth,
        percentVolumeOnUpDays,
        aiVsSolPerformance: aiTokenPerformance - solPerformance,
        tokensAnalyzed: tokens.length,
        totalVolume: totalVolumeThisWeek,
        upDayVolume: volumeOnUpDays
      },
      criteria: {
        bullish: bullishCriteria,
        bearish: bearishCriteria
      }
    };
    
    // Calculate the classification
    const metrics = {
      percentAboveAvg,
      volumeGrowth,
      percentVolumeOnUpDays,
      aiVsSolPerformance: aiPerformance - solPerformance
    };

    const classification = classifyMarket(metrics);

    // Enhanced console output
    console.log('\n📊 Market Sentiment Analysis Results:');
    console.log('=====================================');
    console.log(`Classification: ${classification.sentiment} (${classification.confidence.toFixed(1)}% confidence)`);
    console.log('\nReasons:');
    classification.reasons.forEach(reason => console.log(`• ${reason}`));
    console.log('\nDetailed Metrics:');
    console.log(`• Tokens above 7d avg: ${percentAboveAvg.toFixed(1)}%`);
    console.log(`• Volume growth: ${volumeGrowth.toFixed(1)}%`);
    console.log(`• Volume on up days: ${percentVolumeOnUpDays.toFixed(1)}%`);
    console.log(`• AI vs SOL performance: ${metrics.aiVsSolPerformance.toFixed(1)}%`);

    // Save to Airtable with enhanced notes
    const sentimentTable = getTable('MARKET_SENTIMENT');
    await sentimentTable.create([{
      fields: {
        weekStartDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        weekEndDate: new Date().toISOString(),
        classification: classification.sentiment,
        confidence: classification.confidence,
        totalTokens: tokens.length,
        tokensAbove7dAvg: tokensAboveAvg,
        weeklyVolume: totalVolumeThisWeek,
        prevWeekVolume: totalVolumePrevWeek,
        upDayVolume: volumeOnUpDays,
        totalVolume: totalVolumeDays,
        solPerformance,
        aiTokensPerformance: aiPerformance,
        notes: classification.reasons.join('\n')
      }
    }]);
    
    // Print summary
    console.log('\n📊 Market Sentiment Analysis Results:');
    console.log('=====================================');
    console.log(`Classification: ${sentiment} ${sentiment === 'BULLISH' ? '🚀' : sentiment === 'BEARISH' ? '🐻' : '😐'}`);
    console.log(`Tokens above 7d avg: ${percentAboveAvg.toFixed(1)}%`);
    console.log(`Volume growth: ${volumeGrowth.toFixed(1)}%`);
    console.log(`Volume on up days: ${percentVolumeOnUpDays.toFixed(1)}%`);
    console.log(`AI vs SOL performance: ${(aiPerformance - solPerformance).toFixed(1)}%`);
    
    return analysis;
    
  } catch (error) {
    console.error('❌ Error analyzing market sentiment:', error);
    throw new Error(`Market sentiment analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Run the analysis with proper error handling
console.log('🚀 Starting market sentiment analysis script...');
analyzeMarketSentiment()
  .then((analysis) => {
    console.log('\n✅ Analysis completed successfully!');
    console.log('Final sentiment:', analysis.sentiment);
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
