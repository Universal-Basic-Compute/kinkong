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
                sort=[('-createdAt', 'desc')],
                maxRecords=1
            )
            if records:
                return records[0]['fields'].get('classification', 'NEUTRAL')
            return 'NEUTRAL'
        except Exception as e:
            logger.error(f"Error getting market sentiment: {e}")
            return 'NEUTRAL'

    def generate_overview_with_claude(self, signals: Dict[str, List[Dict]], sentiment: str) -> str:
        """Generate comprehensive market overview using Claude"""
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
            Write a comprehensive market analysis article that covers both bullish and bearish signals.
            
            Article structure:
            1. Market Overview
               - Current sentiment and key trends
               - Major market movements
               - Overall ecosystem health
            
            2. Bullish Signals
               - Notable token performances
               - Volume and liquidity analysis
               - Emerging opportunities
            
            3. Risk Analysis
               - Bearish indicators
               - Market concerns
               - Areas to monitor
            
            4. Technical Insights
               - Volume patterns
               - Price action analysis
               - Market structure
            
            5. Conclusion
               - Key takeaways
               - Market outlook
               - Important levels to watch
            
            Writing style:
            - Professional but engaging tone
            - Data-driven analysis
            - Clear reasoning for all points
            - Use relevant emojis for sections
            - Include specific examples from the data
            - Avoid price predictions
            - Maintain KinKong's analytical voice
            
            The article will be split into a thread, so structure it in clear sections."""

            user_prompt = f"""Time: {current_time}
            Market Sentiment: {sentiment}
            
            Bullish Signals ({len(signals['bullish'])} tokens):
            {bullish_tokens if bullish_tokens else "None found"}
            
            Bearish Signals ({len(signals['bearish'])} tokens):
            {bearish_tokens if bearish_tokens else "None found"}"""

            # Get Claude's analysis
            client = anthropic.Client(api_key=os.getenv('ANTHROPIC_API_KEY'))
            response = client.messages.create(
                model="claude-3-opus-20240229",
                max_tokens=2000,
                system=system_prompt,
                messages=[{"role": "user", "content": user_prompt}]
            )
            
            analysis = response.content[0].text.strip()
            
            # Add signature
            analysis += "\n\n🤖 Analysis by KinKong AI"
            analysis += "\nFollow @kinkong_ubc for real-time signals and analysis"
            
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
        # Verify environment variables
        required_vars = [
            'KINKONG_AIRTABLE_BASE_ID',
            'KINKONG_AIRTABLE_API_KEY',
            'TELEGRAM_BOT_TOKEN',
            'TELEGRAM_CHAT_ID',
            'X_API_KEY',
            'X_API_SECRET',
            'X_ACCESS_TOKEN',
            'X_ACCESS_TOKEN_SECRET',
            'ANTHROPIC_API_KEY'
        ]
        
        missing = [var for var in required_vars if not os.getenv(var)]
        if missing:
            raise ValueError(f"Missing environment variables: {', '.join(missing)}")

        # Generate and send overview
        generator = MarketOverviewGenerator()
        if generator.send_overview():
            logger.info("✅ Market overview sent successfully")
            sys.exit(0)
        else:
            logger.error("❌ Failed to send market overview")
            sys.exit(1)

    except Exception as e:
        logger.error(f"Fatal error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
