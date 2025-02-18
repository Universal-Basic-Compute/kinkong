import sys
from pathlib import Path

# Get the project root (parent of scripts directory)
project_root = Path(__file__).parent.parent
if str(project_root) not in sys.path:
    sys.path.append(str(project_root))

# Now we can import backend modules
from backend.src.airtable.tables import getTable
import anthropic
import os
import base64
from datetime import datetime, timezone, timedelta
import json
from pathlib import Path
import requests
import numpy as np
import pandas as pd
from collections import defaultdict
import statistics
from airtable import Airtable
from validate_signal import validate_signal

class ChartAnalysis:
    def __init__(self, timeframe, signal, confidence, reasoning, key_levels, risk_reward_ratio=None, reassess_conditions=None):
        self.timeframe = timeframe
        self.signal = signal
        self.confidence = confidence
        self.reasoning = reasoning
        self.key_levels = key_levels
        self.risk_reward_ratio = risk_reward_ratio
        self.reassess_conditions = reassess_conditions

    def get(self, key, default=None):
        """Add dictionary-like get method"""
        return getattr(self, key, default)

    def to_dict(self):
        """Convert ChartAnalysis object to dictionary"""
        return {
            'timeframe': self.timeframe,
            'signal': self.signal,
            'confidence': self.confidence,
            'reasoning': self.reasoning,
            'key_levels': self.key_levels,
            'risk_reward_ratio': self.risk_reward_ratio,
            'reassess_conditions': self.reassess_conditions
        }

def send_telegram_message(message, chart_paths=None):
    """Send message and optional charts to Telegram channel"""
    token = os.getenv('TELEGRAM_BOT_TOKEN')
    
    if not token:
        print("Telegram bot token missing")
        return
        
    base_url = f"https://api.telegram.org/bot{token}"
    
    try:
        if chart_paths:
            # First send the text message
            text_response = requests.post(
                f"{base_url}/sendMessage",
                json={
                    "chat_id": -1002276145657,
                    "text": message,
                    "parse_mode": "HTML"
                }
            )
            text_response.raise_for_status()
            
            # Then send each chart as a photo
            for chart_path in chart_paths:
                with open(chart_path, 'rb') as photo:
                    files = {'photo': photo}
                    photo_response = requests.post(
                        f"{base_url}/sendPhoto",
                        data={"chat_id": -1002276145657},
                        files=files
                    )
                    photo_response.raise_for_status()
            
            print("Telegram message and charts sent successfully")
        else:
            # Just send the text message if no charts
            response = requests.post(
                f"{base_url}/sendMessage",
                json={
                    "chat_id": -1002276145657,
                    "text": message,
                    "parse_mode": "HTML"
                }
            )
            response.raise_for_status()
            print("Telegram message sent successfully")
            
    except Exception as e:
        print(f"Failed to send Telegram message: {e}")
        if 'response' in locals():
            print(f"Telegram API response: {response.text}")

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

def get_dexscreener_data(token_address: str = None) -> Optional[Dict]:
    """Fetch token data from DexScreener API"""
    try:
        if not token_address:
            print("No token address provided for DexScreener API")
            return None
            
        print(f"Fetching DexScreener data for token: {token_address}")
        url = f"https://api.dexscreener.com/latest/dex/tokens/{token_address}"
        
        # Add headers to avoid rate limiting
        headers = {
            'User-Agent': 'Mozilla/5.0',
            'Accept': 'application/json'
        }
        
        response = requests.get(url, headers=headers)
        print(f"DexScreener response status: {response.status_code}")
        
        if not response.ok:
            print(f"DexScreener API error: {response.status_code}")
            return None
            
        data = response.json()
        
        if not data.get('pairs'):
            print(f"No pairs found in DexScreener response for {token_address}")
            return None
            
        # Get the most liquid Solana pair
        sol_pairs = [p for p in data['pairs'] if p.get('chainId') == 'solana']
        if not sol_pairs:
            print("No Solana pairs found")
            return None
            
        main_pair = max(sol_pairs, key=lambda x: float(x.get('liquidity', {}).get('usd', 0)))
        
        result = {
            'price': float(main_pair.get('priceUsd', 0)),
            'price_change_24h': float(main_pair.get('priceChange', {}).get('h24', 0)),
            'volume_24h': float(main_pair.get('volume', {}).get('h24', 0)),
            'liquidity': float(main_pair.get('liquidity', {}).get('usd', 0)),
            'fdv': float(main_pair.get('fdv', 0)),
            'market_cap': float(main_pair.get('marketCap', 0))
        }
        
        print("Processed market data:", result)
        return result
    except Exception as e:
        print(f"Error fetching DexScreener data: {e}")
        return None

