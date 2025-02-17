import anthropic
import os
import base64
from datetime import datetime, timezone
import json
from pathlib import Path
import requests
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

def analyze_chart_with_claude(chart_path):
    """Analyze a chart using Claude 3.5"""
    client = anthropic.Anthropic(
        api_key=os.getenv('ANTHROPIC_API_KEY')
    )
    
    # Read image file as base64
    with open(chart_path, "rb") as image_file:
        image_data = base64.b64encode(image_file.read()).decode('utf-8')
    
    # Extract timeframe from filename
    filename = Path(chart_path).name
    timeframe = '15m' if '15m' in filename else '2h' if '2h' in filename else '8h'
    
    prompt = """You are an expert cryptocurrency technical analyst specializing in UBC/USD market analysis.

Study this chart carefully and follow these steps:

1. PRICE ACTION ANALYSIS
- Identify the current trend (bullish, bearish, or ranging)
- Locate key swing highs and lows
- Note any significant chart patterns
- Identify key support and resistance levels

2. VOLUME ANALYSIS
- Compare current volume to average
- Note any volume spikes or divergences
- Check if volume confirms price movement

3. TECHNICAL INDICATORS
- Study the EMA20 and EMA50 relationship
- Note any crossovers or divergences
- Check price position relative to EMAs

4. MARKET STRUCTURE
- Identify higher highs/lows or lower highs/lows
- Note any break of structure
- Evaluate current market phase

5. RISK ASSESSMENT
- Calculate potential risk/reward ratio
- Identify clear invalidation points
- Consider current volatility

Based on this analysis, provide:
1. A clear BUY/SELL/HOLD signal
2. Confidence level (0-100%)
3. Key price levels for:
   - Entry (current price area)
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
1. Price action events to watch (e.g. "Break above $1.25 resistance")
2. Technical indicator developments (e.g. "EMA20 crossing above EMA50")
3. Volume triggers (e.g. "Volume spike above 2x average")
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
    # Group analyses by timeframe
    signals = {
        'short_term': next((a for a in analyses if a.timeframe == '15m'), None),
        'medium_term': next((a for a in analyses if a.timeframe == '2h'), None),
        'long_term': next((a for a in analyses if a.timeframe == '8h'), None)
    }
    
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
