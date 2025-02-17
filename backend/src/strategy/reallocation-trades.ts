import { getTable } from '../airtable/tables';
import type { MarketSentiment, Portfolio } from '../airtable/tables';
import { getTokenPrices } from '../utils/jupiter';
import { sendTelegramMessage } from '../utils/telegram';
import { createThought } from '../airtable/thoughts';

interface TokenAllocation {
  aiTokens: number;
  sol: number;
  stables: number;
}

const ALLOCATIONS: Record<'BULLISH' | 'BEARISH' | 'NEUTRAL', TokenAllocation> = {
  BULLISH: { aiTokens: 70, sol: 20, stables: 10 },
  BEARISH: { aiTokens: 40, sol: 20, stables: 40 },
  NEUTRAL: { aiTokens: 50, sol: 30, stables: 20 }
};

export interface ReallocationTrade {
  token: string;
  action: 'BUY' | 'SELL';
  targetPercentage: number;
  currentPercentage: number;
  reason: string;
}

export async function calculateReallocationTrades(): Promise<ReallocationTrade[]> {
  const trades: ReallocationTrade[] = [];
  
  // Get current market sentiment
  const sentimentTable = getTable('MARKET_SENTIMENT');
  const [latestSentiment] = await sentimentTable
    .select({
      maxRecords: 1,
      sort: [{ field: 'weekStartDate', direction: 'desc' }]
    })
    .firstPage();

  if (!latestSentiment) {
    throw new Error('No market sentiment data found');
  }

  const sentiment = latestSentiment.get('classification') as keyof typeof ALLOCATIONS;
  const targetAllocations = ALLOCATIONS[sentiment];

  // Get current portfolio
  const portfolioTable = getTable('PORTFOLIO');
  const portfolioRecords = await portfolioTable.select().all();
  
  // Calculate current allocations
  const portfolio = portfolioRecords.map(record => ({
    token: record.get('token') as string,
    allocation: record.get('allocation') as number,
    usdValue: record.get('usdValue') as number
  }));

  const totalValue = portfolio.reduce((sum, holding) => sum + (holding.usdValue || 0), 0);

  // Group tokens by type
  const currentAllocations = {
    aiTokens: portfolio
      .filter(p => !['SOL', 'USDC', 'USDT'].includes(p.token))
      .reduce((sum, p) => sum + ((p.usdValue || 0) / totalValue * 100), 0),
    sol: portfolio
      .filter(p => p.token === 'SOL')
      .reduce((sum, p) => sum + ((p.usdValue || 0) / totalValue * 100), 0),
    stables: portfolio
      .filter(p => ['USDC', 'USDT'].includes(p.token))
      .reduce((sum, p) => sum + ((p.usdValue || 0) / totalValue * 100), 0)
  };

  // Generate trades based on differences
  if (Math.abs(currentAllocations.aiTokens - targetAllocations.aiTokens) > 5) {
    trades.push({
      token: 'AI_TOKENS',
      action: currentAllocations.aiTokens < targetAllocations.aiTokens ? 'BUY' : 'SELL',
      targetPercentage: targetAllocations.aiTokens,
      currentPercentage: currentAllocations.aiTokens,
      reason: `Adjusting AI tokens allocation for ${sentiment} market`
    });
  }

  if (Math.abs(currentAllocations.sol - targetAllocations.sol) > 5) {
    trades.push({
      token: 'SOL',
      action: currentAllocations.sol < targetAllocations.sol ? 'BUY' : 'SELL',
      targetPercentage: targetAllocations.sol,
      currentPercentage: currentAllocations.sol,
      reason: `Adjusting SOL allocation for ${sentiment} market`
    });
  }

  if (Math.abs(currentAllocations.stables - targetAllocations.stables) > 5) {
    trades.push({
      token: 'USDC',
      action: currentAllocations.stables < targetAllocations.stables ? 'BUY' : 'SELL',
      targetPercentage: targetAllocations.stables,
      currentPercentage: currentAllocations.stables,
      reason: `Adjusting stables allocation for ${sentiment} market`
    });
  }
  
  if (trades.length > 0) {
    // Create telegram message
    const message = `🔄 Portfolio Reallocation Needed\n\n` +
      `Market Sentiment: ${sentiment}\n\n` +
      `Required Changes:\n` +
      trades.map(t => `- ${t.action} ${t.token}: ${t.currentPercentage.toFixed(1)}% → ${t.targetPercentage.toFixed(1)}%`).join('\n') +
      `\n\nReason: Adjusting allocations for ${sentiment.toLowerCase()} market conditions`;

    // Send telegram notification
    await sendTelegramMessage(message);

    // Create Kinos thought
    await createThought({
      type: 'REALLOCATION',
      content: `Portfolio reallocation required for ${sentiment} market. ` +
        `${trades.length} trades needed to adjust allocations.`,
      context: {
        trades,
        sentiment,
        currentAllocations,
        targetAllocations
      }
    });
  }

  return trades;
}
