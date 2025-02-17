import anthropic
import os
import base64
from datetime import datetime, timezone
import json
from pathlib import Path
import requests
import numpy as np
import pandas as pd
from collections import defaultdict
import statistics
from airtable import Airtable

class ChartAnalysis:
    def __init__(self, timeframe, signal, confidence, reasoning, key_levels, risk_reward_ratio=None, reassess_conditions=None):
        self.timeframe = timeframe
        self.signal = signal
        self.confidence = confidence
        self.reasoning = reasoning
        self.key_levels = key_levels
        self.risk_reward_ratio = risk_reward_ratio
        self.reassess_conditions = reassess_conditions

def send_telegram_message(message):
    """Send message to Telegram channel"""
    token = os.getenv('TELEGRAM_BOT_TOKEN')
    chat_id = os.getenv('TELEGRAM_CHAT_ID')
    
    if not token or not chat_id:
        print("Telegram configuration missing")
        return
        
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    data = {
        "chat_id": chat_id,
        "text": message,
        "parse_mode": "HTML"
    }
    
    try:
        response = requests.post(url, json=data)
        response.raise_for_status()
    except Exception as e:
        print(f"Failed to send Telegram message: {e}")

import requests
from typing import Dict, Optional

def get_market_context():
    """Get broader market context (SOL, BTC trends)"""
    try:
        # Get SOL data
        sol_data = get_dexscreener_data("So11111111111111111111111111111111111111112")
        # Get BTC price data
        btc_response = requests.get("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true")
        btc_data = btc_response.json()
        
        return {
            'sol_price_change': sol_data['price_change_24h'] if sol_data else 0,
            'btc_price_change': btc_data['bitcoin']['usd_24h_change'] if btc_data else 0
        }
    except Exception as e:
        print(f"Error getting market context: {e}")
        return None

def calculate_volatility(price_data, window=24):
    """Calculate historical volatility"""
    returns = np.log(price_data['Close'] / price_data['Close'].shift(1))
    return returns.rolling(window=window).std() * np.sqrt(window)

def analyze_volume_profile(df):
    """Analyze volume distribution at price levels"""
    price_volume = defaultdict(float)
    for idx, row in df.iterrows():
        price_level = round(row['Close'], 4)
        price_volume[price_level] += row['Volume']
    
    # Find high volume nodes
    sorted_levels = sorted(price_volume.items(), key=lambda x: x[1], reverse=True)
    return sorted_levels[:5]  # Return top 5 volume nodes

def validate_trade_setup(analysis, market_data):
    """Validate trade setup quality"""
    if analysis.signal == 'BUY':
        # Check if buying at support
        current_price = market_data['price']
        nearest_support = min(analysis.key_levels['support'], 
                            key=lambda x: abs(x - current_price))
        
        if current_price < nearest_support * 1.02:  # Within 2% of support
            analysis.confidence = min(analysis.confidence * 1.2, 100)  # Boost confidence
        else:
            analysis.confidence *= 0.8  # Reduce confidence

def get_optimal_timeframe(volatility):
    """Suggest optimal trading timeframe based on volatility"""
    if volatility > 0.5:  # High volatility
        return "Consider shorter timeframes (15m-1h) due to high volatility"
    elif volatility < 0.2:  # Low volatility
        return "Consider longer timeframes (4h-1d) in low volatility"
    return "Current volatility supports medium timeframes (1h-4h)"

def calculate_position_size(analysis, market_data):
    """Calculate suggested position size based on risk"""
    if not analysis.key_levels.get('stopLoss'):
        return None
        
    risk_percent = 2  # 2% account risk per trade
    entry = market_data['price']
    stop = analysis.key_levels['stopLoss']
    
    risk_per_token = abs(entry - stop)
    position_size = (market_data['liquidity'] * risk_percent) / risk_per_token
    
    return min(position_size, market_data['liquidity'] * 0.01)  # Max 1% of liquidity

