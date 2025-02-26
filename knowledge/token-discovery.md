# KinKong Token Discovery Strategies

## Overview
This document outlines the token discovery strategies used by KinKong to identify promising tokens in the Solana ecosystem. These strategies leverage the Birdeye API to filter and rank tokens based on various metrics.

## Implementation Details

### API Integration
All strategies use the Birdeye API's token list endpoint with different parameters:
```
GET https://public-api.birdeye.so/defi/v3/token/list
```

### Discovery Strategies

#### 1. Volume Momentum Strategy

**Purpose:** Identify tokens with significant trading activity growth that may indicate emerging trends or market interest.

**API Parameters:**
- `sort_by=volume_24h_change_percent`
- `sort_type=desc`
- `min_liquidity=100000`
- `min_volume_24h_usd=50000`
- `min_holder=500`
- `limit=20`

**Implementation Strategy:**
1. Run this query daily at the same time
2. Track tokens that appear in the top 20 for 3+ consecutive days
3. Research fundamentals of these tokens before considering them for the portfolio
4. Prioritize tokens with consistent volume growth across multiple timeframes (24h, 8h, 4h)

**Risk Management:**
- Exclude tokens with suspicious volume patterns (sudden spikes followed by drops)
- Verify volume is distributed across multiple DEXs/pools
- Check holder concentration metrics

#### 2. Recent Listings with Traction

**Purpose:** Discover newly listed tokens that are gaining significant market attention and liquidity.

**API Parameters:**
- `sort_by=recent_listing_time`
- `sort_type=desc`
- `min_liquidity=200000`
- `min_trade_24h_count=500`
- `min_holder=300`
- `limit=30`

**Implementation Strategy:**
1. Run this query twice weekly
2. Monitor new listings that maintain or grow their liquidity for 7+ days
3. Compare trade count trends to identify sustained interest
4. Prioritize tokens that show organic growth patterns rather than artificial pumps

**Risk Management:**
- Implement stricter position size limits for newer tokens
- Require minimum 7-day history before significant allocation
- Verify team and project information thoroughly

#### 3. Price Momentum with Volume Confirmation

**Purpose:** Identify tokens with strong price performance backed by increasing trading volume.

**API Parameters:**
- `sort_by=price_change_24h_percent`
- `sort_type=desc`
- `min_volume_24h_usd=100000`
- `min_volume_24h_change_percent=20`
- `min_liquidity=300000`
- `min_trade_24h_count=700`
- `limit=25`

**Implementation Strategy:**
1. Run this query daily after major market sessions
2. Look for tokens appearing consistently across multiple timeframes
3. Compare 4h, 8h, and 24h price changes to identify sustainable momentum
4. Prioritize tokens where volume growth exceeds or matches price growth

**Risk Management:**
- Avoid chasing tokens already up significantly (>50% in 24h)
- Verify price action against broader market trends
- Check for unusual wallet activity or wash trading

#### 4. Liquidity Growth Detector

**Purpose:** Find tokens that are rapidly gaining liquidity, which often precedes major price movements.

**API Parameters:**
- `sort_by=liquidity`
- `sort_type=desc`
- `min_market_cap=1000000`
- `max_market_cap=100000000`
- `min_holder=1000`
- `min_volume_24h_usd=200000`
- `limit=50`

**Implementation Strategy:**
1. Run this query weekly and track changes in rankings
2. Identify tokens moving up the liquidity rankings rapidly
3. Calculate liquidity-to-market-cap ratios to find undervalued tokens
4. Prioritize tokens with growing holder counts and increasing trade frequency

**Risk Management:**
- Verify liquidity is distributed across multiple pools
- Check for single-wallet liquidity provision
- Monitor liquidity stability over 7-day period

#### 5. High Trading Activity Filter

**Purpose:** Discover tokens with unusually high trading activity relative to their market cap.

**API Parameters:**
- `sort_by=trade_24h_count`
- `sort_type=desc`
- `min_liquidity=150000`
- `min_volume_24h_usd=75000`
- `min_holder=400`
- `limit=30`

**Implementation Strategy:**
1. Run this query daily
2. Calculate the ratio of trade count to market cap to find unusually active tokens
3. Look for tokens with consistently high trading activity across multiple days
4. Prioritize tokens where trading activity is growing week-over-week

**Risk Management:**
- Verify trade count distribution (should be spread across time periods)
- Check for bot activity or wash trading patterns
- Compare with historical activity levels

## Integration with Trading System

### Discovery Pipeline
1. **Initial Discovery:** Run API queries according to strategy schedules
2. **First-Level Filtering:** Apply minimum criteria from API parameters
3. **Second-Level Filtering:** Manual review of fundamentals and on-chain metrics
4. **Tracking:** Add promising tokens to watchlist with discovery source tagged
5. **Analysis:** Run technical analysis on watchlist tokens
6. **Integration:** Add selected tokens to active trading portfolio

### Performance Tracking
- Track performance of tokens by discovery strategy
- Calculate success rate for each strategy
- Adjust parameters based on historical performance
- Maintain discovery source metadata for optimization

### Automation Schedule
- Volume Momentum: Daily at 00:00 UTC
- Recent Listings: Monday and Thursday at 12:00 UTC
- Price Momentum: Daily at 08:00 UTC and 20:00 UTC
- Liquidity Growth: Weekly on Friday at 16:00 UTC
- High Activity: Daily at 04:00 UTC

## Risk Management Framework

### General Principles
- Higher thresholds during bearish market conditions
- Adjust liquidity requirements based on intended position size
- Additional verification for newly listed tokens
- Consider holder concentration metrics

### Strategy-Specific Adjustments
- For Recent Listings: Start with 25% of standard position size
- For Price Momentum: Reduce allocation for tokens up >30% in 24h
- For all strategies: Maximum 5% allocation to any single token
- For High Activity: Verify activity is not from a small number of wallets

## Performance Metrics

Track the following metrics for each discovery strategy:
1. Win rate (% of discovered tokens that achieve profit target)
2. Average ROI per token
3. Time to first significant move (>10%)
4. Holding period for maximum profit
5. Correlation with market conditions
6. False positive rate (tokens that meet criteria but perform poorly)

Review strategy performance monthly and adjust parameters accordingly.
