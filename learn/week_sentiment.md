# Learn How: KinKong's Weekly Market Sentiment Classification 🦍

Ever wondered how KinKong determines if a week is BULLISH, NEUTRAL, or BEARISH? Let's break down our market sentiment analysis system!

## The Core Concept

KinKong uses a multi-indicator approach that analyzes four key aspects of market behavior over a 7-day period. Each indicator is designed to capture different market dynamics while being reliable and data-driven.

## The Four Key Indicators

### 1. Price Action Analysis 📈
Looks at how AI tokens are performing relative to their recent history.

**Calculation:**
- Track all active AI tokens' prices
- Compare current price to 7-day average
- Calculate percentage above average

**Classification:**
- BULLISH: >60% tokens above average
- BEARISH: <40% tokens above average
- NEUTRAL: 40-60% tokens above average

### 2. Volume Trend Analysis 📊
Examines trading activity and its direction.

**Calculation:**
- Sum total weekly volume
- Compare to previous week's volume
- Analyze volume on up vs down days

**Classification:**
- BULLISH if:
  * Current week volume > Previous week
  * >60% volume on up days
- BEARISH if:
  * Current week volume < Previous week
  * >60% volume on down days

### 3. Relative Strength vs SOL 💪
Compares AI token performance against SOL.

**Calculation:**
- Calculate median AI token performance
- Compare to SOL's performance
- Determine outperformance percentage

**Classification:**
- BULLISH: AI tokens outperforming SOL
- BEARISH: AI tokens underperforming SOL
- NEUTRAL: Similar performance (±2%)

### 4. POSITION Signals Analysis 🎯
Analyzes our long-term trading signals.

**Calculation:**
- Count HIGH confidence POSITION signals from last 7 days
- Calculate percentage of BUY vs SELL signals
- Minimum 3 signals required

**Classification:**
- BULLISH: >60% BUY signals
- BEARISH: <40% BUY signals
- NEUTRAL: 40-60% BUY signals

## Overall Classification Rules

### Bullish Week Requirements
Need at least 3 of these 4 conditions:
1. >60% of AI tokens above 7-day average
2. Weekly volume higher than previous week
3. >60% of volume on up days
4. >60% of POSITION signals are BUY

### Bearish Week Requirements
Need at least 3 of these 4 conditions:
1. <40% of AI tokens above 7-day average
2. Weekly volume lower than previous week
3. >60% of volume on down days
4. <40% of POSITION signals are BUY

### Neutral Classification
- When neither bullish nor bearish conditions are met
- Usually indicates transitional or consolidation periods

## Portfolio Impact

The weekly sentiment directly influences portfolio allocation:

```python
BULLISH Market:
- AI Tokens: 70%
- SOL: 20%
- Stables: 10%

NEUTRAL Market:
- AI Tokens: 50%
- SOL: 20%
- Stables: 30%

BEARISH Market:
- AI Tokens: 30%
- SOL: 10%
- Stables: 60%
```

## Example Calculation

Let's look at a sample week:

```python
Price Action:
- 7 out of 10 tokens above average (70% ✅ BULLISH)

Volume Analysis:
- Weekly volume up 15% ✅
- 65% volume on up days ✅
- Result: BULLISH

Relative Strength:
- AI tokens: +12%
- SOL: +8%
- Result: BULLISH ✅

POSITION Signals:
- Total signals: 5
- BUY signals: 2 (40%)
- Result: NEUTRAL ❌

Final Classification:
- 3 BULLISH indicators
- 1 NEUTRAL indicator
= BULLISH WEEK
```

## Why This Approach?

1. **Comprehensive View**: Combines price, volume, relative performance, and trading signals

2. **Objective Metrics**: Uses clear numerical thresholds rather than subjective analysis

3. **Risk Management**: More conservative in uncertain markets

4. **Adaptability**: Adjusts portfolio exposure based on market conditions

5. **Reliability**: Multiple indicators reduce false signals

## Real-World Application

The sentiment classification runs every Friday and determines the next week's:
- Portfolio allocation targets
- Trading position sizes
- Risk management parameters
- Entry/exit aggressiveness

This systematic approach helps KinKong maintain optimal exposure while adapting to changing market conditions! 🦍📈

#KinKong #TradingStrategy #MarketAnalysis #RiskManagement
