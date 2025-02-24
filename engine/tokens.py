import os
import sys
import json
import requests
from datetime import datetime, timezone
from pathlib import Path
from airtable import Airtable
from dotenv import load_dotenv
from typing import Optional, Dict, Any
import logging

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

# Load environment variables
load_dotenv()

class TokenSearcher:
    def __init__(self):
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
                print(f"✅ Found existing token record for {keyword.upper()}")
                token_record = existing_records[0]['fields']
                return {
                    'symbol': token_record.get('token'),  # Use token as symbol
                    'name': token_record.get('name'),
                    'address': token_record.get('mint'),
                    'verified': True
                }

            # If not found, search Birdeye and create new record
            print(f"🔍 Token not found. Searching Birdeye for {keyword.upper()}...")
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
                raise Exception(f"API returned success=false: {data.get('message', 'No error message')}")
            
            # Find token results
            items = data.get('data', {}).get('items', [])
            token_item = next((item for item in items if item['type'] == 'token'), None)
            
            if not token_item or not token_item.get('result'):
                print(f"❌ No tokens found for keyword: {keyword}")
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
            # Get current timestamp in ISO format
            created_at = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
            
            # Get DexScreener data for social links and pair info
            print(f"\n🔍 Fetching DexScreener data for {token_data.get('address')}")
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

                        print("\n🔗 Extracted social links:")
                        print(json.dumps(social_links, indent=2))
                        print("\n🔄 Pair:", pair)
                        print("\n🖼️ Image URL:", image)
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
                'tokenId': token_data.get('symbol', ''),
                'token': token_data.get('symbol', ''),
                'name': token_data.get('name', ''),
                'isActive': True,
                'mint': token_data.get('address', ''),
                'description': f"Token {token_data.get('symbol')} on Solana chain",
                'createdAt': created_at,
                # Add social media links
                'website': social_links.get('website', ''),
                'xAccount': social_links.get('xAccount', ''),
                'telegram': social_links.get('telegram', ''),
                # Add pair
                'pair': pair,
                'image': image
            }
            
            print("\n📝 Airtable Record to Create/Update:")
            print(json.dumps(airtable_record, indent=2))
            
            # Check if token already exists
            existing_records = self.airtable.get_all(
                formula=f"{{mint}} = '{token_data.get('address')}'")
            
            # Create/update token record first
            if existing_records:
                print(f"\n🔄 Updating existing token record for {token_data.get('symbol')}")
                record_id = existing_records[0]['id']
                # Don't update createdAt for existing records
                del airtable_record['createdAt']
                self.airtable.update(record_id, airtable_record)
                print("✅ Token record updated successfully")
            else:
                print(f"\n➕ Creating new token record for {token_data.get('symbol')}")
                record = self.airtable.insert(airtable_record)
                record_id = record['id']
                print("✅ Token record created successfully")

            # Now check for bullish signals
            print(f"\n🔍 Checking social signals for {token_data.get('symbol')}...")
            bullish, analysis = monitor_token(token_data.get('symbol'))

            # Update token record with results
            update_data = {
                'isActive': bullish,  # Set active based on bullish signals
                'explanation': analysis if analysis else "No significant bullish signals found"
            }

            self.airtable.update(record_id, update_data)
            print(f"✅ Token record updated with signal analysis")
            print(f"Active: {'✅' if bullish else '❌'}")
            if analysis:
                print(f"Analysis: {analysis}")

            return True
            
        except Exception as e:
            print(f"\n❌ Error creating token record: {str(e)}")
            if hasattr(e, '__traceback__'):
                import traceback
                print("Traceback:")
                traceback.print_tb(e.__traceback__)
            return False

def main():
    try:
        # Check command line arguments
        import sys
        if len(sys.argv) != 2:
            print("Usage: python tokens.py <token_keyword>")
            sys.exit(1)
            
        keyword = sys.argv[1]
        
        # Verify environment variables
        required_vars = [
            'KINKONG_AIRTABLE_BASE_ID',
            'KINKONG_AIRTABLE_API_KEY',
            'BIRDEYE_API_KEY'
        ]
        
        missing = [var for var in required_vars if not os.getenv(var)]
        if missing:
            raise Exception(f"Missing environment variables: {', '.join(missing)}")

        # Search and create token
        searcher = TokenSearcher()
        print(f"🔍 Searching for token: {keyword}")
        
        token_data = searcher.search_token(keyword)
        if token_data:
            print(f"✅ Found token: {token_data.get('symbol')}")
            if searcher.create_token_record(token_data):
                print(f"✅ Token record created/updated successfully")
            else:
                print(f"❌ Failed to create/update token record")
        else:
            print(f"❌ Token not found")

    except Exception as e:
        print(f"\n❌ Script failed: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()
