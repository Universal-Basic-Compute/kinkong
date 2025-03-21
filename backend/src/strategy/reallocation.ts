import { base } from '../airtable/client';
import { getTokenPrice } from '../utils/jupiter';

export const TABLES = {
  PORTFOLIO: 'PORTFOLIO',
  TRADES: 'TRADES', 
  TOKENS: 'TOKENS',
  SIGNALS: 'SIGNALS',
  REPORTS: 'REPORTS',
  PORTFOLIO_SNAPSHOTS: 'PORTFOLIO_SNAPSHOTS',
  INVESTMENTS: 'INVESTMENTS',
  MARKET_SENTIMENT: 'MARKET_SENTIMENT',
  MESSAGES: 'MESSAGES',
  THOUGHTS: 'THOUGHTS',
  SENTIMENT_ANALYSIS: 'SENTIMENT_ANALYSIS'
};

export function getTable(tableName: string) {
  if (!tableName) {
    throw new Error('Table name is required');
  }
  console.log('Getting table:', tableName);
  return base.table(tableName);
}

module.exports = { TABLES, getTable };

// Type definitions remain for TypeScript but don't affect runtime
interface Portfolio {
  token: string;
  allocation: number;
  lastUpdate: string;
  usdValue?: number;
}

interface PortfolioSnapshot {
  timestamp: string;
  totalValue: number;
  holdings: {
    token: string;
    amount: number;
    price: number;
    value: number;
  }[];
}

interface Trade {
  createdAt: string;  // ISO 8601 UTC format
  token: string;
  action: 'BUY' | 'SELL';
  amount: number;
  price: number;
  lastUpdateTime?: string;  // ISO 8601 UTC format
}

interface Token {
  token: string;
  name: string;
  mint: string;
  isActive: boolean;
  volume7d: number;
  liquidity: number;
  volumeGrowth: number;
  pricePerformance: number;
  holderCount: number;
  price: number;
  price7dAvg: number;
  volumeOnUpDay: boolean;
  priceChange24h: number;
}

interface Signal {
  createdAt: string;
  token: string;
  type: 'BUY' | 'SELL';
  timeframe: 'SCALP' | 'INTRADAY' | 'SWING' | 'POSITION';
  entryPrice?: number;
  targetPrice?: number;
  stopLoss?: number;
  confidence: 'LOW' | 'MEDIUM' | 'HIGH';
  reason: string;
  url?: string;
  expectedReturn?: number;
  actualReturn?: number;
  accuracy?: number;
  wallet?: string;
  code?: string;
}

interface MarketSentiment {
  weekStartDate: string;
  weekEndDate: string;
  classification: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  confidence: number;
  totalTokens: number;
  tokensAbove7dAvg: number;
  weeklyVolume: number;
  prevWeekVolume: number;
  upDayVolume: number;
  totalVolume: number;
  solPerformance: number;
  aiTokensPerformance: number;
  notes: string;
}

interface Message {
  createdAt: string;
  role: 'user' | 'assistant';
  content: string;
  code: string;
  context?: string;
  wallet?: string;
}

interface Subscription {
  code: string;
  startDate: string;
  endDate: string;
  status: 'ACTIVE' | 'EXPIRED' | 'CANCELLED';
  amount: number;
  signature: string;
  wallet?: string;
}

interface Thought {
  type: 'TECHNICAL_ANALYSIS' | 'REALLOCATION' | 'SIGNAL';
  content: string;
  context: Record<string, any>;
}

interface TradeOrder {
  token: string;
  action: 'BUY' | 'SELL';
  amount: number;
  reason: string;
}

interface TokenScore {
  token: string;
  baseScore: number;
  volumeScore: number;
  priceScore: number;
  liquidityScore: number;
  finalScore: number;
  currentAllocation: number;
  targetAllocation: number;
}

function normalizeScore(value: number, allValues: number[]): number {
  const min = Math.min(...allValues);
  const max = Math.max(...allValues);
  if (max === min) return 50; // Default to middle if all values are the same
  return ((value - min) / (max - min)) * 100;
}

function calculateBaseScore(token: Token): number {
  // Base score considers basic token health metrics
  const hasGoodVolume = token.volume7d / 7 >= 10000; // Min $10k daily
  const hasGoodLiquidity = token.liquidity >= 30000; // Min $30k liquidity
  
  let score = 50; // Start at neutral
  if (hasGoodVolume) score += 25;
  if (hasGoodLiquidity) score += 25;
  
  return score;
}

function calculatePriceScore(priceChange24h: number): number {
  // Convert price change to 0-100 score
  // +10% change = 100 score
  // -10% change = 0 score
  // 0% change = 50 score
  const score = (priceChange24h + 10) * 5;
  return Math.max(0, Math.min(100, score));
}

