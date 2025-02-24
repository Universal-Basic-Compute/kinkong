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

    def get_token_data(self) -> List[Dict]:
        """Get important token metrics and explanations from TOKENS table"""
        try:
            # Get only truly active tokens with explanations
            records = self.tokens_table.get_all(
                formula="AND(" +
                    "{isActive}=1, " +  # Must be active
                    "NOT({token}='UBC'), " +  # Exclude specific tokens
                    "NOT({token}='COMPUTE'), " +
                    "NOT({token}='USDT'), " +  # Exclude stablecoins
                    "NOT({token}='USDC'), " +
                    "{volume24h}>0" +  # Must have recent volume
                ")",
                fields=[
                    'token',
                    'explanation',  # Primary field for news/updates
                    'price',
                    'priceChange24h',
                    'volume24h',
                    'volume7d',
                    'liquidity',
                    'holderCount',
                    'volumeGrowth',
                    'pricePerformance'
                ]
            )
            
            # Sort by volume to prioritize most active tokens
            sorted_records = sorted(
                [record['fields'] for record in records],
                key=lambda x: float(x.get('volume24h', 0)),
                reverse=True
            )
            
            logger.info(f"Found {len(sorted_records)} active tokens for market overview")
            return sorted_records
            
        except Exception as e:
            logger.error(f"Error getting token data: {e}")
            return []

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

    def generate_overview_with_claude(self, tokens: List[Dict], sentiment: str) -> str:
        """Generate market overview using Claude with token metrics and sentiment"""
        try:
            # Format token data emphasizing explanations
            token_summaries = "\n\n".join([
                f"${token['token']} Updates:"
                f"\nNews & Analysis: {token.get('explanation', 'No recent updates')}"
                f"\nMetrics:"
                f"\n- Price: ${token.get('price', 0):.4f} ({token.get('priceChange24h', 0):+.1f}%)"
                f"\n- Volume 24h: ${token.get('volume24h', 0):,.0f}"
                f"\n- Volume 7d: ${token.get('volume7d', 0):,.0f}"
                f"\n- Liquidity: ${token.get('liquidity', 0):,.0f}"
                f"\n- Holders: {token.get('holderCount', 0):,}"
                f"\n- Volume Growth: {token.get('volumeGrowth', 0):+.1f}%"
                f"\n- Price Performance: {token.get('pricePerformance', 0):+.1f}%"
                for token in tokens
            ])
            
            current_time = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
            
            system_prompt = f"""You are KinKong, an AI-powered cryptocurrency trading bot specializing in Solana ecosystem tokens.
            Write a comprehensive ecosystem update focusing on recent developments and news.

            Current Market Context:
            Time: {current_time}
            Market Sentiment: {sentiment}

            Token Updates and Metrics:
            {token_summaries}

            Article structure:
            1. Ecosystem Overview
               - Current sentiment
               - Major developments
               - Key project updates
            
            2. Notable Developments (Main Focus)
               - Project announcements
               - Partnership news
               - Development milestones
               - Community growth
               - Adoption metrics
            
            3. Market Impact
               - Volume trends
               - Liquidity changes
               - Holder growth
               - Brief technical context
            
            4. Forward Outlook
               - Upcoming developments
               - Projects to watch
               - Key events
            
            Writing style:
            - Focus on news and developments
            - Highlight ecosystem growth
            - Data-supported narrative
            - Use relevant emojis
            - Include specific project updates
            - Keep technical analysis minimal
            - Maintain KinKong's voice
            - Emphasize fundamental developments over price action"""

            user_prompt = "Generate a market overview based on the provided token metrics and market sentiment."

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
            # Get token data and sentiment
            tokens = self.get_token_data()
            sentiment = self.get_market_sentiment()
            
            # Generate overview
            analysis = self.generate_overview_with_claude(tokens, sentiment)
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
