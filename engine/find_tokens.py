#!/usr/bin/env python3
"""
Find Trending Tokens Script

This script fetches tokens from Birdeye API using various discovery strategies
and adds them to the system by calling engine\tokens.py for each token.

Usage:
    python engine\find_tokens.py [strategy] [limit]
    
    strategy: Optional. Discovery strategy to use (default: trending)
              Options: trending, volume_momentum, recent_listings, price_momentum,
                       liquidity_growth, high_activity
    limit: Optional. Number of tokens to process (default: 10, max: 50)
"""

import os
import sys
import json
import logging
import requests
import subprocess
import time
import traceback
import argparse
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
from dotenv import load_dotenv
from enum import Enum

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

class DiscoveryStrategy(Enum):
    """Enum for token discovery strategies"""
    ALL = "all"  # Add this new option
    TRENDING = "trending"
    VOLUME_MOMENTUM = "volume_momentum"
    RECENT_LISTINGS = "recent_listings"
    PRICE_MOMENTUM = "price_momentum"
    LIQUIDITY_GROWTH = "liquidity_growth"
    HIGH_ACTIVITY = "high_activity"
    
    @classmethod
    def from_string(cls, strategy_name: str) -> 'DiscoveryStrategy':
        """Convert string to DiscoveryStrategy enum"""
        try:
            return cls(strategy_name.lower())
        except ValueError:
            logger.warning(f"Invalid strategy: {strategy_name}. Using default (all).")
            return cls.ALL  # Change default to ALL

