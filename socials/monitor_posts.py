import os
import sys
import yaml
import json
import requests
import logging
import platform
if platform.system() == 'Windows':
    import asyncio
    import socket
    from functools import partial
    
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    
    # Create proper async DNS resolver
    async def async_getaddrinfo(host, port, family=0, type=0, proto=0, flags=0):
        loop = asyncio.get_event_loop()
        return await loop.getaddrinfo(host, port)
    
    # Replace socket.getaddrinfo with async version
    def patched_getaddrinfo(*args, **kwargs):
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            return loop.run_until_complete(async_getaddrinfo(*args))
        finally:
            loop.close()
    
    socket.getaddrinfo = patched_getaddrinfo
try:
    import anthropic
    ANTHROPIC_AVAILABLE = True
except ImportError:
    ANTHROPIC_AVAILABLE = False
    print("Warning: anthropic module not available, some features will be disabled")
from time import sleep
from ratelimit import limits, sleep_and_retry
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

# Define rate limits (450 requests per 15-minute window for search)
CALLS_PER_WINDOW = 450
WINDOW_SECONDS = 15 * 60

@sleep_and_retry
@limits(calls=CALLS_PER_WINDOW, period=WINDOW_SECONDS)
@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=4, max=10))
def search_token_tweets(token: str, bearer_token: str) -> List[Dict]:
    """Search recent tweets mentioning a token"""
    try:
        headers = {
            "Authorization": f"Bearer {bearer_token}",
            "Content-Type": "application/json"
        }
        
        # Search endpoint
        search_url = "https://api.twitter.com/2/tweets/search/recent"
        
        # Search for just the token name
        query = f"{token} -is:retweet -is:reply lang:en"
        
        params = {
            "query": query,
            "max_results": 10,
            "tweet.fields": "created_at,public_metrics,text",
            "sort_order": "relevancy"
        }
        
        response = requests.get(search_url, headers=headers, params=params)
        response.raise_for_status()
        
        tweets = response.json().get('data', [])
        logger.info(f"Found {len(tweets)} tweets mentioning {token}")
        return tweets
        
    except requests.exceptions.RequestException as e:
        logger.error(f"Error searching tweets for token {token}: {str(e)}")
        if e.response is not None:
            logger.error(f"Response content: {e.response.content}")
        return []
    except Exception as e:
        logger.error(f"Unexpected error searching tweets for token {token}: {str(e)}")
        return []

@sleep_and_retry
@limits(calls=CALLS_PER_WINDOW, period=WINDOW_SECONDS)
@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=4, max=10))
def get_account_tweets(x_account: str, bearer_token: str) -> List[Dict]:
    """Get recent tweets from a specific X account"""
    try:
        headers = {
            "Authorization": f"Bearer {bearer_token}",
            "Content-Type": "application/json"
        }
        
        # Remove @ if present in account name
        x_account = x_account.lstrip('@')
        
        # First get the user ID
        user_url = f"https://api.twitter.com/2/users/by/username/{x_account}"
        user_response = requests.get(user_url, headers=headers)
        user_response.raise_for_status()
        
        user_id = user_response.json().get('data', {}).get('id')
        if not user_id:
            logger.error(f"Could not find user ID for account: {x_account}")
            return []
            
        # Then get their tweets
        tweets_url = f"https://api.twitter.com/2/users/{user_id}/tweets"
        params = {
            "max_results": 10,  # Get last 10 tweets
            "tweet.fields": "created_at,public_metrics,text",
            "exclude": "retweets,replies"
        }
        
        response = requests.get(tweets_url, headers=headers, params=params)
        response.raise_for_status()
        
        tweets = response.json().get('data', [])
        return tweets
        
    except requests.exceptions.RequestException as e:
        logger.error(f"Error fetching tweets for account {x_account}: {str(e)}")
        if e.response is not None:
            logger.error(f"Response content: {e.response.content}")
        return []
    except Exception as e:
        logger.error(f"Unexpected error fetching tweets for account {x_account}: {str(e)}")
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
        
        system_prompt = """You are KinKong, an AI-powered cryptocurrency trading bot and market sentiment analyst.
        You specialize in analyzing Solana ecosystem tokens with a focus on AI/ML projects.
        
        Analyze these tweets about a token and provide a detailed analysis followed by your verdict.
        
        Start directly with the analysis covering:
        1. Content summary - key themes and topics
        2. Engagement analysis - likes, retweets, discussions
        3. Notable signals:
           - Announcements or news
           - Community sentiment
           - Endorsements or partnerships
           - Technical analysis mentions
           - Volume and liquidity discussions
           - Development updates
           - Ecosystem growth indicators
        
        Then end your response with one of these verdicts:
        "VERDICT: BULLISH" - if there are clear, strong positive signals
        "VERDICT: NOT BULLISH" - if signals are weak, mixed, or negative
        
        Your analysis should be thorough and evidence-based, regardless of the final verdict.
        Do not include any introductory text - begin immediately with your analysis.
        
        Remember: You are KinKong - maintain a professional but engaging tone that reflects your identity as a sophisticated trading bot."""

        user_prompt = f"""As KinKong, analyze these tweets about ${token}:

        {tweets_text}

        Start directly with analysis and end with your VERDICT."""

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
        
        # Check if analysis ends with a verdict
        if "VERDICT: BULLISH" in analysis:
            return analysis  # Return full analysis for bullish verdict
        elif "VERDICT: NOT BULLISH" in analysis:
            return analysis  # Return full analysis even for not bullish
        else:
            logger.warning(f"Analysis missing verdict: {analysis[:50]}...")
            return None
        
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
        return False, None

