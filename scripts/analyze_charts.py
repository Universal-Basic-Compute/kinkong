import sys
import logging
from pathlib import Path

# Add project root to Python path
project_root = str(Path(__file__).parent.parent.absolute())
if project_root not in sys.path:
    sys.path.insert(0, project_root)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Now we can import backend modules
from backend.src.airtable.tables import getTable
from socials.post_signal import post_signal
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
from scripts.validate_signal import validate_signal

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
    try:
        # Find first { and last }
        start_idx = json_str.find('{')
        end_idx = json_str.rfind('}')
        
        if start_idx == -1 or end_idx == -1:
            print("No valid JSON structure found in response")
            print("Original string:", json_str)
            # Return a valid empty structure
            return json.dumps({
                "timeframes": {
                    "POSITION": {},
                    "SWING": {},
                    "INTRADAY": {},
                    "SCALP": {}
                },
                "overall_analysis": {}
            })
            
        # Extract just the JSON part
        json_str = json_str[start_idx:end_idx + 1]
        
        # Remove any remaining markdown code block indicators
        json_str = json_str.replace('```json', '')
        json_str = json_str.replace('```', '')
        
        # Remove any leading/trailing whitespace
        json_str = json_str.strip()
        
        # Validate by parsing
        parsed = json.loads(json_str)
            
        return json.dumps(parsed)
        
    except Exception as e:
        print(f"Error cleaning JSON string: {e}")
        print("Original string:", json_str)
        # Return a valid empty structure
        return json.dumps({
            "timeframes": {
                "POSITION": {},
                "SWING": {},
                "INTRADAY": {},
                "SCALP": {}
            },
            "overall_analysis": {}
        })

SYSTEM_PROMPT = """You are an expert cryptocurrency technical analyst specializing in UBC/USD market analysis.

Analyze the charts in order from highest to lowest timeframe:
1. POSITION (1D chart, 30-day trades)
2. SWING (4H chart, 7-day trades)
3. INTRADAY (1H chart, 24-hour trades)
4. SCALP (15m chart, 6-hour trades)

Latest Token Metrics:
{token_metrics}

For each timeframe, provide:
1. Signal (BUY/SELL/HOLD)
2. Confidence level (0-100%)
3. Key support and resistance levels
4. Detailed reasoning
5. Risk/reward ratio if applicable

Format your response as JSON:
{{
    \\"timeframes\\": {{
        \\"POSITION\\": {{
            \\"signal\\": \\"BUY|SELL|HOLD\\",
            \\"confidence\\": 0,
            \\"reasoning\\": \\"Detailed analysis\\",
            \\"key_levels\\": {{
                \\"support\\": [0.0, 0.0],
                \\"resistance\\": [0.0, 0.0]
            }},
            \\"risk_reward_ratio\\": 0.0
        }},
        \\"SWING\\": {{ ... }},
        \\"INTRADAY\\": {{ ... }},
        \\"SCALP\\": {{ ... }}
    }}
}}"""

def get_latest_token_snapshot(token):
    """Get latest token snapshot from Airtable"""
    try:
        snapshots_table = getTable('TOKEN_SNAPSHOTS')
        records = snapshots_table.select(
            filterByFormula=f"{{token}} = '{token}'",
            sort=[{'field': 'createdAt', 'direction': 'desc'}],
            maxRecords=1
        ).all()
        
        if records:
            return records[0]['fields']
        return None
    except Exception as e:
        print(f"Error fetching token snapshot: {e}")
        return None

