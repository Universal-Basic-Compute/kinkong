import os
import sys
import json
import requests
import logging
import traceback
from datetime import datetime, timezone
from pathlib import Path
from airtable import Airtable
from dotenv import load_dotenv
from typing import Optional, Dict, Any, List

# Add project root to Python path
project_root = Path(__file__).parent.parent.absolute()
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

def setup_logging():
    """Configure logging with consistent output"""
    # Configure the root logger
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S',
        stream=sys.stdout
    )
    
    # Get the module logger
    logger = logging.getLogger(__name__)
    logger.setLevel(logging.INFO)
    
    return logger

# Initialize logger
logger = setup_logging()

class TokenManager:
    """Manages token data in Airtable with Birdeye and DexScreener integration"""
    
    # Special token lists
    ALWAYS_ACTIVE_TOKENS = {'USDT', 'WETH', 'WBTC', 'SOL'}
    ALWAYS_INACTIVE_TOKENS = {'UBC', 'COMPUTE'}
    
    def analyze_social_signals(self, token_symbol: str, token_data: Dict[str, Any] = None) -> tuple[bool, str]:
        """
        Analyze social media signals for a token with proper timeout handling
        
        Args:
            token_symbol: Token symbol to analyze
            token_data: Optional token data containing xAccount
            
        Returns:
            Tuple of (is_bullish, analysis_text)
        """
        try:
            logger.info(f"Analyzing social signals for {token_symbol}")
            
            # Check if we have the required API keys
            anthropic_api_key = os.getenv('ANTHROPIC_API_KEY')
            x_bearer_token = os.getenv('X_BEARER_TOKEN')
            
            if not anthropic_api_key:
                logger.warning("ANTHROPIC_API_KEY not found, skipping sentiment analysis")
                return False, "Sentiment analysis skipped (missing API key)"
                
            if not x_bearer_token:
                logger.warning("X_BEARER_TOKEN not found, skipping X/Twitter analysis")
                return False, "X/Twitter analysis skipped (missing API key)"
            
            # Get X account from token data
            x_account = None
            if token_data and 'xAccount' in token_data:
                x_account = token_data.get('xAccount')
            
            # Get tweets - either from account or search for token mentions
            tweets = []
            if x_account:
                logger.info(f"Getting tweets from account @{x_account}")
                tweets = self.get_account_tweets(x_account, x_bearer_token)
                
                if not tweets:
                    logger.info(f"No tweets found for account @{x_account}, falling back to token search")
                    # Fall back to token search if no tweets from account
                    tweets = self.search_token_tweets(token_symbol, x_bearer_token)
            else:
                logger.info(f"No X account found for {token_symbol}, searching for token mentions")
                tweets = self.search_token_tweets(token_symbol, x_bearer_token)
            
            if not tweets:
                logger.info(f"No tweets found for {token_symbol}")
                return False, f"No recent tweets found for {token_symbol}"
            
            logger.info(f"Found {len(tweets)} tweets for analysis")
            
            # Analyze sentiment with Claude with timeout
            is_bullish, analysis = self.analyze_sentiment_with_claude(
                token_symbol, 
                tweets, 
                anthropic_api_key
            )
            
            if is_bullish:
                logger.info(f"Bullish signals detected for {token_symbol}")
            else:
                logger.info(f"No bullish signals detected for {token_symbol}")
                
            return is_bullish, analysis
                
        except Exception as e:
            logger.error(f"Error in analyze_social_signals: {e}")
            logger.error(traceback.format_exc())
            return False, f"Error analyzing social signals: {e}"
    
    def __init__(self):
        """Initialize the TokenManager with API credentials"""
        # Load environment variables
        load_dotenv()
        
        # Get API credentials
        self.airtable_base_id = os.getenv('KINKONG_AIRTABLE_BASE_ID')
        self.airtable_api_key = os.getenv('KINKONG_AIRTABLE_API_KEY')
        self.birdeye_api_key = os.getenv('BIRDEYE_API_KEY')
        
        # Validate credentials
        if not all([self.airtable_base_id, self.airtable_api_key, self.birdeye_api_key]):
            missing = []
            if not self.airtable_base_id: missing.append('KINKONG_AIRTABLE_BASE_ID')
            if not self.airtable_api_key: missing.append('KINKONG_AIRTABLE_API_KEY')
            if not self.birdeye_api_key: missing.append('BIRDEYE_API_KEY')
            logger.error(f"Missing required environment variables: {', '.join(missing)}")
            raise ValueError(f"Missing required environment variables: {', '.join(missing)}")
        
        # Initialize Airtable client
        self.tokens_table = Airtable(self.airtable_base_id, 'TOKENS', self.airtable_api_key)
        
        logger.info("TokenManager initialized successfully")
    
    def search_token(self, symbol: str) -> Optional[Dict[str, Any]]:
        """
        Search for a token by symbol
        
        Args:
            symbol: Token symbol to search for
            
        Returns:
            Dictionary with token data or None if not found
        """
        symbol = symbol.upper()
        logger.info(f"Searching for token: {symbol}")
        
        # Step 1: Check if token exists in Airtable
        try:
            existing_records = self.tokens_table.get_all(formula=f"{{token}} = '{symbol}'")
            
            if existing_records:
                logger.info(f"Found existing token record for {symbol}")
                token_record = existing_records[0]['fields']
                return {
                    'symbol': token_record.get('token'),
                    'name': token_record.get('name'),
                    'address': token_record.get('mint'),
                    'verified': True,
                    'record_id': existing_records[0]['id']
                }
        except Exception as e:
            logger.error(f"Error checking Airtable: {e}")
        
        # Step 2: Search Birdeye API with shorter timeout
        logger.info(f"Searching Birdeye for {symbol}")
        
        try:
            url = "https://public-api.birdeye.so/defi/v3/search"
            params = {"keyword": symbol, "chain": "solana"}
            headers = {
                "x-api-key": self.birdeye_api_key,
                "accept": "application/json"
            }
            
            # Use a shorter timeout for Birdeye (8 seconds instead of 15)
            response = requests.get(url, params=params, headers=headers, timeout=8)
            
            if not response.ok:
                logger.error(f"Birdeye API error: {response.status_code}")
                # Fall through to DexScreener fallback
            else:
                data = response.json()
                if data.get('success'):
                    # Extract token data
                    items = data.get('data', {}).get('items', [])
                    token_item = next((item for item in items if item['type'] == 'token'), None)
                    
                    if token_item and token_item.get('result'):
                        tokens = token_item['result'][:5]
                        logger.info(f"Found {len(tokens)} token results")
                        
                        # Find exact match first
                        token_data = next(
                            (token for token in tokens if token.get('symbol', '').upper() == symbol),
                            None
                        )
                        
                        # If no exact match, use first token
                        if not token_data and tokens:
                            token_data = tokens[0]
                        
                        if token_data:
                            logger.info(f"Selected token: {token_data.get('symbol')}")
                            return {
                                'symbol': token_data.get('symbol'),
                                'name': token_data.get('name'),
                                'address': token_data.get('address'),
                                'verified': token_data.get('verified', False)
                            }
        except requests.exceptions.Timeout:
            logger.warning(f"Birdeye API timed out, falling back to DexScreener")
        except Exception as e:
            logger.error(f"Error searching Birdeye: {e}")
            logger.error(traceback.format_exc())
        
        # Step 3: Fallback to DexScreener API
        logger.info(f"Falling back to DexScreener for {symbol}")
        try:
            # DexScreener search endpoint
            url = f"https://api.dexscreener.com/latest/dex/search?q={symbol}"
            headers = {
                'User-Agent': 'Mozilla/5.0',
                'Accept': 'application/json'
            }
            
            response = requests.get(url, headers=headers, timeout=10)
            
            if response.ok:
                data = response.json()
                pairs = data.get('pairs', [])
                
                # Filter for Solana pairs
                sol_pairs = [p for p in pairs if p.get('chainId') == 'solana']
                
                if sol_pairs:
                    # Get the most liquid pair
                    best_pair = max(sol_pairs, key=lambda x: float(x.get('liquidity', {}).get('usd', 0) or 0))
                    
                    # Extract token data
                    base_token = best_pair.get('baseToken', {})
                    
                    if base_token and base_token.get('symbol', '').upper() == symbol:
                        logger.info(f"Found token on DexScreener: {base_token.get('symbol')}")
                        return {
                            'symbol': base_token.get('symbol'),
                            'name': base_token.get('name', base_token.get('symbol')),
                            'address': base_token.get('address'),
                            'verified': True  # Assume verified if on DexScreener
                        }
                    
                    # Check quote token as fallback
                    quote_token = best_pair.get('quoteToken', {})
                    if quote_token and quote_token.get('symbol', '').upper() == symbol:
                        logger.info(f"Found token on DexScreener: {quote_token.get('symbol')}")
                        return {
                            'symbol': quote_token.get('symbol'),
                            'name': quote_token.get('name', quote_token.get('symbol')),
                            'address': quote_token.get('address'),
                            'verified': True
                        }
            
            logger.error(f"Token {symbol} not found on DexScreener")
            return None
            
        except Exception as e:
            logger.error(f"Error searching DexScreener: {e}")
            logger.error(traceback.format_exc())
            return None
    
    def analyze_sentiment_with_claude(self, token_symbol: str, tweets: List[Dict], api_key: str) -> tuple[bool, str]:
        """
        Analyze tweet sentiment using Claude
        
        Args:
            token_symbol: Token symbol to analyze
            tweets: List of tweet data dictionaries
            api_key: Anthropic API key
            
        Returns:
            Tuple of (is_bullish, analysis_text)
        """
        try:
            import anthropic
            
            client = anthropic.Client(api_key=api_key)
            
            # Format tweets for analysis
            tweets_text = "\n\n".join([
                f"Tweet {i+1}:\n{tweet.get('text', '')}\n"
                f"Likes: {tweet.get('public_metrics', {}).get('like_count', 0)}\n"
                f"Retweets: {tweet.get('public_metrics', {}).get('retweet_count', 0)}"
                for i, tweet in enumerate(tweets[:5])  # Limit to 5 tweets
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

            user_prompt = f"""As KinKong, analyze these tweets about ${token_symbol}:

            {tweets_text}

            Start directly with analysis and end with your VERDICT."""

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
            
            analysis = message.content[0].text.strip()
            
            # Check if analysis ends with a verdict
            if "VERDICT: BULLISH" in analysis:
                return True, analysis
            else:
                return False, analysis
                
        except Exception as e:
            logger.error(f"Error analyzing sentiment with Claude: {str(e)}")
            return False, f"Error analyzing sentiment: {str(e)}"
    
    def search_token_tweets(self, token_symbol: str, bearer_token: str) -> List[Dict]:
        """
        Search for tweets mentioning a token
        
        Args:
            token_symbol: Token symbol to search for (without $ prefix)
            bearer_token: X/Twitter API bearer token
            
        Returns:
            List of tweet data dictionaries
        """
        try:
            logger.info(f"Searching for tweets mentioning {token_symbol}")
            
            headers = {
                "Authorization": f"Bearer {bearer_token}",
                "Content-Type": "application/json"
            }
            
            # Search endpoint
            search_url = "https://api.twitter.com/2/tweets/search/recent"
            
            # Search for token without $ prefix
            query = f"{token_symbol} -is:retweet -is:reply lang:en"
            
            params = {
                "query": query,
                "max_results": 10,
                "tweet.fields": "created_at,public_metrics,text",
                "sort_order": "relevancy"
            }
            
            # Use requests with timeout
            response = requests.get(search_url, headers=headers, params=params, timeout=15)
            
            if not response.ok:
                logger.error(f"X/Twitter API error: {response.status_code}")
                logger.error(f"Response: {response.text}")
                return []
            
            data = response.json()
            tweets = data.get('data', [])
            
            logger.info(f"Found {len(tweets)} tweets mentioning ${token_symbol}")
            return tweets
            
        except requests.exceptions.Timeout:
            logger.error(f"X/Twitter API request timed out")
            return []
        except Exception as e:
            logger.error(f"Error searching tweets for {token_symbol}: {e}")
            return []
    
    def get_account_tweets(self, x_account: str, bearer_token: str) -> List[Dict]:
        """
        Get recent tweets from a specific X account with timeout
        
        Args:
            x_account: X account username (without @)
            bearer_token: X/Twitter API bearer token
            
        Returns:
            List of tweet data dictionaries
        """
        try:
            # Remove @ if present in account name
            x_account = x_account.lstrip('@')
            
            logger.info(f"Getting tweets from account @{x_account}")
            
            headers = {
                "Authorization": f"Bearer {bearer_token}",
                "Content-Type": "application/json"
            }
            
            # First get the user ID
            user_url = f"https://api.twitter.com/2/users/by/username/{x_account}"
            
            # Use requests with timeout
            user_response = requests.get(user_url, headers=headers, timeout=15)
            
            if not user_response.ok:
                logger.error(f"X/Twitter API error: {user_response.status_code}")
                logger.error(f"Response: {user_response.text}")
                return []
            
            user_data = user_response.json()
            user_id = user_data.get('data', {}).get('id')
            
            if not user_id:
                logger.error(f"Could not find user ID for account: @{x_account}")
                return []
                
            # Then get their tweets
            tweets_url = f"https://api.twitter.com/2/users/{user_id}/tweets"
            params = {
                "max_results": 10,  # Get last 10 tweets
                "tweet.fields": "created_at,public_metrics,text",
                "exclude": "retweets,replies"
            }
            
            # Use requests with timeout
            response = requests.get(tweets_url, headers=headers, params=params, timeout=15)
            
            if not response.ok:
                logger.error(f"X/Twitter API error: {response.status_code}")
                logger.error(f"Response: {response.text}")
                return []
            
            data = response.json()
            tweets = data.get('data', [])
            
            logger.info(f"Found {len(tweets)} tweets from @{x_account}")
            return tweets
            
        except requests.exceptions.Timeout:
            logger.error(f"X/Twitter API request timed out")
            return []
        except Exception as e:
            logger.error(f"Error getting tweets for account @{x_account}: {e}")
            return []
    
    def get_dexscreener_data(self, token_address: str) -> Dict[str, Any]:
        """
        Get token data from DexScreener API
        
        Args:
            token_address: Token mint address
            
        Returns:
            Dictionary with social links and market data
        """
        logger.info(f"Fetching DexScreener data for {token_address}")
        
        result = {
            'social_links': {
                'website': '',
                'xAccount': '',
                'telegram': ''
            },
            'pair': '',
            'image': '',
            'price': 0,
            'volume24h': 0,
            'liquidity': 0
        }
        
        try:
            url = f"https://api.dexscreener.com/latest/dex/tokens/{token_address}"
            headers = {
                'User-Agent': 'Mozilla/5.0',
                'Accept': 'application/json'
            }
            
            response = requests.get(url, headers=headers, timeout=15)
            
            if not response.ok:
                logger.error(f"DexScreener API error: {response.status_code}")
                return result
            
            data = response.json()
            
            if not data.get('pairs'):
                logger.warning("No pairs found in DexScreener data")
                return result
            
            # Get Solana pairs and find most liquid
            sol_pairs = [p for p in data['pairs'] if p.get('chainId') == 'solana']
            
            if not sol_pairs:
                logger.warning("No Solana pairs found")
                return result
            
            # Use most liquid pair
            main_pair = max(sol_pairs, key=lambda x: float(x.get('liquidity', {}).get('usd', 0) or 0))
            
            # Extract social links
            if main_pair.get('info', {}).get('websites'):
                for website in main_pair['info']['websites']:
                    if website.get('label') == 'Website':
                        result['social_links']['website'] = website.get('url', '')
            
            if main_pair.get('info', {}).get('socials'):
                for social in main_pair['info']['socials']:
                    if social.get('type') == 'twitter':
                        x_url = social.get('url', '')
                        x_account = x_url.split('/')[-1].lstrip('@')
                        
                        # Clean up the X account username by removing URL parameters
                        if '?' in x_account:
                            x_account = x_account.split('?')[0]
                            logger.info(f"Cleaned X account username: {x_account}")
                        
                        result['social_links']['xAccount'] = x_account
                    elif social.get('type') == 'telegram':
                        result['social_links']['telegram'] = social.get('url', '')
            
            # Get pair address and image URL
            result['pair'] = main_pair.get('pairAddress', '')
            result['image'] = main_pair.get('info', {}).get('imageUrl', '')
            
            # Get market data
            result['price'] = float(main_pair.get('priceUsd', 0))
            result['volume24h'] = float(main_pair.get('volume', {}).get('h24', 0) or 0)
            result['liquidity'] = float(main_pair.get('liquidity', {}).get('usd', 0) or 0)
            
            logger.info(f"DexScreener data retrieved successfully")
            logger.info(f"Website: {result['social_links']['website']}")
            logger.info(f"X Account: {result['social_links']['xAccount']}")
            logger.info(f"Telegram: {result['social_links']['telegram']}")
            logger.info(f"Pair: {result['pair']}")
            logger.info(f"Image: {result['image']}")
            
            return result
            
        except Exception as e:
            logger.error(f"Error fetching DexScreener data: {e}")
            logger.error(traceback.format_exc())
            return result
    
    def create_or_update_token(self, token_data: Dict[str, Any]) -> Optional[str]:
        """
        Create or update a token record in Airtable
        
        Args:
            token_data: Token data from search_token
            
        Returns:
            Record ID of the created/updated token or None on failure
        """
        try:
            symbol = token_data.get('symbol')
            if not symbol:
                logger.error("No symbol provided in token data")
                return None
            
            symbol = symbol.upper()
            logger.info(f"Creating/updating token record for {symbol}")
            
            # Get current timestamp
            current_time = datetime.now(timezone.utc).isoformat()
            
            # Get additional data from DexScreener
            dex_data = self.get_dexscreener_data(token_data.get('address'))
            
            # Determine if token should be active based on social signals
            is_active = False  # Default to False
            explanation = ""

            # Special token handling
            if symbol in self.ALWAYS_ACTIVE_TOKENS:
                is_active = True
                explanation = f"{symbol} is a special token - always active"
                logger.info(f"{symbol} is a special token - always active")
            elif symbol in self.ALWAYS_INACTIVE_TOKENS:
                is_active = False
                explanation = f"{symbol} is a special token - always inactive"
                logger.info(f"{symbol} is a special token - always inactive")
            else:
                # Analyze social signals - pass token data with xAccount
                logger.info(f"Analyzing social signals for {symbol}")
                
                # Create token data with xAccount from DexScreener
                token_social_data = {
                    'xAccount': dex_data['social_links']['xAccount']
                }
                
                is_bullish, analysis = self.analyze_social_signals(symbol, token_social_data)
                is_active = is_bullish
                explanation = analysis
                
                if is_active:
                    logger.info(f"Setting {symbol} to active based on bullish signals")
                else:
                    logger.info(f"Setting {symbol} to inactive based on social analysis")
            
            # Prepare record data
            airtable_record = {
                'token': symbol,
                'name': token_data.get('name', ''),
                'mint': token_data.get('address', ''),
                'isActive': is_active,
                'updatedAt': current_time,
                'website': dex_data['social_links']['website'],
                'xAccount': dex_data['social_links']['xAccount'],
                'telegram': dex_data['social_links']['telegram'],
                'pair': dex_data['pair'],
                'image': dex_data['image'],
                'explanation': explanation,  # Add explanation field
                'description': f"Token {symbol} on Solana chain"
            }
            
            # Log the record we're about to save
            logger.info(f"Saving token record with the following data:")
            logger.info(f"Token: {symbol}")
            logger.info(f"Website: {dex_data['social_links']['website']}")
            logger.info(f"X Account: {dex_data['social_links']['xAccount']}")
            logger.info(f"Telegram: {dex_data['social_links']['telegram']}")
            logger.info(f"Pair: {dex_data['pair']}")
            logger.info(f"Image: {dex_data['image']}")
            
            # Check if record exists
            record_id = token_data.get('record_id')
            
            if record_id:
                # Update existing record
                logger.info(f"Updating existing token record for {symbol}")
                self.tokens_table.update(record_id, airtable_record)
                logger.info(f"Token record updated successfully")
                return record_id
            else:
                # Create new record
                logger.info(f"Creating new token record for {symbol}")
                airtable_record['createdAt'] = current_time
                record = self.tokens_table.insert(airtable_record)
                logger.info(f"Token record created successfully")
                return record['id']
                
        except Exception as e:
            logger.error(f"Error creating/updating token record: {e}")
            logger.error(traceback.format_exc())
            return None
    
    def get_all_tokens(self) -> List[Dict]:
        """Get all tokens from Airtable"""
        try:
            logger.info("Fetching all tokens from Airtable")
            records = self.tokens_table.get_all()
            logger.info(f"Found {len(records)} tokens")
            return records
        except Exception as e:
            logger.error(f"Error fetching tokens: {e}")
            return []
    
    def process_token(self, symbol: str) -> bool:
        """
        Process a single token by symbol
        
        Args:
            symbol: Token symbol to process
            
        Returns:
            True if successful, False otherwise
        """
        try:
            # Search for token
            token_data = self.search_token(symbol)
            
            if not token_data:
                logger.error(f"Token {symbol} not found")
                return False
            
            # Check if token has a record_id (exists in Airtable)
            record_id = token_data.get('record_id')
            if record_id:
                # Check when the token was last updated
                try:
                    # Get the token record to check updatedAt
                    token_record = self.tokens_table.get(record_id)
                    updated_at = token_record['fields'].get('updatedAt')
                    
                    if updated_at:
                        # Convert to datetime and check if older than 24 hours
                        from datetime import datetime, timezone, timedelta
                        updated_at_dt = datetime.fromisoformat(updated_at.replace('Z', '+00:00'))
                        age = datetime.now(timezone.utc) - updated_at_dt
                        
                        if age < timedelta(hours=72):
                            logger.info(f"Token {symbol} was updated less than 72 hours ago ({age.total_seconds()/3600:.1f} hours). Skipping.")
                            return True  # Return success without processing
                except Exception as e:
                    logger.warning(f"Error checking token update time: {e}. Will proceed with update.")
            
            # Create or update token record
            record_id = self.create_or_update_token(token_data)
            
            if not record_id:
                logger.error(f"Failed to create/update token record for {symbol}")
                return False
            
            logger.info(f"Token {symbol} processed successfully")
            return True
            
        except Exception as e:
            logger.error(f"Error processing token {symbol}: {e}")
            logger.error(traceback.format_exc())
            return False
    
    def process_all_tokens(self) -> Dict[str, int]:
        """
        Process all tokens in the database
        
        Returns:
            Dictionary with success and failure counts
        """
        results = {
            'success': 0,
            'failure': 0,
            'total': 0,
            'skipped': 0  # Add skipped counter
        }
        
        try:
            # Get all tokens
            tokens = self.get_all_tokens()
            results['total'] = len(tokens)
            
            logger.info(f"Processing {len(tokens)} tokens")
            
            for token_record in tokens:
                try:
                    symbol = token_record['fields'].get('token')
                    
                    if not symbol:
                        logger.warning(f"Token record {token_record['id']} has no symbol, skipping")
                        results['failure'] += 1
                        continue
                    
                    # Check when the token was last updated
                    updated_at = token_record['fields'].get('updatedAt')
                    if updated_at:
                        # Convert to datetime and check if older than 24 hours
                        from datetime import datetime, timezone, timedelta
                        updated_at_dt = datetime.fromisoformat(updated_at.replace('Z', '+00:00'))
                        age = datetime.now(timezone.utc) - updated_at_dt
                        
                        if age < timedelta(hours=72):
                            logger.info(f"Token {symbol} was updated less than 72 hours ago ({age.total_seconds()/3600:.1f} hours). Skipping.")
                            results['skipped'] += 1
                            continue
                    
                    logger.info(f"Processing token {symbol}")
                    
                    # Create token data from record
                    token_data = {
                        'symbol': symbol,
                        'name': token_record['fields'].get('name'),
                        'address': token_record['fields'].get('mint'),
                        'verified': True,
                        'record_id': token_record['id']
                    }
                    
                    # Update token record
                    record_id = self.create_or_update_token(token_data)
                    
                    if record_id:
                        logger.info(f"Token {symbol} updated successfully")
                        results['success'] += 1
                    else:
                        logger.error(f"Failed to update token {symbol}")
                        results['failure'] += 1
                        
                except Exception as e:
                    logger.error(f"Error processing token record: {e}")
                    results['failure'] += 1
            
            logger.info(f"Processed {results['total']} tokens: {results['success']} successful, {results['failure']} failed, {results['skipped']} skipped")
            return results
            
        except Exception as e:
            logger.error(f"Error processing tokens: {e}")
            logger.error(traceback.format_exc())
            return results
            
    def refresh_active_tokens(self) -> Dict[str, int]:
        """
        Refresh all active tokens in the database
        
        Returns:
            Dictionary with success and failure counts
        """
        results = {
            'success': 0,
            'failure': 0,
            'total': 0,
            'skipped': 0
        }
        
        try:
            # Get all active tokens
            logger.info("Fetching active tokens from Airtable")
            records = self.tokens_table.get_all(formula="{isActive}=1")
            results['total'] = len(records)
            
            logger.info(f"Found {len(records)} active tokens to refresh")
            
            for token_record in records:
                try:
                    symbol = token_record['fields'].get('token')
                    
                    if not symbol:
                        logger.warning(f"Token record {token_record['id']} has no symbol, skipping")
                        results['failure'] += 1
                        continue
                    
                    logger.info(f"Refreshing active token {symbol}")
                    
                    # Create token data from record
                    token_data = {
                        'symbol': symbol,
                        'name': token_record['fields'].get('name'),
                        'address': token_record['fields'].get('mint'),
                        'verified': True,
                        'record_id': token_record['id']
                    }
                    
                    # Update token record
                    record_id = self.create_or_update_token(token_data)
                    
                    if record_id:
                        logger.info(f"Token {symbol} refreshed successfully")
                        results['success'] += 1
                    else:
                        logger.error(f"Failed to refresh token {symbol}")
                        results['failure'] += 1
                        
                except Exception as e:
                    logger.error(f"Error refreshing token record: {e}")
                    results['failure'] += 1
            
            logger.info(f"Refreshed {results['total']} active tokens: {results['success']} successful, {results['failure']} failed")
            return results
            
        except Exception as e:
            logger.error(f"Error refreshing active tokens: {e}")
            logger.error(traceback.format_exc())
            return results

def main():
    """Main function to run the script"""
    try:
        # Initialize token manager
        token_manager = TokenManager()
        
        # Check command line arguments
        if len(sys.argv) > 1:
            # Check for refresh_active command
            if sys.argv[1].lower() == 'refresh_active':
                logger.info("Refreshing all active tokens")
                results = token_manager.refresh_active_tokens()
                
                logger.info(f"Refreshed {results['total']} active tokens:")
                logger.info(f"- {results['success']} successful")
                logger.info(f"- {results['failure']} failed")
            else:
                # Process single token
                symbol = sys.argv[1]
                logger.info(f"Processing token: {symbol}")
                
                if token_manager.process_token(symbol):
                    logger.info(f"Token {symbol} processed successfully")
                else:
                    logger.error(f"Failed to process token {symbol}")
                    sys.exit(1)
        else:
            # Process all tokens
            logger.info("Processing all tokens")
            results = token_manager.process_all_tokens()
            
            logger.info(f"Processed {results['total']} tokens:")
            logger.info(f"- {results['success']} successful")
            logger.info(f"- {results['failure']} failed")
            
            # Generate market overview (optional)
            try:
                logger.info("Generating market overview")
                from socials.market_overview_generation import MarketOverviewGenerator
                generator = MarketOverviewGenerator()
                if generator.send_overview():
                    logger.info("Market overview posted successfully")
                else:
                    logger.warning("Failed to post market overview")
            except Exception as e:
                logger.error(f"Error generating market overview: {e}")
        
        logger.info("Script completed successfully")
        
    except Exception as e:
        logger.error(f"Script failed: {e}")
        logger.error(traceback.format_exc())
        sys.exit(1)

if __name__ == "__main__":
    main()
