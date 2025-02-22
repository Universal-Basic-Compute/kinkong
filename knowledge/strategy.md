# KinKong Trading Strategy Analysis

## Trading Frequency Optimization

For optimal short-term results in the Solana ecosystem, KinKong implements a 4x daily trading schedule rather than single daily trades. Here's the detailed analysis behind this decision:

### 1. Market Dynamics
- Crypto markets operate 24/7, with significant price movements across different time zones
- 6-hour intervals (4x daily) better capture intraday trends and volatility
- Enables reaction to Asian, European, and American market sessions

### 2. Risk Management Benefits
- Smaller position sizes per trade reduce exposure to sudden market moves
- More frequent rebalancing helps maintain optimal portfolio weights
- Better ability to cut losses early or take profits at local peaks

### 3. Technical Advantages
- Solana's fast block times (~400ms) and low fees make frequent trading cost-effective
- Lower slippage due to smaller trade sizes
- Better price averaging across different market conditions

### 4. Opportunity Capture
- More entry/exit points to capitalize on short-term price movements
- Better ability to react to news and market events
- Increased chances of catching favorable price swings

## Recommended Trading Schedule

### Signal Timeframes and Targets

#### Trade Duration Windows
- SCALP: 6 hours
  * Chart interval: 15-minute candles
  * Analysis period: Last 6 hours
  * Minimum profit target: 8%
  * Stop-loss: 10%
  * Rationale: Accounts for DEX fees (2-5%), gas, slippage

- INTRADAY: 24 hours
  * Chart interval: 1-hour candles
  * Analysis period: Last 24 hours
  * Minimum profit target: 12%
  * Stop-loss: 15%

- SWING: 7 days
  * Chart interval: 4-hour candles
  * Analysis period: Last 7 days
  * Minimum profit target: 20%
  * Stop-loss: 20%

- POSITION: 30 days
  * Chart interval: Daily candles
  * Analysis period: Last 30 days
  * Minimum profit target: 30%
  * Stop-loss: 25%

#### Trading Windows (4x Daily)
- Asian window: 00:00 UTC ±30min
- European window: 06:00 UTC ±30min
- Overlap window: 12:00 UTC ±30min
- American window: 18:00 UTC ±30min

#### Cost Considerations
- LP fees: 0.8-2% per trade (varies by pool)
- Gas fees: ~0.1-0.2% per trade
- Slippage: ~0.5-1% per trade
- Total round-trip costs: 2.8-6.4% (entry + exit combined)

#### Trade Duration Windows
- SCALP: 6 hours (one trading window to next)
  * Minimum profit target: 15% (to cover worst-case 6.4% costs + margin)
  * Typical target: 20-30%
  * Stop-loss: 10%

- INTRADAY: 24 hours
  * Minimum profit target: 20%
  * Typical target: 25-40%
  * Stop-loss: 15%

- SWING: 7 days
  * Minimum profit target: 30%
  * Typical target: 40-80%
  * Stop-loss: 20%

- POSITION: 30 days
  * Minimum profit target: 50%
  * Typical target: 100%+
  * Stop-loss: 25%

#### Position Management
- Check all open positions at each trading window
- Close positions if:
  * Take profit hit
  * Stop loss hit
  * Timeframe expired
  * Maximum drawdown exceeded
  * Higher-confidence opposing signal received

Trades only execute if any position requires >3% adjustment, providing efficient rebalancing while avoiding unnecessary transactions.

## Core Trading Strategy

### Portfolio Composition
- Dynamic portfolio of 10 selected AI tokens on Solana
- SOL position for ecosystem exposure
- Stablecoin position for risk management
- Total portfolio rebalanced 4x daily

### Weekly Market Sentiment Analysis (Friday Assessment)

#### Core Indicators (API-Friendly)

1. Price Action (via DEX APIs)
   - Weekly close vs Weekly open for top AI tokens
   - Simple 7-day trend (higher highs/lower lows)
   - Position relative to 20-day MA
   Primary source: Jupiter/Orca DEX APIs

2. Volume Analysis (via DEX APIs)
   - 7-day volume trend
   - Compare current week's volume to previous week
   - Volume concentration (up days vs down days)
   Primary source: Birdeye/Jupiter APIs

3. Market Dominance (via price feeds)
   - AI tokens total marketcap vs SOL
   - Week-over-week change in dominance
   Primary source: Birdeye API