def analyze_charts_with_claude(chart_paths, token_info=None):
    """Analyze multiple timeframe charts together using Claude 3"""
    try:
        # Debug logging at start
        print("\nStarting chart analysis with:")
        print(f"Chart paths: {chart_paths}")
        print(f"Token info: {token_info}")

        # Validate inputs
        if not chart_paths:
            raise ValueError("No chart paths provided")
            
        if not token_info or 'token' not in token_info:
            raise ValueError("Invalid token info provided")
            
        # Verify chart files exist
        existing_charts = []
        for path in chart_paths:
            if os.path.exists(path):
                existing_charts.append(path)
            else:
                print(f"Warning: Chart not found at {path}")
                
        if not existing_charts:
            raise ValueError("No valid chart files found")

        # Get API key from environment
        api_key = os.getenv('ANTHROPIC_API_KEY')
        if not api_key:
            raise ValueError("ANTHROPIC_API_KEY not found in .env file")

        # Format system prompt with token metrics
        # Get latest snapshot
        latest_snapshot = get_latest_token_snapshot(token_info['token'])
        snapshot_text = ""
        if latest_snapshot:
            snapshot_text = f"""

Latest Token Metrics:
• Price: ${latest_snapshot.get('price', 0):.4f}
• 24h Volume: ${latest_snapshot.get('volume24h', 0):,.2f}
• Market Cap: ${latest_snapshot.get('marketCap', 0):,.2f}
• Liquidity: ${latest_snapshot.get('liquidity', 0):,.2f}
• Price Change 24h: {latest_snapshot.get('priceChange24h', 0):.2f}%
• Volume Change 24h: {latest_snapshot.get('volumeChange24h', 0):.2f}%"""

        formatted_system_prompt = SYSTEM_PROMPT.format(token_metrics=snapshot_text)

        # Make request to Claude via HTTP
        print("\n🚀 Making request to Claude API...")

        claude_url = "https://api.anthropic.com/v1/messages"
        headers = {
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json"
        }

        # Prepare chart images for Claude request
        chart_contents = []
        for chart_path in existing_charts:  # Use existing_charts instead of chart_paths
            try:
                with open(chart_path, "rb") as image_file:
                    image_data = base64.b64encode(image_file.read()).decode('utf-8')
                    
                    # Map the chart path to the correct timeframe
                    if '6h_scalp' in str(chart_path):
                        timeframe = 'SCALP'
                    elif '24h_intraday' in str(chart_path):
                        timeframe = 'INTRADAY'
                    elif '7d_swing' in str(chart_path):
                        timeframe = 'SWING'
                    elif '30d_position' in str(chart_path):
                        timeframe = 'POSITION'
                    else:
                        print(f"Unknown timeframe in chart path: {chart_path}")
                        continue

                    chart_contents.append({
                        "timeframe": timeframe,
                        "data": image_data
                    })
                    print(f"Successfully loaded chart for {timeframe}")
            except Exception as e:
                print(f"Error loading chart {chart_path}: {e}")
                continue

        if not chart_contents:
            raise ValueError("No chart images could be loaded")
        
        user_prompt = f"""I'm providing you with charts for {token_info['token']}/USD for a complete multi-timeframe analysis.

Please analyze the charts in this specific order, from highest to lowest timeframe, to build a complete top-down analysis:

1. POSITION (30D chart) - First analyze the long-term trend and major market structure
2. SWING (7D chart) - Then analyze the medium-term trend and key swing levels
3. INTRADAY (24H chart) - Next analyze the short-term trend and intraday patterns
4. SCALP (6H chart) - Finally analyze immediate price action and potential entry/exit points

For each timeframe, consider how it relates to the higher timeframes above it. Your analysis should flow from the larger trend down to the immediate trading opportunities."""

        # Create client with API key
        client = anthropic.Client(api_key=api_key)
        message = client.messages.create(
            model="claude-3-5-sonnet-20241022",
            max_tokens=4096,
            system=formatted_system_prompt,
            messages=[
                {
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
                }
            ]
        )
        
        # Add debug logging for Claude's response
        print("\nRaw response from Claude:")
        print(message.content[0].text)

        # Clean and parse response with better error handling
        cleaned_response = clean_json_string(message.content[0].text)
        print("\nCleaned response:")
        print(cleaned_response)
        
        # Validate JSON structure before parsing
        if not cleaned_response.strip().startswith('{'):
            raise ValueError("Response is not valid JSON - doesn't start with {")
            
        analysis = json.loads(cleaned_response)
        
        # Validate expected structure
        if 'timeframes' not in analysis:
            raise ValueError("Response missing required 'timeframes' key")
            
        # Extract timeframe analyses
        timeframe_analyses = analysis.get('timeframes', {})
        
        if not timeframe_analyses:
            raise ValueError("No timeframe analyses found in response")
            
        # Convert to ChartAnalysis objects
        analyses = {}
        for timeframe, data in timeframe_analyses.items():
            if not isinstance(data, dict):
                print(f"Warning: Invalid data format for timeframe {timeframe}")
                continue
                
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
        
    except json.JSONDecodeError as e:
        print(f"\nJSON parsing error: {e}")
        print("Failed to parse response at position:", e.pos)
        print("Line:", e.doc.splitlines()[e.lineno-1])
        return None
        
    except Exception as e:
        print(f"\nError processing Claude's response: {e}")
        if 'cleaned_response' in locals():
            print("Response content:")
            print(cleaned_response)
        return None