def clean_json_string(json_str):
    """Clean and validate JSON string"""
    # Remove control characters
    import re
    json_str = re.sub(r'[\x00-\x1F\x7F-\x9F]', '', json_str)
    
    # Fix common JSON formatting issues
    json_str = json_str.replace('\n', ' ')
    json_str = json_str.replace('\\', '\\\\')
    
    # Remove any markdown code block indicators
    json_str = json_str.replace('```json', '')
    json_str = json_str.replace('```', '')
    
    return json_str.strip()

SYSTEM_PROMPT = """You are an expert cryptocurrency technical analyst specializing in UBC/USD market analysis.

For each timeframe, provide:
1. Signal (BUY/SELL/HOLD)
2. Confidence level (0-100%)
3. Key support and resistance levels
4. Detailed reasoning
5. Risk/reward ratio if applicable

Timeframes analyzed:
- SCALP (15m chart, 6-hour trades)
- INTRADAY (1H chart, 24-hour trades)
- SWING (4H chart, 7-day trades)
- POSITION (1D chart, 30-day trades)

Format your response as JSON:
{
    "timeframes": {
        "SCALP": {
            "signal": "BUY|SELL|HOLD",
            "confidence": 0,
            "reasoning": "Detailed analysis",
            "key_levels": {
                "support": [0.0, 0.0],
                "resistance": [0.0, 0.0]
            },
            "risk_reward_ratio": 0.0
        },
        "INTRADAY": { ... },
        "SWING": { ... },
        "POSITION": { ... }
    },
    "overall_analysis": {
        "primary_trend": "BULLISH|BEARISH|NEUTRAL",
        "timeframe_alignment": "ALIGNED|MIXED|CONFLICTING",
        "best_timeframe": "SCALP|INTRADAY|SWING|POSITION",
        "key_observations": ["List of important points"],
        "recommended_action": {
            "signal": "BUY|SELL|HOLD",
            "timeframe": "SCALP|INTRADAY|SWING|POSITION",
            "reasoning": "Why this is the best action"
        }
    }
}"""

