import os
import json
import requests
from datetime import datetime, timezone
from airtable import Airtable
from dotenv import load_dotenv
from typing import Optional, Dict, Any

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
        
    def search_token(self, keyword: str) -> Optional[Dict[str, Any]]:
        """Search for a token using Birdeye API"""
        try:
            # First check if token exists in Airtable
            existing_records = self.airtable.get_all(
                formula=f"OR({{token}} = '{keyword.upper()}', {{symbol}} = '{keyword.upper()}')"
            )
            
            if existing_records:
                print(f"✅ Found existing token record for {keyword.upper()}")
                token_record = existing_records[0]['fields']
                return {
                    'symbol': token_record.get('token'),
                    'name': token_record.get('name'),
                    'address': token_record.get('mint'),
                    'verified': True  # Assume tokens in our database are verified
                }

            # If not found in Airtable, search Birdeye
            print(f"🔍 Searching Birdeye for {keyword.upper()}...")
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
            
            print(f"Raw API response:", json.dumps(data, indent=2))
            
            if not data.get('success'):
                raise Exception(f"API returned success=false: {data.get('message', 'No error message')}")
            
            # Find token results
            items = data.get('data', {}).get('items', [])
            token_item = next((item for item in items if item['type'] == 'token'), None)
            
            if not token_item or not token_item.get('result'):
                print(f"No tokens found for keyword: {keyword}")
                return None
                
            tokens = token_item['result']
            
            # Find verified token with matching symbol
            verified_token = next(
                (token for token in tokens 
                 if token.get('verified') and 
                 token.get('symbol', '').upper() == keyword.upper()),
                None
            )
            
            if verified_token:
                return verified_token
                
            # If no verified match, return first verified token
            verified_token = next(
                (token for token in tokens if token.get('verified')),
                None
            )
            
            if verified_token:
                return verified_token
                
            # If no verified tokens, return first token
            return tokens[0] if tokens else None
            
        except Exception as e:
            print(f"Error searching token: {str(e)}")
            return None

    def create_token_record(self, token_data: Dict[str, Any]) -> bool:
        """Create a token record in Airtable"""
        try:
            # Get current timestamp in ISO format
            created_at = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
            
            # Format data for Airtable
            airtable_record = {
                'tokenId': token_data.get('symbol', ''),  # Using symbol as tokenId
                'token': token_data.get('symbol', ''),
                'name': token_data.get('name', ''),
                'isActive': True,
                'mint': token_data.get('address', ''),
                'description': f"Token {token_data.get('symbol')} on Solana chain",  # Basic description
                'createdAt': created_at
            }
            
            # Check if token already exists
            existing_records = self.airtable.get_all(
                formula=f"{{mint}} = '{token_data.get('address')}'")
            
            if existing_records:
                print(f"Token {token_data.get('symbol')} already exists in Airtable")
                record_id = existing_records[0]['id']
                # Don't update createdAt for existing records
                del airtable_record['createdAt']
                self.airtable.update(record_id, airtable_record)
                print(f"Updated existing token record")
            else:
                self.airtable.insert(airtable_record)
                print(f"Created new token record")
            
            return True
            
        except Exception as e:
            print(f"Error creating token record: {str(e)}")
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