def create_airtable_signal(analysis, timeframe, token_info, analyses=None, additional_fields=None):
    try:
        print(f"\nCreating Airtable signal for {token_info['token']}...")
        
        # Get current UTC timestamp in ISO format
        current_time = datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')
        
        # Debug the analysis object
        print("\nAnalysis object type:", type(analysis))
        print("Analysis contents:", analysis)
        
        # Get the reasoning from the original analysis in analyses
        reason_text = ''
        if analyses and timeframe in analyses:
            timeframe_analysis = analyses[timeframe]
            if isinstance(timeframe_analysis, dict):
                reason_text = timeframe_analysis.get('reasoning', '')
                print("\nGot reasoning from timeframe analysis dict:", reason_text)
            elif hasattr(timeframe_analysis, 'reasoning'):
                reason_text = timeframe_analysis.reasoning
                print("\nGot reasoning from timeframe analysis object:", reason_text)
        
        # Fallback to the analysis object itself if needed
        if not reason_text:
            print("\nFalling back to analysis object for reasoning")
            if isinstance(analysis, dict):
                reason_text = analysis.get('reasoning', '')
                print("Got reasoning from analysis dict:", reason_text)
            elif hasattr(analysis, 'reasoning'):
                reason_text = analysis.reasoning
                print("Got reasoning from analysis object:", reason_text)
            elif hasattr(analysis, 'get'):
                reason_text = analysis.get('reasoning', '')
                print("Got reasoning using get method:", reason_text)
                
        if not reason_text:
            print("\nWARNING: Could not extract reasoning text from any source!")
            
        signal_type = analysis.get('signal', 'UNKNOWN')
        confidence = analysis.get('confidence', 0)
        key_levels = analysis.get('key_levels', {})

        print(f"\nExtracted data:")
        print(f"Reasoning: {reason_text}")
        print(f"Signal type: {signal_type}")
        print(f"Confidence: {confidence}")
        print(f"Key levels: {key_levels}")

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

        # Get entry/target/stop prices from key levels
        support_levels = key_levels.get('support', [])
        resistance_levels = key_levels.get('resistance', [])
        
        if signal_type == 'SELL':
            entry_price = resistance_levels[0] if resistance_levels else 0
            target_price = support_levels[0] if support_levels else 0
            stop_loss = resistance_levels[1] if len(resistance_levels) > 1 else entry_price * 1.05
        else:  # BUY
            entry_price = support_levels[0] if support_levels else 0
            target_price = resistance_levels[0] if resistance_levels else 0
            stop_loss = support_levels[1] if len(support_levels) > 1 else entry_price * 0.95

        expected_return = abs((target_price - entry_price) / entry_price * 100)

        # Create signal record with just the reasoning text
        signal_data = {
            'token': token_info['token'],
            'type': signal_type,
            'timeframe': timeframe,
            'entryPrice': entry_price,
            'targetPrice': target_price,
            'stopLoss': stop_loss,
            'confidence': confidence_level,
            'reason': reason_text,  # Just the raw reasoning text
            'createdAt': current_time,
            'expiryDate': expiry_date.isoformat().replace('+00:00', 'Z'),
            'expectedReturn': round(expected_return, 2)
        }

        # Add any additional fields
        if additional_fields:
            # Remove 'validated' from additional fields if present
            additional_fields.pop('validated', None)
            signal_data.update(additional_fields)

        print("\nSending to Airtable:", json.dumps(signal_data, indent=2))
        response = airtable.insert(signal_data)
        print(f"✅ Created signal: {response['id']}")

        # Post to social media if it's a high confidence signal
        if confidence_level == 'HIGH':
            if post_signal(response):
                print("✅ Signal posted to social media")
            else:
                print("⚠️ Failed to post signal to social media")

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
    
    # Get Airtable configuration
    base_id = os.getenv('KINKONG_AIRTABLE_BASE_ID')
    api_key = os.getenv('KINKONG_AIRTABLE_API_KEY')
    
    if not base_id or not api_key:
        print("❌ Missing Airtable configuration")
        return []
    
    # Standard timeframes for all analysis
    STRATEGY_TIMEFRAMES = ['SCALP', 'INTRADAY', 'SWING', 'POSITION']
    
    pending_signals = []
    
    for token_info, analyses in token_analyses:
        print(f"\n📊 Processing signals for {token_info['token']}...")
        
        # Filter valid timeframes
        valid_timeframes = {}
        for tf, analysis in analyses.items():
            if tf == 'overall':
                continue
                
            if tf in STRATEGY_TIMEFRAMES:
                valid_timeframes[tf] = analysis
                print(f"Valid timeframe: {tf}")
            else:
                print(f"Skipping unknown timeframe: {tf}")
        
        print(f"\nFound {len(valid_timeframes)} valid timeframe analyses")
        
        for timeframe, analysis in valid_timeframes.items():
            print(f"\n⏰ Processing {timeframe} timeframe...")
            
            signal_type = analysis.get('signal')
            confidence = analysis.get('confidence', 0)
            key_levels = analysis.get('key_levels')
            
            print(f"Signal type: {signal_type}")
            print(f"Confidence: {confidence}")
            print(f"Key levels: {key_levels}")
            
            if signal_type and signal_type != 'HOLD' and confidence >= 60:
                print("✅ Signal meets criteria for creation")
                
                # Create signal with validation status = 0 (pending)
                result = create_airtable_signal(
                    analysis,
                    timeframe,  # Pass the actual timeframe name
                    token_info,
                    analyses
                )
                
                if result:
                    # Check for existing trades first
                    trades_table = Airtable(base_id, 'TRADES', api_key)
                    existing_trades = trades_table.get_all(
                        formula=f"{{signalId}} = '{result['id']}'"
                    )

                    if existing_trades:
                        print(f"⚠️ Trade already exists for signal {result['id']}")
                        continue

                    # Create trade record with the correct timeframe
                    trade_data = {
                        'signalId': result['id'],
                        'token': token_info['token'], 
                        'type': signal_type,
                        'timeframe': timeframe,  # Use the actual timeframe!
                        'status': 'PENDING',
                        'amount': 0,
                        'entryValue': 0,
                        'activationTime': None,
                        'entryPrice': float(result['fields']['entryPrice']),
                        'stopLoss': float(result['fields']['stopLoss']),
                        'targetPrice': float(result['fields']['targetPrice']),
                        'expiryDate': result['fields']['expiryDate'],
                        'exitPrice': None,
                        'realizedPnl': None,
                        'roi': None
                    }
                    
                    # Add trade record
                    trade_result = trades_table.insert(trade_data)
                    print(f"\n✅ Created trade record: {trade_result['id']}")
                    
                    # Validate signal immediately
                    validation_result = validate_signal(
                        timeframe=timeframe,  # Pass the actual timeframe name
                        signal_data={
                            'id': result['id'],
                            'signal': signal_type,
                            'entryPrice': float(result['fields'].get('entryPrice', 0)),
                            'targetPrice': float(result['fields'].get('targetPrice', 0)),
                            'stopLoss': float(result['fields'].get('stopLoss', 0))
                        },
                        token_info=token_info,
                        market_data=get_dexscreener_data(token_info['mint'])
                    )
                    
                    if validation_result['valid']:
                        pending_signals.append({
                            'signal_id': result['id'],
                            'trade_id': trade_result['id'],
                            'timeframe': timeframe,
                            'token': token_info['token'],
                            'type': signal_type,
                            'confidence': confidence,
                            'token_info': token_info
                        })
                        print(f"✅ Signal validated successfully for {timeframe}")
                    else:
                        print(f"❌ Signal validation failed for {timeframe}: {validation_result['reason']}")

    # Process validated signals
    if pending_signals:
        print(f"\n🔄 Processing {len(pending_signals)} validated signals...")
        results = process_valid_signals(pending_signals)
        print(f"✅ Created {len(results)} trades")
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
            signal_id = f"{token_info.get('token')}_{timeframe}_{analysis.get('signal')}_{datetime.now().strftime('%Y%m%d')}"
            
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
    
    message = f"""🔄 {token_info.get('token')} Technical Analysis Update

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
            Path('public/charts') / token_info['token'].lower() / f"{token_info['token']}_{timeframe}_candles_trading_view.png"
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
                'token': token_record.get('token'),
                'name': token_record.get('name'),
                'mint': token_record.get('mint')
            }
            
            print(f"\n📊 Processing token {i}/{len(tokens)}: {token_info['token']}")
            
            # Get chart paths for this token
            chart_paths = [
                Path('public/charts') / token_info['token'].lower() / f"{token_info['token']}_{tf}"
                for tf in [
                    '30d_position.png',
                    '7d_swing.png',
                    '24h_intraday.png',
                    '6h_scalp.png'
                ]
            ]
            
            # Filter to only existing charts
            existing_charts = [p for p in chart_paths if p.exists()]
            
            if not existing_charts:
                print(f"❌ No charts found for {token_info['token']}")
                continue
                
            try:
                # Analyze charts
                analyses = analyze_charts_with_claude(existing_charts, token_info)
                print(f"\n✅ Analysis completed for {token_info['token']}")
                
                # Add to batch for processing
                all_analyses.append((token_info, analyses))
                
            except Exception as e:
                print(f"❌ Error analyzing {token_info['token']}: {e}")
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
    processed_signals = []
    
    for signal in pending_signals:
        try:
            print(f"\nCreating trade for {signal['token']} - {signal['timeframe']}...")
            
            # Create trade with specific timeframe
            result = create_airtable_signal(
                signal,
                signal['timeframe'],  # Use the specific timeframe
                signal['token_info']
            )
            
            if result:
                print(f"✅ Trade created successfully for {signal['timeframe']}")
                processed_signals.append({
                    'token': signal['token'],
                    'timeframe': signal['timeframe'],
                    'signal': signal['type'],
                    'confidence': signal['confidence']
                })
            else:
                print(f"❌ Failed to create trade for {signal['timeframe']}")
                
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
