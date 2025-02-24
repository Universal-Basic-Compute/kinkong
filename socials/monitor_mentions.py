import os
import sys
import requests
import logging
import anthropic
from pathlib import Path
from dotenv import load_dotenv
from requests_oauthlib import OAuth1
from datetime import datetime, timezone, timedelta
import subprocess
from typing import Optional, List
from airtable import Airtable as AirtableAPI
from airtable import Airtable

def extract_tokens_from_text(text: str) -> List[str]:
    """Extract tokens mentioned with $ symbol from text"""
    import re
    # Match $TOKEN pattern, excluding common punctuation after the token
    pattern = r'\$([A-Za-z0-9]+)(?=[.,!?\s]|$)'
    matches = re.findall(pattern, text)
    return [token.upper() for token in matches]

def check_token_status(token: str, airtable_base_id: str, airtable_api_key: str) -> bool:
    """Check if token needs updating (doesn't exist or old data)"""
    try:
        # Initialize Airtable with proper parameters
        airtable = Airtable(
            base_id=airtable_base_id,
            table_name='TOKENS',  # Specify the table name
            api_key=airtable_api_key
        )
        
        # Get token record
        records = airtable.get_all(
            formula=f"{{token}}='{token}'",
            fields=['token', 'updatedAt']
        )
        
        if not records:
            logger.info(f"Token {token} not found in database")
            return True
            
        # Check updatedAt timestamp
        record = records[0]
        updated_at = record.get('fields', {}).get('updatedAt')
        if not updated_at:
            return True
            
        # Convert to datetime and check if older than 48 hours
        updated_at = datetime.fromisoformat(updated_at.replace('Z', '+00:00'))
        age = datetime.now(timezone.utc) - updated_at
        
        return age > timedelta(hours=48)
        
    except Exception as e:
        logger.error(f"Error checking token status: {e}")
        return True