def analyze_charts_with_claude(chart_paths, token_info=None):
    """Analyze multiple timeframe charts together using Claude 3"""
    try:
        # Get API key from environment
        api_key = os.getenv('ANTHROPIC_API_KEY')
        if not api_key:
            raise ValueError("ANTHROPIC_API_KEY not found in .env file")
        
        # Debug print to verify the key
        print(f"API Key from .env: {api_key[:8]}...{api_key[-4:]}")
        
        # Create client with explicit API key
        client = anthropic.Client(
            api_key=api_key,
        )
        
        # Get market data and context
        market_data = get_dexscreener_data(token_info['mint'] if token_info else None)
        if not market_data:
            print(f"Warning: No DexScreener data available for {token_info['symbol'] if token_info else 'token'}")
            # Continue with analysis but without market data
            market_data = {
                'price': 0,
                'price_change_24h': 0,
                'volume_24h': 0,
                'liquidity': 0,
                'fdv': 0,
                'market_cap': 0
            }
        market_context = get_market_context()

        # Prepare all chart images
        chart_contents = []
        for chart_path in chart_paths:
            # Convert WindowsPath to string
            chart_path_str = str(chart_path)
            with open(chart_path, "rb") as image_file:
                image_data = base64.b64encode(image_file.read()).decode('utf-8')
                timeframe = '15m' if '15m' in chart_path_str else '2h' if '2h' in chart_path_str else '8h'
                chart_contents.append({
                    "timeframe": timeframe,
                    "data": image_data
                })
        
        # Format market data for prompt
        market_data_str = ""
        if market_data:
            market_data_str = f"""
Current Market Data:
• Price: ${market_data['price']:.4f}
• 24h Change: {market_data['price_change_24h']:.2f}%
• 24h Volume: ${market_data['volume_24h']:,.2f}
• Liquidity: ${market_data['liquidity']:,.2f}
• FDV: ${market_data['fdv']:,.2f}
• Market Cap: ${market_data['market_cap']:,.2f}
"""

        user_prompt = f"""I'm providing you with charts for {token_info['symbol'] if token_info else 'UBC'}/USD for a complete multi-timeframe analysis.

{market_data_str}

Analyze each timeframe in sequence, considering how they relate to each other:

1. First analyze the POSITION timeframe for long-term trend and market structure
2. Then analyze the SWING timeframe for medium-term movements
3. Then analyze the INTRADAY timeframe for short-term setups
4. Finally analyze the SCALP timeframe for immediate price action and entries"""

        message = client.messages.create(
            model="claude-3-5-sonnet-20241022",
            max_tokens=4096,
            system=SYSTEM_PROMPT,
            messages=[{
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": user_prompt
                    },
                    *[{
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": "image/png",
                            "data": chart["data"]
                        }
                    } for chart in chart_contents]
                ]
            }]
        )
        
        try:
            # Clean and parse response
            cleaned_response = clean_json_string(message.content[0].text)
            analysis = json.loads(cleaned_response)
                
            # Extract timeframe analyses
            timeframe_analyses = analysis.get('timeframes', {})
                
            # Convert to ChartAnalysis objects
            analyses = {}
            for timeframe, data in timeframe_analyses.items():
                analyses[timeframe] = ChartAnalysis(
                    timeframe=timeframe,
                    signal=data.get("signal"),
                    confidence=data.get("confidence"),
                    reasoning=data.get("reasoning"),
                    key_levels=data.get("key_levels"),
                    risk_reward_ratio=data.get("risk_reward_ratio"),
                    reassess_conditions=None
                )
                
            # Add overall analysis
            analyses["overall"] = analysis.get("overall_analysis", {})
                
            return analyses
            
        except Exception as e:
            print(f"Failed to parse analysis: {e}")
            print("Response content:")
            print(cleaned_response)
            raise
            

            
    except Exception as e:
        print(f"Failed to analyze charts: {e}")
        raise

