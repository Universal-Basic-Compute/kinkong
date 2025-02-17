from dotenv import load_dotenv
import os
from datetime import datetime
import asyncio
from airtable import Airtable
from ratelimit import limits, sleep_and_retry
import json
from pathlib import Path
from generate_chart import generate_chart, fetch_token_data, calculate_support_levels
from analyze_charts import analyze_charts_with_claude, generate_signal

@sleep_and_retry
@limits(calls=5, period=1)  # 5 calls per second
def rate_limited_fetch(timeframe, hours, token_address):
    return fetch_token_data(timeframe, hours, token_address)

# Load environment variables
load_dotenv()

CHART_CONFIGS = [
    {
        'timeframe': '15m',
        'duration_hours': 34,
        'title': '{symbol}/USD Short-term Analysis (34H)',
        'subtitle': '15-minute candles - Trading Setup View',
        'filename': '{symbol}_34h_short_term_15m_candles_trading_view.png'
    },
    {
        'timeframe': '2H',
        'duration_hours': 270,
        'title': '{symbol}/USD Medium-term Analysis (11D)',
        'subtitle': '2-hour candles - Swing Trading View',
        'filename': '{symbol}_11d_medium_term_2h_candles_swing_view.png'
    },
    {
        'timeframe': '8H',
        'duration_hours': 1080,
        'title': '{symbol}/USD Long-term Analysis (45D)',
        'subtitle': '8-hour candles - Trend Analysis View',
        'filename': '{symbol}_45d_long_term_8h_candles_trend_view.png'
    }
]

async def get_active_tokens():
    """Get list of active tokens from Airtable"""
    try:
        base_id = os.getenv('KINKONG_AIRTABLE_BASE_ID')
        api_key = os.getenv('KINKONG_AIRTABLE_API_KEY')
        
        if not base_id or not api_key:
            raise ValueError("Airtable configuration missing")
            
        airtable = Airtable(base_id, 'TOKENS', api_key)
        
        records = airtable.get_all(
            formula="AND({isActive}=1, NOT({mint}=''))"
        )
        
        tokens = [{
            'symbol': record['fields'].get('symbol') or record['fields'].get('name'),
            'mint': record['fields']['mint']
        } for record in records]
        
        print(f"Found {len(tokens)} active tokens")
        return tokens
        
    except Exception as e:
        print(f"Error fetching active tokens: {e}")
        return []

async def analyze_token(token):
    """Generate and analyze charts for a single token"""
    retries = 3
    for attempt in range(retries):
        try:
            print(f"\n🔄 Processing {token['symbol']}...")
            
            # Create token-specific directory
            token_dir = Path('public/charts') / token['symbol'].lower()
            token_dir.mkdir(parents=True, exist_ok=True)
            
            # Generate charts for each timeframe
            chart_paths = []
            for config in CHART_CONFIGS:
                # Format config for this token
                token_config = {
                    **config,
                    'title': config['title'].format(symbol=token['symbol']),
                    'subtitle': config['subtitle'].format(symbol=token['symbol']),
                    'filename': config['filename'].format(symbol=token['symbol'])
                }
                
                # Fetch data
                df = fetch_token_data(
                    timeframe=config['timeframe'],
                    hours=config['duration_hours'],
                    token_address=token['mint']
                )
                
                if df is None or df.empty:
                    print(f"No data available for {token['symbol']} - {config['timeframe']}")
                    continue
                    
                # Calculate support levels
                support_levels = calculate_support_levels(df)
                
                # Generate chart and get the actual saved path
                success = generate_chart(df, token_config, support_levels)
                if success:
                    # Use the correct path where the file was actually saved
                    chart_path = token_dir / token_config['filename']
                    if chart_path.exists():  # Verify file exists
                        print(f"Generated chart: {chart_path}")
                        chart_paths.append(str(chart_path))  # Convert Path to string
                    else:
                        print(f"Chart file not found at {chart_path}")
                else:
                    print(f"Failed to generate chart for {token['symbol']} - {config['timeframe']}")
            
            if not chart_paths:
                print(f"No charts generated for {token['symbol']}")
                return
                
            # Do analysis only once
            print(f"\nAnalyzing charts for {token['symbol']}...")
            analyses = analyze_charts_with_claude(
                chart_paths,
                token_info={
                    'symbol': token['symbol'],
                    'mint': token['mint']
                }
            )
            
            if not analyses:
                print(f"No analysis generated for {token['symbol']}")
                return

            # Convert ChartAnalysis objects to dictionaries for JSON serialization
            serializable_analyses = {}
            for timeframe, analysis in analyses.items():
                if timeframe == 'overall':
                    serializable_analyses[timeframe] = analysis  # Overall is already a dict
                else:
                    serializable_analyses[timeframe] = {
                        'timeframe': analysis.timeframe,
                        'signal': analysis.signal,
                        'confidence': analysis.confidence,
                        'reasoning': analysis.reasoning,
                        'key_levels': analysis.key_levels,
                        'risk_reward_ratio': analysis.risk_reward_ratio,
                        'reassess_conditions': analysis.reassess_conditions
                    }

            # Save analysis to file
            analysis_path = token_dir / 'analysis.json'
            with open(analysis_path, 'w') as f:
                json.dump({
                    'timestamp': datetime.now().isoformat(),
                    'token': token['symbol'],
                    'analyses': serializable_analyses
                }, f, indent=2)
            print(f"Saved analysis to {analysis_path}")
            
            # Generate signal using the already-performed analysis
            signal_message = generate_signal(serializable_analyses, {
                'symbol': token['symbol'],
                'mint': token['mint']
            })
            print(f"\nCompleted analysis and signal generation for {token['symbol']}")
            
            # If we get here, processing was successful
            break
            
        except Exception as e:
            if attempt == retries - 1:
                print(f"Failed all retries for {token['symbol']}: {e}")
                return
            print(f"Attempt {attempt + 1} failed, retrying in 10s...")
            await asyncio.sleep(10)

async def main():
    try:
        print("🚀 Starting token analysis...")
        
        # Get active tokens
        tokens = await get_active_tokens()
        
        if not tokens:
            print("No active tokens found")
            return
            
        # Process tokens sequentially to avoid rate limits
        total = len(tokens)
        for i, token in enumerate(tokens, 1):
            print(f"\nProcessing token {i}/{total}: {token['symbol']}")
            await analyze_token(token)
            # Add delay between tokens
            await asyncio.sleep(5)
            
        print("\n✅ Token analysis completed")
        
    except Exception as e:
        print(f"❌ Fatal error: {e}")
        raise

if __name__ == "__main__":
    asyncio.run(main())
