import sys
import codecs
from pathlib import Path
import os
import traceback

if sys.stdout.encoding != 'utf-8':
    sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, 'strict')
    sys.stderr = codecs.getwriter('utf-8')(sys.stderr.buffer, 'strict')
from datetime import datetime, timedelta, timezone
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
        self.snapshots_table = Airtable(self.base_id, 'TOKEN_SNAPSHOTS', self.api_key)
        
        # Chart configurations for different timeframes
        self.TIMEFRAMES = [
            {
                'timeframe': '15m',
                'strategy': 'SCALP',
                'hours': 15,  # 15 hours = 60 fifteen-minute candles
                'title': '{token}/USD Scalp Analysis (6H)',
                'filename': '{token}_6h_scalp.png'
            },
            {
                'timeframe': '1H',
                'strategy': 'INTRADAY',
                'hours': 60,  # 60 hours = 60 hourly candles
                'title': '{token}/USD Intraday Analysis (24H)',
                'filename': '{token}_24h_intraday.png'
            },
            {
                'timeframe': '4H',
                'strategy': 'SWING',
                'hours': 240,  # 240 hours = 60 four-hour candles
                'title': '{token}/USD Swing Analysis (7D)',
                'filename': '{token}_7d_swing.png'
            },
            {
                'timeframe': '1D',
                'strategy': 'POSITION',
                'hours': 1440,  # 1440 hours = 60 daily candles
                'title': '{token}/USD Position Analysis (30D)',
                'filename': '{token}_30d_position.png'
            }
        ]

    async def get_active_tokens(self) -> List[Dict]:
        """Get list of active tokens excluding tokens with empty mint addresses"""
        try:
            # Using get_all with a simpler formula
            records = self.tokens_table.get_all(
                formula="AND(" +
                    "{isActive}=1, " +
                    "NOT({mint}='')" +
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
                
            # Log the full analyses result for debugging
            logger.info(f"Full analyses result for {token['token']}:")
            for tf, analysis in analyses.items():
                logger.info(f"  {tf}: {analysis}")
            
            # Create signals for strong setups
            signals_created = 0
            for timeframe, analysis in analyses.items():
                if timeframe == 'overall':
                    continue
                    
                signal_type = analysis.get('signal')
                confidence = analysis.get('confidence', 0)
                
                # Log the analysis details for debugging
                logger.info(f"Analysis for {token['token']} - {timeframe}: signal={signal_type}, confidence={confidence}, expectedReturn={analysis.get('expectedReturn', 0)}")
                logger.info(f"Full analysis data for {token['token']} - {timeframe}: {analysis}")
                
                # Only create signals for BUY/SELL (not HOLD) with confidence >= 60
                # Also check that the expected return meets minimum targets based on timeframe
                if signal_type and signal_type != 'HOLD' and confidence >= 60:
                    # Calculate expected return based on entry and target prices
                    if hasattr(analysis, 'key_levels') and analysis.key_levels:
                        key_levels = analysis.key_levels
                        
                        # Extract support and resistance levels
                        support_levels = key_levels.get('support', [])
                        resistance_levels = key_levels.get('resistance', [])
                        
                        # Calculate entry and target prices based on signal type
                        if signal_type == 'BUY':
                            # For BUY signals: entry at support, target at resistance
                            entry_price = min(support_levels) if support_levels else 0
                            target_price = min(resistance_levels) if resistance_levels else 0
                        else:  # SELL
                            # For SELL signals: entry at resistance, target at support
                            entry_price = max(resistance_levels) if resistance_levels else 0
                            target_price = max(support_levels) if support_levels else 0
                        
                        # Calculate expected return as percentage
                        if entry_price and target_price and entry_price > 0:
                            if signal_type == 'BUY':
                                expected_return = ((target_price - entry_price) / entry_price) * 100
                            else:  # SELL
                                expected_return = ((entry_price - target_price) / entry_price) * 100
                            
                            # Ensure expected return is positive
                            expected_return = abs(expected_return)
                        else:
                            expected_return = 0
                    else:
                        # Fallback to existing methods if key_levels not available
                        if hasattr(analysis, 'get'):
                            expected_return = analysis.get('expectedReturn', 0)
                        elif hasattr(analysis, 'to_dict'):
                            expected_return = analysis.to_dict().get('expectedReturn', 0)
                        elif hasattr(analysis, 'risk_reward_ratio'):
                            # Use risk_reward_ratio as a fallback for expectedReturn
                            expected_return = getattr(analysis, 'risk_reward_ratio', 0) * 100 if getattr(analysis, 'risk_reward_ratio', 0) else 0
                        else:
                            expected_return = 0
                    
                    # Log the calculated expected return
                    logger.info(f"Calculated expected return for {token['token']} - {timeframe}: {expected_return:.2f}%")
                    
                    # Set minimum target based on timeframe
                    min_target = {
                        'SCALP': 12,      # 12% for SCALP
                        'INTRADAY': 15,   # 15% for INTRADAY
                        'SWING': 20,      # 20% for SWING
                        'POSITION': 25    # 25% for POSITION
                    }.get(timeframe, 15)  # Default to 15% if timeframe not recognized
                    
                    # Skip if expected return is below minimum target
                    if expected_return < min_target:
                        logger.info(f"Skipping {timeframe} signal for {token['token']} - expected return {expected_return:.2f}% below minimum target {min_target}%")
                        if hasattr(analysis, 'to_dict'):
                            logger.info(f"Analysis keys available: {list(analysis.to_dict().keys())}")
                        elif hasattr(analysis, '__dict__'):
                            logger.info(f"Analysis keys available: {list(analysis.__dict__.keys())}")
                        else:
                            logger.info(f"Analysis object doesn't support keys() method")
                        continue
                        
                    # Check for existing signal before creating a new one
                    existing_signal = self.check_existing_signal(token['token'], timeframe)
                    if existing_signal:
                        logger.info(f"Using existing {timeframe} signal for {token['token']} (ID: {existing_signal['id']})")
                        signals_created += 1
                        continue  # Skip to next timeframe
                        
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
            
    def get_token_snapshots(self, token_mint: str) -> List[Dict]:
        """Get token snapshots for a specific token mint"""
        try:
            # Using get_all with formula instead of select
            records = self.snapshots_table.get_all(
                formula=f"{{mint}}='{token_mint}'",
                sort=[("timestamp", "desc")]
            )
            return [record['fields'] for record in records]
        except Exception as e:
            logger.error(f"Error fetching token snapshot: {e}")
            return []
    
    def check_existing_signal(self, token: str, timeframe: str) -> Optional[Dict]:
        """
        Check if a signal for the same token and timeframe exists in the last 6 hours
        
        Args:
            token: Token symbol
            timeframe: Signal timeframe (SCALP, INTRADAY, SWING, POSITION)
            
        Returns:
            Existing signal record if found, None otherwise
        """
        try:
            # Calculate timestamp for 6 hours ago
            six_hours_ago = (datetime.now(timezone.utc) - timedelta(hours=6)).isoformat()
            
            # Query Airtable for existing signals
            signals_table = Airtable(self.base_id, 'SIGNALS', self.api_key)
            existing_signals = signals_table.get_all(
                formula=f"AND({{token}}='{token}', {{timeframe}}='{timeframe}', {{createdAt}} > '{six_hours_ago}')"
            )
            
            if existing_signals:
                logger.info(f"Found existing {timeframe} signal for {token} created within the last 6 hours")
                return existing_signals[0]
            
            return None
        except Exception as e:
            logger.error(f"Error checking for existing signals: {e}")
            return None
            
    async def analyze_specific_token(self, token_symbol: str) -> Optional[Dict]:
        """
        Analyze a specific token by symbol and generate signals if appropriate
        
        Args:
            token_symbol: The token symbol to analyze
            
        Returns:
            The created signal record or None if no signal was generated
        """
        try:
            logger.info(f"\n🔍 Analyzing specific token: {token_symbol}")
            
            # Get token from TOKENS table
            token_records = self.tokens_table.get_all(
                formula=f"AND({{token}}='{token_symbol}', {{isActive}}=1)"
            )
            
            if not token_records:
                logger.error(f"Token {token_symbol} not found or not active")
                return None
                
            token = {
                'token': token_records[0]['fields'].get('token'),
                'mint': token_records[0]['fields'].get('mint')
            }
            
            # Analyze the token
            signal = await self.analyze_token(token)
            
            if signal:
                logger.info(f"✅ Generated signal for {token_symbol}")
                return signal
            else:
                logger.info(f"No signal generated for {token_symbol}")
                return None
                
        except Exception as e:
            logger.error(f"❌ Error analyzing token {token_symbol}: {e}")
            return None

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

        # Initialize signal generator
        generator = SignalGenerator()
        
        # Check if a specific token was provided as argument
        if len(sys.argv) > 1:
            token_symbol = sys.argv[1].upper()
            logger.info(f"Analyzing specific token: {token_symbol}")
            
            # Analyze the specified token
            signal = asyncio.run(generator.analyze_specific_token(token_symbol))
            
            if signal:
                logger.info(f"✅ Successfully generated signal for {token_symbol}")
                # Print signal details
                logger.info(f"Signal details:")
                logger.info(f"Type: {signal.get('type')}")
                logger.info(f"Timeframe: {signal.get('timeframe')}")
                logger.info(f"Confidence: {signal.get('confidence')}")
                if 'entryPrice' in signal:
                    logger.info(f"Entry Price: ${signal['entryPrice']:.6f}")
                if 'targetPrice' in signal:
                    logger.info(f"Target Price: ${signal['targetPrice']:.6f}")
                if 'stopLoss' in signal:
                    logger.info(f"Stop Loss: ${signal['stopLoss']:.6f}")
                
                # Return success
                sys.exit(0)
            else:
                logger.error(f"❌ No signal generated for {token_symbol}")
                sys.exit(1)
        else:
            # Generate signals for all active tokens
            asyncio.run(generator.generate_signals())
            logger.info("\n✅ Signal generation completed for all active tokens")
            sys.exit(0)

    except Exception as e:
        logger.error(f"\n❌ Script failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
