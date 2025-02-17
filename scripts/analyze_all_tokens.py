import sys
from pathlib import Path
import os
from datetime import datetime, timedelta

# Get absolute path to project root
project_root = str(Path(__file__).parent.parent.absolute())

# Add to Python path if not already there
if project_root not in sys.path:
    sys.path.insert(0, project_root)

# Debug prints
print(f"Project root: {project_root}")
print(f"Current working directory: {os.getcwd()}")
print(f"Python path: {sys.path}")
print(f"Looking for backend at: {project_root}/backend")
print(f"Directory contents: {os.listdir(project_root)}")

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
        'duration_hours': 12,
        'title': '{symbol}/USD Short-term Analysis (12H)',
        'subtitle': '15-minute candles - Trading Setup View',
        'filename': '{symbol}_12h_short_term_15m_candles_trading_view.png'
    },
    {
        'timeframe': '2H',
        'duration_hours': 48,
        'title': '{symbol}/USD Medium-term Analysis (48H)',
        'subtitle': '2-hour candles - Swing Trading View',
        'filename': '{symbol}_48h_medium_term_2h_candles_swing_view.png'
    },
    {
        'timeframe': '8H',
        'duration_hours': 336,
        'title': '{symbol}/USD Long-term Analysis (14D)',
        'subtitle': '8-hour candles - Trend Analysis View',
        'filename': '{symbol}_14d_long_term_8h_candles_trend_view.png'
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
            
            # Check for recent analysis
            analysis_path = token_dir / 'analysis.json'
            if analysis_path.exists():
                try:
                    with open(analysis_path, 'r') as f:
                        saved_analysis = json.load(f)
                        
                    # Parse the timestamp from saved analysis
                    analysis_time = datetime.fromisoformat(saved_analysis['timestamp'])
                    time_diff = datetime.now() - analysis_time
                    
                    # If analysis is less than 10 minutes old
                    if time_diff < timedelta(minutes=10):
                        print(f"Using recent analysis from {time_diff.seconds // 60} minutes ago")
                        
                        # Verify all chart files exist
                        chart_paths = []
                        all_charts_exist = True
                        
                        for config in CHART_CONFIGS:
                            chart_filename = config['filename'].format(symbol=token['symbol'])
                            chart_path = token_dir / chart_filename
                            if chart_path.exists():
                                chart_paths.append(str(chart_path))
                            else:
                                all_charts_exist = False
                                break
                        
                        if all_charts_exist:
                            print("All chart files present, using cached analysis")
                            return {
                                'token_info': {
                                    'symbol': token['symbol'],
                                    'mint': token['mint']
                                },
                                'analyses': saved_analysis['analyses']
                            }
                        else:
                            print("Some chart files missing, regenerating analysis")
                except Exception as e:
                    print(f"Error reading cached analysis: {e}")
                    # Continue with new analysis if there's any error reading cache
            
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
                return None
                
            # Do analysis
            print(f"\nAnalyzing charts for {token['symbol']}...")
            try:
                analyses = analyze_charts_with_claude(
                    chart_paths,
                    token_info={
                        'symbol': token['symbol'],
                        'mint': token['mint']
                    }
                )
                
                print("Analysis result type:", type(analyses))
                print("Analysis keys:", analyses.keys() if analyses else None)
                
                if not analyses:
                    print(f"No analysis generated for {token['symbol']}")
                    return None
                
                # Convert ChartAnalysis objects to dictionaries
                serializable_analyses = {}
                for timeframe, analysis in analyses.items():
                    print(f"Processing timeframe {timeframe}, analysis type: {type(analysis)}")
                    if timeframe == 'overall':
                        serializable_analyses[timeframe] = analysis
                    else:
                        if hasattr(analysis, 'to_dict'):
                            serializable_analyses[timeframe] = analysis.to_dict()
                        else:
                            serializable_analyses[timeframe] = analysis

                # Save analysis to file
                analysis_path = token_dir / 'analysis.json'
                with open(analysis_path, 'w') as f:
                    json.dump({
                        'timestamp': datetime.now().isoformat(),
                        'token': token['symbol'],
                        'analyses': serializable_analyses
                    }, f, indent=2)
                print(f"Saved analysis to {analysis_path}")
                
                # Return the analysis data
                return {
                    'token_info': {
                        'symbol': token['symbol'],
                        'mint': token['mint']
                    },
                    'analyses': serializable_analyses
                }
                
            except Exception as e:
                print(f"Error during analysis: {e}")
                if attempt == retries - 1:
                    return None
                continue
                
        except Exception as e:
            print(f"Error processing {token['symbol']}: {e}")
            if attempt == retries - 1:
                return None
            print(f"Attempt {attempt + 1} failed, retrying in 10s...")
            await asyncio.sleep(10)
            
    return None

async def main():
    try:
        print("\n🚀 Starting token analysis...")
        
        # Get active tokens
        tokens = await get_active_tokens()
        
        if not tokens:
            print("No active tokens found")
            return
            
        # Collect analyses for all tokens
        analyses = []
        total = len(tokens)
        
        for i, token in enumerate(tokens, 1):
            print(f"\n=== Processing token {i}/{total}: {token['symbol']} ===")
            try:
                result = await analyze_token(token)
                if result:
                    print(f"\n✅ Analysis completed for {token['symbol']}")
                    print("Analysis structure:", type(result))
                    print("Analysis keys:", result.keys() if result else None)
                    analyses.append(result)
                else:
                    print(f"\n❌ No valid analysis for {token['symbol']}")
            except Exception as e:
                print(f"\n❌ Error analyzing {token['symbol']}: {str(e)}")
                continue
                
            print("\n" + "="*50)  # Visual separator between tokens
        
        # Process all analyses in batch
        if analyses:
            print(f"\n🔄 Processing {len(analyses)} token analyses in batch...")
            from analyze_charts import process_signals_batch
            print("\nAnalyses to process:", [a['token_info']['symbol'] for a in analyses])
            signals = process_signals_batch([
                (a['token_info'], a['analyses']) for a in analyses
            ])
            print(f"\n✅ Generated {len(signals)} signals")
        else:
            print("\n❌ No analyses to process")
            
        print("\n✅ Token analysis completed")
        
    except Exception as e:
        print(f"\n❌ Fatal error: {e}")
        raise

if __name__ == "__main__":
    asyncio.run(main())
