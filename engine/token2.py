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
        
        # Step 2: Search Birdeye API
        logger.info(f"Searching Birdeye for {symbol}")
        
        try:
            url = "https://public-api.birdeye.so/defi/v3/search"
            params = {"keyword": symbol, "chain": "solana"}
            headers = {
                "x-api-key": self.birdeye_api_key,
                "accept": "application/json"
            }
            
            response = requests.get(url, params=params, headers=headers, timeout=15)
            
            if not response.ok:
                logger.error(f"Birdeye API error: {response.status_code}")
                return None
            
            data = response.json()
            if not data.get('success'):
                logger.error(f"Birdeye API error: {data.get('message', 'Unknown error')}")
                return None
            
            # Extract token data
            items = data.get('data', {}).get('items', [])
            token_item = next((item for item in items if item['type'] == 'token'), None)
            
            if not token_item or not token_item.get('result'):
                logger.error(f"No token found matching '{symbol}'")
                return None
            
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
            
            logger.error("No token data found")
            return None
            
        except Exception as e:
            logger.error(f"Error searching Birdeye: {e}")
            logger.error(traceback.format_exc())
            return None
    
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
            
            # Determine if token should be active - DEFAULT TO FALSE
            is_active = False  # Changed from True to False
            if symbol in self.ALWAYS_ACTIVE_TOKENS:
                is_active = True
                logger.info(f"{symbol} is a special token - always active")
            elif symbol in self.ALWAYS_INACTIVE_TOKENS:
                is_active = False
                logger.info(f"{symbol} is a special token - always inactive")
            
            # Prepare record data
            airtable_record = {
                'token': symbol,
                'name': token_data.get('name', ''),
                'mint': token_data.get('address', ''),
                'isActive': is_active,  # Now defaults to False
                'updatedAt': current_time,
                'website': dex_data['social_links']['website'],
                'xAccount': dex_data['social_links']['xAccount'],
                'telegram': dex_data['social_links']['telegram'],
                'pair': dex_data['pair'],
                'image': dex_data['image'],
                # Removed price, volume24h, and liquidity fields
                'description': f"Token {symbol} on Solana chain"
            }
            
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
            'total': 0
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
            
            logger.info(f"Processed {results['total']} tokens: {results['success']} successful, {results['failure']} failed")
            return results
            
        except Exception as e:
            logger.error(f"Error processing tokens: {e}")
            logger.error(traceback.format_exc())
            return results

def main():
    """Main function to run the script"""
    try:
        # Initialize token manager
        token_manager = TokenManager()
        
        # Check command line arguments
        if len(sys.argv) > 1:
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
                from socials.bullish_posts_overview import MarketOverviewGenerator
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
