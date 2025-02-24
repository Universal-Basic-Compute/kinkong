import os
import requests
import json
from dotenv import load_dotenv
import time
from typing import Optional, Dict, List

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

    def get_active_tokens(self) -> List[Dict]:
        """Get all active tokens from Airtable"""
        try:
            url = f"{self.base_url}/TOKENS"
            params = {
                "filterByFormula": "{isActive}=1",
                "fields[]": ["mint", "token"]
            }
            
            response = requests.get(url, headers=self.headers, params=params)
            response.raise_for_status()
            
            records = response.json().get('records', [])
            return [
                {
                    'id': record['id'],
                    'mint': record.get('fields', {}).get('mint', ''),
                    'token': record.get('fields', {}).get('token', '')
                }
                for record in records
            ]
            
        except Exception as e:
            logger.error(f"Error fetching tokens from Airtable: {str(e)}")
            return []

    def update_token(self, token_id: str, x_account: str):
        """Update token record with X account"""
        try:
            url = f"{self.base_url}/TOKENS/{token_id}"
            data = {
                "fields": {
                    "xAccount": x_account
                }
            }
            
            response = requests.patch(url, headers=self.headers, json=data)
            response.raise_for_status()
            logger.info(f"Updated X account: {x_account}")
            
        except Exception as e:
            logger.error(f"Error updating token: {str(e)}")

def get_dexscreener_data(token_address: str) -> Optional[Dict]:
    """Fetch token data from Dexscreener API"""
    try:
        url = f"https://api.dexscreener.com/latest/dex/tokens/{token_address}"
        response = requests.get(url)
        response.raise_for_status()
        data = response.json()
        
        if not data.get('pairs'):
            logger.warning(f"No pairs found for token {token_address}")
            return None
            
        # Get the first pair which typically contains the social info
        pair = data['pairs'][0]
        
        return {
            'xAccount': pair.get('social', {}).get('twitter', '')
        }
        
    except Exception as e:
        logger.error(f"Error fetching Dexscreener data for {token_address}: {str(e)}")
        return None

def main():
    try:
        # Load environment variables
        load_dotenv()
        
        # Get environment variables
        base_id = os.getenv('KINKONG_AIRTABLE_BASE_ID')
        api_key = os.getenv('KINKONG_AIRTABLE_API_KEY')
        
        if not base_id or not api_key:
            raise ValueError("Missing Airtable configuration")
            
        # Initialize Airtable API client
        airtable = AirtableAPI(base_id, api_key)
        
        # Get active tokens
        logger.info("Fetching active tokens...")
        tokens = airtable.get_active_tokens()
        logger.info(f"Found {len(tokens)} active tokens")
        
        # Process each token
        for token in tokens:
            logger.info(f"Processing {token['token']}...")
            
            # Get Dexscreener data
            dex_data = get_dexscreener_data(token['mint'])
            
            if dex_data and dex_data['xAccount']:
                # Update token with X account
                airtable.update_token(token['id'], dex_data['xAccount'])
                logger.info(f"Updated {token['token']} with X account: {dex_data['xAccount']}")
            else:
                logger.warning(f"No X account found for {token['token']}")
            
            # Rate limiting
            time.sleep(1)  # Be nice to the API
            
        logger.info("Finished processing all tokens")
        
    except Exception as e:
        logger.error(f"Script failed: {str(e)}")
        raise

if __name__ == "__main__":
    main()
