import { getTable } from '../airtable/tables';
import { getTokenData } from '../airtable/tokens';
import { getCurrentPortfolio } from './portfolio';
import { getTokenPrices } from '../utils/jupiter';
import fetch from 'node-fetch';
import Airtable from 'airtable';

function classifyMarket(metrics: WeeklyAnalysis['metrics']): MarketClassification {
  let bullishPoints = 0;
  let bearishPoints = 0;
  const reasons: string[] = [];

  // Analyze percent above average
  if (metrics.percentAboveAvg > 60) {
    bullishPoints += 2;
    reasons.push(`${metrics.percentAboveAvg.toFixed(1)}% of tokens above 7d average`);
  } else if (metrics.percentAboveAvg < 40) {
    bearishPoints += 2;
    reasons.push(`Only ${metrics.percentAboveAvg.toFixed(1)}% of tokens above 7d average`);
  }

  // Analyze volume growth
  if (metrics.volumeGrowth > 10) {
    bullishPoints += 2;
    reasons.push(`Volume up ${metrics.volumeGrowth.toFixed(1)}% from last week`);
  } else if (metrics.volumeGrowth < -10) {
    bearishPoints += 2;
    reasons.push(`Volume down ${Math.abs(metrics.volumeGrowth).toFixed(1)}% from last week`);
  }

  // Analyze volume on up days
  if (metrics.percentVolumeOnUpDays > 60) {
    bullishPoints += 1;
    reasons.push(`${metrics.percentVolumeOnUpDays.toFixed(1)}% of volume on up days`);
  } else if (metrics.percentVolumeOnUpDays < 40) {
    bearishPoints += 1;
    reasons.push(`Only ${metrics.percentVolumeOnUpDays.toFixed(1)}% of volume on up days`);
  }

  // Analyze AI vs SOL performance
  if (metrics.aiVsSolPerformance > 5) {
    bullishPoints += 1;
    reasons.push(`AI tokens outperforming SOL by ${metrics.aiVsSolPerformance.toFixed(1)}%`);
  } else if (metrics.aiVsSolPerformance < -5) {
    bearishPoints += 1;
    reasons.push(`AI tokens underperforming SOL by ${Math.abs(metrics.aiVsSolPerformance).toFixed(1)}%`);
  }

  // Calculate total points and confidence
  const totalPoints = bullishPoints + bearishPoints;
  let confidence = 0;
  let sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';

  if (bullishPoints > bearishPoints) {
    sentiment = 'BULLISH';
    confidence = (bullishPoints / totalPoints) * 100;
  } else if (bearishPoints > bullishPoints) {
    sentiment = 'BEARISH';
    confidence = (bearishPoints / totalPoints) * 100;
  } else {
    sentiment = 'NEUTRAL';
    confidence = 50;
    reasons.push('Mixed signals with no clear direction');
  }

  return {
    sentiment,
    confidence,
    reasons
  };
}

interface WeeklyAnalysis {
  metrics: {
    percentAboveAvg: number;
    volumeGrowth: number;
    percentVolumeOnUpDays: number;
    aiVsSolPerformance: number;
  };
}

interface MarketClassification {
  sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  confidence: number;
  reasons: string[];
}

interface TokenSnapshot {
  token: string;
  mint: string;
  timestamp: string;
  price: number;
  price7dAvg: number;
  volume24h: number;
  volumeOnUpDay: boolean;
  liquidity: number;
  priceChange24h: number;
  isActive: boolean;
}

