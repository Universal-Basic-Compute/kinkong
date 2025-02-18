export interface TradeParams {
  inputToken: string;
  outputToken: string;
  amount: number;
  slippage?: number;
}

export type SignalStatus = 
  | 'PENDING'    // Just created, not yet executed
  | 'ACTIVE'     // Trade is open
  | 'COMPLETED'  // Hit take profit
  | 'STOPPED'    // Hit stop loss
  | 'EXPIRED'    // Time expired before TP/SL
  | 'CANCELLED'  // Cancelled before execution
  | 'FAILED'     // Failed to execute

export interface Signal {
  id: string;
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
  status: SignalStatus;
}