#### Bullish Week Classification (Need 3/4):
- >60% of AI tokens above their 7-day average price
- Weekly volume higher than previous week
- >60% of volume on up days
- AI tokens outperforming SOL (relative strength)

#### Bearish Week Classification (Need 3/4):
- <40% of AI tokens above their 7-day average price
- Weekly volume lower than previous week
- >60% of volume on down days
- AI tokens underperforming SOL (relative strength)

Note: All indicators prioritize data readily available from Solana DEX APIs and price feeds.

### Token Selection Process (Weekly Review)

#### Selection Pool
- All Solana tokens with AI/ML focus
- Core Requirements:
  - Listed on Jupiter DEX
  - 7-day average daily volume > $10,000
  - Minimum liquidity of 3x intended position size
  - Active liquidity pools with USDC

#### Ranking Criteria (Simple Score)

1. Volume Trend
   - 7-day volume growth rate
   - Consistent daily trading activity
   Primary source: Jupiter API

2. Price Momentum
   - Performance vs SOL (7-day)
   - Simple trend direction
   Primary source: Jupiter API

3. Market Health
   - Number of active holders
   - Basic liquidity metrics
   Primary source: Birdeye API

#### Weekly Update Process (Every Friday)
1. Score Calculation
   - Generate weighted scores for all eligible tokens
   - Rank tokens by total score
   - Flag tokens with significant score changes

2. Portfolio Updates
   - Keep top 7 tokens by score
   - Reserve 3 slots for:
     - 2 highest positive score changes
     - 1 new entry meeting criteria

3. Replacement Rules
   - Replace tokens that fall below minimum requirements
   - Maximum 3 new entries per week for stability
   - Gradual position adjustment over 24h for new entries

4. Emergency Removal Criteria
   - Portfolio value drops >10%
   - Liquidity falls below 2x position size
   - Critical verified negative news

### Daily Trading Operations
1. Position Management (4x Daily)
   - Reallocation between:
     - Selected AI tokens
     - SOL holdings
     - Stablecoin reserves
   - Based on:
     - Short-term technical indicators
     - Relative strength between assets
     - Risk metrics
     - Market volatility

2. Risk Management
   - Dynamic stablecoin allocation based on market conditions
   - Increased stablecoin position during bearish weeks
   - Higher token exposure during bullish conditions
   - SOL position as ecosystem hedge

### Reallocation Process (6-Hour Intervals)

#### Portfolio Components
1. Bull Market Allocation
   - AI Tokens (Selected 10): 70%
   - SOL Position: 20%
   - Stablecoin Reserve: 10%

2. Bear Market Allocation
   - AI Tokens (Selected 10): 40%
   - SOL Position: 20%
   - Stablecoin Reserve: 40%

Note: Market condition (bull/bear) determined by weekly sentiment analysis

### Project Fundamentals & Sentiment Analysis

#### News & Sentiment Analysis

1. Major News Impact
   - Focus on verifiable announcements only
   - Sources: Official channels only
   - Binary classification: Positive/Negative

2. Simple Integration
   - Positive news: +1% allocation
   - Negative news: -1% allocation
   - Emergency exit on critical negative news
   - Maximum 2% total sentiment impact

3. Risk Management
   - Immediate review if sentiment score drops below 2
   - Emergency exit if critical negative news
   - Double check unusual social activity spikes

#### Implementation Rules
- Keep sentiment data fresh (max 24h old)
- Ignore minor news/social chatter
- Focus on verifiable information
- Don't override technical signals

#### Reallocation Rules

1. Base Portfolio Structure
   - AI Tokens: 50-70%
   - SOL: 15-25%
   - Stables: Minimum 15%

2. Individual Token Allocation
   - Base allocation: 10% per token
   - Simple adjustments:
     - +2% for top 3 performers (7-day)
     - -2% for bottom 3 performers
   - Maximum single token: 12%
   - Minimum stablecoin reserve: 15%

3. Reallocation Triggers
   - Mandatory time-based (every 6 hours)
   - Emergency triggers:
     - Single token drops >12% in 6 hours
     - Overall portfolio drops >8% in 6 hours
     - Liquidity crisis in any holding