def get_dexscreener_data(token_address: str = "9psiRdn9cXYVps4F1kFuoNjd2EtmqNJXrCPmRppJpump") -> Optional[Dict]:
    """Fetch token data from DexScreener API"""
    try:
        url = f"https://api.dexscreener.com/latest/dex/tokens/{token_address}"
        response = requests.get(url)
        response.raise_for_status()
        
        data = response.json()
        if not data.get('pairs'):
            print("No pairs found in DexScreener response")
            return None
            
        # Get the most liquid pair
        main_pair = max(data['pairs'], key=lambda x: float(x.get('liquidity', {}).get('usd', 0)))
        
        return {
            'price': float(main_pair.get('priceUsd', 0)),
            'price_change_24h': float(main_pair.get('priceChange', {}).get('h24', 0)),
            'volume_24h': float(main_pair.get('volume', {}).get('h24', 0)),
            'liquidity': float(main_pair.get('liquidity', {}).get('usd', 0)),
            'fdv': float(main_pair.get('fdv', 0)),
            'market_cap': float(main_pair.get('marketCap', 0))
        }
    except Exception as e:
        print(f"Error fetching DexScreener data: {e}")
        return None

def analyze_chart_with_claude(chart_path):
    """Analyze a chart using Claude 3"""
    client = anthropic.Client(
        api_key=os.getenv('ANTHROPIC_API_KEY')
    )
    
    # Get market data and context
    market_data = get_dexscreener_data()
    market_context = get_market_context()
    
    # Get chart data for technical calculations
    df = pd.read_csv(chart_path)  # Assuming chart data is saved alongside image
    volatility = calculate_volatility(df)
    volume_nodes = analyze_volume_profile(df)
    
    additional_context = f"""
Market Context:
• SOL 24h Change: {market_context['sol_price_change']:.2f}%
• BTC 24h Change: {market_context['btc_price_change']:.2f}%
• Historical Volatility: {volatility.iloc[-1]:.2f}
• Key Volume Nodes: {', '.join([f'${price:.4f}' for price, _ in volume_nodes])}
"""
    
    # Read image file as base64
    with open(chart_path, "rb") as image_file:
        image_data = base64.b64encode(image_file.read()).decode('utf-8')
    
    # Extract timeframe from filename
    filename = Path(chart_path).name
    timeframe = '15m' if '15m' in filename else '2h' if '2h' in filename else '8h'
    
    # Format market data for prompt
    market_context = ""
    if market_data:
        market_context = f"""
Current Market Data:
• Price: ${market_data['price']:.4f}
• 24h Change: {market_data['price_change_24h']:.2f}%
• 24h Volume: ${market_data['volume_24h']:,.2f}
• Liquidity: ${market_data['liquidity']:,.2f}
• FDV: ${market_data['fdv']:,.2f}
• Market Cap: ${market_data['market_cap']:,.2f}
"""
    
    prompt = f"""You are an expert cryptocurrency technical analyst specializing in UBC/USD market analysis.

{market_context}

Study this chart carefully and follow these steps:

1. PRICE ACTION ANALYSIS
- Identify the current trend (bullish, bearish, or ranging)
- Locate key swing highs and lows
- Note any significant chart patterns
- Identify key support and resistance levels
- Consider current price in relation to liquidity levels

2. VOLUME ANALYSIS
- Compare current volume (${market_data['volume_24h']:,.2f}) to recent activity
- Note any volume spikes or divergences
- Check if volume confirms price movement
- Consider liquidity depth (${market_data['liquidity']:,.2f})

3. TECHNICAL INDICATORS
- Study the EMA20 and EMA50 relationship
- Note any crossovers or divergences
- Check price position relative to EMAs
- Consider momentum in relation to 24h change ({market_data['price_change_24h']:.2f}%)

4. MARKET STRUCTURE
- Identify higher highs/lows or lower highs/lows
- Note any break of structure
- Evaluate current market phase
- Consider market cap (${market_data['market_cap']:,.2f}) and FDV (${market_data['fdv']:,.2f})

5. RISK ASSESSMENT
- Calculate potential risk/reward ratio
- Identify clear invalidation points
- Consider current volatility
- Factor in current liquidity conditions

Based on this analysis, provide:
1. A clear BUY/SELL/HOLD signal
2. Confidence level (0-100%)
3. Key price levels for:
   - Entry (current price area: ${market_data['price']:.4f})
   - Target (next significant resistance/support)
   - Stop loss (structure invalidation point)
4. Detailed reasoning explaining your decision

Format your response as JSON:
{
    "signal": "BUY|SELL|HOLD",
    "confidence": number,
    "reasoning": "Detailed multi-paragraph analysis",
    "key_levels": {
        "support": [numbers],
        "resistance": [numbers]
    },
    "risk_reward_ratio": number,
    "reassess_conditions": {
        "time": "When to check again (e.g. '2 hours', '4 candles')",
        "price_triggers": ["List of price levels to watch"],
        "technical_events": ["Specific events to watch for (e.g. 'EMA crossover', 'Break of structure')"]
    }
}

Remember:
- Only give BUY signals at support with bullish confirmation
- Only give SELL signals at resistance with bearish confirmation
- For HOLD signals:
  * Specify exact conditions that would trigger reassessment
  * Include price levels that would change the analysis
  * List technical events that could create opportunities
  * Give a clear timeframe for next review
- Confidence should reflect the quality of the setup
- Include at least 2 levels each for support and resistance

For HOLD signals, be specific about:
1. Price action events to watch (e.g. "Break above ${market_data['price']:.4f}")
2. Technical indicator developments (e.g. "EMA20 crossing above EMA50")
3. Volume triggers (e.g. "Volume spike above ${market_data['volume_24h']*2:,.2f}")
4. Time-based reassessment (e.g. "After next 4-hour candle close")"""

    try:
        message = client.messages.create(
            model="claude-3-sonnet-20240229",
            max_tokens=1024,
            messages=[{
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": prompt
                    },
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": "image/png",
                            "data": image_data
                        }
                    }
                ]
            }]
        )
        
        # Parse JSON response
        analysis = json.loads(message.content[0].text)
        
        return ChartAnalysis(
            timeframe=timeframe,
            signal=analysis['signal'],
            confidence=analysis['confidence'],
            reasoning=analysis['reasoning'],
            key_levels=analysis['key_levels'],
            risk_reward_ratio=analysis.get('risk_reward_ratio')
        )
        
    except Exception as e:
        print(f"Failed to analyze chart {filename}: {e}")
        raise

