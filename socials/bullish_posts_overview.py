import os
import sys
from pathlib import Path
import logging
from datetime import datetime, timezone
from typing import List, Dict, Optional
from dotenv import load_dotenv
from airtable import Airtable
import anthropic

def setup_logging():
    """Configure logging"""
    logger = logging.getLogger(__name__)
    if not logger.handlers:
        handler = logging.StreamHandler()
        formatter = logging.Formatter(
            '%(asctime)s - %(levelname)s - %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        )
        handler.setFormatter(formatter)
        logger.addHandler(handler)
    logger.setLevel(logging.INFO)
    logger.propagate = False
    return logger

logger = setup_logging()

class MarketOverviewGenerator:
    def __init__(self):
        load_dotenv()
        self.base_id = os.getenv('KINKONG_AIRTABLE_BASE_ID')
        self.api_key = os.getenv('KINKONG_AIRTABLE_API_KEY')
        self.tokens_table = Airtable(self.base_id, 'TOKENS', self.api_key)
        self.sentiment_table = Airtable(self.base_id, 'MARKET_SENTIMENT', self.api_key)

    def get_token_signals(self) -> Dict[str, List[Dict]]:
        """Get all tokens with their signals grouped by sentiment"""
        try:
            # Get all active tokens and their analysis
            records = self.tokens_table.get_all(
                formula="AND(" +
                    "{isActive}=1, " +
                    "NOT({token}='UBC'), " +
                    "NOT({token}='COMPUTE')" +
                ")"
            )
            
            signals = {
                'bullish': [],
                'bearish': []
            }
            
            for record in records:
                fields = record.get('fields', {})
                analysis = fields.get('explanation', '')
                
                signal_data = {
                    'token': fields.get('token'),
                    'analysis': analysis,
                    'price': fields.get('price', 0),
                    'volume24h': fields.get('volume24h', 0),
                    'priceChange24h': fields.get('priceChange24h', 0)
                }
                
                if "VERDICT: BULLISH" in analysis:
                    signals['bullish'].append(signal_data)
                elif "VERDICT: NOT BULLISH" in analysis:
                    signals['bearish'].append(signal_data)
            
            # Sort both lists by 24h volume
            for key in signals:
                signals[key].sort(key=lambda x: float(x['volume24h'] or 0), reverse=True)
            
            return signals
            
        except Exception as e:
            logger.error(f"Error getting token signals: {e}")
            return {'bullish': [], 'bearish': []}

    def get_market_sentiment(self) -> str:
        """Get latest market sentiment"""
        try:
            records = self.sentiment_table.get_all(
                sort=[('createdAt', 'desc')],
                maxRecords=1
            )
            if records:
                return records[0]['fields'].get('classification', 'NEUTRAL')
            return 'NEUTRAL'
        except Exception as e:
            logger.error(f"Error getting market sentiment: {e}")
            return 'NEUTRAL'

    def generate_overview_with_claude(self, signals: Dict[str, List[Dict]], sentiment: str) -> str:
        """Generate comprehensive market overview using Claude, focusing on bullish signals"""
        try:
            # Format signals data for Claude
            bullish_tokens = "\n".join([
                f"${token['token']}: ${token['price']:.4f} | {token['priceChange24h']:+.1f}% | Vol: ${token['volume24h']:,.0f}\n{token['analysis']}"
                for token in signals['bullish']
            ])
            
            bearish_tokens = "\n".join([
                f"${token['token']}: ${token['price']:.4f} | {token['priceChange24h']:+.1f}% | Vol: ${token['volume24h']:,.0f}\n{token['analysis']}"
                for token in signals['bearish']
            ])
            
            current_time = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
            
            system_prompt = """You are KinKong, an AI-powered cryptocurrency trading bot specializing in Solana ecosystem tokens.
            Write an engaging market analysis focused on bullish opportunities while acknowledging key risks.
            
            Article structure:
            1. Market Overview (Brief)
               - Current sentiment
               - Key ecosystem trends
            
            2. Bullish Opportunities (Main Focus)
               - Strongest performing tokens
               - Notable volume increases
               - Positive technical setups
               - Emerging patterns
               - Key support levels
            
            3. Quick Risk Summary
               - Brief mention of key risks
               - Important resistance levels
            
            4. Action Items
               - Tokens to watch
               - Key levels to monitor
               - Volume thresholds
            
            Writing style:
            - Enthusiastic but professional tone
            - Focus on opportunities
            - Data-driven analysis
            - Use relevant emojis
            - Include specific examples
            - Keep risk section concise
            - Maintain KinKong's voice
            
            Remember: While maintaining objectivity, emphasize the constructive and bullish signals in the market."""

            user_prompt = f"""Time: {current_time}
            Market Sentiment: {sentiment}
            
            Strong Bullish Signals ({len(signals['bullish'])} tokens):
            {bullish_tokens if bullish_tokens else "None found"}
            
            Watch List ({len(signals['bearish'])} tokens):
            {bearish_tokens if bearish_tokens else "None found"}"""

            # Get Claude's analysis
            client = anthropic.Client(api_key=os.getenv('ANTHROPIC_API_KEY'))
            response = client.messages.create(
                model="claude-3-5-sonnet-20241022",
                max_tokens=4096,
                system=system_prompt,
                messages=[{"role": "user", "content": user_prompt}]
            )
            
            analysis = response.content[0].text.strip()
            
            # Add signature and call to action
            analysis += "\n\n🦍 KinKong AI Analysis"
            analysis += "\n📊 Real-time signals: @kinkong_ubc"
            analysis += "\n💡 Join our community: t.me/ubccommunity"
            
            return analysis
            
        except Exception as e:
            logger.error(f"Error generating overview with Claude: {e}")
            return ""

    def send_overview(self) -> bool:
        """Generate and send market overview"""
        try:
            # Get signals and sentiment
            signals = self.get_token_signals()
            sentiment = self.get_market_sentiment()
            
            # Generate overview
            analysis = self.generate_overview_with_claude(signals, sentiment)
            if not analysis:
                logger.error("Failed to generate overview")
                return False
            
            # Send to Telegram as single message
            from scripts.analyze_charts import send_telegram_message
            if not send_telegram_message(analysis):
                logger.error("Failed to send Telegram message")
                return False
            
            # Split into thread for Twitter
            from socials.post_signal import post_to_x
            
            # Split analysis into ~280 char chunks for threading
            chunks = []
            current_chunk = ""
            for line in analysis.split('\n'):
                if len(current_chunk) + len(line) + 1 <= 280:
                    current_chunk += line + '\n'
                else:
                    chunks.append(current_chunk.strip())
                    current_chunk = line + '\n'
            if current_chunk:
                chunks.append(current_chunk.strip())
            
            # Post thread
            previous_tweet_id = None
            for i, chunk in enumerate(chunks):
                # Add thread numbering
                numbered_chunk = f"({i+1}/{len(chunks)}) {chunk}"
                
                # Post as reply to previous tweet
                success = post_to_x(
                    numbered_chunk, 
                    {'type': 'MARKET_UPDATE', 'reply_to': previous_tweet_id}
                )
                
                if not success:
                    logger.error(f"Failed to post thread part {i+1}")
                    return False
                    
                # Get tweet ID for next reply
                previous_tweet_id = success
            
            logger.info("Successfully sent market overview")
            return True
            
        except Exception as e:
            logger.error(f"Error sending overview: {e}")
            return False

def main():
    try:
        # Load environment variables with explicit path
        project_root = Path(__file__).parent.parent.absolute()
        env_path = project_root / '.env'
        load_dotenv(dotenv_path=env_path)
        
        logger.info(f"Loading environment variables from: {env_path}")
        
        # Verify required environment variables
        required_vars = {
            'KINKONG_AIRTABLE_BASE_ID': os.getenv('KINKONG_AIRTABLE_BASE_ID'),
            'KINKONG_AIRTABLE_API_KEY': os.getenv('KINKONG_AIRTABLE_API_KEY'),
            'TELEGRAM_BOT_TOKEN': os.getenv('TELEGRAM_BOT_TOKEN'),
            'TELEGRAM_CHAT_ID': os.getenv('TELEGRAM_CHAT_ID'),
            'X_API_KEY': os.getenv('X_API_KEY'),
            'X_API_SECRET': os.getenv('X_API_SECRET'),
            'X_ACCESS_TOKEN': os.getenv('X_ACCESS_TOKEN'),
            'X_ACCESS_TOKEN_SECRET': os.getenv('X_ACCESS_TOKEN_SECRET'),
            'ANTHROPIC_API_KEY': os.getenv('ANTHROPIC_API_KEY')
        }
        
        # Check each variable and log status
        missing = []
        for var_name, var_value in required_vars.items():
            if not var_value:
                missing.append(var_name)
                logger.error(f"❌ {var_name} not found")
            else:
                logger.info(f"✅ {var_name} loaded")

        if missing:
            raise ValueError(f"Missing required environment variables: {', '.join(missing)}")

        # Generate and send overview
        logger.info("\n🚀 Initializing market overview generator...")
        generator = MarketOverviewGenerator()
        
        if generator.send_overview():
            logger.info("✅ Market overview sent successfully")
            sys.exit(0)
        else:
            logger.error("❌ Failed to send market overview")
            sys.exit(1)

    except Exception as e:
        logger.error(f"Fatal error: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()
