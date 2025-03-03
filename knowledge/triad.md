# Score-Based Token-Native Strategy: Daily UBC/COMPUTE/SOL Allocation

## Core Concept: 1 UBC = 1 UBC

This strategy measures success by token quantity growth, not dollar value:
- Performance measured in actual token amounts
- Focus on accumulating more tokens regardless of price
- Ensures withdrawals are always possible in the original token

## Score-Based Allocation System

### Investment Options
1. **Direct Holdings:** UBC, COMPUTE, SOL
2. **Liquidity Pools:** UBC/SOL LP, COMPUTE/SOL LP, UBC/COMPUTE LP

### Daily Scoring Process

Every 24 hours, score each token on a -10 to +10 scale:
- **UBC Score** (-10 to +10)
  * +10: Extremely bullish on UBC vs SOL
  * 0: Neutral on UBC vs SOL
  * -10: Extremely bearish on UBC vs SOL

- **COMPUTE Score** (-10 to +10)
  * +10: Extremely bullish on COMPUTE vs SOL
  * 0: Neutral on COMPUTE vs SOL
  * -10: Extremely bearish on COMPUTE vs SOL

### Allocation Formula

The scoring system creates a dynamic allocation across all six investment options:

1. **Direct UBC Holdings**
   - Base allocation: 16.67% (1/6 of portfolio)
   - Adjustment: +1.67% for each positive UBC score point
   - Maximum: 33.33% at UBC score +10
   - Minimum: 0% at UBC score -10

2. **Direct COMPUTE Holdings**
   - Base allocation: 16.67% (1/6 of portfolio)
   - Adjustment: +1.67% for each positive COMPUTE score point
   - Maximum: 33.33% at COMPUTE score +10
   - Minimum: 0% at COMPUTE score -10

3. **UBC/SOL LP**
   - Base allocation: 16.67% (1/6 of portfolio)
   - Adjustment: +1.67% for each negative UBC score point
   - Maximum: 33.33% at UBC score -10
   - Minimum: 0% at UBC score +10

4. **COMPUTE/SOL LP**
   - Base allocation: 16.67% (1/6 of portfolio)
   - Adjustment: +1.67% for each negative COMPUTE score point
   - Maximum: 33.33% at COMPUTE score -10
   - Minimum: 0% at COMPUTE score +10

5. **UBC/COMPUTE LP**
   - Base allocation: 16.67% (1/6 of portfolio)
   - Adjustment: Higher when both tokens have similar scores (narrower spread)
   - Maximum: 33.33% when UBC and COMPUTE scores are identical
   - Minimum: 0% when scores are at opposite extremes

6. **Direct SOL Holdings**
   - Base allocation: 16.67% (1/6 of portfolio)
   - Adjustment: Increases when both UBC and COMPUTE scores are negative
   - Maximum: 33.33% when both tokens are at -10
   - Minimum: 0% when either token is above 0

### Simplified Calculation Table

| Score Combination | UBC | COMPUTE | UBC/SOL LP | COMPUTE/SOL LP | UBC/COMPUTE LP | SOL |
|-------------------|-----|---------|------------|----------------|----------------|-----|
| UBC +10, COMP +10 | 33% | 33% | 0% | 0% | 33% | 0% |
| UBC +10, COMP -10 | 33% | 0% | 0% | 33% | 0% | 33% |
| UBC -10, COMP +10 | 0% | 33% | 33% | 0% | 0% | 33% |
| UBC -10, COMP -10 | 0% | 0% | 33% | 33% | 0% | 33% |
| UBC +5, COMP +5 | 25% | 25% | 8% | 8% | 25% | 8% |
| UBC +5, COMP -5 | 25% | 8% | 8% | 25% | 15% | 16% |
| UBC 0, COMP 0 | 17% | 17% | 17% | 17% | 33% | 0% |

## Implementation Guide

### Daily Review Process
1. **Score Assignment (24-hour cycle)**
   - Review market data and ecosystem developments
   - Assign UBC score from -10 to +10
   - Assign COMPUTE score from -10 to +10

2. **Calculate Allocation Percentages**
   - Use the scoring table or formula to determine target allocation
   - Round allocations to nearest 5% for simplicity
   - Ensure allocations total 100%

3. **Execute Reallocation**
   - Compare current allocation to target allocation
   - Adjust positions to match target allocation
   - Minimize transaction costs by setting minimum rebalance threshold (5%)

### Practical Examples

**Example 1: Strongly Bullish UBC, Slightly Bearish COMPUTE**
- UBC Score: +8
- COMPUTE Score: -3
- Resulting Allocation:
  * Direct UBC: 30%
  * Direct COMPUTE: 12%
  * UBC/SOL LP: 3%
  * COMPUTE/SOL LP: 22%
  * UBC/COMPUTE LP: 15%
  * Direct SOL: 18%

**Example 2: Both Mildly Bearish**
- UBC Score: -4
- COMPUTE Score: -4
- Resulting Allocation:
  * Direct UBC: 10%
  * Direct COMPUTE: 10%
  * UBC/SOL LP: 23%
  * COMPUTE/SOL LP: 23%
  * UBC/COMPUTE LP: 25%
  * Direct SOL: 9%

**Example 3: Neutral on Both**
- UBC Score: 0
- COMPUTE Score: 0
- Resulting Allocation:
  * Direct UBC: 17%
  * Direct COMPUTE: 17%
  * UBC/SOL LP: 17%
  * COMPUTE/SOL LP: 17%
  * UBC/COMPUTE LP: 33%
  * Direct SOL: 0%

## Performance Tracking

Track these key metrics in token-native terms:
1. **Total UBC equivalent holdings**
   - Direct UBC + UBC portion of LP positions
   - Converted value of other assets in UBC terms

2. **Total COMPUTE equivalent holdings**
   - Direct COMPUTE + COMPUTE portion of LP positions
   - Converted value of other assets in COMPUTE terms

3. **LP Fee Generation**
   - Track fees earned from each LP position
   - Convert to token equivalents

4. **Position Performance**
   - Track token accumulation rate for each position
   - Compare performance between strategies

## Advantages of Score-Based Allocation

1. **Nuanced Position Sizing**
   - Captures degree of conviction, not just direction
   - Creates smoother transitions between allocations
   - Allows for partial position adjustments

2. **Systematic Approach**
   - Removes emotional decision-making
   - Creates consistent, repeatable process
   - Allows for performance analysis by score

3. **Flexible Implementation**
   - Can be adjusted daily or on custom schedule
   - Scores can incorporate various inputs (technical, fundamental, sentiment)
   - Formula can be tweaked based on market conditions

This score-based system maintains the core "1 UBC = 1 UBC" token-native philosophy while providing a systematic framework for daily allocation decisions. The approach optimizes for token accumulation through precisely calibrated exposures across direct holdings and liquidity pools.