def create_airtable_signal(analysis, timeframe):
    """Create a signal record in Airtable"""
    try:
        # Initialize Airtable
        base_id = os.getenv('KINKONG_AIRTABLE_BASE_ID')
        api_key = os.getenv('KINKONG_AIRTABLE_API_KEY')
        
        if not base_id or not api_key:
            print("Airtable configuration missing")
            return
            
        airtable = Airtable(base_id, 'SIGNALS', api_key)
        
        # Map timeframe to signal type
        timeframe_mapping = {
            '15m': 'SCALP',
            '2h': 'INTRADAY',
            '8h': 'SWING'
        }
        
        # Map confidence to LOW/MEDIUM/HIGH
        confidence_mapping = {
            range(0, 40): 'LOW',
            range(40, 75): 'MEDIUM',
            range(75, 101): 'HIGH'
        }
        
        confidence_level = next(
            (level for range_, level in confidence_mapping.items() 
             if int(analysis.confidence) in range_),
            'MEDIUM'
        )

        # Extract price levels from analysis
        support_levels = analysis.key_levels['support']
        resistance_levels = analysis.key_levels['resistance']
        
        # Calculate entry, target and stop prices
        current_price = support_levels[0] if analysis.signal == 'BUY' else resistance_levels[0]
        target_price = resistance_levels[0] if analysis.signal == 'BUY' else support_levels[0]
        stop_price = support_levels[1] if analysis.signal == 'BUY' else resistance_levels[1]
        
        # Create signal record matching the interface exactly
        signal_data = {
            'fields': {
                'timestamp': datetime.now(timezone.utc).isoformat(),
                'token': 'UBC',
                'type': analysis.signal,  # BUY/SELL only
                'timeframe': timeframe_mapping.get(timeframe, 'INTRADAY'),
                'entryPrice': current_price,
                'targetPrice': target_price,
                'stopLoss': stop_price,
                'confidence': confidence_level,
                'wallet': os.getenv('STRATEGY_WALLET', ''),  # Add strategy wallet address
                'reason': (f"{analysis.reasoning}\n\n"
                          f"Support Levels: {', '.join(map(str, support_levels))}\n"
                          f"Resistance Levels: {', '.join(map(str, resistance_levels))}\n"
                          f"R/R Ratio: {analysis.risk_reward_ratio if analysis.risk_reward_ratio else 'N/A'}"),
                'url': ''  # Optional URL field
            }
        }
        
        # Only create signal if it's BUY or SELL (not HOLD)
        if analysis.signal in ['BUY', 'SELL']:
            airtable.insert(signal_data)
            print(f"Created {analysis.signal} signal in Airtable for {timeframe} timeframe")
        
    except Exception as e:
        print(f"Failed to create Airtable signal: {e}")

