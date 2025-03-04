import sys
from pathlib import Path
import os
import asyncio
import json
import logging
from typing import List, Dict, Optional
from datetime import datetime, timezone
import aiohttp
import random
import time
from dotenv import load_dotenv
from airtable import Airtable

# Get absolute path to project root
project_root = Path(__file__).parent.parent.absolute()

# Add project root to Python path
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

# Set Windows event loop policy
if os.name == 'nt':  # Windows
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

def setup_logging():
    """Configure logging with a single handler"""
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
logger = setup_logging()

# Load environment variables
env_path = project_root / '.env'
load_dotenv(dotenv_path=env_path)

class LPPositionManager:
    def __init__(self):
        # Load environment variables
        self.base_id = os.getenv('KINKONG_AIRTABLE_BASE_ID')
        self.api_key = os.getenv('KINKONG_AIRTABLE_API_KEY')
        self.wallet_address = os.getenv('STRATEGY_WALLET')
        
        if not self.base_id or not self.api_key or not self.wallet_address:
            raise ValueError("Missing required environment variables")
        
        # Initialize Airtable
        self.positions_table = Airtable(self.base_id, 'LP_POSITIONS', self.api_key)
        self.logger = setup_logging()
        
        # Define the pools we want to track
        self.pools = [
            {
                "name": "UBC/SOL DLMM",
                "address": "DGtgdZKsVa76LvkNYTT1XMinHevrHmwjiyXGphxAPTgq",
                "type": "DLMM",
                "token0": "UBC",
                "token1": "SOL"
            },
            {
                "name": "COMPUTE/SOL DYN",
                "address": "HN7ibjiyX399d1EfYXcWaSHZRSMfUmonYvXGFXG41Rr3",
                "type": "DYN",
                "token0": "COMPUTE",
                "token1": "SOL"
            },
            {
                "name": "COMPUTE/UBC DLMM",
                "address": "xERePvynM5hAozHUE1sit2CgRS7VLHXy4phkypSKZip",
                "type": "DLMM",
                "token0": "COMPUTE",
                "token1": "UBC"
            }
        ]
        
        # Token mint addresses for reference
        self.token_mints = {
            "SOL": "So11111111111111111111111111111111111111112",
            "UBC": "9psiRdn9cXYVps4F1kFuoNjd2EtmqNJXrCPmRppJpump",
            "COMPUTE": "B1N1HcMm4RysYz4smsXwmk2UnS8NziqKCM6Ho8i62vXo"
        }
        
        # Initialize token prices dictionary
        self.token_prices = {}

    async def deactivate_existing_positions(self):
        """Deactivate all existing LP positions"""
        try:
            # Get all active positions
            active_positions = self.positions_table.get_all(
                formula="isActive=TRUE()"
            )
            
            self.logger.info(f"Found {len(active_positions)} active positions to deactivate")
            
            # Update each position to inactive
            for position in active_positions:
                self.positions_table.update(
                    position['id'],
                    {'isActive': False, 'updatedAt': datetime.now(timezone.utc).isoformat()}
                )
                
            self.logger.info(f"Successfully deactivated {len(active_positions)} positions")
            
        except Exception as e:
            self.logger.error(f"Error deactivating existing positions: {e}")
            raise

    async def fetch_dlmm_positions(self, pool_address: str) -> List[Dict]:
        """Fetch DLMM positions for a specific pool using Shyft API with rate limit handling"""
        try:
            # Get Shyft API key from environment variables
            shyft_api_key = os.getenv('SHYFT_API_KEY')
            if not shyft_api_key:
                self.logger.error("SHYFT_API_KEY not found in environment variables")
                return []
                
            self.logger.info(f"Fetching positions from Shyft API for wallet: {self.wallet_address}")
            
            # GraphQL query to get positions for the wallet
            operations_doc = f"""
                query MyQuery {{
                  meteora_dlmm_PositionV2(
                    where: {{owner: {{_eq: "{self.wallet_address}"}}}}
                  ) {{
                    upperBinId
                    lowerBinId
                    totalClaimedFeeYAmount
                    totalClaimedFeeXAmount
                    lastUpdatedAt
                    lbPair
                    owner
                  }}
                  meteora_dlmm_Position(
                    where: {{owner: {{_eq: "{self.wallet_address}"}}}}
                  ) {{
                    lastUpdatedAt
                    lbPair
                    lowerBinId
                    upperBinId
                    totalClaimedFeeYAmount
                    totalClaimedFeeXAmount
                    owner
                  }}
                }}
            """
            
            # Make the API request to get positions
            max_retries = 3
            base_delay = 2
            
            for retry in range(max_retries):
                try:
                    # Add delay before retry
                    if retry > 0:
                        delay = base_delay * (2 ** retry) + random.uniform(0, 1)
                        self.logger.info(f"Retry {retry+1}/{max_retries} after {delay:.2f}s delay")
                        await asyncio.sleep(delay)
                    
                    async with aiohttp.ClientSession() as session:
                        async with session.post(
                            f"https://programs.shyft.to/v0/graphql/accounts?api_key={shyft_api_key}&network=mainnet-beta",
                            json={
                                "query": operations_doc,
                                "variables": {},
                                "operationName": "MyQuery"
                            },
                            headers={"Content-Type": "application/json"}
                        ) as response:
                            response_text = await response.text()
                            
                            # Check for rate limit errors
                            if "RateLimitExceeded" in response_text:
                                if retry < max_retries - 1:
                                    self.logger.warning(f"Rate limit exceeded, retrying in {base_delay * (2 ** (retry+1))}s...")
                                    continue
                                else:
                                    self.logger.error(f"Rate limit exceeded after {max_retries} retries")
                                    return []
                            
                            if response.status != 200:
                                self.logger.error(f"Failed to fetch positions from Shyft: {response_text}")
                                if retry < max_retries - 1:
                                    continue
                                return []
                            
                            result = await response.json()
                            
                            if "errors" in result:
                                error_msg = str(result['errors'])
                                self.logger.error(f"GraphQL errors: {error_msg}")
                                
                                # Check for rate limit errors in the error message
                                if "rate limit" in error_msg.lower() or "quota" in error_msg.lower():
                                    if retry < max_retries - 1:
                                        self.logger.warning(f"Rate limit error, retrying in {base_delay * (2 ** (retry+1))}s...")
                                        continue
                                
                                return []
                            
                            positions = []
                            
                            # Process Position data
                            if "data" in result and "meteora_dlmm_Position" in result["data"]:
                                for position in result["data"]["meteora_dlmm_Position"]:
                                    # Only include positions for the specific pool we're looking for
                                    if position["lbPair"] == pool_address:
                                        # Add a delay before fetching LB pair details to avoid rate limits
                                        await asyncio.sleep(1)
                                        
                                        # Get LB pair details
                                        lb_pair_details = await self.fetch_lb_pair_details(position["lbPair"], shyft_api_key)
                                        
                                        # Create position object with LB pair details
                                        position_data = {
                                            "address": position["lbPair"],
                                            "poolAddress": position["lbPair"],
                                            "owner": position["owner"],
                                            "lowerBinId": position["lowerBinId"],
                                            "upperBinId": position["upperBinId"],
                                            "totalClaimedFeeXAmount": position["totalClaimedFeeXAmount"],
                                            "totalClaimedFeeYAmount": position["totalClaimedFeeYAmount"],
                                            "lastUpdatedAt": position["lastUpdatedAt"],
                                            "lbPairDetails": lb_pair_details
                                        }
                                        
                                        positions.append(position_data)
                            
                            # Process PositionV2 data
                            if "data" in result and "meteora_dlmm_PositionV2" in result["data"]:
                                for position in result["data"]["meteora_dlmm_PositionV2"]:
                                    # Only include positions for the specific pool we're looking for
                                    if position["lbPair"] == pool_address:
                                        # Add a delay before fetching LB pair details to avoid rate limits
                                        await asyncio.sleep(1)
                                        
                                        # Get LB pair details
                                        lb_pair_details = await self.fetch_lb_pair_details(position["lbPair"], shyft_api_key)
                                        
                                        # Create position object with LB pair details
                                        position_data = {
                                            "address": position["lbPair"],
                                            "poolAddress": position["lbPair"],
                                            "owner": position["owner"],
                                            "lowerBinId": position["lowerBinId"],
                                            "upperBinId": position["upperBinId"],
                                            "totalClaimedFeeXAmount": position["totalClaimedFeeXAmount"],
                                            "totalClaimedFeeYAmount": position["totalClaimedFeeYAmount"],
                                            "lastUpdatedAt": position["lastUpdatedAt"],
                                            "lbPairDetails": lb_pair_details,
                                            "version": "V2"
                                        }
                                        
                                        positions.append(position_data)
                            
                            self.logger.info(f"Found {len(positions)} positions for pool {pool_address}")
                            return positions
                
                except Exception as e:
                    self.logger.error(f"Error in fetch attempt {retry+1}: {e}")
                    if retry < max_retries - 1:
                        continue
                    else:
                        self.logger.error(f"All retries failed")
                        return []
                        
        except Exception as e:
            self.logger.error(f"Error fetching DLMM positions: {e}")
            return []

    async def fetch_lb_pair_details(self, lb_pair_address: str, shyft_api_key: str) -> Dict:
        """Fetch LB pair details for a specific pair address with rate limit handling"""
        max_retries = 3
        base_delay = 2  # Base delay in seconds
        
        for retry in range(max_retries):
            try:
                # GraphQL query to get LB pair details
                query = f"""
                    query MyQuery {{
                        meteora_dlmm_LbPair(
                            where: {{pubkey: {{_eq: "{lb_pair_address}"}}}}
                        ) {{
                            pubkey
                            oracle
                            pairType
                            reserveX
                            reserveY
                            status
                            tokenXMint
                            tokenYMint
                        }}
                    }}
                """
                
                # Add delay before request to avoid rate limits
                if retry > 0:
                    # Exponential backoff with jitter
                    delay = base_delay * (2 ** retry) + random.uniform(0, 1)
                    self.logger.info(f"Retry {retry+1}/{max_retries} after {delay:.2f}s delay")
                    await asyncio.sleep(delay)
                
                # Make the API request to get LB pair details
                async with aiohttp.ClientSession() as session:
                    async with session.post(
                        f"https://programs.shyft.to/v0/graphql/accounts?api_key={shyft_api_key}&network=mainnet-beta",
                        json={
                            "query": query,
                            "variables": {},
                            "operationName": "MyQuery"
                        },
                        headers={"Content-Type": "application/json"}
                    ) as response:
                        response_text = await response.text()
                        
                        # Check for rate limit errors
                        if "RateLimitExceeded" in response_text:
                            if retry < max_retries - 1:
                                self.logger.warning(f"Rate limit exceeded, retrying in {base_delay * (2 ** (retry+1))}s...")
                                continue
                            else:
                                self.logger.error(f"Rate limit exceeded after {max_retries} retries")
                                # Return empty dict but don't fail completely
                                return {}
                        
                        if response.status != 200:
                            self.logger.error(f"Failed to fetch LB pair details: {response_text}")
                            if retry < max_retries - 1:
                                continue
                            return {}
                        
                        result = await response.json()
                        
                        if "errors" in result:
                            error_msg = str(result['errors'])
                            self.logger.error(f"GraphQL errors: {error_msg}")
                            
                            # Check for rate limit errors in the error message
                            if "rate limit" in error_msg.lower() or "quota" in error_msg.lower():
                                if retry < max_retries - 1:
                                    self.logger.warning(f"Rate limit error, retrying in {base_delay * (2 ** (retry+1))}s...")
                                    continue
                            
                            return {}
                        
                        if "data" in result and "meteora_dlmm_LbPair" in result["data"] and len(result["data"]["meteora_dlmm_LbPair"]) > 0:
                            return result["data"]["meteora_dlmm_LbPair"][0]
                        
                        return {}
                        
            except Exception as e:
                self.logger.error(f"Error fetching LB pair details: {e}")
                if retry < max_retries - 1:
                    continue
                return {}
        
        return {}  # Return empty dict if all retries failed

    async def fetch_dyn_positions(self, pool_address: str) -> List[Dict]:
        """Fetch DYN positions for a specific pool using Shyft API with rate limit handling"""
        try:
            # Get Shyft API key from environment variables
            shyft_api_key = os.getenv('SHYFT_API_KEY')
            if not shyft_api_key:
                self.logger.error("SHYFT_API_KEY not found in environment variables")
                return []
                
            self.logger.info(f"Fetching DYN positions from Shyft API for wallet: {self.wallet_address}")
            
            # GraphQL query to get positions for the wallet
            operations_doc = f"""
                query MyQuery {{
                  meteora_dyn_Position(
                    where: {{owner: {{_eq: "{self.wallet_address}"}}}}
                  ) {{
                    lastUpdatedAt
                    pool
                    owner
                    liquidity
                    lowerTick
                    upperTick
                    tokenFeesOwedX
                    tokenFeesOwedY
                  }}
                }}
            """
            
            # Make the API request to get positions
            max_retries = 3
            base_delay = 2
            
            for retry in range(max_retries):
                try:
                    # Add delay before retry
                    if retry > 0:
                        delay = base_delay * (2 ** retry) + random.uniform(0, 1)
                        self.logger.info(f"Retry {retry+1}/{max_retries} after {delay:.2f}s delay")
                        await asyncio.sleep(delay)
                    
                    async with aiohttp.ClientSession() as session:
                        async with session.post(
                            f"https://programs.shyft.to/v0/graphql/accounts?api_key={shyft_api_key}&network=mainnet-beta",
                            json={
                                "query": operations_doc,
                                "variables": {},
                                "operationName": "MyQuery"
                            },
                            headers={"Content-Type": "application/json"}
                        ) as response:
                            response_text = await response.text()
                            
                            # Check for rate limit errors
                            if "RateLimitExceeded" in response_text:
                                if retry < max_retries - 1:
                                    self.logger.warning(f"Rate limit exceeded, retrying in {base_delay * (2 ** (retry+1))}s...")
                                    continue
                                else:
                                    self.logger.error(f"Rate limit exceeded after {max_retries} retries")
                                    return []
                            
                            if response.status != 200:
                                self.logger.error(f"Failed to fetch DYN positions from Shyft: {response_text}")
                                if retry < max_retries - 1:
                                    continue
                                return []
                            
                            result = await response.json()
                            
                            if "errors" in result:
                                error_msg = str(result['errors'])
                                self.logger.error(f"GraphQL errors: {error_msg}")
                                
                                # Check for rate limit errors in the error message
                                if "rate limit" in error_msg.lower() or "quota" in error_msg.lower():
                                    if retry < max_retries - 1:
                                        self.logger.warning(f"Rate limit error, retrying in {base_delay * (2 ** (retry+1))}s...")
                                        continue
                                
                                return []
                            
                            positions = []
                            
                            # Process Position data
                            if "data" in result and "meteora_dyn_Position" in result["data"]:
                                for position in result["data"]["meteora_dyn_Position"]:
                                    # Only include positions for the specific pool we're looking for
                                    if position["pool"] == pool_address:
                                        # Add a delay before fetching pool details to avoid rate limits
                                        await asyncio.sleep(1)
                                        
                                        # Get pool details
                                        pool_details = await self.fetch_dyn_pool_details(position["pool"], shyft_api_key)
                                        
                                        # Create position object with pool details
                                        position_data = {
                                            "address": position["pool"],
                                            "poolAddress": position["pool"],
                                            "owner": position["owner"],
                                            "liquidity": position["liquidity"],
                                            "lowerTick": position["lowerTick"],
                                            "upperTick": position["upperTick"],
                                            "tokenFeesOwedX": position["tokenFeesOwedX"],
                                            "tokenFeesOwedY": position["tokenFeesOwedY"],
                                            "lastUpdatedAt": position["lastUpdatedAt"],
                                            "poolDetails": pool_details
                                        }
                                        
                                        positions.append(position_data)
                            
                            self.logger.info(f"Found {len(positions)} DYN positions for pool {pool_address}")
                            return positions
                
                except Exception as e:
                    self.logger.error(f"Error in fetch attempt {retry+1}: {e}")
                    if retry < max_retries - 1:
                        continue
                    else:
                        self.logger.error(f"All retries failed")
                        return []
                        
        except Exception as e:
            self.logger.error(f"Error fetching DYN positions: {e}")
            return []

    async def fetch_dyn_pool_details(self, pool_address: str, shyft_api_key: str) -> Dict:
        """Fetch DYN pool details for a specific pool address with rate limit handling"""
        max_retries = 3
        base_delay = 2  # Base delay in seconds
        
        for retry in range(max_retries):
            try:
                # GraphQL query to get pool details
                query = f"""
                    query MyQuery {{
                        meteora_dyn_Pool(
                            where: {{pubkey: {{_eq: "{pool_address}"}}}}
                        ) {{
                            pubkey
                            tokenX
                            tokenY
                            fee
                            liquidity
                            sqrtPriceX64
                            tick
                        }}
                    }}
                """
                
                # Add delay before request to avoid rate limits
                if retry > 0:
                    # Exponential backoff with jitter
                    delay = base_delay * (2 ** retry) + random.uniform(0, 1)
                    self.logger.info(f"Retry {retry+1}/{max_retries} after {delay:.2f}s delay")
                    await asyncio.sleep(delay)
                
                # Make the API request to get pool details
                async with aiohttp.ClientSession() as session:
                    async with session.post(
                        f"https://programs.shyft.to/v0/graphql/accounts?api_key={shyft_api_key}&network=mainnet-beta",
                        json={
                            "query": query,
                            "variables": {},
                            "operationName": "MyQuery"
                        },
                        headers={"Content-Type": "application/json"}
                    ) as response:
                        response_text = await response.text()
                        
                        # Check for rate limit errors
                        if "RateLimitExceeded" in response_text:
                            if retry < max_retries - 1:
                                self.logger.warning(f"Rate limit exceeded, retrying in {base_delay * (2 ** (retry+1))}s...")
                                continue
                            else:
                                self.logger.error(f"Rate limit exceeded after {max_retries} retries")
                                # Return empty dict but don't fail completely
                                return {}
                        
                        if response.status != 200:
                            self.logger.error(f"Failed to fetch DYN pool details: {response_text}")
                            if retry < max_retries - 1:
                                continue
                            return {}
                        
                        result = await response.json()
                        
                        if "errors" in result:
                            error_msg = str(result['errors'])
                            self.logger.error(f"GraphQL errors: {error_msg}")
                            
                            # Check for rate limit errors in the error message
                            if "rate limit" in error_msg.lower() or "quota" in error_msg.lower():
                                if retry < max_retries - 1:
                                    self.logger.warning(f"Rate limit error, retrying in {base_delay * (2 ** (retry+1))}s...")
                                    continue
                            
                            return {}
                        
                        if "data" in result and "meteora_dyn_Pool" in result["data"] and len(result["data"]["meteora_dyn_Pool"]) > 0:
                            return result["data"]["meteora_dyn_Pool"][0]
                        
                        return {}
                        
            except Exception as e:
                self.logger.error(f"Error fetching DYN pool details: {e}")
                if retry < max_retries - 1:
                    continue
                return {}
        
        return {}  # Return empty dict if all retries failed

    async def fetch_positions_for_pool(self, pool: Dict) -> List[Dict]:
        """Fetch positions for a specific pool based on its type"""
        pool_address = pool['address']
        pool_type = pool['type']
        
        positions = []
        
        # Try primary method based on pool type
        if pool_type == "DLMM":
            positions = await self.fetch_dlmm_positions(pool_address)
        elif pool_type == "DYN":
            positions = await self.fetch_dyn_positions(pool_address)
        else:
            self.logger.error(f"Unknown pool type: {pool_type}")
        
        # If no positions found, log it but don't create placeholders
        if not positions:
            self.logger.warning(f"No positions found for pool {pool_address}")
        
        # Add a small delay between pools to avoid rate limits
        await asyncio.sleep(2)
        
        return positions

    def normalize_dlmm_position(self, position: Dict, pool: Dict) -> Dict:
        """Normalize DLMM position data from Shyft API"""
        try:
            # Extract token information from LB pair details
            lb_pair_details = position.get('lbPairDetails', {})
            
            # Get token mints
            token_x_mint = lb_pair_details.get('tokenXMint', '')
            token_y_mint = lb_pair_details.get('tokenYMint', '')
            
            # Determine which token is which based on our pool definition
            token0_is_x = False
            for token_name, token_mint in self.token_mints.items():
                if token_mint == token_x_mint and token_name == pool['token0']:
                    token0_is_x = True
                    break
                if token_mint == token_y_mint and token_name == pool['token0']:
                    token0_is_x = False
                    break
            
            # Get reserve amounts from LB pair details
            reserve_x = float(lb_pair_details.get('reserveX', 0))
            reserve_y = float(lb_pair_details.get('reserveY', 0))
            
            # Calculate token amounts based on position's share of the pool
            # This is a simplified calculation and may need adjustment based on actual bin distribution
            # For more accurate calculations, we would need to know the exact bin distribution
            token_x_amount = reserve_x * 0.01  # Placeholder - needs actual calculation
            token_y_amount = reserve_y * 0.01  # Placeholder - needs actual calculation
            
            # Map token amounts to token0 and token1
            token0_amount = token_x_amount if token0_is_x else token_y_amount
            token1_amount = token_y_amount if token0_is_x else token_x_amount
            
            # Calculate USD values using token prices
            token0_price = self.token_prices.get(pool['token0'], 0)
            token1_price = self.token_prices.get(pool['token1'], 0)
            
            token0_value_usd = token0_amount * token0_price
            token1_value_usd = token1_amount * token1_price
            total_value_usd = token0_value_usd + token1_value_usd
            
            # Create normalized position data - REMOVE SPECIFIC FIELDS
            return {
                'pool': pool['address'],  # Use 'pool' as the field name for Airtable
                'poolAddress': pool['address'],
                'poolName': pool['name'],
                'poolType': pool['type'],
                'token0': pool['token0'],
                'token1': pool['token1'],
                'positionAddress': position.get('address', ''),
                'token0Amount': token0_amount,
                'token1Amount': token1_amount,
                'token0ValueUsd': token0_value_usd,
                'token1ValueUsd': token1_value_usd,
                'totalValueUsd': total_value_usd,
                'isActive': True,
                'createdAt': datetime.now(timezone.utc).isoformat(),
                'updatedAt': datetime.now(timezone.utc).isoformat()
            }
        except Exception as e:
            self.logger.error(f"Error normalizing DLMM position: {e}")
            return {}

    def normalize_dyn_position(self, position: Dict, pool: Dict) -> Dict:
        """Normalize DYN position data from Shyft API"""
        try:
            # Extract token information from pool details
            pool_details = position.get('poolDetails', {})
            
            # Calculate token amounts based on liquidity and price range
            # This is a simplified calculation and would need to be adjusted based on actual math for DYN positions
            # For more accurate calculations, we would need to use the actual formulas from the DYN protocol
            liquidity = float(position.get('liquidity', 0))
            
            # Placeholder calculations - these need to be replaced with actual DYN formulas
            token0_amount = liquidity * 0.01  # Placeholder
            token1_amount = liquidity * 0.01  # Placeholder
            
            # Calculate USD values using token prices
            token0_price = self.token_prices.get(pool['token0'], 0)
            token1_price = self.token_prices.get(pool['token1'], 0)
            
            token0_value_usd = token0_amount * token0_price
            token1_value_usd = token1_amount * token1_price
            total_value_usd = token0_value_usd + token1_value_usd
            
            # Create normalized position data - REMOVE SPECIFIC FIELDS
            return {
                'pool': pool['address'],  # Use 'pool' as the field name for Airtable
                'poolAddress': pool['address'],
                'poolName': pool['name'],
                'poolType': pool['type'],
                'token0': pool['token0'],
                'token1': pool['token1'],
                'positionAddress': position.get('address', ''),
                'token0Amount': token0_amount,
                'token1Amount': token1_amount,
                'token0ValueUsd': token0_value_usd,
                'token1ValueUsd': token1_value_usd,
                'totalValueUsd': total_value_usd,
                'isActive': True,
                'createdAt': datetime.now(timezone.utc).isoformat(),
                'updatedAt': datetime.now(timezone.utc).isoformat()
            }
        except Exception as e:
            self.logger.error(f"Error normalizing DYN position: {e}")
            return {}

    def normalize_position(self, position: Dict, pool: Dict) -> Dict:
        """Normalize position data based on pool type"""
        if pool['type'] == "DLMM":
            return self.normalize_dlmm_position(position, pool)
        elif pool['type'] == "DYN":
            return self.normalize_dyn_position(position, pool)
        else:
            self.logger.error(f"Unknown pool type: {pool['type']}")
            return {}

    async def save_position(self, position_data: Dict):
        """Save a position to Airtable"""
        try:
            if not position_data:
                return
                
            # Check if position already exists by pool address
            existing_positions = self.positions_table.get_all(
                formula=f"{{pool}}='{position_data['poolAddress']}'"
            )
            
            if existing_positions:
                # Update existing position
                self.logger.info(f"Updating existing position for pool: {position_data['poolAddress']}")
                position_data['updatedAt'] = datetime.now(timezone.utc).isoformat()
                position_data['pool'] = position_data['poolAddress']  # Ensure pool field is set
                self.positions_table.update(existing_positions[0]['id'], position_data)
            else:
                # Create new position
                self.logger.info(f"Creating new position for pool: {position_data['poolAddress']}")
                position_data['pool'] = position_data['poolAddress']  # Ensure pool field is set
                self.positions_table.insert(position_data)
                
        except Exception as e:
            self.logger.error(f"Error saving position: {e}")

    async def process_all_positions(self):
        """Process all positions for all pools"""
        try:
            # First deactivate all existing positions
            await self.deactivate_existing_positions()
            
            # Fetch token prices first
            self.token_prices = await self.fetch_token_prices()
            self.logger.info(f"Fetched prices: {self.token_prices}")
            
            # Process each pool
            for pool in self.pools:
                self.logger.info(f"Processing pool: {pool['name']} ({pool['address']})")
                
                # Fetch positions for this pool
                positions = await self.fetch_positions_for_pool(pool)
                
                # Process each position
                for position in positions:
                    # Normalize position data
                    normalized_position = self.normalize_position(position, pool)
                    
                    # Save to Airtable
                    if normalized_position:
                        await self.save_position(normalized_position)
                        # Small delay between saving positions
                        await asyncio.sleep(0.5)
                
                # Larger delay between pools
                await asyncio.sleep(3)
                
            self.logger.info("Finished processing all positions")
            
        except Exception as e:
            self.logger.error(f"Error processing positions: {e}")
            raise

async def main():
    try:
        logger.info("Starting LP position manager")
        
        # Initialize position manager
        manager = LPPositionManager()
        
        # Process all positions
        await manager.process_all_positions()
        
        logger.info("LP position manager completed successfully")
        
    except Exception as e:
        logger.error(f"Error in LP position manager: {e}")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())
