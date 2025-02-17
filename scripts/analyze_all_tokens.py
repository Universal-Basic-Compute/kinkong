import sys
from pathlib import Path
import os

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
                
            except Exception as analysis_error:
                print(f"Error during chart analysis: {analysis_error}")
                print("Analysis error type:", type(analysis_error))
                if hasattr(analysis_error, '__dict__'):
                    print("Analysis error attributes:", analysis_error.__dict__)
                raise
            
            if not analyses:
                print(f"No analysis generated for {token['symbol']}")
                return

            # Convert ChartAnalysis objects to dictionaries for JSON serialization
            try:
                serializable_analyses = {}
                for timeframe, analysis in analyses.items():
                    print(f"Processing timeframe {timeframe}, analysis type: {type(analysis)}")
                    if timeframe == 'overall':
                        serializable_analyses[timeframe] = analysis
                    else:
                        if hasattr(analysis, 'to_dict'):
                            serializable_analyses[timeframe] = analysis.to_dict()
                        else:
                            print(f"Warning: analysis for {timeframe} has no to_dict method")
                            serializable_analyses[timeframe] = analysis

                # Try to serialize to verify it works
                print("Testing JSON serialization...")
                json_test = json.dumps(serializable_analyses)
                print("JSON serialization successful")

            except Exception as serialize_error:
                print(f"Error during serialization: {serialize_error}")
                print("Serialization error type:", type(serialize_error))
                if hasattr(serialize_error, '__dict__'):
                    print("Serialization error attributes:", serialize_error.__dict__)
                raise

            # Save analysis to file
            try:
                analysis_path = token_dir / 'analysis.json'
                with open(analysis_path, 'w') as f:
                    json.dump({
                        'timestamp': datetime.now().isoformat(),
                        'token': token['symbol'],
                        'analyses': serializable_analyses
                    }, f, indent=2)
                print(f"Saved analysis to {analysis_path}")
            
            except Exception as save_error:
                print(f"Error saving analysis file: {save_error}")
                print("Save error type:", type(save_error))
                if hasattr(save_error, '__dict__'):
                    print("Save error attributes:", save_error.__dict__)
                raise
            
            # Store analysis for batch processing
            return {
                'token_info': {
                    'symbol': token['symbol'],
                    'mint': token['mint']
                },
                'analyses': serializable_analyses
            }
            
        except Exception as e:
            if attempt == retries - 1:
                print(f"Failed all retries for {token['symbol']}: {e}")
                print("Final error type:", type(e))
                if hasattr(e, '__dict__'):
                    print("Final error attributes:", e.__dict__)
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
            
        # Collect analyses for all tokens
        analyses = []
        total = len(tokens)
        
        for i, token in enumerate(tokens, 1):
            print(f"\nProcessing token {i}/{total}: {token['symbol']}")
            result = await analyze_token(token)
            if result:
                analyses.append(result)
            # Add delay between tokens
            await asyncio.sleep(5)
        
        # Process all signals in batch
        if analyses:
            print(f"\nProcessing {len(analyses)} token analyses in batch...")
            from analyze_charts import process_signals_batch
            signals = process_signals_batch([
                (a['token_info'], a['analyses']) for a in analyses
            ])
            print(f"Processed {len(signals)} signals")
        else:
            print("\nNo analyses to process")
            
        print("\n✅ Token analysis completed")
        
    except Exception as e:
        print(f"❌ Fatal error: {e}")
        raise

if __name__ == "__main__":
    asyncio.run(main())
