import base from './client';

// Main tables
export const TABLES = {
  PORTFOLIO: 'Portfolio',
  TRADES: 'Trades', 
  TOKENS: 'Tokens',
  SIGNALS: 'Signals',
  REPORTS: 'Reports'
} as const;

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
}

export const getTable = (tableName: string) => {
  if (!tableName) {
    throw new Error('Table name is required');
  }
  console.log('Getting table:', tableName);
  return base(tableName);
};