def create_airtable_signal(analysis, timeframe, token_info, analyses=None):
    try:
        print(f"\nCreating Airtable signal for {token_info['symbol']}...")
        
        # Extract the specific timeframe analysis
        timeframe_analysis = analysis.get('reasoning', '')
        signal_type = analysis.get('signal', 'UNKNOWN')
        confidence = analysis.get('confidence', 0)
        key_levels = analysis.get('key_levels', {})
        
        # Get overall analysis
        overall = analyses.get('overall', {}) if analyses else {}
        
        # Build reason text using the actual analysis data
        reason_text = (
            f"Technical Analysis Summary:\n\n"
            f"{timeframe_analysis}\n\n"  # Use the actual analysis reasoning
            f"Overall Market Context:\n"
            f"• Primary Trend: {overall.get('primary_trend', 'Unknown')}\n"
            f"• Timeframe Alignment: {overall.get('timeframe_alignment', 'Unknown')}\n"
            f"• Best Timeframe: {overall.get('best_timeframe', 'Unknown')}\n\n"
        )

        # Add key observations if available
        if overall.get('key_observations'):
            reason_text += "Key Observations:\n"
            for observation in overall['key_observations']:
                reason_text += f"• {observation}\n"
            reason_text += "\n"

        # Add key levels
        support_levels = key_levels.get('support', [])
        resistance_levels = key_levels.get('resistance', [])
        if support_levels or resistance_levels:
            reason_text += (
                f"Key Support/Resistance Levels:\n"
                f"Support: {', '.join(f'${price:.4f}' for price in support_levels)}\n"
                f"Resistance: {', '.join(f'${price:.4f}' for price in resistance_levels)}\n\n"
            )

        # Calculate trade setup
        if signal_type == 'SELL':
            entry_price = resistance_levels[0] if resistance_levels else 0
            target_price = support_levels[0] if support_levels else 0
            stop_loss = resistance_levels[1] if len(resistance_levels) > 1 else entry_price * 1.05
        else:  # BUY
            entry_price = support_levels[0] if support_levels else 0
            target_price = resistance_levels[0] if resistance_levels else 0
            stop_loss = support_levels[1] if len(support_levels) > 1 else entry_price * 0.95

        # Add trade setup details
        if entry_price and target_price:
            expected_return = abs((target_price - entry_price) / entry_price * 100)
            reason_text += (
                f"Trade Setup:\n"
                f"• Entry: ${entry_price:.4f}\n"
                f"• Target: ${target_price:.4f}\n"
                f"• Stop Loss: ${stop_loss:.4f}\n"
                f"• Expected Return: {expected_return:.1f}%\n\n"
            )

        # Add recommended action from overall analysis
        recommended_action = overall.get('recommended_action', {})
        action_reasoning = recommended_action.get('reasoning', 
            f"Execute {signal_type} order at ${entry_price:.4f} with {confidence}% confidence"
        )
        reason_text += f"Recommended Action:\n{action_reasoning}"

        print("\nGenerated reason text:")
        print(reason_text)

        # Initialize Airtable
        base_id = os.getenv('KINKONG_AIRTABLE_BASE_ID')
        api_key = os.getenv('KINKONG_AIRTABLE_API_KEY')
        
        if not base_id or not api_key:
            print("❌ Airtable configuration missing")
            return

        print("✅ Airtable configuration found")
        airtable = Airtable(base_id, 'SIGNALS', api_key)
        
        # Map confidence to LOW/MEDIUM/HIGH
        confidence_level = 'LOW' if confidence < 40 else 'HIGH' if confidence > 75 else 'MEDIUM'

        # Calculate expiry date based on timeframe
        now = datetime.now(timezone.utc)
        expiry_mapping = {
            'SCALP': timedelta(hours=6),
            'INTRADAY': timedelta(days=1),
            'SWING': timedelta(days=7),
            'POSITION': timedelta(days=30)
        }
        expiry_delta = expiry_mapping.get(timeframe)
        if not expiry_delta:
            print(f"Invalid timeframe: {timeframe}")
            return None
        expiry_date = now + expiry_delta

        # Create signal record
        signal_data = {
            'timestamp': now.isoformat(),
            'token': token_info['symbol'],
            'type': signal_type,
            'timeframe': timeframe,
            'entryPrice': entry_price,
            'targetPrice': target_price,
            'stopLoss': stop_loss,
            'confidence': confidence_level,
            'wallet': os.getenv('STRATEGY_WALLET', ''),
            'reason': reason_text,
            'expiryDate': expiry_date.isoformat(),
            'expectedReturn': round(expected_return, 2) if 'expected_return' in locals() else 0
        }

        print("\nSending to Airtable:", json.dumps(signal_data, indent=2))
        response = airtable.insert(signal_data)
        print(f"✅ Created signal: {response['id']}")
        return response

    except Exception as e:
        print(f"Failed to create Airtable signal: {str(e)}")
        print(f"Error type: {type(e)}")
        if hasattr(e, '__dict__'):
            print(f"Error attributes: {e.__dict__}")
        return None

