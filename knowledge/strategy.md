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

KinKong executes trades at four strategic times daily:
- 00:00 UTC (Asian session)
- 06:00 UTC (European session start)
- 12:00 UTC (European/American overlap)
- 18:00 UTC (American session)

This schedule provides comprehensive coverage of major market movements while allowing sufficient time between trades for analysis and strategy adjustment.

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
   - Volume drops below threshold
   - Liquidity removal > 50%
   - Suspicious trading patterns
   - Major negative project news

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
1. AI Tokens (Selected 10)
   - Individual allocation: 3-15% each
   - Combined allocation: 30-80% of portfolio
   - Minimum position size: $1,000

2. SOL Position
   - Allocation range: 10-40%
   - Acts as ecosystem hedge
   - Minimum position: 5%

3. Stablecoin Reserve
   - Allocation range: 15-60%
   - Higher during bearish weeks
   - Minimum position: 15%

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

#### New Token Suggestions

1. Submission Process
   - Dedicated #new-tokens channel
   - Required format:
     ```
     New Token Submission:
     Token: $SYMBOL
     Contract: [ADDRESS]
     Category: [AI/ML focus area]
     Reason: [Analysis]
     Liquidity: [Current DEX liquidity]
     Volume: [24h volume]
     ```
   - One submission per holder per week

2. Fast-Track Evaluation
   - Tokens suggested by verified holders skip initial screening
   - Automatically added to next weekly review if:
     - Minimum 3 different holders suggest same token
     - Combined suggester stake > 100,000 $COMPUTE
     - Meets basic liquidity/volume requirements

3. Reserved Allocation
   - 1 of the 3 "new entry" slots reserved for shareholder suggestions
   - Must still meet minimum criteria:
     - DEX listing
     - Liquidity requirements
     - Trading history
   
4. Suggestion Scoring
   - Base points from technical criteria (70%)
   - Additional weight factors:
     - Number of suggesting holders
     - Suggesters' historical accuracy
     - Combined stake of suggesting holders
     - Quality of submitted analysis

5. Risk Controls
   - Mandatory 48h monitoring period before inclusion
   - Maximum 2 shareholder-suggested tokens at once
   - Immediate removal if manipulation detected
   - Extra scrutiny on newly launched tokens
