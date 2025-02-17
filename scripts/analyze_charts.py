import anthropic
import os
import base64
from datetime import datetime
import json
from pathlib import Path
import requests

class ChartAnalysis:
    def __init__(self, timeframe, signal, confidence, reasoning, key_levels, risk_reward_ratio=None):
        self.timeframe = timeframe
        self.signal = signal
        self.confidence = confidence
        self.reasoning = reasoning
        self.key_levels = key_levels
        self.risk_reward_ratio = risk_reward_ratio

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
    
    prompt = """You are an expert crypto technical analyst. Analyze this UBC/USD chart and provide:
1. Clear BUY/SELL/HOLD signal with confidence level (0-100%)
2. Key support and resistance levels
3. Detailed reasoning including:
   - Trend analysis
   - Volume analysis
   - Key patterns
   - Risk/reward ratio if applicable
Format your response as JSON with the following structure:
{
    "signal": "BUY|SELL|HOLD",
    "confidence": number,
    "reasoning": "string",
    "key_levels": {
        "support": [numbers],
        "resistance": [numbers]
    },
    "risk_reward_ratio": number (optional)
}"""

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

def generate_signal(analyses):
    """Generate combined signal from multiple timeframe analyses"""
    # Group analyses by timeframe
    signals = {
        'short_term': next((a for a in analyses if a.timeframe == '15m'), None),
        'medium_term': next((a for a in analyses if a.timeframe == '2h'), None),
        'long_term': next((a for a in analyses if a.timeframe == '8h'), None)
    }
    
    # Create detailed message
    message = f"""🔄 UBC Technical Analysis Update

Short-term (15m):
Signal: {signals['short_term'].signal} ({signals['short_term'].confidence}% confidence)
{signals['short_term'].reasoning}

Medium-term (2h):
Signal: {signals['medium_term'].signal} ({signals['medium_term'].confidence}% confidence)
{signals['medium_term'].reasoning}

Long-term (8h):
Signal: {signals['long_term'].signal} ({signals['long_term'].confidence}% confidence)
{signals['long_term'].reasoning}

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