def process_signals_batch(token_analyses):
    print("\n🔄 Starting signals batch processing...")
    print(f"Received {len(token_analyses)} token analyses to process")
    
    # Standard timeframes for all analysis
    STRATEGY_TIMEFRAMES = ['SCALP', 'INTRADAY', 'SWING', 'POSITION']
    
    pending_signals = []
    
    for token_info, analyses in token_analyses:
        print(f"\n📊 Processing signals for {token_info['symbol']}...")
        print(f"Analysis structure: {type(analyses)}")
        print(f"Available timeframes: {list(analyses.keys())}")
        
        # Filter valid timeframes
        valid_timeframes = {}
        for tf, analysis in analyses.items():
            # Skip the 'overall' key as it's not a timeframe
            if tf == 'overall':
                continue
                
            # Check if timeframe is one of our standard timeframes
            if tf in STRATEGY_TIMEFRAMES:
                valid_timeframes[tf] = analysis
                print(f"Valid timeframe: {tf}")
            else:
                print(f"Skipping unknown timeframe: {tf}")
        
        print(f"\nFound {len(valid_timeframes)} valid timeframe analyses")
        
        for timeframe, analysis in valid_timeframes.items():
            print(f"\n⏰ Processing {timeframe} timeframe...")
            
            # Extract signal details
            signal_type = None
            confidence = 0
            key_levels = None
            
            if isinstance(analysis, dict):
                signal_type = analysis.get('signal')
                confidence = analysis.get('confidence', 0)
                key_levels = analysis.get('key_levels')
            
            print(f"Signal type: {signal_type}")
            print(f"Confidence: {confidence}")
            print(f"Key levels: {key_levels}")
            
            if signal_type and signal_type != 'HOLD' and confidence >= 60:
                print("✅ Signal meets criteria for creation")
                
                # Safely get support and resistance levels
                support_levels = key_levels.get('support', []) if key_levels else []
                resistance_levels = key_levels.get('resistance', []) if key_levels else []
                
                # Only proceed if we have at least one level for each
                if not support_levels or not resistance_levels:
                    print("❌ Insufficient price levels")
                    continue
                
                # For stop loss, use second level if available, otherwise calculate from first level
                if signal_type == 'SELL':
                    entry_price = resistance_levels[0]
                    target_price = support_levels[0]
                    stop_loss = support_levels[1] if len(support_levels) > 1 else support_levels[0] * 1.05  # 5% above support
                else:  # BUY
                    entry_price = support_levels[0]
                    target_price = resistance_levels[0]
                    stop_loss = resistance_levels[1] if len(resistance_levels) > 1 else resistance_levels[0] * 0.95  # 5% below resistance
                
                # Create signal data with key levels
                signal_data = {
                    'timeframe': timeframe,
                    'signal': signal_type,
                    'confidence': confidence,
                    'token_info': token_info,
                    'key_levels': key_levels,
                    'entryPrice': entry_price,
                    'targetPrice': target_price,
                    'stopLoss': stop_loss
                }
                
                # Validate signal
                print("Validating signal...")
                validation_result = validate_signal(
                    timeframe=timeframe,
                    signal_data=signal_data,
                    token_info=token_info,
                    market_data=get_dexscreener_data(token_info['mint'])
                )
                
                print(f"Validation result: {validation_result}")
                
                if validation_result['valid']:
                    print("✅ Signal validated, adding to pending signals")
                    pending_signals.append(signal_data)
                else:
                    print(f"❌ Signal validation failed: {validation_result['reason']}")
            else:
                print("❌ Signal did not meet criteria:")
                if not signal_type:
                    print("- No signal type")
                if signal_type == 'HOLD':
                    print("- HOLD signal")
                if confidence < 60:
                    print(f"- Low confidence ({confidence})")
    
    print(f"\n📝 Collected {len(pending_signals)} valid signals")
    
    if pending_signals:
        print("\n🚀 Processing valid signals...")
        results = process_valid_signals(pending_signals)
        print(f"✅ Created {len(results)} signals")
        return results
    else:
        print("\n⚠️ No valid signals to process")
        return []

