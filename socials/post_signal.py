import os
import json
import requests
import anthropic
from datetime import datetime, timezone
from dotenv import load_dotenv
from typing import Dict, Optional

def setup_logging():
    import logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(levelname)s - %(message)s'
    )
    return logging.getLogger(__name__)

logger = setup_logging()

class AirtableAPI:
    def __init__(self, base_id: str, api_key: str):
        self.base_id = base_id
        self.api_key = api_key
        self.base_url = f"https://api.airtable.com/v0/{base_id}"
        self.headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }

    def get_latest_signal(self) -> Optional[Dict]:
        """Get latest HIGH confidence BUY signal"""
        try:
            url = f"{self.base_url}/SIGNALS"
            params = {
                "filterByFormula": "AND({type}='BUY', {confidence}='HIGH')",
                "sort[0][field]": "createdAt",
                "sort[0][direction]": "desc",
                "maxRecords": 1
            }
            
            response = requests.get(url, headers=self.headers, params=params)
            response.raise_for_status()
            
            records = response.json().get('records', [])
            if records:
                return records[0]
            return None
            
        except Exception as e:
            logger.error(f"Error fetching signal from Airtable: {str(e)}")
            return None

def post_to_x(text: str) -> bool:
    """Post to X using API v2"""
    try:
        import tweepy
        
        # Get OAuth 1.0a credentials
        api_key = os.getenv('X_API_KEY')
        api_secret = os.getenv('X_API_SECRET')
        access_token = os.getenv('X_ACCESS_TOKEN')
        access_token_secret = os.getenv('X_ACCESS_TOKEN_SECRET')
        
        if not all([api_key, api_secret, access_token, access_token_secret]):
            logger.error("Missing X API credentials. Required: X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_TOKEN_SECRET")
            return False
            
        # Initialize Tweepy with OAuth 1.0a
        auth = tweepy.OAuthHandler(api_key, api_secret)
        auth.set_access_token(access_token, access_token_secret)
        
        # Create API v2 client
        client = tweepy.Client(
            consumer_key=api_key,
            consumer_secret=api_secret,
            access_token=access_token,
            access_token_secret=access_token_secret
        )
        
        # Post tweet using v2 endpoint
        response = client.create_tweet(text=text)
        
        if response.data:
            logger.info(f"Successfully posted to X. Tweet ID: {response.data['id']}")
            return True
        else:
            logger.error("Failed to post to X - no response data")
            return False
            
    except Exception as e:
        logger.error(f"Error posting to X: {str(e)}")
        return False

SYSTEM_PROMPT = """You are a cryptocurrency trading expert managing the X account for KinKong.

Write a short, engaging tweet about a trading signal. The tweet should:
1. Be concise and professional
2. Include the token symbol
3. Mention key levels (entry, target)
4. Use relevant emojis
5. Include #Solana
6. Be under 280 characters

Format:
[Emoji] Signal Alert: $[TOKEN]
[Key Information]
[Levels]
#Solana"""

def generate_tweet_with_claude(signal_data: Dict) -> Optional[str]:
    """Generate tweet content using Claude"""
    try:
        # Get API key from environment
        api_key = os.getenv('ANTHROPIC_API_KEY')
        if not api_key:
            raise ValueError("ANTHROPIC_API_KEY not found")
            
        client = anthropic.Client(api_key=api_key)
        
        # Get token info
        airtable = AirtableAPI(os.getenv('KINKONG_AIRTABLE_BASE_ID'), os.getenv('KINKONG_AIRTABLE_API_KEY'))
        token_info = get_token_info(signal_data.get('fields', {}).get('token'), airtable)
        
        if not token_info:
            logger.error(f"Token info not found for {signal_data.get('fields', {}).get('token')}")
            return None
            
        # Get customized system prompt
        system_prompt = get_system_prompt(token_info)
        
        # Prepare signal info for Claude
        fields = signal_data.get('fields', {})
        user_prompt = f"""Create a tweet for this trading signal:

Token: {fields.get('token')}
Type: {fields.get('type')}
Entry Price: ${fields.get('entryPrice', 0):.4f}
Target Price: ${fields.get('targetPrice', 0):.4f}
Timeframe: {fields.get('timeframe')}
Expected Return: {fields.get('expectedReturn')}%"""

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
        
        # Extract and clean the tweet text
        tweet_text = message.content[0].text.strip()
        
        # Ensure tweet is within X's character limit
        if len(tweet_text) > 280:
            tweet_text = tweet_text[:277] + "..."
            
        return tweet_text
        
    except Exception as e:
        logger.error(f"Error generating tweet with Claude: {str(e)}")
        return None

def main():
    try:
        # Load environment variables
        load_dotenv()
        
        # Get environment variables
        base_id = os.getenv('KINKONG_AIRTABLE_BASE_ID')
        api_key = os.getenv('KINKONG_AIRTABLE_API_KEY')
        
        if not all([base_id, api_key]):
            raise ValueError("Missing required environment variables")
            
        # Initialize Airtable API client
        airtable = AirtableAPI(base_id, api_key)
        
        # Get latest signal
        logger.info("Fetching latest HIGH confidence BUY signal...")
        signal = airtable.get_latest_signal()
        
        if not signal:
            logger.info("No suitable signals found")
            return
            
        # Generate tweet content
        logger.info("Generating tweet content with Claude...")
        tweet_text = generate_tweet_with_claude(signal)
        
        if not tweet_text:
            logger.error("Failed to generate tweet content")
            return
            
        # Post to X
        logger.info("Posting to X...")
        if post_to_x(tweet_text):
            logger.info("Successfully posted signal to X")
            logger.info(f"Tweet content: {tweet_text}")
        else:
            logger.error("Failed to post to X")
        
    except Exception as e:
        logger.error(f"Script failed: {str(e)}")
        raise

if __name__ == "__main__":
    main()
