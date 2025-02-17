export type SignalStatus = 
  | 'PENDING'    // Just created, not yet executed
  | 'ACTIVE'     // Trade is open
  | 'COMPLETED'  // Hit take profit
  | 'STOPPED'    // Hit stop loss
  | 'EXPIRED'    // Time expired before TP/SL
  | 'CANCELLED'  // Cancelled before execution
  | 'FAILED'     // Failed to execute
