import base from './client';

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

export function getTable(tableName: string) {
  if (!tableName) {
    throw new Error('Table name is required');
  }
  console.log('Getting table:', tableName);
  return base.table(tableName);
}

// For CommonJS compatibility
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { TABLES, getTable };
}
