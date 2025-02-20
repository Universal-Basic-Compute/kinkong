const { base } = require('./client');

// Table interfaces (keep these for TypeScript)
type Portfolio = {
  token: string;
  allocation: number;
  lastUpdate: string;
  usdValue?: number;
}

type PortfolioSnapshot = {
  timestamp: string;
  totalValue: number;
  holdings: {
    token: string;
    amount: number;
    price: number;
    value: number;
  }[];
}

type Trade = {
  createdAt: string;  // ISO 8601 UTC format
  token: string;
  action: 'BUY' | 'SELL';
  amount: number;
  price: number;
  lastUpdateTime?: string;  // ISO 8601 UTC format
}

type Token = {
  symbol: string;  // Changed from token to symbol
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

type Signal = {
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

type MarketSentiment = {
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

type Message = {
  createdAt: string;
  role: 'user' | 'assistant';
  content: string;
  code: string;
  context?: string;
  wallet?: string;
}

type Subscription = {
  code: string;
  startDate: string;
  endDate: string;
  status: 'ACTIVE' | 'EXPIRED' | 'CANCELLED';
  amount: number;
  signature: string;
  wallet?: string;
}

type Thought = {
  type: 'TECHNICAL_ANALYSIS' | 'REALLOCATION' | 'SIGNAL';
  content: string;
  context: Record<string, any>;
}

const TABLES = {
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

function getTable(tableName) {
  if (!tableName) {
    throw new Error('Table name is required');
  }
  console.log('Getting table:', tableName);
  return base.table(tableName);
}

// Export for CommonJS
module.exports = { 
  TABLES, 
  getTable,
  // Also export types for TypeScript
  Portfolio,
  PortfolioSnapshot,
  Trade,
  Token,
  Signal,
  MarketSentiment,
  Message,
  Subscription,
  Thought
};
