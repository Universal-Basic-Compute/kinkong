import base from './client';

// Main tables
export const TABLES = {
  PORTFOLIO: 'Portfolio',
  TRADES: 'Trades', 
  TOKENS: 'Tokens',
  SIGNALS: 'Signals', // Ensure exact match with Airtable
  REPORTS: 'Reports'
} as const;

// Add table name validation
export const getTable = (tableName: string) => {
  if (!tableName) {
    throw new Error('Table name is required');
  }
  console.log('Getting table:', tableName);
  return base(tableName);
};

// Table interfaces
export interface Portfolio {
  token: string;
  allocation: number;
  lastUpdate: string;
}

export interface Trade {
  timestamp: string;
  token: string;
  action: 'BUY' | 'SELL';
  amount: number;
  price: number;
}

export interface Token {
  symbol: string;
  isActive: boolean;
  volume7d: number;
  liquidity: number;
}

export interface Signal {
  timestamp: string;
  holder: string;
  token: string;
  type: 'BUY' | 'SELL';
}

// Table methods
export const getTable = (table: keyof typeof TABLES) => base(TABLES[table]);
