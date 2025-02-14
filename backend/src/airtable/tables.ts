import base from './client';

// Main tables
export const TABLES = {
  PORTFOLIO: 'tblPortfolio',
  TRADES: 'tblTrades', 
  TOKENS: 'tblTokens',
  SIGNALS: 'tblSignals',
  REPORTS: 'tblReports'
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
  holder: string;
  token: string;
  type: 'BUY' | 'SELL';
}

// Table methods
export const getTable = (table: keyof typeof TABLES) => base(TABLES[table]);