def generate_signal(analyses, token_info):
    """Generate combined signal from serialized analyses"""
    # Extract timeframe analyses (excluding 'overall' key)
    timeframe_analyses = {k: v for k, v in analyses.items() if k != 'overall'}
    
    # Track which signals we've already sent to avoid duplicates
    processed_signals = set()
    
    # Check timeframe alignment
    signals_aligned = all(
        analyses[tf].get('signal') == list(timeframe_analyses.values())[0].get('signal')
        for tf in timeframe_analyses.keys()
    )
    
    if signals_aligned:
        base_confidence = max(a.get('confidence', 0) for a in timeframe_analyses.values())
        confidence_boost = 20  # Boost confidence when all timeframes align
    else:
        base_confidence = statistics.mean(a.get('confidence', 0) for a in timeframe_analyses.values())
        confidence_boost = 0
    
    # Group analyses by timeframe
    signals = {
        'short_term': timeframe_analyses.get('15m', {}),
        'medium_term': timeframe_analyses.get('2h', {}),
        'long_term': timeframe_analyses.get('8h', {})
    }
    
    # Create signals in Airtable only for high confidence signals
    high_confidence_signals = []
    for timeframe, analysis in timeframe_analyses.items():
        if analysis and analysis.get('signal') != 'HOLD' and analysis.get('confidence', 0) >= 60:
            # Create unique signal identifier
            signal_id = f"{token_info.get('symbol')}_{timeframe}_{analysis.get('signal')}_{datetime.now().strftime('%Y%m%d')}"
            
            if signal_id not in processed_signals:
                result = create_airtable_signal(analysis, timeframe, token_info, analyses)
                if result:
                    high_confidence_signals.append({
                        'timeframe': timeframe,
                        'signal': analysis.get('signal'),
                        'confidence': analysis.get('confidence', 0)
                    })
                    processed_signals.add(signal_id)

    # Create detailed message
    overall = analyses.get('overall', {})
    
    message = f"""🔄 {token_info.get('symbol')} Technical Analysis Update

Primary Trend: {overall.get('primary_trend', 'N/A')}
Timeframe Alignment: {overall.get('timeframe_alignment', 'N/A')}
Best Timeframe: {overall.get('best_timeframe', 'N/A')}

"""

    # Add high confidence signals to message
    if high_confidence_signals:
        message += "🎯 High Confidence Signals:\n"
        for signal in high_confidence_signals:
            message += f"{signal.get('timeframe')}: {signal.get('signal')} ({signal.get('confidence')}% confidence)\n"
        message += "\n"

    # Add detailed timeframe analysis
    for timeframe, analysis in [
        ('Short-term (15m)', signals.get('short_term', {})),
        ('Medium-term (2h)', signals.get('medium_term', {})),
        ('Long-term (8h)', signals.get('long_term', {}))
    ]:
        if analysis:
            message += f"{timeframe}:\n"
            message += f"Signal: {analysis.get('signal')} ({analysis.get('confidence')}% confidence)\n"
            message += f"{analysis.get('reasoning', 'No reasoning provided')}\n\n"

    message += "Key Observations:\n"
    message += "\n".join(f"• {obs}" for obs in overall.get('key_observations', ['No observations']))
    message += f"\n\nRecommended Action:\n{overall.get('recommended_action', {}).get('reasoning', 'No recommendation')}"

    # Only send to Telegram if there are high confidence signals
    if high_confidence_signals:
        # Get paths to the three timeframe charts
        chart_paths = [
            Path('public/charts') / token_info['symbol'].lower() / f"{token_info['symbol']}_{timeframe}_candles_trading_view.png"
            for timeframe in ['15m', '2h', '8h']
        ]
        
        # Filter to only existing chart files
        existing_charts = [str(path) for path in chart_paths if path.exists()]
        
        send_telegram_message(message, existing_charts)
        print("\nSent high confidence signals and charts to Telegram")
    else:
        print("\nNo high confidence signals to send")
    
    # Log analysis
    print("\nAnalysis completed:")
    print(message)
    
    return message

