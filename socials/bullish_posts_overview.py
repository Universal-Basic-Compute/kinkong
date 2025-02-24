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

    def generate_overview_with_claude(self, signals: Dict[str, List[Dict]], sentiment: str) -> tuple[str, str]:
        """Generate market overview using Claude"""
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
            Write a market overview based on the provided token analyses and market sentiment.
            
            Your response should include:
            1. Brief market sentiment summary
            2. Analysis of bullish signals found
            3. Analysis of bearish signals and risks
            4. Key themes or patterns observed
            
            Format:
            - Write in a professional but engaging tone
            - Use relevant emojis appropriately
            - Keep the analysis data-driven
            - Avoid specific price predictions
            - Include both opportunities and risks
            
            Provide two versions:
            1. TELEGRAM: Detailed analysis (up to 2000 characters)
            2. TWITTER: Key points only (up to 280 characters)
            
            Start with TELEGRAM: and then TWITTER: without any other text."""

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
            
            analysis = response.content[0].text
            
            # Split into Telegram and Twitter messages
            parts = analysis.split('TWITTER:')
            if len(parts) != 2:
                raise ValueError("Claude's response not in expected format")
            
            telegram_msg = parts[0].replace('TELEGRAM:', '').strip()
            tweet_msg = parts[1].strip()
            
            return telegram_msg, tweet_msg
            
        except Exception as e:
            logger.error(f"Error generating overview with Claude: {e}")
            return "", ""

    def send_overview(self) -> bool:
        """Generate and send market overview"""
        try:
            # Get signals and sentiment
            signals = self.get_token_signals()
            sentiment = self.get_market_sentiment()
            
            # Generate overview
            telegram_msg, tweet_msg = self.generate_overview_with_claude(signals, sentiment)
            if not telegram_msg or not tweet_msg:
                logger.error("Failed to generate overview")
                return False
            
            # Send to Telegram
            from scripts.analyze_charts import send_telegram_message
            if not send_telegram_message(telegram_msg):
                logger.error("Failed to send Telegram message")
                return False
            
            # Post to Twitter
            from socials.post_signal import post_to_x
            if not post_to_x(tweet_msg, {'type': 'MARKET_UPDATE'}):
                logger.error("Failed to post to Twitter")
                return False
            
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
