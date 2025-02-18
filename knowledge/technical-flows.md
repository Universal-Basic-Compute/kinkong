# KinKong Technical Flows Documentation

## Timing Specifications

### Signal Generation (analyze_all_tokens.py)
- Runs every 6 hours
- Processes all tokens sequentially
- Generates charts for 3 timeframes:
  * 15m candles for 12H analysis (SCALP trades)
  * 2h candles for 48H analysis (INTRADAY trades)
  * 8h candles for 14D analysis (SWING trades)
- Creates PENDING signals in Airtable

### Trade Execution (monitor_trades.py)
- Runs every 1 minute
- Processes one PENDING signal per cycle
- Checks one ACTIVE trade per cycle
- Order: First check PENDING, then check ACTIVE

## Process Details

### Signal Generation Steps
1. Get active tokens from Airtable
2. For each token:
   - Generate charts for all timeframes
   - Get Claude analysis
   - Validate signal requirements
   - Create PENDING signal if valid

### Trade Execution Steps
1. Check one PENDING signal:
   - Get current price
   - If price at entry (±1%), execute trade
   - Update to ACTIVE if successful

2. Check one ACTIVE trade:
   - Update unrealized P&L
   - Check take profit
   - Check stop loss
   - Check expiry
   - Execute exit if conditions met

## Error Handling

### Signal Generation
- Retry chart generation up to 3 times
- Skip token if analysis fails
- Continue to next token on error
- Log all failures for review

### Trade Execution
- Skip to next cycle if price feed fails
- Log failed executions
- No automatic retries (wait for next cycle)
- Maintain trade state on failure

## Monitoring

### Key Metrics
1. Signal Generation
   - Number of signals generated per cycle
   - Analysis success rate
   - Claude API response time
   - Chart generation success rate

2. Trade Execution
   - Execution success rate
   - Price feed reliability
   - Time between signal and execution
   - P&L update success rate

### Logging
- All status changes logged with timestamps
- Execution attempts logged
- Price checks logged
- Error conditions logged with context

## Database Schema

### 1. SIGNALS Table
```sql
- id: string
- timestamp: datetime
- token: string
- type: BUY/SELL
- timeframe: string
- entryPrice: number
- targetPrice: number
- stopLoss: number
- status: string
- confidence: LOW/MEDIUM/HIGH
- reason: string
- expiryDate: datetime
- lastUpdateTime: datetime
```

### 2. TRADES Table
```sql
- signalId: string
- timestamp: datetime
- token: string
- type: BUY/SELL
- amount: number
- price: number
- value: number
- signature: string
- executionPrice: number
- executionTimestamp: datetime
- transactionSignature: string
- unrealizedPnl: number
- realizedPnl: number
- roi: number
```
