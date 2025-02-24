import os
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


def check_mentions():
    """Check mentions of @kinkong_ubc once"""
    try:
        # Get bearer token
        bearer_token = os.getenv('X_BEARER_TOKEN')
        if not bearer_token:
            logger.error("Missing X_BEARER_TOKEN")
            return
            
        # API endpoint - updated to api.x.com
        url = "https://api.x.com/2/users/me/mentions"
        
        # Headers with bearer token
        headers = {
            "Authorization": f"Bearer {bearer_token}",
            "Content-Type": "application/json"
        }
        
        # Get last processed mention ID
        last_mention_id = get_last_mention_id()
        
        # Parameters for the request
        params = {
            "tweet.fields": "created_at,text",
            "expansions": "author_id",
            "user.fields": "username",
            "max_results": 100
        }
        
        # Add since_id if we have a last mention
        if last_mention_id:
            params["since_id"] = last_mention_id
            
        # Make the request
        response = requests.get(url, headers=headers, params=params)
        response.raise_for_status()
        
        data = response.json()
        
        if "data" in data:
            newest_id = None
            for mention in data["data"]:
                # Track newest mention ID
                if not newest_id or int(mention["id"]) > int(newest_id):
                    newest_id = mention["id"]
                    
                # Get author info from includes
                author = next(
                    (u for u in data["includes"]["users"] if u["id"] == mention["author_id"]),
                    None
                )
                
                if author:
                    # Send notification
                    notification_data = {
                        "id": mention["id"],
                        "created_at": mention["created_at"],
                        "text": mention["text"],
                        "user": {
                            "screen_name": author["username"]
                        }
                    }
                    
                    if send_telegram_notification(notification_data):
                        logger.info(f"Notification sent for mention from @{author['username']}")
                    else:
                        logger.error(f"Failed to send notification for mention from @{author['username']}")

                    # Generate and post reply
                    reply_text = generate_reply_with_claude(mention["text"], author["username"])
                    if reply_text:
                        # Post reply using v2 endpoint
                        reply_url = "https://api.x.com/2/tweets"
                        reply_data = {
                            "text": reply_text,
                            "reply": {
                                "in_reply_to_tweet_id": mention["id"]
                            }
                        }
                        
                        reply_response = requests.post(
                            reply_url,
                            headers=headers,
                            json=reply_data
                        )
                        
                        if reply_response.status_code == 201:
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
            'X_BEARER_TOKEN',
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