export async function recordPortfolioSnapshot() {
  try {
    console.log('Starting portfolio snapshot recording...');
    
    // Get current portfolio
    console.log('Fetching current portfolio...');
    const portfolio = await getCurrentPortfolio();
    console.log('Current portfolio:', portfolio);
    
    // Get token prices and metrics
    console.log('Fetching token data...');
    const tokens = await getTable('TOKENS').select({
      filterByFormula: '{isActive} = 1'
    }).all();

    // Current timestamp
    const timestamp = new Date().toISOString();

    // Create snapshots for each token
    const snapshots: TokenSnapshot[] = [];
    for (const token of tokens) {
      try {
        // Get DexScreener data for current metrics
        const dexScreenerData = await getDexScreenerData(token.get('mint') as string);
        const pair = dexScreenerData.pairs?.[0];

        // Get historical price data for 7d average
        const historicalPrices = await getHistoricalPrices(token.get('mint') as string);
        const price7dAvg = calculatePriceAverage(historicalPrices);

        // Create snapshot
        const snapshot: TokenSnapshot = {
          token: token.get('symbol') as string,
          mint: token.get('mint') as string,
          timestamp,
          price: Number(pair?.priceUsd || 0),
          price7dAvg,
          volume24h: pair?.volume?.h24 || 0,
          volumeOnUpDay: (pair?.priceChange?.h24 || 0) > 0,
          liquidity: pair?.liquidity?.usd || 0,
          priceChange24h: pair?.priceChange?.h24 || 0,
          isActive: true
        };

        snapshots.push(snapshot);
      } catch (error) {
        console.error(`Error processing snapshot for ${token.get('symbol')}:`, error);
      }
    }

    // Save snapshots to Airtable
    const snapshotsTable = getTable('TOKEN_SNAPSHOTS');
    for (const snapshot of snapshots) {
      try {
        await snapshotsTable.create([{
          fields: {
            token: snapshot.token,
            mint: snapshot.mint,
            timestamp: snapshot.timestamp,
            price: snapshot.price,
            price7dAvg: snapshot.price7dAvg,
            volume24h: snapshot.volume24h,
            volumeOnUpDay: snapshot.volumeOnUpDay,
            liquidity: snapshot.liquidity,
            priceChange24h: snapshot.priceChange24h,
            isActive: snapshot.isActive
          }
        }]);
        console.log(`Created snapshot for ${snapshot.token}`);
      } catch (error) {
        console.error(`Error saving snapshot for ${snapshot.token}:`, error);
      }
    }

    // Calculate and store portfolio value
    const totalValue = portfolio.reduce((sum, holding) => {
      const tokenSnapshot = snapshots.find(s => s.token === holding.token);
      return sum + (holding.allocation * (tokenSnapshot?.price || 0));
    }, 0);

    // Save portfolio snapshot
    const portfolioSnapshotsTable = getTable('PORTFOLIO_SNAPSHOTS');
    await portfolioSnapshotsTable.create([{
      fields: {
        timestamp,
        totalValue,
        holdingsJson: JSON.stringify(portfolio.map(holding => {
          const tokenSnapshot = snapshots.find(s => s.token === holding.token);
          return {
            token: holding.token,
            amount: holding.allocation,
            price: tokenSnapshot?.price || 0,
            value: holding.allocation * (tokenSnapshot?.price || 0)
          };
        }))
      }
    }]);

    console.log('Successfully recorded all snapshots');

    // Calculate metrics from snapshots
    let tokensAboveAvg = 0;
    let totalVolumeThisWeek = 0;
    let totalVolumePrevWeek = 0;
    let volumeOnUpDays = 0;
    let totalVolumeDays = 0;
    let aiPerformance = 0;
    let solPerformance = 0;

    // Calculate metrics from snapshots
    for (const snapshot of snapshots) {
      // Count tokens above 7d average
      if (snapshot.price > snapshot.price7dAvg) {
        tokensAboveAvg++;
      }

      // Add to volume totals
      totalVolumeThisWeek += snapshot.volume24h;
      if (snapshot.volumeOnUpDay) {
        volumeOnUpDays++;
      }
      totalVolumeDays++;

      // Calculate performance (simplified - you may want to adjust this)
      if (snapshot.token === 'SOL') {
        solPerformance = snapshot.priceChange24h;
      } else {
        aiPerformance += snapshot.priceChange24h;
      }
    }

    // Average AI token performance
    aiPerformance = aiPerformance / (snapshots.length - 1); // Subtract 1 for SOL

    // Get previous week's volume (you may want to fetch this from historical data)
    totalVolumePrevWeek = totalVolumeThisWeek * 0.9; // Placeholder calculation

    // Calculate metrics for notifications
    const notificationMetrics = {
      percentAboveAvg: (tokensAboveAvg / tokens.length) * 100,
      volumeGrowth: totalVolumePrevWeek > 0 
        ? ((totalVolumeThisWeek - totalVolumePrevWeek) / totalVolumePrevWeek) * 100 
        : 0,
      percentVolumeOnUpDays: (volumeOnUpDays / totalVolumeDays) * 100,
      aiVsSolPerformance: aiPerformance - solPerformance
    };

    const classification = classifyMarket(notificationMetrics);

    // Send notifications
    await sendNotifications(notificationMetrics, classification);

    return { totalValue, snapshots };

  } catch (error) {
    console.error('Failed to record portfolio snapshot:', error);
    throw error;
  }
}