def monitor_token(token: Optional[str] = None) -> tuple[bool, Optional[str]]:
    """Monitor posts for a specific token or all tokens if none specified
    Returns:
        tuple: (bullish_signals_found: bool, analysis_text: Optional[str])
    """
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
        
        # Get token data
        if token:
            # Get specific token
            tokens = airtable.get_active_tokens()
            tokens = [t for t in tokens if t.get('token') == token]
            if not tokens:
                logger.error(f"Token {token} not found or not active")
                return False, None
        else:
            # Get all active tokens
            tokens = airtable.get_active_tokens()
            
        logger.info(f"Found {len(tokens)} token(s) to process")
        
        bullish_found = False
        analysis_text = None
        # Process token(s)
        for token_data in tokens:
            try:
                token_symbol = token_data.get('token')
                x_account = token_data.get('xAccount')
                
                if not token_symbol:
                    logger.warning(f"Missing token symbol")
                    continue
                    
                logger.info(f"Processing ${token_symbol}")
                metrics.increment('tokens_processed')
                
                # Check if anthropic is available
                if not ANTHROPIC_AVAILABLE:
                    logger.info("Anthropic not available - skipping sentiment analysis")
                    return True, "Token added to monitoring (sentiment analysis disabled)"

                # Get tweets - either from account or search
                if x_account:
                    logger.info(f"Getting tweets from account: {x_account}")
                    tweets = get_account_tweets(x_account, os.getenv('X_BEARER_TOKEN'))
                else:
                    logger.info(f"No X account found, searching for ${token_symbol} mentions")
                    tweets = search_token_tweets(token_symbol, os.getenv('X_BEARER_TOKEN'))
                
                if not tweets:
                    logger.info(f"No tweets found for {token_symbol}")
                    continue
                    
                # Analyze sentiment
                analysis = analyze_sentiment_with_claude(token_symbol, tweets)
                if analysis:
                    is_bullish = "VERDICT: BULLISH" in analysis
                    analysis_text = analysis  # Store analysis regardless of verdict
                    
                    if is_bullish:
                        logger.info(f"Bullish signals detected for ${token_symbol}")
                        if send_telegram_notification(token_symbol, analysis):
                            logger.info(f"Notification sent for ${token_symbol}")
                            metrics.increment('notifications_sent')
                        else:
                            logger.error(f"Failed to send notification for ${token_symbol}")
                        bullish_found = True
                    else:
                        logger.info(f"No significant bullish signals for ${token_symbol}")
                else:
                    logger.info(f"No analysis generated for ${token_symbol}")
                    analysis_text = "No analysis could be generated"  # Default text for failed analysis
                
                # Add delay between tokens if processing multiple
                if len(tokens) > 1:
                    sleep(config['delay_between_tokens'])
                
            except Exception as e:
                logger.error(f"Error processing token {token_symbol}: {e}")
                metrics.increment('errors')
                analysis_text = f"Error during analysis: {str(e)}"  # Store error as analysis
                continue
                
        # Add summary
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
        
        return bullish_found, analysis_text
                
    except Exception as e:
        logger.error(f"Script failed: {e}")
        metrics.increment('errors')
        return False, f"Script failed: {str(e)}"  # Return error message as analysis

def main():
    try:
        # Check for token argument
        token = sys.argv[1] if len(sys.argv) > 1 else None
        
        if token:
            logger.info(f"Monitoring posts for token: {token}")
        else:
            logger.info("Monitoring posts for all active tokens")
            
        bullish, analysis = monitor_token(token)
        
        # Print results
        if bullish:
            print("\n✅ Bullish signals found!")
            print("\nAnalysis:")
            print(analysis)
        else:
            print("\n❌ No bullish signals found")
            
        sys.exit(0 if bullish else 1)

    except Exception as e:
        logger.error(f"Fatal error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
