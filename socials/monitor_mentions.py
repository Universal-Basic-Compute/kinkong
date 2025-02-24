import os
import time
import tweepy
import requests
import logging
from dotenv import load_dotenv
from datetime import datetime, timezone

def setup_logging():
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(levelname)s - %(message)s'
    )
    return logging.getLogger(__name__)

logger = setup_logging()

def send_telegram_notification(mention):
    """Send mention notification to Telegram"""
    try:
        bot_token = os.getenv('TELEGRAM_BOT_TOKEN')
        chat_id = os.getenv('TELEGRAM_CHAT_ID')
        
        if not bot_token or not chat_id:
            logger.error("Missing Telegram credentials")
            return False
            
        # Format message
        mention_time = mention.created_at.strftime("%Y-%m-%d %H:%M:%S UTC")
        message = (
            f"🔔 <b>New Mention of @kinkong_ubc</b>\n\n"
            f"From: @{mention.user.screen_name}\n"
            f"Time: {mention_time}\n\n"
            f"{mention.full_text}\n\n"
            f"🔗 https://twitter.com/{mention.user.screen_name}/status/{mention.id}"
        )
        
        # Send to Telegram
        url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
        data = {
            "chat_id": chat_id,
            "text": message,
            "parse_mode": "HTML"
        }
        
        response = requests.post(url, data=data)
        response.raise_for_status()
        return True
        
    except Exception as e:
        logger.error(f"Failed to send Telegram notification: {e}")
        return False

def monitor_mentions():
    """Monitor mentions of @kinkong_ubc"""
    try:
        # Initialize X API client
        auth = tweepy.OAuthHandler(
            os.getenv('X_API_KEY'),
            os.getenv('X_API_SECRET')
        )
        auth.set_access_token(
            os.getenv('X_ACCESS_TOKEN'),
            os.getenv('X_ACCESS_TOKEN_SECRET')
        )
        
        api = tweepy.API(auth)
        client = tweepy.Client(
            consumer_key=os.getenv('X_API_KEY'),
            consumer_secret=os.getenv('X_API_SECRET'),
            access_token=os.getenv('X_ACCESS_TOKEN'),
            access_token_secret=os.getenv('X_ACCESS_TOKEN_SECRET')
        )
        
        # Track last processed mention
        last_mention_id = None
        
        while True:
            try:
                # Get mentions using v2 endpoint
                mentions = client.get_users_mentions(
                    id=client.get_me()[0].id,
                    since_id=last_mention_id,
                    tweet_fields=['created_at', 'text'],
                    expansions=['author_id'],
                    user_fields=['username']
                )
                
                if mentions.data:
                    for mention in mentions.data:
                        # Update last mention ID
                        if not last_mention_id or mention.id > last_mention_id:
                            last_mention_id = mention.id
                            
                        # Get full tweet object for better formatting
                        tweet = api.get_status(mention.id, tweet_mode='extended')
                        
                        # Send notification
                        if send_telegram_notification(tweet):
                            logger.info(f"Notification sent for mention from @{tweet.user.screen_name}")
                        else:
                            logger.error(f"Failed to send notification for mention from @{tweet.user.screen_name}")
                
                # Wait before next check
                time.sleep(60)  # Check every minute
                
            except tweepy.RateLimitError:
                logger.warning("Rate limit reached, waiting 15 minutes...")
                time.sleep(900)
                
            except Exception as e:
                logger.error(f"Error checking mentions: {e}")
                time.sleep(60)
                
    except Exception as e:
        logger.error(f"Monitor process failed: {e}")
        raise

def main():
    try:
        # Load environment variables
        load_dotenv()
        
        # Verify required environment variables
        required_vars = [
            'X_API_KEY',
            'X_API_SECRET', 
            'X_ACCESS_TOKEN',
            'X_ACCESS_TOKEN_SECRET',
            'TELEGRAM_BOT_TOKEN',
            'TELEGRAM_CHAT_ID'
        ]
        
        missing_vars = [var for var in required_vars if not os.getenv(var)]
        if missing_vars:
            raise ValueError(f"Missing required environment variables: {', '.join(missing_vars)}")
        
        logger.info("Starting mentions monitor...")
        monitor_mentions()
        
    except Exception as e:
        logger.error(f"Script failed: {e}")
        raise

if __name__ == "__main__":
    main()