def generate_signal(analyses):
    """Generate combined signal from multiple timeframe analyses"""
    # Check timeframe alignment
    signals_aligned = all(a.signal == analyses[0].signal for a in analyses)
    
    if signals_aligned:
        base_confidence = max(a.confidence for a in analyses)
        confidence_boost = 20  # Boost confidence when all timeframes align
    else:
        base_confidence = statistics.mean(a.confidence for a in analyses)
        confidence_boost = 0
    
    # Group analyses by timeframe
    signals = {
        'short_term': next((a for a in analyses if a.timeframe == '15m'), None),
        'medium_term': next((a for a in analyses if a.timeframe == '2h'), None),
        'long_term': next((a for a in analyses if a.timeframe == '8h'), None)
    }
    
    # Apply confidence adjustment
    for timeframe in signals:
        if signals[timeframe]:
            signals[timeframe].confidence = min(
                signals[timeframe].confidence + confidence_boost, 
                100
            )
    
    # Create signals in Airtable
    for timeframe, analysis in signals.items():
        if analysis and analysis.signal != 'HOLD':  # Only create signals for BUY/SELL
            create_airtable_signal(analysis, analysis.timeframe)

    # Create detailed message
    def format_reassessment(analysis):
        if not analysis.reassess_conditions:
            return ""
        
        conditions = analysis.reassess_conditions
        return f"""
Reassessment Conditions:
⏰ Time: {conditions['time']}
📊 Price Triggers: {', '.join(conditions['price_triggers'])}
📈 Technical Events: {', '.join(conditions['technical_events'])}
"""

    message = f"""🔄 UBC Technical Analysis Update

Short-term (15m):
Signal: {signals['short_term'].signal} ({signals['short_term'].confidence}% confidence)
{signals['short_term'].reasoning}
{format_reassessment(signals['short_term']) if signals['short_term'].signal == 'HOLD' else ''}

Medium-term (2h):
Signal: {signals['medium_term'].signal} ({signals['medium_term'].confidence}% confidence)
{signals['medium_term'].reasoning}
{format_reassessment(signals['medium_term']) if signals['medium_term'].signal == 'HOLD' else ''}

Long-term (8h):
Signal: {signals['long_term'].signal} ({signals['long_term'].confidence}% confidence)
{signals['long_term'].reasoning}
{format_reassessment(signals['long_term']) if signals['long_term'].signal == 'HOLD' else ''}

Key Levels:
Support: {', '.join(map(str, signals['medium_term'].key_levels['support']))}
Resistance: {', '.join(map(str, signals['medium_term'].key_levels['resistance']))}
"""

    # Send to Telegram
    send_telegram_message(message)
    
    # Log analysis
    print("\nAnalysis completed:")
    print(message)
    
    return message

def main():
    try:
        # 1. Generate charts (assuming charts are already generated)
        charts_dir = Path('public/charts')
        chart_files = list(charts_dir.glob('*.png'))
        
        if not chart_files:
            raise Exception("No chart files found")
            
        print(f"Found {len(chart_files)} charts to analyze")
        
        # 2. Analyze each chart
        analyses = []
        for chart_path in chart_files:
            print(f"\nAnalyzing {chart_path.name}...")
            analysis = analyze_chart_with_claude(chart_path)
            analyses.append(analysis)
            
        # 3. Generate and send signal
        signal = generate_signal(analyses)
        
        print("\nAnalysis completed successfully")
        
    except Exception as e:
        print(f"Analysis failed: {e}")
        raise

if __name__ == "__main__":
    main()
