import os
import sys
import json
import requests
import aiohttp
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
    """Extract tokens that start with $ symbol"""
    import re
    
    # Liste des tokens à ignorer (stablecoins etc)
    IGNORE_TOKENS = {'$USD', '$USDT', '$USDC'}
    
    # Pattern uniquement pour les tokens avec $
    pattern = r'\$([A-Za-z0-9]+)(?=[.,!?\s]|$)'
    
    # Trouver tous les matches et filtrer
    matches = re.findall(pattern, text)
    tokens = set()
    
    for token in matches:
        token = token.upper()
        if (f"${token}" not in IGNORE_TOKENS and 
            len(token) >= 2 and  # Au moins 2 caractères après le $
            len(token) <= 10):   # Maximum 10 caractères
            tokens.add(token)
    
    if tokens:
        logger.info(f"Found tokens in text: {list(tokens)}")
    
    return list(tokens)

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
    """Update token data using TokenManager"""
    try:
        logger.info(f"Updating token data for {token}")
        
        # Add project root to Python path
        import sys
        from pathlib import Path
        
        # Get absolute path to project root
        project_root = Path(__file__).parent.parent.absolute()
        
        # Add project root to Python path if not already there
        if str(project_root) not in sys.path:
            sys.path.insert(0, str(project_root))
            logger.info(f"Added {project_root} to Python path")
        
        # Import TokenManager from engine.tokens
        from engine.tokens import TokenManager
        
        # Initialize token manager
        token_manager = TokenManager()
        
        # Process token
        success = token_manager.process_token(token)
        
        if success:
            logger.info(f"Successfully updated token {token}")
            return True
        else:
            logger.error(f"Failed to update token {token}")
            return False
            
    except Exception as e:
        logger.error(f"Error updating token {token}: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return False

def setup_logging():
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(levelname)s - %(message)s'
    )
    return logging.getLogger(__name__)

logger = setup_logging()

async def save_message(message_data: dict, context: str = 'X_MENTION'):
    """Save message to MESSAGES table"""
    try:
        airtable = Airtable(
            os.getenv('KINKONG_AIRTABLE_BASE_ID'),
            'MESSAGES',
            os.getenv('KINKONG_AIRTABLE_API_KEY')
        )
        
        # Extract tokens and convert to string
        tokens = extract_tokens_from_text(message_data['text'])
        tokens_string = json.dumps(tokens) if tokens else None
        
        # Format message record avec 'content' au lieu de 'text'
        record = {
            'messageId': message_data['id'],
            'content': message_data['text'],  # Changé de 'text' à 'content'
            'username': message_data.get('author_username', ''),
            'context': context,
            'role': 'user',
            'notes': tokens_string,
            'createdAt': message_data['created_at']
        }
        
        airtable.insert(record)
        logger.info(f"Saved message: {message_data['id']}")
        return True
        
    except Exception as e:
        logger.error(f"Error saving message: {e}")
        return False

async def process_tokens(tokens: list):
    """Process list of tokens"""
    try:
        base_id = os.getenv('KINKONG_AIRTABLE_BASE_ID')
        api_key = os.getenv('KINKONG_AIRTABLE_API_KEY')
        
        if not base_id or not api_key:
            logger.error("Missing Airtable credentials")
            return False
        
        for token in tokens:
            if check_token_status(token, base_id, api_key):
                logger.info(f"Token {token} needs updating")
                await update_token(token)
            else:
                logger.info(f"Token {token} is up to date")
        return True
        
    except Exception as e:
        logger.error(f"Error processing tokens: {e}")
        return False

async def get_last_mention_id() -> Optional[str]:
    """Get last processed mention ID from MESSAGES table"""
    try:
        airtable = Airtable(
            os.getenv('KINKONG_AIRTABLE_BASE_ID'),
            'MESSAGES',
            os.getenv('KINKONG_AIRTABLE_API_KEY')
        )
        
        # Get latest X_MENTION message
        records = airtable.get_all(
            formula="context='X_MENTION'",
            sort=[('createdAt', 'desc')],
            maxRecords=1
        )
        
        if records:
            return records[0]['fields'].get('messageId')
        return None
            
    except Exception as e:
        logger.error(f"Error getting last mention ID from Airtable: {e}")
        return None

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
            model="claude-3-7-sonnet-20250219",
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
        
        # Get last mention ID from Airtable
        last_mention_id = await get_last_mention_id()
        logger.info(f"Last processed mention ID: {last_mention_id}")
        
        params = {
            "tweet.fields": "created_at,text,conversation_id,referenced_tweets",
            "expansions": "author_id,referenced_tweets.id",
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
                        
                    # Get author info
                    author = next(
                        (u for u in data["includes"]["users"] if u["id"] == mention["author_id"]),
                        None
                    )
                        
                    # Format mention data
                    mention_data = {
                        'id': mention['id'],
                        'text': mention['text'],
                        'created_at': mention['created_at'],
                        'author_username': author['username'] if author else None
                    }

                    # Initialize conversation text array
                    conversation_texts = [mention['text']]  # Start with mention text

                    # Get conversation context
                    try:
                        # Get conversation ID
                        conversation_id = mention.get("conversation_id")
                        if conversation_id:
                            conversation_url = f"https://api.twitter.com/2/tweets/search/recent"
                            params = {
                                "query": f"conversation_id:{conversation_id}",
                                "tweet.fields": "created_at,text,referenced_tweets",
                                "expansions": "referenced_tweets.id",
                                "max_results": 100
                            }
                            
                            # Use synchronous requests instead of aiohttp
                            conv_response = requests.get(conversation_url, auth=auth, params=params)
                            if conv_response.status_code == 200:
                                conv_data = conv_response.json()
                                if "data" in conv_data:
                                    for tweet in conv_data["data"]:
                                        conversation_texts.append(tweet["text"])
                                        logger.debug(f"Added conversation tweet: {tweet['text'][:50]}...")

                        # Get any quoted or replied-to tweets
                        referenced_tweets = mention.get("referenced_tweets", [])
                        for ref in referenced_tweets:
                            ref_id = ref.get("id")
                            if ref_id:
                                ref_url = f"https://api.twitter.com/2/tweets/{ref_id}"
                                ref_response = requests.get(ref_url, auth=auth)
                                if ref_response.status_code == 200:
                                    ref_data = ref_response.json()
                                    if "data" in ref_data:
                                        conversation_texts.append(ref_data["data"]["text"])
                                        logger.debug(f"Added referenced tweet: {ref_data['data']['text'][:50]}...")

                    except Exception as e:
                        logger.error(f"Error getting conversation context: {e}")
                        # Continue with what we have even if context gathering fails

                    # Combine all conversation texts
                    combined_text = " ".join(conversation_texts)
                    mention_data['text'] = combined_text  # Update with full context

                    # Save mention with full context
                    await save_message(mention_data, 'X_MENTION')
                    
                    # Extract tokens from full context
                    tokens = extract_tokens_from_text(combined_text)
                    
                    if tokens:
                        logger.info(f"Found tokens in conversation: {tokens}")
                        await process_tokens(tokens)
                    else:
                        logger.info("No tokens found in conversation")
                except Exception as e:
                    logger.error(f"Error processing mention: {e}")
                    continue
            
            # Log newest mention ID if we found any mentions
            if newest_id:
                logger.info(f"Processed mentions up to ID: {newest_id}")
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
