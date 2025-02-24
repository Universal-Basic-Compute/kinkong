import os
import yaml
import requests
import logging
import anthropic
from time import sleep
from dotenv import load_dotenv
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional
from tenacity import retry, stop_after_attempt, wait_exponential

def setup_logging():
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(levelname)s - %(message)s'
    )
    return logging.getLogger(__name__)

logger = setup_logging()

class TweetCache:
    def __init__(self):
        self.cache = {}
        self.expiry = timedelta(hours=1)

    def get(self, tweet_id):
        if tweet_id in self.cache:
            timestamp, data = self.cache[tweet_id]
            if datetime.now() - timestamp < self.expiry:
                return data
        return None

    def set(self, tweet_id, data):
        self.cache[tweet_id] = (datetime.now(), data)

class MetricsTracker:
    def __init__(self):
        self.metrics = {
            'tokens_processed': 0,
            'tweets_analyzed': 0,
            'bullish_signals': 0,
            'notifications_sent': 0,
            'errors': 0
        }

    def increment(self, metric):
        self.metrics[metric] += 1

    def report(self):
        return self.metrics

tweet_cache = TweetCache()
metrics = MetricsTracker()

def load_config():
    try:
        with open('config.yaml', 'r') as f:
            return yaml.safe_load(f)
    except FileNotFoundError:
        return {
            'max_tweets_per_token': 20,
            'analysis_threshold': 0.7,
            'cache_expiry_hours': 1,
            'delay_between_tokens': 2,
            'max_retries': 3
        }

class AirtableAPI:
    def __init__(self, base_id: str, api_key: str):
        self.base_id = base_id
        self.api_key = api_key
        self.base_url = f"https://api.airtable.com/v0/{base_id}"
        self.headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }

    def get_active_tokens(self) -> List[Dict]:
        """Get all active tokens from TOKENS table"""
        try:
            url = f"{self.base_url}/TOKENS"
            params = {
                "filterByFormula": "{isActive}=1"
            }
            
            response = requests.get(url, headers=self.headers, params=params)
            response.raise_for_status()
            
            records = response.json().get('records', [])
            return [record.get('fields', {}) for record in records]
            
        except Exception as e:
            logger.error(f"Error fetching tokens from Airtable: {str(e)}")
            return []

@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=4, max=10))
def get_top_tweets(token: str, bearer_token: str) -> List[Dict]:
    """Get top tweets for a token using X API"""
    try:
        headers = {
            "Authorization": f"Bearer {bearer_token}",
            "Content-Type": "application/json"
        }
        
        # Search query for token mentions
        query = f"${token} -is:retweet lang:en"
        
        url = "https://api.x.com/2/tweets/search/recent"
        params = {
            "query": query,
            "max_results": 20,
            "tweet.fields": "created_at,public_metrics,text",
            "sort_order": "relevancy"
        }
        
        response = requests.get(url, headers=headers, params=params)
        response.raise_for_status()
        
        tweets = response.json().get('data', [])
        
        # Sort by engagement (likes + retweets)
        sorted_tweets = sorted(
            tweets,
            key=lambda x: (
                x.get('public_metrics', {}).get('like_count', 0) +
                x.get('public_metrics', {}).get('retweet_count', 0)
            ),
            reverse=True
        )
        
        return sorted_tweets[:5]  # Return top 5 most engaged tweets
        
    except Exception as e:
        logger.error(f"Error fetching tweets for {token}: {str(e)}")
        return []

