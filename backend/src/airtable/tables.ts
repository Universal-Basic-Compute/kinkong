import base from './client';

// Add Token type definition
export interface Token {
  symbol: string;
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
} as const;

export function getTable(tableName: string) {
  if (!tableName) {
    throw new Error('Table name is required');
  }
  console.log('Getting table:', tableName);
  return base.table(tableName);
}

// For CommonJS compatibility
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { TABLES, getTable, Token };
}