async function calculateTokenScores(tokens: Token[]): Promise<TokenScore[]> {
  // 1. Calculate base metrics
  const scores = tokens.map(token => {
    // Base score (0-100)
    const baseScore = calculateBaseScore(token);
    
    // Volume score (0-100)
    const volumeScore = normalizeScore(token.volume7d / 7, tokens.map(t => t.volume7d / 7));
    
    // Price momentum score (0-100)
    const priceScore = calculatePriceScore(token.priceChange24h || 0);
    
    // Liquidity score (0-100)
    const liquidityScore = normalizeScore(token.liquidity, tokens.map(t => t.liquidity));

    // Weighted final score
    const finalScore = (
      baseScore * 0.3 +      // 30% weight on base metrics
      volumeScore * 0.3 +    // 30% weight on volume
      priceScore * 0.2 +     // 20% weight on price momentum
      liquidityScore * 0.2    // 20% weight on liquidity
    );

    return {
      token: token.token,
      baseScore,
      volumeScore,
      priceScore,
      liquidityScore,
      finalScore,
      currentAllocation: 0, // Will be fetched from portfolio
      targetAllocation: 0 // Will be calculated next
    };
  });

  // 2. Sort by final score
  const sortedScores = scores.sort((a, b) => b.finalScore - a.finalScore);

  // 3. Calculate target allocations
  const top3 = sortedScores.slice(0, 3);
  const bottom3 = sortedScores.slice(-3);

  return sortedScores.map(score => ({
    ...score,
    targetAllocation: calculateTargetAllocation(score, top3, bottom3)
  }));
}

function calculateTargetAllocation(
  score: TokenScore, 
  top3: TokenScore[], 
  bottom3: TokenScore[]
): number {
  // Start with base allocation
  let target = 10; // 10% base

  // Adjust for performance
  if (top3.includes(score)) {
    target += 2; // +2% for top performers
  } else if (bottom3.includes(score)) {
    target -= 2; // -2% for bottom performers
  }

  // Cap at maximum allocation
  return Math.min(target, 12); // Max 12%
}

async function getMarketSentiment(): Promise<'BULLISH' | 'BEARISH' | 'NEUTRAL'> {
  const table = getTable('MARKET_SENTIMENT');
  const records = await table
    .select({
      maxRecords: 1,
      sort: [{ field: 'weekEndDate', direction: 'desc' }]
    })
    .firstPage();

  if (records.length === 0) return 'NEUTRAL';
  return records[0].get('classification') as 'BULLISH' | 'BEARISH' | 'NEUTRAL';
}

async function executeOrder(order: TradeOrder) {
  // TODO: Implement order execution via Jupiter
  console.log('Executing order:', order);
}

async function recordReallocation(data: {
  timestamp: Date;
  token: string;
  action: 'BUY' | 'SELL';
  amount: number;
  reason: string;
}) {
  // Get token price from DexScreener
  const price = await getTokenPrice(data.token);
  
  const table = getTable('TRADES');
  await table.create([{
    fields: {
      timestamp: data.timestamp.toISOString(),
      token: data.token,
      action: data.action,
      amount: data.amount,
      price: price || 0,
      reason: data.reason
    }
  }]);
}

