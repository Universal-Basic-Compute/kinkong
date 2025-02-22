import sys
from pathlib import Path
import os
from datetime import datetime, timedelta
import asyncio
from airtable import Airtable
from dotenv import load_dotenv
import json
import logging
from typing import List, Dict, Optional

# Add project root to Python path
project_root = str(Path(__file__).parent.parent.absolute())
if project_root not in sys.path:
    sys.path.insert(0, project_root)

# Import project modules
from scripts.generate_chart import generate_chart, fetch_token_data, calculate_support_levels
from scripts.analyze_charts import analyze_charts_with_claude, create_airtable_signal

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)

class SignalGenerator:
    def __init__(self):
        load_dotenv()
        self.base_id = os.getenv('KINKONG_AIRTABLE_BASE_ID')
        self.api_key = os.getenv('KINKONG_AIRTABLE_API_KEY')
        self.tokens_table = Airtable(self.base_id, 'TOKENS', self.api_key)
        
        # Chart configurations for different timeframes
        self.TIMEFRAMES = [
            {
                'timeframe': '15m',
                'strategy': 'SCALP',
                'hours': 6,
                'title': '{token}/USD Scalp Analysis (6H)',
                'filename': '{token}_6h_scalp.png'
            },
            {
                'timeframe': '1H',
                'strategy': 'INTRADAY',
                'hours': 24,
                'title': '{token}/USD Intraday Analysis (24H)',
                'filename': '{token}_24h_intraday.png'
            },
            {
                'timeframe': '4H',
                'strategy': 'SWING',
                'hours': 168,  # 7 days
                'title': '{token}/USD Swing Analysis (7D)',
                'filename': '{token}_7d_swing.png'
            }
        ]

    async def get_active_tokens(self) -> List[Dict]:
        """Get list of active tokens excluding specific ones"""
        try:
            records = self.tokens_table.get_all(
                formula="AND(" +
                    "{isActive}=1, " +
                    "NOT({mint}=''), " +
                    "NOT({token}='UBC'), " +
                    "NOT({token}='COMPUTE'), " +
                    "NOT({token}='USDT')" +
                ")"
            )
            
            tokens = [{
                'token': record['fields'].get('token') or record['fields'].get('name'),
                'mint': record['fields']['mint']
            } for record in records]
            
            logger.info(f"Found {len(tokens)} active tokens for analysis")
            return tokens
            
        except Exception as e:
            logger.error(f"Error fetching active tokens: {e}")
            return []

    async def analyze_token(self, token: Dict) -> Optional[Dict]:
        """Generate and analyze charts for a single token"""
        try:
            logger.info(f"\nAnalyzing {token['token']}...")
            
            # Create token directory for charts
            token_dir = Path('public/charts') / token['token'].lower()
            token_dir.mkdir(parents=True, exist_ok=True)
            
            # Generate charts for each timeframe
            chart_paths = []
            for config in self.TIMEFRAMES:
                try:
                    # Format config for this token
                    token_config = {
                        **config,
                        'title': config['title'].format(token=token['token']),
                        'filename': config['filename'].format(token=token['token'])
                    }
                    
                    # Fetch and validate data
                    df = fetch_token_data(
                        timeframe=config['timeframe'],
                        hours=config['hours'],
                        token_address=token['mint']
                    )
                    
                    if df is None or df.empty:
                        logger.warning(f"No data for {token['token']} - {config['timeframe']}")
                        continue
                        
                    # Calculate support levels and generate chart
                    support_levels = calculate_support_levels(df)
                    chart_path = token_dir / token_config['filename']
                    
                    if generate_chart(df, token_config, support_levels):
                        if chart_path.exists():
                            chart_paths.append(str(chart_path))
                            logger.info(f"Generated chart: {chart_path}")
                    
                except Exception as e:
                    logger.error(f"Error generating chart for {config['timeframe']}: {e}")
                    continue
            
            if not chart_paths:
                logger.warning(f"No charts generated for {token['token']}")
                return None
            
            # Analyze charts and generate signals
            analyses = analyze_charts_with_claude(
                chart_paths,
                token_info={'token': token['token'], 'mint': token['mint']}
            )
            
            if not analyses:
                logger.warning(f"No analysis generated for {token['token']}")
                return None
            
            # Create signals for strong setups
            signals_created = 0
            for timeframe, analysis in analyses.items():
                if timeframe == 'overall':
                    continue
                    
                signal_type = analysis.get('signal')
                confidence = analysis.get('confidence', 0)
                
                if signal_type and signal_type != 'HOLD' and confidence >= 60:
                    try:
                        result = create_airtable_signal(
                            analysis,
                            timeframe,
                            {'token': token['token'], 'mint': token['mint']},
                            analyses,
                            {'validated': False}
                        )
                        if result:
                            signals_created += 1
                            logger.info(f"Created {timeframe} signal for {token['token']}")
                    except Exception as e:
                        logger.error(f"Error creating signal: {e}")
            
            logger.info(f"Created {signals_created} signals for {token['token']}")
            return {
                'token': token['token'],
                'signals_created': signals_created,
                'analyses': analyses
            }
            
        except Exception as e:
            logger.error(f"Error analyzing {token['token']}: {e}")
            return None

    async def generate_signals(self):
        """Main function to generate signals for all active tokens"""
        try:
            logger.info("Starting signal generation process...")
            
            # Get active tokens
            tokens = await self.get_active_tokens()
            if not tokens:
                logger.error("No active tokens found")
                return
            
            # Process each token
            results = []
            for token in tokens:
                try:
                    result = await self.analyze_token(token)
                    if result:
                        results.append(result)
                    await asyncio.sleep(1)  # Rate limiting
                except Exception as e:
                    logger.error(f"Error processing {token['token']}: {e}")
                    continue
            
            # Summarize results
            total_signals = sum(r['signals_created'] for r in results if r)
            logger.info(f"\nSignal generation completed:")
            logger.info(f"Tokens analyzed: {len(results)}")
            logger.info(f"Total signals created: {total_signals}")
            
            return results
            
        except Exception as e:
            logger.error(f"Error in signal generation process: {e}")
            raise

def main():
    try:
        # Verify environment variables
        required_vars = [
            'KINKONG_AIRTABLE_BASE_ID',
            'KINKONG_AIRTABLE_API_KEY',
            'ANTHROPIC_API_KEY'  # Required for Claude analysis
        ]
        
        missing = [var for var in required_vars if not os.getenv(var)]
        if missing:
            raise ValueError(f"Missing environment variables: {', '.join(missing)}")

        # Run signal generation
        generator = SignalGenerator()
        asyncio.run(generator.generate_signals())

    except Exception as e:
        logger.error(f"Fatal error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
