import base from './client';

// Main tables
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
  THOUGHTS: 'THOUGHTS'
} as const;

// Table interfaces
export interface Portfolio {
  token: string;
  allocation: number;
  lastUpdate: string;
  usdValue?: number; // Add this field
}

export interface PortfolioSnapshot {
  timestamp: string;
  totalValue: number;
  holdings: {
    token: string;
    amount: number;
    price: number;
    value: number;
  }[];
}

export interface Trade {
  createdAt: string;  // Changed from timestamp
  token: string;
  action: 'BUY' | 'SELL';
  amount: number;
  price: number;
}

export interface Token {
  symbol: string;  // Changed from token to symbol
  mint: string;
  isActive: boolean;
  volume7d: number;
  liquidity: number;
  priceChange24h?: number;
}

export interface Signal {
  createdAt: string;
  token: string;
  type: 'BUY' | 'SELL';
  timeframe: 'SCALP' | 'INTRADAY' | 'SWING' | 'POSITION';
  entryPrice?: number;
  targetPrice?: number;
  stopLoss?: number;
  confidence: 'LOW' | 'MEDIUM' | 'HIGH';
  wallet: string;
  reason: string;
  url?: string;
  expectedReturn?: number;
  actualReturn?: number;
  accuracy?: number;
}

export interface MarketSentiment {
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

export interface Message {
  createdAt: string;
  role: 'user' | 'assistant';
  content: string;
  wallet?: string;
  context?: string; // Changed to string since Airtable stores as text
}

export interface Thought {
  type: 'TECHNICAL_ANALYSIS' | 'REALLOCATION' | 'SIGNAL';
  content: string;
  context: Record<string, any>;
}

export const getTable = (tableName: string) => {
  if (!tableName) {
    throw new Error('Table name is required');
  }
  console.log('Getting table:', tableName);
  return base.table(tableName);
};
