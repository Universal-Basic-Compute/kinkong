import os
import tweepy
import requests
import logging
import anthropic
from dotenv import load_dotenv
from datetime import datetime, timezone
from typing import Optional

def setup_logging():
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(levelname)s - %(message)s'
    )
    return logging.getLogger(__name__)

logger = setup_logging()

def get_last_mention_id():
    """Read last processed mention ID from file"""
    try:
        with open('last_mention_id.txt', 'r') as f:
            return int(f.read().strip())
    except (FileNotFoundError, ValueError):
        return None

def save_last_mention_id(mention_id):
    """Save last processed mention ID to file"""
    with open('last_mention_id.txt', 'w') as f:
        f.write(str(mention_id))

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

def generate_reply_with_claude(mention_text: str, username: str) -> Optional[str]:
    """Generate reply content using Claude"""
    try:
        # Get API key from environment
        api_key = os.getenv('ANTHROPIC_API_KEY')
        if not api_key:
            raise ValueError("ANTHROPIC_API_KEY not found")
            
        client = anthropic.Client(api_key=api_key)
        
        system_prompt = """You are KinKong, a cryptocurrency trading bot on X (formerly Twitter).
        Generate friendly, professional replies to mentions.
        Keep responses concise (under 280 characters) and relevant to trading/crypto.
        Use emojis appropriately.
        Never give financial advice or specific trading recommendations.
        If users ask about specific trades or signals, direct them to follow @kinkong_ubc for updates."""

        user_prompt = f"""Reply to this mention from @{username}:

        {mention_text}"""

        message = client.messages.create(
            model="claude-3-5-sonnet-20241022",
            max_tokens=1000,
            system=system_prompt,
            messages=[
                {
                    "role": "user",
                    "content": user_prompt
                }
            ]
        )
        
        # Extract and clean the reply text
        reply_text = message.content[0].text.strip()
        
        # Ensure reply is within X's character limit
        if len(reply_text) > 280:
            reply_text = reply_text[:277] + "..."
            
        return reply_text
        
    except Exception as e:
        logger.error(f"Error generating reply with Claude: {str(e)}")
        return None

def reply_to_mention(api: tweepy.API, client: tweepy.Client, mention_id: int, username: str, text: str) -> bool:
    """Reply to a mention on X"""
    try:
        # Post reply
        response = client.create_tweet(
            text=text,
            in_reply_to_tweet_id=mention_id
        )
        
        if response.data:
            logger.info(f"Successfully replied to @{username}")
            return True
        else:
            logger.error("Failed to post reply - no response data")
            return False
            
    except Exception as e:
        logger.error(f"Error replying to mention: {str(e)}")
        return False

def check_mentions():
    """Check mentions of @kinkong_ubc once"""
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
        
        # Create API v1.1 instance for media upload
        api = tweepy.API(auth)
        
        # Create API v2 client
        client = tweepy.Client(
            consumer_key=os.getenv('X_API_KEY'),
            consumer_secret=os.getenv('X_API_SECRET'),
            access_token=os.getenv('X_ACCESS_TOKEN'),
            access_token_secret=os.getenv('X_ACCESS_TOKEN_SECRET')
        )
        
        # Get last processed mention ID
        last_mention_id = get_last_mention_id()
        
        # Get mentions using v2 endpoint
        mentions = client.get_users_mentions(
            id=client.get_me()[0].id,
            since_id=last_mention_id,
            tweet_fields=['created_at', 'text'],
            expansions=['author_id'],
            user_fields=['username']
        )
        
        if mentions.data:
            newest_id = None
            for mention in mentions.data:
                # Track newest mention ID
                if not newest_id or mention.id > newest_id:
                    newest_id = mention.id
                    
                # Get full tweet object for better formatting
                tweet = api.get_status(mention.id, tweet_mode='extended')
                
                # Send notification
                if send_telegram_notification(tweet):
                    logger.info(f"Notification sent for mention from @{tweet.user.screen_name}")
                else:
                    logger.error(f"Failed to send notification for mention from @{tweet.user.screen_name}")

                # Generate and post reply
                reply_text = generate_reply_with_claude(tweet.full_text, tweet.user.screen_name)
                if reply_text:
                    if reply_to_mention(api, client, mention.id, tweet.user.screen_name, reply_text):
                        logger.info(f"Reply posted: {reply_text}")
                    else:
                        logger.error("Failed to post reply")
                else:
                    logger.error("Failed to generate reply")
            
            # Save newest mention ID
            if newest_id:
                save_last_mention_id(newest_id)
                
    except Exception as e:
        logger.error(f"Check mentions failed: {e}")
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
            'TELEGRAM_CHAT_ID',
            'ANTHROPIC_API_KEY'
        ]
        
        missing_vars = [var for var in required_vars if not os.getenv(var)]
        if missing_vars:
            raise ValueError(f"Missing required environment variables: {', '.join(missing_vars)}")
        
        logger.info("Checking mentions...")
        check_mentions()
        logger.info("Mentions check completed")
        
    except Exception as e:
        logger.error(f"Script failed: {e}")
        raise

if __name__ == "__main__":
    main()