class TokenFinder:
    """Finds tokens from Birdeye API using various strategies and adds them to the system"""
    
    def __init__(self, strategy: DiscoveryStrategy = DiscoveryStrategy.TRENDING):
        """
        Initialize the TokenFinder
        
        Args:
            strategy: The discovery strategy to use
        """
        # Load environment variables
        load_dotenv()
        
        # Get API key from environment
        self.birdeye_api_key = os.getenv('BIRDEYE_API_KEY')
        if not self.birdeye_api_key:
            raise ValueError("BIRDEYE_API_KEY not found in environment variables")
        
        self.strategy = strategy
        logger.info(f"TokenFinder initialized with strategy: {strategy.value}")
    
    def get_strategy_params(self) -> Tuple[str, Dict[str, Any]]:
        """
        Get API endpoint and parameters for the current strategy
        
        Returns:
            Tuple containing (endpoint_url, request_params)
        """
        # Base API v3 endpoint for token listing
        base_url = "https://public-api.birdeye.so/defi/v3/token/list"
        
        # Strategy-specific parameters
        if self.strategy == DiscoveryStrategy.TRENDING:
            # Legacy trending endpoint
            return "https://public-api.birdeye.so/defi/token_trending", {
                "sort_by": "rank",
                "sort_type": "asc",
                "offset": 0
            }
        
        elif self.strategy == DiscoveryStrategy.VOLUME_MOMENTUM:
            return base_url, {
                "sort_by": "volume_24h_change_percent",
                "sort_type": "desc",
                "min_liquidity": 100000,
                "min_volume_24h_usd": 50000,
                "min_holder": 500
            }
            
        elif self.strategy == DiscoveryStrategy.RECENT_LISTINGS:
            return base_url, {
                "sort_by": "recent_listing_time",
                "sort_type": "desc",
                "min_liquidity": 200000,
                "min_trade_24h_count": 500,
                "min_holder": 300
            }
            
        elif self.strategy == DiscoveryStrategy.PRICE_MOMENTUM:
            return base_url, {
                "sort_by": "price_change_24h_percent",
                "sort_type": "desc",
                "min_volume_24h_usd": 100000,
                "min_volume_24h_change_percent": 20,
                "min_liquidity": 300000,
                "min_trade_24h_count": 700
            }
            
        elif self.strategy == DiscoveryStrategy.LIQUIDITY_GROWTH:
            return base_url, {
                "sort_by": "liquidity",
                "sort_type": "desc",
                "min_market_cap": 1000000,
                "max_market_cap": 100000000,
                "min_holder": 1000,
                "min_volume_24h_usd": 200000
            }
            
        elif self.strategy == DiscoveryStrategy.HIGH_ACTIVITY:
            return base_url, {
                "sort_by": "trade_24h_count",
                "sort_type": "desc",
                "min_liquidity": 150000,
                "min_volume_24h_usd": 75000,
                "min_holder": 400
            }
        
        # Default to trending if strategy not recognized
        return "https://public-api.birdeye.so/defi/token_trending", {
            "sort_by": "rank",
            "sort_type": "asc",
            "offset": 0
        }

    def get_tokens(self, limit: int = 10) -> List[Dict[str, Any]]:
        """
        Get tokens from Birdeye API using the current strategy
        
        Args:
            limit: Number of tokens to retrieve (max 50)
            
        Returns:
            List of token data
        """
        try:
            # Ensure limit is within valid range
            if limit < 1:
                limit = 1
            elif limit > 50:
                limit = 50
                
            logger.info(f"Fetching top {limit} tokens using strategy: {self.strategy.value}")
            
            # Get endpoint and parameters for the current strategy
            url, params = self.get_strategy_params()
            
            # Add limit to parameters
            params["limit"] = limit
            
            # Prepare request headers
            headers = {
                "x-api-key": self.birdeye_api_key,
                "accept": "application/json"
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
            
            # Handle different response structures based on API version
            if url.endswith('token_trending'):  # Legacy trending endpoint
                # Check if data field exists
                if 'data' not in data:
                    logger.error("Response missing 'data' field")
                    logger.info(f"Full response: {json.dumps(data)}")
                    return []
                    
                # Check if tokens field exists
                if 'tokens' not in data.get('data', {}):
                    logger.error("Response missing 'data.tokens' field")
                    logger.info(f"Data field content: {json.dumps(data.get('data', {}))}")
                    return []
                
                tokens = data.get('data', {}).get('tokens', [])
            else:  # V3 API endpoints
                # Check if data field exists
                if 'data' not in data:
                    logger.error("Response missing 'data' field")
                    logger.info(f"Full response: {json.dumps(data)}")
                    return []
                
                tokens = data.get('data', [])
            
            if not tokens:
                logger.warning(f"No tokens found for strategy: {self.strategy.value}")
                return []
            
            logger.info(f"Found {len(tokens)} tokens")
            
            # Convert tokens to the format expected by process_token
            formatted_tokens = []
            for token in tokens:
                # Handle different response structures
                if 'address' in token:  # V3 API format
                    formatted_token = {
                        'symbol': token.get('symbol'),
                        'name': token.get('name'),
                        'address': token.get('address'),
                        'chain': 'solana',
                        'verified': True
                    }
                else:  # Legacy trending format
                    formatted_token = {
                        'symbol': token.get('symbol'),
                        'name': token.get('name'),
                        'address': token.get('address'),
                        'chain': 'solana',
                        'verified': True
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
        Find tokens using the current strategy and process them
        
        Args:
            limit: Number of tokens to process
            
        Returns:
            Dictionary with success and failure counts
        """
        results = {
            'success': 0,
            'failure': 0,
            'total': 0,
            'strategy': self.strategy.value
        }
        
        try:
            # Get tokens using the current strategy
            tokens = self.get_tokens(limit)
            results['total'] = len(tokens)
            
            if not tokens:
                logger.warning(f"No tokens found for strategy: {self.strategy.value}")
                return results
            
            logger.info(f"Processing {len(tokens)} tokens using strategy: {self.strategy.value}")
            
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
        # Set up argument parser
        parser = argparse.ArgumentParser(description='Find and process tokens using various discovery strategies')
        parser.add_argument('strategy', nargs='?', default='all',  # Change default to 'all'
                            help='Discovery strategy to use (default: all)')
        parser.add_argument('limit', nargs='?', type=int, default=20,  # Change default to 20
                            help='Number of tokens to process (default: 20, max: 50)')
        parser.add_argument('--list-strategies', action='store_true',
                            help='List available discovery strategies and exit')
        
        # Parse arguments
        args = parser.parse_args()
        
        # If --list-strategies flag is provided, list available strategies and exit
        if args.list_strategies:
            logger.info("Available discovery strategies:")
            for strategy in DiscoveryStrategy:
                logger.info(f"- {strategy.value}: {get_strategy_description(strategy)}")
            sys.exit(0)
        
        # Convert strategy string to enum
        strategy = DiscoveryStrategy.from_string(args.strategy)
        
        # Validate limit
        limit = args.limit
        if limit < 1:
            limit = 1
            logger.warning(f"Invalid limit: {args.limit}, using minimum: {limit}")
        elif limit > 50:
            limit = 50
            logger.warning(f"Limit too high: {args.limit}, using maximum: {limit}")
        
        logger.info(f"Using strategy: {strategy.value}")
        logger.info(f"Using limit: {limit}")
        
        # Check if we should run all strategies
        if strategy == DiscoveryStrategy.ALL:
            # Run all strategies
            results = run_all_strategies(limit)
            
            # Log summary
            logger.info(f"Script completed successfully")
            logger.info(f"All strategies executed")
            
            # Log results for each strategy
            for strategy_name, strategy_results in results.items():
                logger.info(f"\nStrategy: {strategy_name}")
                logger.info(f"Processed {strategy_results.get('total', 0)} tokens:")
                logger.info(f"- {strategy_results.get('success', 0)} successful")
                logger.info(f"- {strategy_results.get('failure', 0)} failed")
        else:
            # Initialize finder with the specified strategy
            finder = TokenFinder(strategy)
            
            # Find and process tokens
            results = finder.find_and_process_tokens(limit)
            
            logger.info(f"Script completed successfully")
            logger.info(f"Strategy: {results['strategy']}")
            logger.info(f"Processed {results['total']} tokens:")
            logger.info(f"- {results['success']} successful")
            logger.info(f"- {results['failure']} failed")
        
        # Exit with success code
        sys.exit(0)
        
    except Exception as e:
        logger.error(f"Script failed: {e}")
        sys.exit(1)

def run_all_strategies(limit: int = 20) -> Dict[str, Dict[str, int]]:
    """
    Run all discovery strategies sequentially
    
    Args:
        limit: Number of tokens to process per strategy
        
    Returns:
        Dictionary with results for each strategy
    """
    results = {}
    
    # List of all strategies except ALL
    strategies = [
        strategy for strategy in DiscoveryStrategy 
        if strategy != DiscoveryStrategy.ALL
    ]
    
    logger.info(f"Running all {len(strategies)} discovery strategies with limit {limit} each")
    
    # Process each strategy
    for strategy in strategies:
        try:
            logger.info(f"\n{'='*50}")
            logger.info(f"Running strategy: {strategy.value}")
            logger.info(f"{'='*50}\n")
            
            # Initialize finder with this strategy
            finder = TokenFinder(strategy)
            
            # Find and process tokens
            strategy_results = finder.find_and_process_tokens(limit)
            
            # Store results
            results[strategy.value] = strategy_results
            
            # Add a small delay between strategies to avoid rate limiting
            time.sleep(5)
            
        except Exception as e:
            logger.error(f"Error running strategy {strategy.value}: {e}")
            logger.error(traceback.format_exc())
            results[strategy.value] = {
                'success': 0,
                'failure': 0,
                'total': 0,
                'strategy': strategy.value,
                'error': str(e)
            }
    
    # Calculate totals
    total_success = sum(r.get('success', 0) for r in results.values())
    total_failure = sum(r.get('failure', 0) for r in results.values())
    total_tokens = sum(r.get('total', 0) for r in results.values())
    
    logger.info(f"\n{'='*50}")
    logger.info(f"All strategies completed")
    logger.info(f"Total tokens processed: {total_tokens}")
    logger.info(f"Total successful: {total_success}")
    logger.info(f"Total failed: {total_failure}")
    logger.info(f"{'='*50}\n")
    
    return results

def get_strategy_description(strategy: DiscoveryStrategy) -> str:
    """Get a description of the given strategy"""
    descriptions = {
        DiscoveryStrategy.ALL:
            "Run all discovery strategies sequentially",
        DiscoveryStrategy.TRENDING: 
            "Find trending tokens based on Birdeye's ranking algorithm",
        DiscoveryStrategy.VOLUME_MOMENTUM: 
            "Identify tokens with significant trading activity growth (24h volume change)",
        DiscoveryStrategy.RECENT_LISTINGS: 
            "Discover newly listed tokens that are gaining significant market attention",
        DiscoveryStrategy.PRICE_MOMENTUM: 
            "Find tokens with strong price performance backed by increasing trading volume",
        DiscoveryStrategy.LIQUIDITY_GROWTH: 
            "Detect tokens that are rapidly gaining liquidity (often precedes price movements)",
        DiscoveryStrategy.HIGH_ACTIVITY: 
            "Discover tokens with unusually high trading activity relative to market cap"
    }
    return descriptions.get(strategy, "Unknown strategy")

if __name__ == "__main__":
    main()
