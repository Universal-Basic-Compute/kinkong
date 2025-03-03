# Score-Based Token-Native Strategy: Daily UBC/COMPUTE/SOL Allocation

## Overview
This strategy dynamically allocates funds between UBC, COMPUTE, and SOL based on daily performance metrics and relative strength.

## Scoring System

### Daily Score Calculation
Each token (UBC and COMPUTE) receives a daily score relative to SOL based on:

1. **Price Performance** (70%)
   - Daily % change compared to SOL
   - If token outperforms SOL: +1 to +5 points (scaled)
   - If token underperforms SOL: -1 to -5 points (scaled)

2. **Volume Trend** (20%)
   - 24h volume change vs 7-day average
   - Increasing volume: +1 to +3 points
   - Decreasing volume: -1 to -3 points

3. **Volatility** (10%)
   - Lower volatility than SOL: +1 point
   - Higher volatility than SOL: -1 point

### Cumulative Score
- Maintain a 7-day rolling score for each token
- Daily scores are added to the cumulative score
- Scores are capped between -10 and +10

## Allocation Rules

### Base Allocation
- SOL: 40% (minimum)
- UBC: 30% (baseline)
- COMPUTE: 30% (baseline)

### Dynamic Adjustments
For each token (UBC and COMPUTE):
- Score +5 to +10: Increase allocation by 10-20% (from SOL portion)
- Score +1 to +4: Increase allocation by 5-10%
- Score -1 to -4: Decrease allocation by 5-10% (to SOL)
- Score -5 to -10: Decrease allocation by 10-20% (to SOL)

### Constraints
- SOL allocation: 20-70%
- UBC allocation: 15-50%
- COMPUTE allocation: 15-50%
- Total allocation always equals 100%

## Rebalancing
- Calculate new allocation targets daily
- Execute trades if allocation differs by >5% from target
- Use Jupiter for best execution
- Maintain transaction logs with performance metrics

## Performance Tracking
- Track daily and cumulative returns vs. holding equal parts
- Calculate Sharpe ratio and maximum drawdown
- Generate weekly performance reports