async def update_token(token: str):
    """Update token data using engine/tokens.py"""
    try:
        import subprocess
        
        logger.info(f"Updating token data for {token}")
        
        # Construct path to engine/tokens.py
        tokens_script = Path(__file__).parent.parent / 'engine' / 'tokens.py'
        
        # Run the script with token as argument
        result = subprocess.run(
            [sys.executable, str(tokens_script), token],
            capture_output=True,
            text=True
        )
        
        if result.returncode == 0:
            logger.info(f"Successfully updated token {token}")
            return True
        else:
            logger.error(f"Failed to update token {token}: {result.stderr}")
            return False
            
    except Exception as e:
        logger.error(f"Error updating token {token}: {e}")
        return False

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
            
        # Format message using v2 API response format
        mention_time = datetime.fromisoformat(mention['created_at'].replace('Z', '+00:00'))
        mention_time_str = mention_time.strftime("%Y-%m-%d %H:%M:%S UTC")
        
        message = (
            f"🔔 <b>New Mention of @kinkong_ubc</b>\n\n"
            f"From: @{mention['user']['screen_name']}\n"
            f"Time: {mention_time_str}\n\n"
            f"{mention['text']}\n\n"
            f"🔗 https://twitter.com/{mention['user']['screen_name']}/status/{mention['id']}"
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


async def check_mentions():
    """Check mentions of @kinkong_ubc once"""
    try:
        # Get OAuth credentials
        api_key = os.getenv('X_API_KEY')
        api_secret = os.getenv('X_API_SECRET')
        access_token = os.getenv('X_ACCESS_TOKEN')
        access_secret = os.getenv('X_ACCESS_TOKEN_SECRET')
        
        # Verify credentials
        if not all([api_key, api_secret, access_token, access_secret]):
            logger.error("Missing X API credentials")
            return
            
        # Create OAuth1 auth object
        auth = OAuth1(
            api_key,
            api_secret,
            access_token,
            access_secret
        )
        
        # Get authenticated user ID using v2 endpoint
        me_url = "https://api.twitter.com/2/users/me"
        me_response = requests.get(me_url, auth=auth)
        
        if me_response.status_code == 403:
            logger.error("Authentication failed")
            return
        elif not me_response.ok:
            logger.error(f"API request failed: {me_response.status_code} - {me_response.text}")
            return
            
        user_id = me_response.json()['data']['id']
        
        # Get mentions using v2 endpoint with correct parameters
        mentions_url = f"https://api.twitter.com/2/users/{user_id}/mentions"
        
        # Get last mention ID
        last_mention_id = get_last_mention_id()
        logger.info(f"Last processed mention ID: {last_mention_id}")
        
        params = {
            "tweet.fields": "created_at,text",
            "expansions": "author_id",
            "user.fields": "username",
            "max_results": 10
        }
        
        # Add since_id if we have a last mention
        if last_mention_id:
            params["since_id"] = last_mention_id
            logger.info(f"Checking for mentions since ID: {last_mention_id}")
        else:
            logger.info("No last mention ID found, checking all recent mentions")
            
        logger.info(f"Fetching mentions for user ID: {user_id}")
        response = requests.get(mentions_url, auth=auth, params=params)
        
        if not response.ok:
            logger.error(f"Mentions request failed: {response.status_code}")
            logger.error(f"Response: {response.text}")
            response.raise_for_status()
        
        data = response.json()
        logger.info(f"API Response: {json.dumps(data, indent=2)}")
        
        if "data" in data:
            mentions_count = len(data["data"])
            logger.info(f"Found {mentions_count} new mentions")
            
            newest_id = None
            for mention in data["data"]:
                try:
                    # Track newest mention ID
                    if not newest_id or int(mention["id"]) > int(newest_id):
                        newest_id = mention["id"]
                    
                    logger.info(f"\nProcessing mention: {mention['text']}")
                    
                    # Extract tokens from mention text
                    tokens = extract_tokens_from_text(mention["text"])
                    if tokens:
                        logger.info(f"Found tokens in mention: {tokens}")
                        
                        # Get Airtable credentials
                        base_id = os.getenv('KINKONG_AIRTABLE_BASE_ID')
                        api_key = os.getenv('KINKONG_AIRTABLE_API_KEY')
                        
                        if not base_id or not api_key:
                            logger.error("Missing Airtable credentials")
                            continue
                        
                        # Check and update each token
                        for token in tokens:
                            if check_token_status(token, base_id, api_key):
                                logger.info(f"Token {token} needs updating")
                                await update_token(token)
                            else:
                                logger.info(f"Token {token} is up to date")
                    else:
                        logger.info("No tokens found in mention")
                except Exception as e:
                    logger.error(f"Error processing mention: {e}")
                    continue
            
            # Save newest mention ID if we found any mentions
            if newest_id:
                logger.info(f"Saving newest mention ID: {newest_id}")
                save_last_mention_id(newest_id)
        else:
            logger.info("No new mentions found")
                
    except Exception as e:
        logger.error(f"Check mentions failed: {e}")
        raise

async def main():
    try:
        # Load environment variables
        load_dotenv()
        
        # Verify required environment variables
        required_vars = [
            'X_API_KEY',
            'X_API_SECRET', 
            'X_ACCESS_TOKEN',
            'X_ACCESS_TOKEN_SECRET',
            # 'TELEGRAM_BOT_TOKEN',  # Commented out
            # 'TELEGRAM_CHAT_ID',    # Commented out
            # 'ANTHROPIC_API_KEY'    # Commented out
        ]
        
        missing_vars = [var for var in required_vars if not os.getenv(var)]
        if missing_vars:
            raise ValueError(f"Missing required environment variables: {', '.join(missing_vars)}")
        
        logger.info("Checking mentions...")
        await check_mentions()
        logger.info("Mentions check completed")
        
    except Exception as e:
        logger.error(f"Script failed: {e}")
        raise

if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