4. Execution Process
   a. Analysis Phase (15 minutes before execution)
      - Calculate target allocations
      - Measure current allocations
      - Compute required trades
      - Estimate slippage

   b. Trade Execution
      - Maximum 2% slippage tolerance
      - Use split orders for large trades
      - Priority: Sell overweight → Buy underweight
      - Use Jupiter aggregator for best execution

5. Risk Controls
   - Maximum single trade size: 10% of token liquidity
   - Minimum liquidity requirement: 3x position size
   - Circuit breaker: Pause trading if slippage >5%
   - Position building: Graduate entries over 2-3 cycles

6. Performance Tracking
   - Track reallocation success rate
   - Monitor slippage vs estimates
   - Record execution costs
   - Compare actual vs target allocations

### Chart Analysis Integration

#### Purpose
- Validate quantitative signals with technical analysis
- Optimize trade execution timing
- Identify key price levels
- Reduce adverse execution timing

#### Process (Each 6-Hour Trading Window)

1. Chart Generation
   - Timeframes analyzed:
     - 1-hour candles (last 24 hours)
     - Include EMA20, EMA50, Volume
   - Generated just before trade execution
   - One chart per active token

2. LLM Vision Analysis
   Primary Focus:
   - Support/resistance levels
   - Clear chart patterns
   - Volume profile
   - Immediate trend direction

   Output Structure:
   ```json
   {
     "sentiment": "BULLISH | BEARISH | NEUTRAL",
     "confidence": "0-100",
     "keyLevels": {
       "support": ["price levels"],
       "resistance": ["price levels"]
     },
     "patterns": ["identified patterns"],
     "tradingRecommendation": {
       "action": "EXECUTE | DELAY | SKIP",
       "reason": "explanation"
     }
   }
   ```

3. Integration Rules
   - Chart analysis cannot override risk management rules
   - Used to optimize rather than determine trades
   - Maximum 15-minute delay for analysis
   - Trades proceed without chart analysis if LLM unavailable

4. Execution Modifications
   - EXECUTE: Proceed with planned trade
   - DELAY: Wait up to 30 minutes for better level
   - SKIP: Cancel trade if technical picture highly unfavorable

5. Entry Price Optimization
   - Buying: Target prices closer to support
   - Selling: Target prices closer to resistance
   - Maximum 1% adjustment from original target

6. Risk Controls
   - Timeout if analysis takes >1 minute
   - Fallback to pure quantitative if chart analysis fails
   - Never exceed original position size
   - Maintain original slippage limits

#### Performance Tracking
- Record chart analysis accuracy
- Track execution price improvements
- Monitor analysis latency
- Compare performance with/without chart analysis

### UBC Shareholder Intelligence Integration

#### Shareholder Input System

1. Signal Collection
   - One signal per holder per day
   - Simple format:
     ```
     $TOKEN: LONG/SHORT
     Reason: [Brief explanation]
     ```
   - Submit via #kinkong-signals channel

2. Signal Processing
   - Simple majority voting system
   - Minimum 3 signals for action
   - Maximum 2% allocation impact
   - 24-hour signal validity

2. Integration Rules
   - Signals valid for 24 hours
   - Minimum 3 signals for consideration
   - Conflicting signals cancel out
   - Emergency signals require verification

#### Implementation
1. Allocation Impact
   - Added to 6-hour reallocation process
   - Applied after technical analysis
   - Cannot override risk management rules
   - Maximum 5% total shareholder influence

2. Performance Tracking
   - Track signal accuracy by holder
   - Update holder influence weights monthly
   - Report effectiveness to community
   - Adjust weights based on performance

#### Risk Controls
- Ignore signals during extreme market conditions
- Require multiple signals for major changes
- Cap individual holder influence
- Filter out coordinated signal attempts

#### New Token Addition Process

1. Base Requirements
   - Listed on Jupiter DEX
   - 7-day average daily volume > $10,000
   - Minimum liquidity of 3x intended position size
   - Active USDC liquidity pools

2. Addition Criteria
   - Must receive 3+ holder suggestions
   - Must pass 48h monitoring period
   - Must maintain base requirements throughout monitoring

3. Submission Process
   - Submit via #new-tokens channel
   - Include token token, contract address, and basic metrics
   - One submission per holder per week

4. Risk Controls
   - Maximum 2 new tokens added per week
   - Immediate removal if base requirements violated
