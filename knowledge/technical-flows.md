# KinKong Technical Flows Documentation

## Timing Specifications

### 4-Hour Cycle Schedule
Each cycle runs 6 times per day (every 4 hours) with the following sequence:

1. Token Data (XX:00)
   - Updates token list and metadata
   - Validates active tokens
   - Updates token metrics

2. Token Snapshots (XX:05)
   - Records current token metrics
   - Updates price and volume data
   - Calculates market indicators

3. Signal Generation (XX:10)
   - Processes all tokens sequentially
   - Generates charts for 3 timeframes:
     * 15m candles for 6H analysis (SCALP trades)
     * 1H candles for 24H analysis (INTRADAY trades)
     * 4H candles for 7D analysis (SWING trades)
   - Creates PENDING signals in Airtable

4. Trade Execution (XX:15)
   - Processes PENDING signals
   - Checks active trades
   - Executes entries and exits
   - Updates trade records

5. Wallet Snapshot (XX:20)
   - Records portfolio state
   - Calculates performance metrics
   - Updates historical data

Daily execution times (UTC):
- 00:00, 00:05, 00:10, 00:15, 00:20
- 04:00, 04:05, 04:10, 04:15, 04:20
- 08:00, 08:05, 08:10, 08:15, 08:20
- 12:00, 12:05, 12:10, 12:15, 12:20
- 16:00, 16:05, 16:10, 16:15, 16:20
- 20:00, 20:05, 20:10, 20:15, 20:20

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
