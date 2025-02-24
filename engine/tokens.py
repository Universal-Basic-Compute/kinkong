import os
import sys
import json
import codecs
import requests
from datetime import datetime, timezone
from pathlib import Path
from airtable import Airtable
from dotenv import load_dotenv
from typing import Optional, Dict, Any
import logging

# Configure UTF-8 encoding for stdout/stderr
if sys.stdout.encoding != 'utf-8':
    sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, 'strict')
    sys.stderr = codecs.getwriter('utf-8')(sys.stderr.buffer, 'strict')

# Add project root to Python path
project_root = Path(__file__).parent.parent.absolute()
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

from socials.monitor_posts import monitor_token

def setup_logging():
    """Configure logging"""
    logger = logging.getLogger(__name__)
    if not logger.handlers:
        handler = logging.StreamHandler()
        formatter = logging.Formatter(
            '%(asctime)s - %(levelname)s - %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        )
        handler.setFormatter(formatter)
        logger.addHandler(handler)
    logger.setLevel(logging.INFO)
    logger.propagate = False
    return logger

# Initialize logger
logger = logging.getLogger(__name__)

def log_message(message: str, level: str = 'info'):
    """Log message with emoji replacements"""
    # Replace emojis with text
    message = message.replace('🔍', '[SEARCH]')
    message = message.replace('✅', '[SUCCESS]') 
    message = message.replace('❌', '[ERROR]')
    message = message.replace('➕', '[ADD]')
    message = message.replace('🔄', '[UPDATE]')
    message = message.replace('📝', '[WRITE]')
    message = message.replace('🌐', '[WEB]')
    message = message.replace('💧', '[LIQUID]')
    message = message.replace('ℹ️', '[INFO]')
    message = message.replace('⚠️', '[WARN]')
    
    if level == 'error':
        logger.error(message)
    else:
        logger.info(message)

# Load environment variables
load_dotenv()

class TokenSearcher:
    def __init__(self):
        self.last_error = None  # For tracking the last error
        self.logger = setup_logging()  # Initialize logger
        self.airtable = Airtable(
            os.getenv('KINKONG_AIRTABLE_BASE_ID'),
            'TOKENS',
            os.getenv('KINKONG_AIRTABLE_API_KEY')
        )
        self.birdeye_api_key = os.getenv('BIRDEYE_API_KEY')
        self.logger = setup_logging()
        
    def search_token(self, keyword: str) -> Optional[Dict[str, Any]]:
        """Search for a token and create new record if it doesn't exist"""
        try:
            # First check if token exists in Airtable - only check 'token' field
            existing_records = self.airtable.get_all(
                formula=f"{{token}} = '{keyword.upper()}'"
            )
            
            if existing_records:
                log_message(f"[SUCCESS] Found existing token record for {keyword.upper()}")
                token_record = existing_records[0]['fields']
                return {
                    'symbol': token_record.get('token'),  # Use token as symbol
                    'name': token_record.get('name'),
                    'address': token_record.get('mint'),
                    'verified': True
                }

            # If not found, search Birdeye and create new record
            log_message(f"[SEARCH] Token not found. Searching Birdeye for {keyword.upper()}")
            url = "https://public-api.birdeye.so/defi/v3/search"
            
            params = {
                "keyword": keyword,
                "chain": "solana"
            }
            
            headers = {
                "x-api-key": self.birdeye_api_key,
                "accept": "application/json"
            }
            
            response = requests.get(url, params=params, headers=headers)
            response.raise_for_status()
            data = response.json()
            
            if not data.get('success'):
                self.last_error = f"Birdeye API error: {data.get('message', 'Unknown error')}"
                self.logger.error(self.last_error)
                return None
            
            # Find token results
            items = data.get('data', {}).get('items', [])
            token_item = next((item for item in items if item['type'] == 'token'), None)
            
            if not token_item or not token_item.get('result'):
                self.last_error = f"No token found matching '{keyword}'"
                self.logger.error(self.last_error)
                return None
                
            tokens = token_item['result']
            
            # Find verified token with matching symbol
            token_data = next(
                (token for token in tokens 
                 if token.get('verified') and 
                 token.get('symbol', '').upper() == keyword.upper()),
                None
            )
            
            # If no verified match with exact symbol, try first verified token
            if not token_data:
                token_data = next((token for token in tokens if token.get('verified')), None)
            
            # If still no match, use first token
            if not token_data:
                token_data = tokens[0] if tokens else None
                
            if token_data:
                print(f"✅ Found token on Birdeye, creating record...")
                if self.create_token_record(token_data):
                    print(f"✅ Created new token record for {keyword.upper()}")
                else:
                    print(f"❌ Failed to create token record")
                return token_data
                
            return None

        except Exception as e:
            print(f"❌ Error searching token: {str(e)}")
            return None

    def create_token_record(self, token_data: Dict[str, Any]) -> bool:
        """Create a token record in Airtable with social media and pair info from DexScreener"""
        try:
            # Special tokens that are always active
            ALWAYS_ACTIVE_TOKENS = {'USDT', 'WETH', 'WBTC', 'SOL'}
            # Tokens that are always inactive
            ALWAYS_INACTIVE_TOKENS = {'UBC', 'COMPUTE'}
            
            token_symbol = token_data.get('symbol')
            self.logger.info(f"\n🔍 Creating/updating token record for {token_symbol}")
            self.logger.info(f"Token data received: {json.dumps(token_data, indent=2)}")

            # Get current timestamp in ISO format
            created_at = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
            
            # Get DexScreener data for social links and pair info
            self.logger.info(f"\n🔍 Fetching DexScreener data for {token_data.get('address')}")
            url = f"https://api.dexscreener.com/latest/dex/tokens/{token_data.get('address')}"
            
            headers = {
                'User-Agent': 'Mozilla/5.0',
                'Accept': 'application/json'
            }
            
            # Log request details
            self.logger.info(f"\n🌐 DexScreener API Request:")
            self.logger.info(f"URL: {url}")
            self.logger.info(f"Headers: {json.dumps(headers, indent=2)}")
            
            # Time the request
            start_time = datetime.now()
            response = requests.get(url, headers=headers)
            request_time = (datetime.now() - start_time).total_seconds()
            self.logger.info(f"Request time: {request_time:.2f}s")
            self.logger.info(f"Response status: {response.status_code}")
            
            if response.ok:
                dex_data = response.json()
                self.logger.info("\n📊 DexScreener Raw Response:")
                self.logger.info(json.dumps(dex_data, indent=2))
                
                if dex_data.get('pairs'):
                    # Get Solana pairs and find most liquid
                    sol_pairs = [p for p in dex_data['pairs'] if p.get('chainId') == 'solana']
                    if sol_pairs:
                        self.logger.info(f"\n🔎 Found {len(sol_pairs)} Solana pairs")
                        
                        # Log liquidity for each pair
                        for pair in sol_pairs:
                            self.logger.info(
                                f"Pair {pair.get('pairAddress')}: "
                                f"${float(pair.get('liquidity', {}).get('usd', 0)):,.2f} liquidity, "
                                f"${float(pair.get('volume', {}).get('h24', 0)):,.2f} 24h volume"
                            )
                        
                        # Use most liquid pair for social info
                        main_pair = max(sol_pairs, key=lambda x: float(x.get('liquidity', {}).get('usd', 0) or 0))
                        self.logger.info("\n💧 Selected most liquid pair:")
                        self.logger.info(json.dumps(main_pair, indent=2))
                        
                        # Extract social links, pair, and image
                        social_links = {
                            'website': '',
                            'xAccount': '',
                            'telegram': ''
                        }

                        # Extract from info.websites array
                        if main_pair.get('info', {}).get('websites'):
                            for website in main_pair['info']['websites']:
                                if website.get('label') == 'Website':
                                    social_links['website'] = website.get('url', '')

                        # Extract from info.socials array
                        if main_pair.get('info', {}).get('socials'):
                            for social in main_pair['info']['socials']:
                                if social.get('type') == 'twitter':
                                    # Strip @ and get just the username from the URL
                                    x_url = social.get('url', '')
                                    x_account = x_url.split('/')[-1].lstrip('@')
                                    social_links['xAccount'] = x_account
                                elif social.get('type') == 'telegram':
                                    social_links['telegram'] = social.get('url', '')

                        # Get pair address and image URL
                        pair = main_pair.get('pairAddress', '')
                        image = main_pair.get('info', {}).get('imageUrl', '')

                        self.logger.info("\n🔗 Extracted social links:")
                        self.logger.info(json.dumps(social_links, indent=2))
                        self.logger.info("\n🔄 Pair: " + pair)
                        self.logger.info("\n🖼️ Image URL: " + image)
            else:
                self.logger.error(f"\n❌ DexScreener API error:")
                self.logger.error(f"Status code: {response.status_code}")
                self.logger.error(f"Response time: {request_time:.2f}s")
                self.logger.error(f"Response headers: {dict(response.headers)}")
                self.logger.error(f"Response text: {response.text}")
                    
                # Try to parse error response
                try:
                    error_data = response.json()
                    self.logger.error(f"Error details: {json.dumps(error_data, indent=2)}")
                except:
                    self.logger.error("Could not parse error response as JSON")
            
            # Format data for Airtable
            airtable_record = {
                'tokenId': token_symbol,
                'token': token_symbol,
                'name': token_data.get('name', ''),
                'isActive': True if token_symbol in ALWAYS_ACTIVE_TOKENS else (
                    False if token_symbol in ALWAYS_INACTIVE_TOKENS else token_data.get('isActive', True)
                ),
                'mint': token_data.get('address', ''),
                'description': f"Token {token_symbol} on Solana chain",
                'createdAt': created_at,
                # Add social media links
                'website': social_links.get('website', ''),
                'xAccount': social_links.get('xAccount', ''),
                'telegram': social_links.get('telegram', ''),
                # Add pair
                'pair': pair,
                'image': image
            }
            
            self.logger.info("\n📝 Airtable Record to Create/Update:")
            self.logger.info(json.dumps(airtable_record, indent=2))
            
            # Check if token already exists
            existing_records = self.airtable.get_all(
                formula=f"{{mint}} = '{token_data.get('address')}'")
            
            self.logger.info(f"\n🔍 Checking for existing records...")
            self.logger.info(f"Found {len(existing_records)} existing records")
            
            # Create/update token record
            if existing_records:
                self.logger.info(f"\n🔄 Updating existing token record for {token_symbol}")
                record_id = existing_records[0]['id']
                # Don't update createdAt for existing records
                del airtable_record['createdAt']
                self.airtable.update(record_id, airtable_record)
                self.logger.info("✅ Token record updated successfully")
            else:
                self.logger.info(f"\n➕ Creating new token record for {token_symbol}")
                record = self.airtable.insert(airtable_record)
                record_id = record['id']
                self.logger.info("✅ Token record created successfully")
                self.logger.info(f"New record ID: {record_id}")

            # Now check for bullish signals
            self.logger.info(f"\n🔍 Checking social signals for {token_data.get('symbol')}...")
            bullish, analysis = monitor_token(token_data.get('symbol'))

            # Update token record with results
            update_data = {
                'isActive': bullish,  # Set active based on bullish signals
                'explanation': analysis if analysis else "No significant bullish signals found"
            }

            self.airtable.update(record_id, update_data)
            self.logger.info(f"✅ Token record updated with signal analysis")
            self.logger.info(f"Active: {'✅' if bullish else '❌'}")
            if analysis:
                self.logger.info(f"Analysis: {analysis}")

            return True
            
        except Exception as e:
            self.logger.error(f"\n❌ Error creating token record: {str(e)}")
            if hasattr(e, '__traceback__'):
                import traceback
                self.logger.error("Traceback:")
                traceback.print_tb(e.__traceback__)
            return False

def main():
    try:
        # Initialize searcher
        searcher = TokenSearcher()
        
        # Define special tokens that are always active
        ALWAYS_ACTIVE_TOKENS = {'USDT', 'WETH', 'WBTC', 'SOL'}
        
        # Check if token keyword provided
        if len(sys.argv) > 1:
            # Process single token
            keyword = sys.argv[1]
            searcher.logger.info(f"[SEARCH] Searching for token: {keyword}")
            
            token_data = searcher.search_token(keyword)
            if token_data:
                searcher.logger.info(f"[SUCCESS] Found token: {token_data.get('symbol')}")
                
                # Force isActive true for special tokens
                if token_data.get('symbol') in ALWAYS_ACTIVE_TOKENS:
                    token_data['isActive'] = True
                    searcher.logger.info(f"[INFO] {token_data.get('symbol')} is a special token - always active")
                
                if searcher.create_token_record(token_data):
                    searcher.logger.info(f"[SUCCESS] Token record created/updated successfully")
                else:
                    searcher.logger.error(f"[ERROR] Failed to create/update token record")
            else:
                searcher.logger.error(f"[ERROR] Token not found or API request failed")
                # Add more details about the failure
                if hasattr(searcher, 'last_error'):
                    searcher.logger.error(f"[ERROR] Details: {searcher.last_error}")
        else:
            # Process all existing tokens
            print("🔄 Processing all existing tokens...")
            
            # Get all tokens from Airtable
            tokens = searcher.airtable.get_all()
            print(f"Found {len(tokens)} tokens to process")
            
            success_count = 0
            for token_record in tokens:
                try:
                    token_symbol = token_record['fields'].get('token')
                    token_data = {
                        'symbol': token_symbol,
                        'name': token_record['fields'].get('name'),
                        'address': token_record['fields'].get('mint'),
                        'verified': True
                    }
                    
                    print(f"\n🔍 Processing {token_data['symbol']}...")
                    
                    # Force isActive true for special tokens
                    if token_symbol in ALWAYS_ACTIVE_TOKENS:
                        token_data['isActive'] = True
                        print(f"ℹ️ {token_symbol} is a special token - always active")
                    
                    if searcher.create_token_record(token_data):
                        success_count += 1
                        print(f"✅ Token record updated successfully")
                    else:
                        print(f"❌ Failed to update token record")
                        
                except Exception as e:
                    print(f"❌ Error processing token: {str(e)}")
                    continue
            
            print(f"\n✅ Processed {success_count} out of {len(tokens)} tokens successfully")

            # Generate and post market overview after processing all tokens
            try:
                print("\n📊 Generating market overview...")
                from socials.bullish_posts_overview import MarketOverviewGenerator
                generator = MarketOverviewGenerator()
                if generator.send_overview():
                    print("✅ Market overview posted successfully")
                else:
                    print("❌ Failed to post market overview")
            except Exception as e:
                print(f"❌ Error generating market overview: {str(e)}")

    except Exception as e:
        searcher.logger.error(f"[ERROR] Script failed: {str(e)}")
        # Add traceback for more details
        import traceback
        searcher.logger.error("Traceback:")
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()
