import base from './client';

// Main tables
export const TABLES = {
  PORTFOLIO: 'PORTFOLIO',
  TRADES: 'TRADES', 
  TOKENS: 'TOKENS',
  SIGNALS: 'SIGNALS',
  REPORTS: 'REPORTS',
  PORTFOLIO_SNAPSHOTS: 'PORTFOLIO_SNAPSHOTS',
  INVESTMENTS: 'INVESTMENTS'
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
  timestamp: string;
  token: string;
  action: 'BUY' | 'SELL';
  amount: number;
  price: number;
}

export interface Token {
  symbol: string;
  mint: string;
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