async function getHistoricalPrices(mint: string): Promise<number[]> {
  try {
    // Get snapshots from the last 7 days
    const snapshotsTable = getTable('TOKEN_SNAPSHOTS');
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const records = await snapshotsTable.select({
      filterByFormula: `AND(
        {mint} = '${mint}',
        IS_AFTER({timestamp}, '${sevenDaysAgo.toISOString()}')
      )`,
      sort: [{ field: 'timestamp', direction: 'desc' }]
    }).all();

    // Extract prices from records
    return records.map(record => record.get('price') as number);
  } catch (error) {
    console.error(`Error fetching historical prices for ${mint}:`, error);
    return [];
  }
}

// Helper function to calculate average price
function calculatePriceAverage(prices: number[]): number {
  if (prices.length === 0) return 0;
  return prices.reduce((sum, price) => sum + price, 0) / prices.length;
}

async function sendNotifications(metrics: WeeklyAnalysis['metrics'], classification: MarketClassification) {
  try {
    // Format message
    const message = `🤖 KinKong Market Sentiment Update

Classification: ${classification.sentiment} (${classification.confidence.toFixed(1)}% confidence)

Key Metrics:
• Tokens above 7d avg: ${metrics.percentAboveAvg.toFixed(1)}%
• Volume growth: ${metrics.volumeGrowth.toFixed(1)}%
• Volume on up days: ${metrics.percentVolumeOnUpDays.toFixed(1)}%
• AI vs SOL: ${metrics.aiVsSolPerformance > 0 ? '+' : ''}${metrics.aiVsSolPerformance.toFixed(1)}%

Reasons:
${classification.reasons.map(r => '• ' + r).join('\n')}`;

    // Send Telegram message
    if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
      console.log('📱 Sending Telegram notification...');
      const telegramUrl = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`;
      const response = await fetch(telegramUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: process.env.TELEGRAM_CHAT_ID,
          text: message,
          parse_mode: 'HTML'
        })
      });
      
      if (!response.ok) {
        throw new Error(`Telegram API error: ${response.status}`);
      }
      console.log('✅ Telegram notification sent');
    }

    // Record thought in Kinos Airtable
    if (process.env.KINOS_AIRTABLE_API_KEY && process.env.KINOS_AIRTABLE_BASE_ID) {
      console.log('💭 Recording thought in Kinos...');
      const kinosBase = new Airtable({
        apiKey: process.env.KINOS_AIRTABLE_API_KEY
      }).base(process.env.KINOS_AIRTABLE_BASE_ID);

      const thoughtsTable = kinosBase.table('THOUGHTS');
      await thoughtsTable.create([
        {
          fields: {
            thoughtId: `kinkong-sentiment-${Date.now()}`,
            swarmId: 'kinkong',
            content: message,
            createdAt: new Date().toISOString()
          }
        }
      ]);
      console.log('✅ Thought recorded in Kinos');
    }
  } catch (error) {
    console.error('❌ Error sending notifications:', error);
  }
}


// Helper function to get DexScreener data (already defined in your token fetching script)
async function getDexScreenerData(mint: string, retries = 3) {
  const DEXSCREENER_API = 'https://api.dexscreener.com/latest/dex/tokens';
  
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(`${DEXSCREENER_API}/${mint}`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
    }
  }
  return {};
}
import { getTokenData } from '../airtable/tokens';

interface MarketClassification {
  sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  confidence: number;
  reasons: string[];
}

export async function analyzeMarketSentiment(): Promise<MarketClassification> {
  try {
    // Get token data
    const tokens = await getTokenData();
    
    // Calculate metrics
    const tokensAbove7dAvg = tokens.filter(t => t.price > t.price7dAvg).length;
    const volumeOnUpDays = tokens.filter(t => t.volumeOnUpDay).length;
    
    // Determine sentiment
    let sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
    let confidence = 0;
    const reasons: string[] = [];

    if (tokensAbove7dAvg > tokens.length * 0.6) {
      sentiment = 'BULLISH';
      confidence += 20;
      reasons.push(`${tokensAbove7dAvg}/${tokens.length} tokens above 7d average`);
    } else if (tokensAbove7dAvg < tokens.length * 0.4) {
      sentiment = 'BEARISH';
      confidence += 20;
      reasons.push(`Only ${tokensAbove7dAvg}/${tokens.length} tokens above 7d average`);
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

    return {
      sentiment,
      confidence: Math.min(confidence, 100),
      reasons
    };

  } catch (error) {
    console.error('Failed to analyze market sentiment:', error);
    throw error;
  }
}
