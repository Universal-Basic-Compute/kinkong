# Learn How: KinKong's Dynamic Trade Sizing 🦍

Ever wondered how KinKong determines the size of each trade? Let's break down our smart trade sizing mechanism that automatically aligns with market conditions! 

## The Core Concept

KinKong uses a dynamic trade sizing approach that considers:
- Current market sentiment (BULLISH/NEUTRAL/BEARISH)
- Available USDC balance
- Target portfolio allocations
- Risk management limits

## Market-Driven Allocations

We maintain three different target allocations based on market sentiment:

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

## Trade Size Calculation

For each trade, KinKong:

1. Gets the latest market sentiment from our analysis
2. Determines the target AI token allocation percentage
3. Uses 10% of available USDC balance
4. Multiplies by the sentiment-based allocation

### Example Calculation:

```python
Available USDC: $1000
Market Sentiment: BULLISH (70% allocation)

Trade Value = $1000 * 0.10 * 0.70
           = $70 per trade
```

## Safety Limits

To ensure responsible trading:
- Minimum trade size: $10
- Maximum trade size: $1000
- Must have sufficient liquidity (3x trade size)

## Real Code Example

```python
async def execute_trade(signal):
    # 1. Get market sentiment
    sentiment = await get_current_market_sentiment()
    
    # 2. Get allocation percentage
    allocation_pct = {
        "BULLISH": 0.70,
        "NEUTRAL": 0.50,
        "BEARISH": 0.30
    }.get(sentiment, 0.50)
    
    # 3. Calculate trade value
    usdc_balance = await get_usdc_balance()
    trade_value = min(
        usdc_balance * 0.10 * allocation_pct,  # 10% of USDC * allocation
        1000  # Max cap
    )
    trade_value = max(trade_value, 10)  # Min $10
```

## Why This Approach?

1. **Natural Portfolio Balance**: Trade sizes automatically adjust to help reach target allocations

2. **Risk Management**: 
   - Smaller trades in bearish markets
   - Larger trades in bullish markets
   - Never risks more than 10% of USDC per trade

3. **Market Adaptation**: 
   - Automatically becomes more conservative in bearish markets
   - Takes advantage of bullish conditions
   - Maintains balanced exposure in neutral markets

4. **Sustainability**: 
   - Preserves capital in tough markets
   - Scales position sizes with portfolio growth
   - Prevents overexposure to any single trade

## Example Scenarios

### Bullish Market
```python
USDC Balance: $10,000
Allocation: 70%
Trade Size = $10,000 * 0.10 * 0.70 = $700
```

### Bearish Market
```python
USDC Balance: $10,000
Allocation: 30%
Trade Size = $10,000 * 0.10 * 0.30 = $300
```

This dynamic sizing ensures KinKong maintains appropriate exposure while adapting to market conditions. It's a key part of our risk management strategy and helps maintain optimal portfolio balance! 🦍📈

#KinKong #TradingStrategy #RiskManagement #CryptoTrading