def main():
    try:
        print("\n🔄 Starting chart analysis...")
        
        # Get token info from Airtable
        tokens_table = getTable('TOKENS')
        tokens = tokens_table.select(filterByFormula='{isActive} = 1').all()
        
        all_analyses = []
        
        for i, token_record in enumerate(tokens, 1):
            token_info = {
                'symbol': token_record.get('symbol'),
                'name': token_record.get('name'),
                'mint': token_record.get('mint')
            }
            
            print(f"\n📊 Processing token {i}/{len(tokens)}: {token_info['symbol']}")
            
            # Get chart paths for this token
            chart_paths = [
                Path('public/charts') / token_info['symbol'].lower() / f"{token_info['symbol']}_{tf}_candles_trading_view.png"
                for tf in ['15m', '2h', '8h']
            ]
            
            # Filter to only existing charts
            existing_charts = [p for p in chart_paths if p.exists()]
            
            if not existing_charts:
                print(f"❌ No charts found for {token_info['symbol']}")
                continue
                
            try:
                # Analyze charts
                analyses = analyze_charts_with_claude(existing_charts, token_info)
                print(f"\n✅ Analysis completed for {token_info['symbol']}")
                
                # Add to batch for processing
                all_analyses.append((token_info, analyses))
                
            except Exception as e:
                print(f"❌ Error analyzing {token_info['symbol']}: {e}")
                continue
        
        # Process all analyses in batch
        if all_analyses:
            print(f"\n🔄 Processing {len(all_analyses)} token analyses...")
            results = process_signals_batch(all_analyses)
            print(f"\n✅ Generated {len(results)} signals")
        else:
            print("\n❌ No analyses to process")
            
    except Exception as e:
        print(f"\n❌ Analysis failed: {e}")
        raise

if __name__ == "__main__":
    main()
def process_valid_signals(pending_signals):
    """Process signals that have passed validation"""
    # Map timeframes to strategy types
    timeframe_mapping = {
        '15m': 'SCALP',     # 15-minute chart for 6-hour trades
        '1H': 'INTRADAY',   # 1-hour chart for 24-hour trades
        '4H': 'SWING',      # 4-hour chart for 7-day trades
        '1D': 'POSITION'    # Daily chart for 30-day trades
    }
    
    processed_signals = []
    
    for signal in pending_signals:
        try:
            print(f"\nCreating signal for {signal['token_info']['symbol']}...")
            result = create_airtable_signal(
                signal,
                signal['timeframe'],
                signal['token_info']
            )
            
            if result:
                print("✅ Signal created successfully")
                processed_signals.append({
                    'token': signal['token_info']['symbol'],
                    'timeframe': signal['timeframe'],
                    'signal': signal['signal'],
                    'confidence': signal['confidence']
                })
            else:
                print("❌ Failed to create signal")
                
        except Exception as e:
            print(f"❌ Error processing signal: {e}")
            continue
    
    # Send batch notification if any signals were processed
    if processed_signals:
        message = "🤖 New Trading Signals\n\n"
        for signal in processed_signals:
            message += f"${signal['token']} {signal['timeframe']}: {signal['signal']} "
            message += f"({signal['confidence']}% confidence)\n"
        
        send_telegram_message(message)
        print("\n✅ Sent batch signals to Telegram")
    else:
        print("\n⚠️ No signals to process")
    
    return processed_signals