export async function executeReallocation() {
  try {
    // 1. Get current market sentiment
    const sentiment = await getMarketSentiment();
    
    // 2. Determine portfolio structure based on sentiment
    const structure = sentiment === 'BEARISH' 
      ? { aiTokens: 40, sol: 20, stables: 40 }
      : { aiTokens: 70, sol: 20, stables: 10 };

    // 3. Get table references first
    const portfolioTable = getTable('PORTFOLIO');
    const tokensTable = getTable('TOKENS');  // Single declaration here

    // 4. Get current portfolio
    const portfolioRecords = await portfolioTable.select().all();

    const currentPortfolio = new Map(
      portfolioRecords.map(record => [
        record.get('token') as string,
        {
          amount: record.get('amount') as number,
          usdValue: record.get('usdValue') as number
        }
      ])
    );

    // Calculate total USD value first - this is the ACTUAL total value from wallet
    const totalValue = Array.from(currentPortfolio.values())
      .reduce((sum, holding) => sum + (holding.usdValue || 0), 0);

    console.log('Actual portfolio total value:', totalValue.toFixed(2));

    // Get current prices for all tokens using mints
    const tokenPrices = new Map<string, number>();
    for (const [token] of currentPortfolio) {
      const cleanToken = token.trim();
      
      if (['USDC', 'USDT'].includes(cleanToken)) {
        tokenPrices.set(token, 1); // Stablecoins are always $1
        continue;
      }

      // Get mint for the token
      const tokenRecord = await tokensTable
        .select({
          filterByFormula: `{token} = '${cleanToken}'`
        })
        .firstPage();

      if (tokenRecord.length > 0) {
        const mint = tokenRecord[0].get('mint') as string;
        if (mint) {
          console.log(`Getting price for ${cleanToken} using mint: ${mint}`);
          const price = await getTokenPrice(mint);
          if (price) {
            tokenPrices.set(token, price);
            console.log(`Found price for ${cleanToken} (${mint}): $${price}`);
          } else {
            console.warn(`Could not get price for ${cleanToken} mint: ${mint}`);
          }
        } else {
          console.warn(`No mint found for token ${cleanToken}`);
        }
      } else {
        console.warn(`No token record found for ${cleanToken}`);
      }
    }

    // Then calculate percentages based on actual USD values
    const updatedPortfolio = new Map(
      Array.from(currentPortfolio.entries()).map(([token, data]) => {
        const price = tokenPrices.get(token) || 0;
        const currentPercentage = (data.usdValue / totalValue) * 100;
        
        return [token, {
          ...data,
          price,
          currentPercentage
        }];
      })
    );

    console.log('Current portfolio value:', totalValue.toFixed(2));
    console.log('Current allocations:', Object.fromEntries(
      Array.from(updatedPortfolio.entries())
        .map(([token, data]) => [
          token, 
          {
            amount: data.amount?.toFixed(4),
            price: data.price,
            usdValue: data.usdValue?.toFixed(2),
            currentPercentage: data.currentPercentage.toFixed(1) + '%'
          }
        ])
    ));

    // 4. Get current tokens and calculate scores
    const tokenRecords = await tokensTable
      .select({
        filterByFormula: '{isActive} = 1'
      })
      .all();

    const tokens: Token[] = tokenRecords.map(record => ({
      token: record.get('token') as string || record.get('name') as string,
      name: record.get('name') as string,
      mint: record.get('mint') as string,
      isActive: true,
      volume7d: record.get('volume7d') as number,
      liquidity: record.get('liquidity') as number,
      volumeGrowth: record.get('volumeGrowth') as number || 0,
      pricePerformance: record.get('pricePerformance') as number || 0,
      holderCount: record.get('holderCount') as number || 0,
      price: record.get('price') as number || 0,
      price7dAvg: record.get('price7dAvg') as number || 0,
      volumeOnUpDay: record.get('volumeOnUpDay') as boolean || false,
      priceChange24h: record.get('priceChange24h') as number || 0
    }));

    const tokenScores = await calculateTokenScores(tokens);

    // 5. Update current allocations from portfolio
    for (const score of tokenScores) {
      const portfolio = currentPortfolio.get(score.token);
      if (portfolio) {
        // Calculate allocation percentage from USD value
        score.currentAllocation = (portfolio.usdValue / totalValue) * 100;
      } else {
        score.currentAllocation = 0;
      }
    }

    // 6. Generate trade orders
    // Calculate total portfolio value and print current allocations
    // Use the previously calculated totalValue and updatedPortfolio

    // First calculate all needed trades
    const potentialOrders: TradeOrder[] = [];

    for (const score of tokenScores) {
      const currentValue = currentPortfolio.get(score.token)?.usdValue || 0;
      const currentPercentage = (currentValue / totalValue) * 100;
      
      // Calculate target value based on actual portfolio value
      const targetValue = (score.targetAllocation / 100) * totalValue;
      const difference = targetValue - currentValue;
      
      // Only trade if adjustment > 3%
      if (Math.abs(difference) / totalValue * 100 > 3) {
        const price = await getTokenPrice(score.token);
        if (!price) {
          console.log(`Skipping ${score.token} - no price available`);
          continue;
        }

        console.log(`${score.token}: Current: ${currentPercentage.toFixed(2)}%, Target: ${(targetValue/totalValue*100).toFixed(2)}%, Difference: $${difference.toFixed(2)}`);

        const tokenAmount = Math.abs(difference) / price;
        potentialOrders.push({
          token: score.token,
          action: difference > 0 ? 'BUY' : 'SELL',
          amount: tokenAmount,
          reason: `Reallocation: ${score.finalScore.toFixed(2)} score, ${difference > 0 ? 'increasing' : 'decreasing'} allocation`
        });
      }
    }

    // Sort orders: execute sells first to generate USDC for buys
    const orders = [
      ...potentialOrders.filter(o => o.action === 'SELL'),
      ...potentialOrders.filter(o => o.action === 'BUY')
    ];

    console.log('\nPlanned trades:');
    orders.forEach(order => {
      console.log(`${order.action} ${order.amount.toFixed(4)} ${order.token} - ${order.reason}`);
    });

    // 5. Execute trades
    for (const order of orders) {
      try {
        await executeOrder(order);
        // Log successful reallocation
        await recordReallocation({
          timestamp: new Date(),
          token: order.token,
          action: order.action,
          amount: order.amount,
          reason: order.reason
        });
      } catch (error) {
        console.error(`Failed to execute order for ${order.token}:`, error);
        // Record failed reallocation attempt
      }
    }

    return {
      success: true,
      sentiment,
      structure,
      orders
    };

  } catch (error) {
    console.error('Reallocation failed:', error);
    throw error;
  }
}
