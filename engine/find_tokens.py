#!/usr/bin/env python3
"""
Find Trending Tokens Script

This script fetches trending tokens from Birdeye API and adds them to the system
by calling engine\tokens.py for each token.

Usage:
    python engine\find_tokens.py [limit]
    
    limit: Optional. Number of trending tokens to process (default: 10, max: 20)
"""

import os
import sys
import json
import logging
import requests
import subprocess
import time
import traceback
from pathlib import Path
from typing import List, Dict, Any, Optional
from dotenv import load_dotenv

# Add project root to Python path
project_root = Path(__file__).parent.parent.absolute()
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

def setup_logging():
    """Configure logging with consistent output"""
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S',
        stream=sys.stdout
    )
    
    logger = logging.getLogger(__name__)
    logger.setLevel(logging.INFO)
    
    return logger

# Initialize logger
logger = setup_logging()

class TrendingTokenFinder:
    """Finds trending tokens from Birdeye API and adds them to the system"""
    
    def __init__(self):
        """Initialize the TrendingTokenFinder"""
        # Load environment variables
        load_dotenv()
        
        # Get API key from environment
        self.birdeye_api_key = os.getenv('BIRDEYE_API_KEY')
        if not self.birdeye_api_key:
            raise ValueError("BIRDEYE_API_KEY not found in environment variables")
        
        logger.info("TrendingTokenFinder initialized successfully")
    
    def get_trending_tokens(self, limit: int = 10) -> List[Dict[str, Any]]:
        """
        Get trending tokens from Birdeye API
        
        Args:
            limit: Number of tokens to retrieve (max 20)
            
        Returns:
            List of trending token data
        """
        try:
            # Ensure limit is within valid range
            if limit < 1:
                limit = 1
            elif limit > 20:
                limit = 20
                
            logger.info(f"Fetching top {limit} trending tokens from Birdeye")
            
            # Prepare request
            url = "https://public-api.birdeye.so/defi/token_trending"
            headers = {
                "x-api-key": self.birdeye_api_key,
                "accept": "application/json"
            }
            params = {
                "sort_by": "rank",
                "sort_type": "asc",
                "offset": 0,
                "limit": limit
            }
            
            # Log request details for debugging
            logger.info(f"API Key prefix: {self.birdeye_api_key[:5]}...")
            logger.info(f"Request URL: {url}")
            logger.info(f"Request params: {params}")
            
            # Make request with longer timeout
            response = requests.get(url, headers=headers, params=params, timeout=60)
            
            # Log response details
            logger.info(f"Response status code: {response.status_code}")
            
            # Check response
            if not response.ok:
                logger.error(f"Birdeye API error: {response.status_code}")
                logger.error(f"Response: {response.text}")
                return []
            
            # Parse response
            data = response.json()
            logger.info(f"Response data: {json.dumps(data)[:500]}...")  # Log first 500 chars
            
            # Validate response structure
            if not data.get('success'):
                logger.error(f"Birdeye API error: {data.get('message', 'Unknown error')}")
                return []
            
            # Check if data field exists
            if 'data' not in data:
                logger.error("Response missing 'data' field")
                logger.info(f"Full response: {json.dumps(data)}")
                return []
                
            # Check if tokens field exists (this is the actual field name in the response)
            if 'tokens' not in data.get('data', {}):
                logger.error("Response missing 'data.tokens' field")
                logger.info(f"Data field content: {json.dumps(data.get('data', {}))}")
                return []
            
            tokens = data.get('data', {}).get('tokens', [])
            
            if not tokens:
                logger.warning("No trending tokens found in response")
                return []
            
            logger.info(f"Found {len(tokens)} trending tokens")
            
            # Convert tokens to the format expected by process_token
            formatted_tokens = []
            for token in tokens:
                formatted_token = {
                    'symbol': token.get('symbol'),
                    'name': token.get('name'),
                    'address': token.get('address'),
                    'chain': 'solana',  # All tokens from this endpoint are Solana tokens
                    'verified': True    # Assume verified since they're trending
                }
                formatted_tokens.append(formatted_token)
            
            # Log first few tokens for debugging
            if formatted_tokens:
                logger.info("First few tokens:")
                for i, token in enumerate(formatted_tokens[:3]):
                    logger.info(f"Token {i+1}: {token.get('symbol')} - {token.get('name')}")
            
            return formatted_tokens
            
        except requests.exceptions.Timeout:
            logger.error("Request to Birdeye API timed out")
            return []
        except requests.exceptions.ConnectionError:
            logger.error("Connection error when connecting to Birdeye API")
            return []
        except json.JSONDecodeError:
            logger.error("Invalid JSON response from Birdeye API")
            logger.error(f"Raw response: {response.text if 'response' in locals() else 'No response'}")
            return []
        except Exception as e:
            logger.error(f"Error fetching trending tokens: {e}")
            logger.error(traceback.format_exc())
            return []
    
    def process_token(self, token_data: Dict[str, Any]) -> bool:
        """
        Process a single token by calling engine\tokens.py
        
        Args:
            token_data: Token data from Birdeye API
            
        Returns:
            True if successful, False otherwise
        """
        try:
            # Extract token symbol
            symbol = token_data.get('symbol')
            if not symbol:
                logger.error("No symbol found in token data")
                return False
            
            logger.info(f"Processing token: {symbol}")
            
            # Build command to call engine\tokens.py
            tokens_script = Path(project_root) / "engine" / "tokens.py"
            
            # Add token address as an optional parameter if available
            cmd = [sys.executable, str(tokens_script), symbol]
            if token_data.get('address'):
                cmd.append('--address')
                cmd.append(token_data.get('address'))
            
            # Execute command
            logger.info(f"Executing: {' '.join(cmd)}")
            result = subprocess.run(cmd, capture_output=True, text=True)
            
            # Check result
            if result.returncode == 0:
                logger.info(f"Successfully processed token {symbol}")
                logger.info(result.stdout)
                return True
            else:
                logger.error(f"Failed to process token {symbol}")
                logger.error(f"Exit code: {result.returncode}")
                logger.error(f"Stdout: {result.stdout}")
                logger.error(f"Stderr: {result.stderr}")
                return False
                
        except Exception as e:
            logger.error(f"Error processing token {token_data.get('symbol', 'unknown')}: {e}")
            return False
    
    def find_and_process_tokens(self, limit: int = 10) -> Dict[str, int]:
        """
        Find trending tokens and process them
        
        Args:
            limit: Number of tokens to process
            
        Returns:
            Dictionary with success and failure counts
        """
        results = {
            'success': 0,
            'failure': 0,
            'total': 0
        }
        
        try:
            # Get trending tokens
            tokens = self.get_trending_tokens(limit)
            results['total'] = len(tokens)
            
            if not tokens:
                logger.warning("No tokens to process")
                return results
            
            logger.info(f"Processing {len(tokens)} trending tokens")
            
            # Process each token
            for i, token in enumerate(tokens, 1):
                try:
                    symbol = token.get('symbol', 'unknown')
                    logger.info(f"Processing token {i}/{len(tokens)}: {symbol}")
                    
                    # Add a small delay between requests to avoid rate limiting
                    if i > 1:
                        time.sleep(2)
                    
                    if self.process_token(token):
                        results['success'] += 1
                    else:
                        results['failure'] += 1
                        
                except Exception as e:
                    logger.error(f"Error processing token: {e}")
                    results['failure'] += 1
            
            logger.info(f"Processed {results['total']} tokens: {results['success']} successful, {results['failure']} failed")
            return results
            
        except Exception as e:
            logger.error(f"Error finding and processing tokens: {e}")
            return results

def main():
    """Main function to run the script"""
    try:
        # Parse command line arguments
        limit = 10  # Default limit
        if len(sys.argv) > 1:
            try:
                limit = int(sys.argv[1])
                logger.info(f"Using limit from command line: {limit}")
            except ValueError:
                logger.warning(f"Invalid limit: {sys.argv[1]}, using default: {limit}")
        
        # Initialize finder
        finder = TrendingTokenFinder()
        
        # Find and process tokens
        results = finder.find_and_process_tokens(limit)
        
        logger.info(f"Script completed successfully")
        logger.info(f"Processed {results['total']} tokens:")
        logger.info(f"- {results['success']} successful")
        logger.info(f"- {results['failure']} failed")
        
        # Exit with success code
        sys.exit(0)
        
    except Exception as e:
        logger.error(f"Script failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