def analyze_sentiment_with_claude(token: str, tweets: List[Dict]) -> Optional[str]:
    """Analyze tweet sentiment using Claude"""
    try:
        api_key = os.getenv('ANTHROPIC_API_KEY')
        if not api_key:
            raise ValueError("ANTHROPIC_API_KEY not found")
            
        client = anthropic.Client(api_key=api_key)
        
        # Format tweets for analysis
        tweets_text = "\n\n".join([
            f"Tweet {i+1}:\n{tweet['text']}\n"
            f"Likes: {tweet['public_metrics']['like_count']}\n"
            f"Retweets: {tweet['public_metrics']['retweet_count']}"
            for i, tweet in enumerate(tweets)
        ])
        
        system_prompt = """You are a cryptocurrency market sentiment analyst.
        Analyze these top tweets about a token and determine if there are any notably bullish signals.
        Focus on:
        1. Significant announcements or news
        2. Strong community sentiment
        3. Notable endorsements or partnerships
        4. Technical analysis consensus
        5. Volume and liquidity indicators
        6. Development activity
        7. Ecosystem growth
        
        Consider the engagement levels (likes/retweets) as a weight for each signal.
        Only return analysis if there are clear bullish signals with supporting evidence.
        If nothing significant, return None."""

        user_prompt = f"""Analyze these top tweets about ${token}:

        {tweets_text}

        Are there any noteworthy bullish signals? If yes, explain briefly. If no, respond with 'None'."""

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
        
        analysis = message.content[0].text.strip()
        return None if analysis.lower() == 'none' else analysis
        
    except Exception as e:
        logger.error(f"Error analyzing sentiment with Claude: {str(e)}")
        return None

def send_telegram_notification(token: str, analysis: str):
    """Send sentiment analysis to Telegram"""
    try:
        bot_token = os.getenv('TELEGRAM_BOT_TOKEN')
        chat_id = os.getenv('TELEGRAM_CHAT_ID')
        
        if not bot_token or not chat_id:
            logger.error("Missing Telegram credentials")
            return False
            
        message = (
            f"🔍 <b>Bullish Signals Detected for ${token}</b>\n\n"
            f"{analysis}\n\n"
            f"🤖 Analysis by Claude"
        )
        
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

def main():
    try:
        start_time = datetime.now()
        
        # Load environment variables and config
        load_dotenv()
        config = load_config()
        
        # Verify required environment variables
        required_vars = [
            'KINKONG_AIRTABLE_BASE_ID',
            'KINKONG_AIRTABLE_API_KEY',
            'X_BEARER_TOKEN',
            'TELEGRAM_BOT_TOKEN',
            'TELEGRAM_CHAT_ID',
            'ANTHROPIC_API_KEY'
        ]
        
        missing_vars = [var for var in required_vars if not os.getenv(var)]
        if missing_vars:
            raise ValueError(f"Missing required environment variables: {', '.join(missing_vars)}")
            
        # Initialize Airtable client
        airtable = AirtableAPI(
            os.getenv('KINKONG_AIRTABLE_BASE_ID'),
            os.getenv('KINKONG_AIRTABLE_API_KEY')
        )
        
        # Get active tokens
        tokens = airtable.get_active_tokens()
        logger.info(f"Found {len(tokens)} active tokens")
        
        # Process each token with delay
        for token_data in tokens:
            try:
                token = token_data.get('token')
                if not token:
                    continue
                    
                logger.info(f"Processing ${token}")
                metrics.increment('tokens_processed')
                
                # Get top tweets
                tweets = get_top_tweets(token, os.getenv('X_BEARER_TOKEN'))
                if not tweets:
                    logger.info(f"No tweets found for ${token}")
                    continue
                    
                # Analyze sentiment
                analysis = analyze_sentiment_with_claude(token, tweets)
                if analysis:
                    logger.info(f"Bullish signals detected for ${token}")
                    # Send notification
                    if send_telegram_notification(token, analysis):
                        logger.info(f"Notification sent for ${token}")
                    else:
                        logger.error(f"Failed to send notification for ${token}")
                else:
                    logger.info(f"No significant bullish signals for ${token}")
                
                # Add delay between tokens
                sleep(config['delay_between_tokens'])
                
            except Exception as e:
                logger.error(f"Error processing token {token}: {e}")
                metrics.increment('errors')
                continue
                
        # Add summary at end
        duration = datetime.now() - start_time
        logger.info(f"""
        Monitor Posts Summary:
        Duration: {duration}
        Tokens Processed: {metrics.metrics['tokens_processed']}
        Tweets Analyzed: {metrics.metrics['tweets_analyzed']}
        Bullish Signals: {metrics.metrics['bullish_signals']}
        Notifications Sent: {metrics.metrics['notifications_sent']}
        Errors: {metrics.metrics['errors']}
        """)
                
    except Exception as e:
        logger.error(f"Script failed: {e}")
        metrics.increment('errors')
        raise

if __name__ == "__main__":
    main()
