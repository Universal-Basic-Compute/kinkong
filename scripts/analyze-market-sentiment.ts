import { getTable } from '../backend/src/airtable/tables';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

interface TokenMetrics {
  symbol: string;
  price: number;
  price7dAvg: number;
  volume24h: number;
  volumeOnUpDay: boolean;
  priceChange24h: number;
}

async function getWeeklyMetrics() {
  try {
    // Get snapshots from the last 7 days
    const snapshotsTable = getTable('TOKEN_SNAPSHOTS');
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const records = await snapshotsTable.select({
      filterByFormula: `IS_AFTER({timestamp}, '${sevenDaysAgo.toISOString()}')`,
      sort: [{ field: 'timestamp', direction: 'desc' }]
    }).all();

    // Group snapshots by token
    const tokenSnapshots: { [key: string]: TokenMetrics[] } = {};
    
    records.forEach(record => {
      const token = record.get('token') as string;
      if (!tokenSnapshots[token]) {
        tokenSnapshots[token] = [];
      }
      
      tokenSnapshots[token].push({
        symbol: token,
        price: record.get('price') as number,
        price7dAvg: record.get('price7dAvg') as number,
        volume24h: record.get('volume24h') as number,
        volumeOnUpDay: record.get('volumeOnUpDay') as boolean,
        priceChange24h: record.get('priceChange24h') as number
      });
    });

    return tokenSnapshots;
  } catch (error) {
    console.error('Error fetching weekly metrics:', error);
    throw error;
  }
}

async function analyzeMarketSentiment() {
  try {
    console.log('Starting market sentiment analysis...');
    
    const tokenSnapshots = await getWeeklyMetrics();
    const tokens = Object.keys(tokenSnapshots);
    
    // Initialize counters
    let tokensAboveAvg = 0;
    let volumeOnUpDays = 0;
    let totalVolumeDays = 0;
    let totalVolumeThisWeek = 0;
    let totalVolumePrevWeek = 0;
    
    // Get SOL performance for comparison
    const solSnapshots = tokenSnapshots['SOL'] || [];
    const solPerformance = solSnapshots.length > 0 ? solSnapshots[0].priceChange24h : 0;
    
    // Analyze each token
    tokens.forEach(token => {
      const snapshots = tokenSnapshots[token];
      if (snapshots.length === 0) return;
      
      // Check if above 7-day average
      const latestSnapshot = snapshots[0];
      if (latestSnapshot.price > latestSnapshot.price7dAvg) {
        tokensAboveAvg++;
      }
      
      // Count volume on up/down days
      snapshots.forEach(snapshot => {
        if (snapshot.volumeOnUpDay) {
          volumeOnUpDays++;
        }
        totalVolumeDays++;
      });
      
      // Calculate weekly volumes
      const thisWeekVolume = snapshots.reduce((sum, s) => sum + s.volume24h, 0);
      totalVolumeThisWeek += thisWeekVolume;
      
      // Previous week volume (if available)
      if (snapshots.length > 7) {
        const prevWeekVolume = snapshots.slice(7).reduce((sum, s) => sum + s.volume24h, 0);
        totalVolumePrevWeek += prevWeekVolume;
      }
    });
    
    // Calculate percentages
    const percentAboveAvg = (tokensAboveAvg / tokens.length) * 100;
    const percentVolumeOnUpDays = (volumeOnUpDays / totalVolumeDays) * 100;
    const volumeGrowth = totalVolumePrevWeek > 0 
      ? ((totalVolumeThisWeek - totalVolumePrevWeek) / totalVolumePrevWeek) * 100 
      : 0;
    
    // Average AI token performance
    const aiPerformance = tokens
      .filter(t => t !== 'SOL')
      .reduce((sum, token) => {
        const snapshots = tokenSnapshots[token];
        return sum + (snapshots[0]?.priceChange24h || 0);
      }, 0) / (tokens.length - 1); // Exclude SOL from average
    
    // Check bullish criteria
    const bullishCriteria = [
      percentAboveAvg > 60,
      volumeGrowth > 0,
      percentVolumeOnUpDays > 60,
      aiPerformance > solPerformance
    ];
    
    // Check bearish criteria
    const bearishCriteria = [
      percentAboveAvg < 40,
      volumeGrowth < 0,
      percentVolumeOnUpDays < 40,
      aiPerformance < solPerformance
    ];
    
    const bullishCount = bullishCriteria.filter(Boolean).length;
    const bearishCount = bearishCriteria.filter(Boolean).length;
    
    // Determine market sentiment
    let sentiment;
    if (bullishCount >= 3) {
      sentiment = 'BULLISH';
    } else if (bearishCount >= 3) {
      sentiment = 'BEARISH';
    } else {
      sentiment = 'NEUTRAL';
    }
    
    // Save results to MARKET_SENTIMENT table
    const sentimentTable = getTable('MARKET_SENTIMENT');
    await sentimentTable.create([{
      fields: {
        weekStartDate: sevenDaysAgo.toISOString(),
        weekEndDate: new Date().toISOString(),
        totalTokens: tokens.length,
        tokensAbove7dAvg: tokensAboveAvg,
        weeklyVolume: totalVolumeThisWeek,
        prevWeekVolume: totalVolumePrevWeek,
        upDayVolume: volumeOnUpDays,
        totalVolume: totalVolumeDays,
        solPerformance,
        aiTokensPerformance: aiPerformance,
        classification: sentiment,
        notes: `
          Bullish criteria met: ${bullishCount}/4
          Bearish criteria met: ${bearishCount}/4
          
          Details:
          - ${percentAboveAvg.toFixed(1)}% tokens above 7d avg
          - ${volumeGrowth.toFixed(1)}% volume growth
          - ${percentVolumeOnUpDays.toFixed(1)}% volume on up days
          - AI tokens ${aiPerformance > solPerformance ? 'outperforming' : 'underperforming'} SOL
        `.trim()
      }
    }]);
    
    console.log('\nMarket Sentiment Analysis Results:');
    console.log('----------------------------------');
    console.log(`Classification: ${sentiment}`);
    console.log(`Tokens above 7d avg: ${percentAboveAvg.toFixed(1)}%`);
    console.log(`Volume growth: ${volumeGrowth.toFixed(1)}%`);
    console.log(`Volume on up days: ${percentVolumeOnUpDays.toFixed(1)}%`);
    console.log(`AI vs SOL performance: ${(aiPerformance - solPerformance).toFixed(1)}%`);
    
    return sentiment;
    
  } catch (error) {
    console.error('Error analyzing market sentiment:', error);
    throw error;
  }
}

// Run the analysis
analyzeMarketSentiment()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Script failed:', error);
    process.exit(1);
  });
