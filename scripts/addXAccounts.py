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

    def update_token(self, token_id: str, social_data: Dict):
        """Update token record with social data"""
        try:
            url = f"{self.base_url}/TOKENS/{token_id}"
            data = {
                "fields": {
                    "xAccount": social_data.get('xAccount', ''),
                    "website": social_data.get('website', ''),
                    "telegram": social_data.get('telegram', '')
                }
            }
            
            response = requests.patch(url, headers=self.headers, json=data)
            response.raise_for_status()
            logger.info(f"Updated social data: {json.dumps(social_data, indent=2)}")
            
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
                
        # Get the first pair
        pair = data['pairs'][0]
            
        # Initialize social data
        social_data = {
            'xAccount': '',
            'website': '',
            'telegram': ''
        }
            
        # Extract info from new structure
        if 'info' in pair:
            # Get website
            if 'websites' in pair['info']:
                for website in pair['info']['websites']:
                    if website.get('label') == 'Website':
                        social_data['website'] = website.get('url', '')
                        break
                
            # Get socials
            if 'socials' in pair['info']:
                for social in pair['info']['socials']:
                    if social.get('type') == 'twitter':
                        # Extract handle from Twitter URL
                        twitter_url = social.get('url', '')
                        social_data['xAccount'] = twitter_url.split('/')[-1] if twitter_url else ''
                    elif social.get('type') == 'telegram':
                        social_data['telegram'] = social.get('url', '')
            
        # Log what we found
        logger.info(f"Social info found for {token_address}:")
        logger.info(json.dumps(social_data, indent=2))
            
        return social_data
        
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
            social_data = get_dexscreener_data(token['mint'])
            
            if social_data and social_data['xAccount']:
                # Update token with all social data
                airtable.update_token(token['id'], social_data)
                logger.info(f"Updated {token['token']} with X account: {social_data['xAccount']}")
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
