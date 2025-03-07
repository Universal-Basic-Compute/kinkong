import os
import sys
from pathlib import Path
import logging
from datetime import datetime, timezone
from typing import List, Dict, Optional
from dotenv import load_dotenv
from airtable import Airtable
import anthropic
import requests

def send_telegram_message(message: str) -> bool:
    """Send message to Telegram with improved error handling"""
    try:
        bot_token = os.getenv('TELEGRAM_BOT_TOKEN')
        chat_id = os.getenv('TELEGRAM_CHAT_ID')
        
        if not bot_token or not chat_id:
            logger.error("Missing Telegram credentials")
            return False
        
        # Check message length and split if necessary
        MAX_LENGTH = 4000  # Telegram has a limit of around 4096 characters
        
        # Log message length for debugging
        logger.info(f"Message length: {len(message)} characters")
        
        # Clean up HTML tags that might be causing issues
        # Replace problematic HTML with simpler formatting
        cleaned_message = message
        
        # Try sending without HTML parsing first
        url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
        data = {
            "chat_id": chat_id,
            "text": cleaned_message,
            "parse_mode": "HTML"
        }
        
        try:
            response = requests.post(url, data=data)
            response.raise_for_status()
            logger.info("Message sent successfully with HTML formatting")
            return True
        except requests.exceptions.HTTPError as e:
            logger.warning(f"Failed to send with HTML formatting: {e}")
            
            # If HTML parsing fails, try without parse_mode
            logger.info("Trying to send without HTML parsing")
            data = {
                "chat_id": chat_id,
                "text": message
            }
            
            response = requests.post(url, data=data)
            response.raise_for_status()
            logger.info("Message sent successfully without HTML formatting")
            return True
            
    except Exception as e:
        logger.error(f"Failed to send Telegram message: {e}")
        
        # Try sending a simplified message as a last resort
        try:
            simplified_message = "⚠️ Market overview generated but couldn't be sent in full. Check the dashboard for details."
            url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
            data = {
                "chat_id": chat_id,
                "text": simplified_message
            }
            requests.post(url, data=data)
            logger.info("Simplified error message sent")
        except:
            logger.error("Even simplified message failed to send")
            
        return False

def setup_logging():
    """Configure logging"""
    logger = logging.getLogger(__name__)
    
    # Remove any existing handlers to avoid duplicates
    if logger.hasHandlers():
        logger.handlers.clear()
    
    # Create console handler with formatting
    console_handler = logging.StreamHandler(sys.stdout)  # Explicitly use stdout
    formatter = logging.Formatter(
        '%(asctime)s - %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    console_handler.setFormatter(formatter)
    
    # Add handler to logger
    logger.addHandler(console_handler)
    logger.setLevel(logging.INFO)
    
    # Ensure propagation is enabled
    logger.propagate = True
    
    return logger

# Initialize logger at module level
logger = setup_logging()

class MarketOverviewGenerator:
    def __init__(self):
        load_dotenv()
        self.base_id = os.getenv('KINKONG_AIRTABLE_BASE_ID')
        self.api_key = os.getenv('KINKONG_AIRTABLE_API_KEY')
        self.tokens_table = Airtable(self.base_id, 'TOKENS', self.api_key)
        self.sentiment_table = Airtable(self.base_id, 'MARKET_SENTIMENT', self.api_key)

    def get_token_data(self) -> List[Dict]:
        """Get active tokens with their explanations and X accounts"""
        try:
            # Get only active tokens with explanations
            records = self.tokens_table.get_all(
                formula="AND(" +
                    "{isActive}=1, " +  # Must be active
                    "NOT({token}='UBC'), " +  # Exclude specific tokens
                    "NOT({token}='COMPUTE'), " +
                    "NOT({token}='USDT'), " +  # Exclude stablecoins
                    "NOT({token}='USDC')" +
                ")",
                fields=[
                    'token',
                    'explanation',  # Primary field for news/updates
                    'xAccount'      # X/Twitter account for mentions
                ]
            )
            
            # Filter out records without explanations
            valid_records = [
                record['fields'] for record in records 
                if record['fields'].get('explanation')
            ]
            
            logger.info(f"Found {len(valid_records)} active tokens with updates")
            return valid_records
            
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
            # Format token data with X accounts for single mention
            token_summaries = "\n\n".join([
                f"${token['token']} Updates:"
                f"\nX Account: {token.get('xAccount', 'N/A')}"
                f"\nNews & Analysis: {token.get('explanation', 'No recent updates')}"
                for token in tokens
            ])
            
            current_time = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
            
            system_prompt = f"""You are KinKong, an AI-powered cryptocurrency trading bot specializing in Solana ecosystem tokens.
            Write a comprehensive ecosystem update focusing on recent developments and news.

            When first mentioning a project, use their X handle (provided as 'X Account') once.

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
            - Emphasize fundamental developments over price action

            Formatting instructions:
            - Do not use bold text formatting
            - Do not use headers or titles
            - Use plain text with emojis for section breaks
            - Use simple paragraph structure
            - Avoid using HTML tags like <b> or <strong>
            - Separate sections with line breaks and emojis only"""

            user_prompt = "Generate a market overview based on the provided token metrics and market sentiment."

            # Get Claude's analysis
            client = anthropic.Client(api_key=os.getenv('ANTHROPIC_API_KEY'))
            response = client.messages.create(
                model="claude-3-7-sonnet-20250219",
                max_tokens=4096,
                system=system_prompt,
                messages=[{"role": "user", "content": user_prompt}]
            )
            
            analysis = response.content[0].text.strip()
            
            # Add signature and call to action
            analysis += "\n\n🦍 KinKong - Trader Agent"
            
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

            # Create THOUGHTS record first
            thoughts_table = Airtable(self.base_id, 'THOUGHTS', self.api_key)
            thought_record = {
                'type': 'MARKET_OVERVIEW',
                'content': analysis,
                'createdAt': datetime.now(timezone.utc).isoformat()
            }
            
            try:
                thoughts_table.insert(thought_record)
                logger.info("✅ Created THOUGHTS record")
            except Exception as e:
                logger.error(f"Failed to create THOUGHTS record: {e}")
                return False
            
            # Send to Telegram
            if not send_telegram_message(analysis):
                logger.error("Failed to send Telegram message")
                return False
            
            # Post to X as single long tweet
            try:
                import tweepy
                
                # Get OAuth credentials
                api_key = os.getenv('X_API_KEY')
                api_secret = os.getenv('X_API_SECRET')
                access_token = os.getenv('X_ACCESS_TOKEN')
                access_token_secret = os.getenv('X_ACCESS_TOKEN_SECRET')
                
                if not all([api_key, api_secret, access_token, access_token_secret]):
                    logger.error("Missing X API credentials")
                    return False
                
                # Initialize Tweepy client
                client = tweepy.Client(
                    consumer_key=api_key,
                    consumer_secret=api_secret,
                    access_token=access_token,
                    access_token_secret=access_token_secret
                )
                
                # Post single long tweet - no length limitation for X Premium+
                logger.info("Posting to X with Premium+ (no length limitation)")
                response = client.create_tweet(text=analysis)
                
                if response.data:
                    logger.info("Successfully posted market overview to X")
                else:
                    logger.error("Failed to post to X - no response data")
                    return False
                    
            except Exception as e:
                logger.error(f"Failed to post to X: {e}")
                return False
            
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
