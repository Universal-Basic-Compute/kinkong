"""
Pool Mapping Script

This script retrieves all LP positions for a specific pool directly from the data provider (Shyft API).
It can be used to map positions to pools and analyze pool-specific data without relying on Airtable.
"""

import sys
import os
from pathlib import Path
import logging
import json
import asyncio
import aiohttp
import random
from datetime import datetime, timezone
from typing import Dict, List, Any, Optional
from dotenv import load_dotenv

# Get absolute path to project root
project_root = str(Path(__file__).parent.parent.parent.absolute())
# Add project root to Python path
if project_root not in sys.path:
    sys.path.insert(0, project_root)

# Set Windows event loop policy
if os.name == 'nt':  # Windows
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

# Configure logging
def setup_logging():
    """Set up logging configuration"""
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    return logging.getLogger(__name__)

logger = setup_logging()

# Load environment variables
load_dotenv(dotenv_path=os.path.join(project_root, '.env'))

class PoolMapper:
    """Maps LP positions to pools and provides pool-specific data directly from data providers"""
    
    def __init__(self):
        # Load environment variables
        self.shyft_api_key = os.getenv('SHYFT_API_KEY')
        
        if not self.shyft_api_key:
            raise ValueError("Missing SHYFT_API_KEY in environment variables")
        
        # Define known pool types
        self.pool_types = {
            "DLMM": "Meteora DLMM",
            "DYN": "Meteora DYN"
        }
        
        # Token mint addresses for reference
        self.token_mints = {
            "SOL": "So11111111111111111111111111111111111111112",
            "UBC": "9psiRdn9cXYVps4F1kFuoNjd2EtmqNJXrCPmRppJpump",
            "COMPUTE": "B1N1HcMm4RysYz4smsXwmk2UnS8NziqKCM6Ho8i62vXo"
        }
    
    async def get_all_positions_for_pool(self, pool_address: str, pool_type: str = None) -> List[Dict]:
        """
        Get all positions for a specific pool from the data provider
        
        Args:
            pool_address: The address of the pool
            pool_type: The type of pool (DLMM or DYN). If not provided, will attempt to detect.
            
        Returns:
            List of position data dictionaries
        """
        logger.info(f"Fetching all positions for pool: {pool_address}")
        
        # Determine pool type if not provided
        if not pool_type:
            pool_type = await self.detect_pool_type(pool_address)
            
        if not pool_type:
            logger.error(f"Could not determine pool type for {pool_address}")
            return []
            
        # Fetch positions based on pool type
        if pool_type.upper() == "DLMM":
            return await self.get_dlmm_pool_positions(pool_address)
        elif pool_type.upper() == "DYN":
            return await self.get_dyn_pool_positions(pool_address)
        else:
            logger.error(f"Unsupported pool type: {pool_type}")
            return []
    
    async def detect_pool_type(self, pool_address: str) -> Optional[str]:
        """
        Detect the type of pool based on its address
        
        Args:
            pool_address: The address of the pool
            
        Returns:
            Pool type (DLMM or DYN) or None if could not be determined
        """
        logger.info(f"Detecting pool type for: {pool_address}")
        
        # Try to get DLMM pool details
        dlmm_details = await self.fetch_lb_pair_details(pool_address)
        if dlmm_details and 'pubkey' in dlmm_details:
            return "DLMM"
            
        # Try to get DYN pool details
        dyn_details = await self.fetch_dyn_pool_details(pool_address)
        if dyn_details and 'pubkey' in dyn_details:
            return "DYN"
            
        # Could not determine pool type
        return None
    
    async def get_dlmm_pool_positions(self, pool_address: str) -> List[Dict]:
        """
        Get all positions for a DLMM pool
        
        Args:
            pool_address: The address of the DLMM pool
            
        Returns:
            List of position data dictionaries
        """
        try:
            logger.info(f"Fetching all positions for DLMM pool: {pool_address}")
            
            # GraphQL query to get all positions for the pool
            operations_doc = f"""
                query PoolPositions {{
                  meteora_dlmm_PositionV2(
                    where: {{lbPair: {{_eq: "{pool_address}"}}}}
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
                    where: {{lbPair: {{_eq: "{pool_address}"}}}}
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
                        logger.info(f"Retry {retry+1}/{max_retries} after {delay:.2f}s delay")
                        await asyncio.sleep(delay)
                    
                    async with aiohttp.ClientSession() as session:
                        async with session.post(
                            f"https://programs.shyft.to/v0/graphql/accounts?api_key={self.shyft_api_key}&network=mainnet-beta",
                            json={
                                "query": operations_doc,
                                "variables": {},
                                "operationName": "PoolPositions"
                            },
                            headers={"Content-Type": "application/json"}
                        ) as response:
                            response_text = await response.text()
                            
                            # Check for rate limit errors
                            if "RateLimitExceeded" in response_text:
                                if retry < max_retries - 1:
                                    logger.warning(f"Rate limit exceeded, retrying in {base_delay * (2 ** (retry+1))}s...")
                                    continue
                                else:
                                    logger.error(f"Rate limit exceeded after {max_retries} retries")
                                    return []
                            
                            if response.status != 200:
                                logger.error(f"Failed to fetch positions from Shyft: {response_text}")
                                if retry < max_retries - 1:
                                    continue
                                return []
                            
                            result = await response.json()
                            
                            if "errors" in result:
                                error_msg = str(result['errors'])
                                logger.error(f"GraphQL errors: {error_msg}")
                                
                                # Check for rate limit errors in the error message
                                if "rate limit" in error_msg.lower() or "quota" in error_msg.lower():
                                    if retry < max_retries - 1:
                                        logger.warning(f"Rate limit error, retrying in {base_delay * (2 ** (retry+1))}s...")
                                        continue
                                
                                return []
                            
                            positions = []
                            
                            # Get pool details for enriching position data
                            pool_details = await self.fetch_lb_pair_details(pool_address)
                            
                            # Process Position data
                            if "data" in result and "meteora_dlmm_Position" in result["data"]:
                                for position in result["data"]["meteora_dlmm_Position"]:
                                    position_data = {
                                        "address": position["lbPair"],
                                        "poolAddress": position["lbPair"],
                                        "owner": position["owner"],
                                        "lowerBinId": position["lowerBinId"],
                                        "upperBinId": position["upperBinId"],
                                        "totalClaimedFeeXAmount": position["totalClaimedFeeXAmount"],
                                        "totalClaimedFeeYAmount": position["totalClaimedFeeYAmount"],
                                        "lastUpdatedAt": position["lastUpdatedAt"],
                                        "poolDetails": pool_details,
                                        "poolType": "DLMM",
                                        "version": "V1"
                                    }
                                    
                                    positions.append(position_data)
                            
                            # Process PositionV2 data
                            if "data" in result and "meteora_dlmm_PositionV2" in result["data"]:
                                for position in result["data"]["meteora_dlmm_PositionV2"]:
                                    position_data = {
                                        "address": position["lbPair"],
                                        "poolAddress": position["lbPair"],
                                        "owner": position["owner"],
                                        "lowerBinId": position["lowerBinId"],
                                        "upperBinId": position["upperBinId"],
                                        "totalClaimedFeeXAmount": position["totalClaimedFeeXAmount"],
                                        "totalClaimedFeeYAmount": position["totalClaimedFeeYAmount"],
                                        "lastUpdatedAt": position["lastUpdatedAt"],
                                        "poolDetails": pool_details,
                                        "poolType": "DLMM",
                                        "version": "V2"
                                    }
                                    
                                    positions.append(position_data)
                            
                            logger.info(f"Found {len(positions)} positions for DLMM pool {pool_address}")
                            return positions
                
                except Exception as e:
                    logger.error(f"Error in fetch attempt {retry+1}: {e}")
                    if retry < max_retries - 1:
                        continue
                    else:
                        logger.error(f"All retries failed")
                        return []
                        
        except Exception as e:
            logger.error(f"Error fetching DLMM pool positions: {e}")
            return []
    
    async def get_dyn_pool_positions(self, pool_address: str) -> List[Dict]:
        """
        Get all positions for a DYN pool
        
        Args:
            pool_address: The address of the DYN pool
            
        Returns:
            List of position data dictionaries
        """
        try:
            logger.info(f"Fetching all positions for DYN pool: {pool_address}")
            
            # GraphQL query to get all positions for the pool
            operations_doc = f"""
                query PoolPositions {{
                  meteora_dyn_Position(
                    where: {{pool: {{_eq: "{pool_address}"}}}}
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
                        logger.info(f"Retry {retry+1}/{max_retries} after {delay:.2f}s delay")
                        await asyncio.sleep(delay)
                    
                    async with aiohttp.ClientSession() as session:
                        async with session.post(
                            f"https://programs.shyft.to/v0/graphql/accounts?api_key={self.shyft_api_key}&network=mainnet-beta",
                            json={
                                "query": operations_doc,
                                "variables": {},
                                "operationName": "PoolPositions"
                            },
                            headers={"Content-Type": "application/json"}
                        ) as response:
                            response_text = await response.text()
                            
                            # Check for rate limit errors
                            if "RateLimitExceeded" in response_text:
                                if retry < max_retries - 1:
                                    logger.warning(f"Rate limit exceeded, retrying in {base_delay * (2 ** (retry+1))}s...")
                                    continue
                                else:
                                    logger.error(f"Rate limit exceeded after {max_retries} retries")
                                    return []
                            
                            if response.status != 200:
                                logger.error(f"Failed to fetch DYN positions from Shyft: {response_text}")
                                if retry < max_retries - 1:
                                    continue
                                return []
                            
                            result = await response.json()
                            
                            if "errors" in result:
                                error_msg = str(result['errors'])
                                logger.error(f"GraphQL errors: {error_msg}")
                                
                                # Check for rate limit errors in the error message
                                if "rate limit" in error_msg.lower() or "quota" in error_msg.lower():
                                    if retry < max_retries - 1:
                                        logger.warning(f"Rate limit error, retrying in {base_delay * (2 ** (retry+1))}s...")
                                        continue
                                
                                return []
                            
                            positions = []
                            
                            # Get pool details for enriching position data
                            pool_details = await self.fetch_dyn_pool_details(pool_address)
                            
                            # Process Position data
                            if "data" in result and "meteora_dyn_Position" in result["data"]:
                                for position in result["data"]["meteora_dyn_Position"]:
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
                                        "poolDetails": pool_details,
                                        "poolType": "DYN"
                                    }
                                    
                                    positions.append(position_data)
                            
                            logger.info(f"Found {len(positions)} positions for DYN pool {pool_address}")
                            return positions
                
                except Exception as e:
                    logger.error(f"Error in fetch attempt {retry+1}: {e}")
                    if retry < max_retries - 1:
                        continue
                    else:
                        logger.error(f"All retries failed")
                        return []
                        
        except Exception as e:
            logger.error(f"Error fetching DYN pool positions: {e}")
            return []
    
    async def fetch_lb_pair_details(self, lb_pair_address: str) -> Dict:
        """Fetch LB pair details for a specific pair address with rate limit handling"""
        max_retries = 3
        base_delay = 2  # Base delay in seconds
        
        for retry in range(max_retries):
            try:
                # GraphQL query to get LB pair details
                query = f"""
                    query LbPairDetails {{
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
                            activeId
                            binStep
                        }}
                    }}
                """
                
                # Add delay before request to avoid rate limits
                if retry > 0:
                    # Exponential backoff with jitter
                    delay = base_delay * (2 ** retry) + random.uniform(0, 1)
                    logger.info(f"Retry {retry+1}/{max_retries} after {delay:.2f}s delay")
                    await asyncio.sleep(delay)
                
                # Make the API request to get LB pair details
                async with aiohttp.ClientSession() as session:
                    async with session.post(
                        f"https://programs.shyft.to/v0/graphql/accounts?api_key={self.shyft_api_key}&network=mainnet-beta",
                        json={
                            "query": query,
                            "variables": {},
                            "operationName": "LbPairDetails"
                        },
                        headers={"Content-Type": "application/json"}
                    ) as response:
                        response_text = await response.text()
                        
                        # Check for rate limit errors
                        if "RateLimitExceeded" in response_text:
                            if retry < max_retries - 1:
                                logger.warning(f"Rate limit exceeded, retrying in {base_delay * (2 ** (retry+1))}s...")
                                continue
                            else:
                                logger.error(f"Rate limit exceeded after {max_retries} retries")
                                # Return empty dict but don't fail completely
                                return {}
                        
                        if response.status != 200:
                            logger.error(f"Failed to fetch LB pair details: {response_text}")
                            if retry < max_retries - 1:
                                continue
                            return {}
                        
                        result = await response.json()
                        
                        if "errors" in result:
                            error_msg = str(result['errors'])
                            logger.error(f"GraphQL errors: {error_msg}")
                            
                            # Check for rate limit errors in the error message
                            if "rate limit" in error_msg.lower() or "quota" in error_msg.lower():
                                if retry < max_retries - 1:
                                    logger.warning(f"Rate limit error, retrying in {base_delay * (2 ** (retry+1))}s...")
                                    continue
                            
                            return {}
                        
                        if "data" in result and "meteora_dlmm_LbPair" in result["data"] and len(result["data"]["meteora_dlmm_LbPair"]) > 0:
                            pair_data = result["data"]["meteora_dlmm_LbPair"][0]
                            
                            # Add token names based on token mints
                            token_x_mint = pair_data.get('tokenXMint', '')
                            token_y_mint = pair_data.get('tokenYMint', '')
                            
                            token_x_name = "Unknown"
                            token_y_name = "Unknown"
                            
                            for token_name, token_mint in self.token_mints.items():
                                if token_mint == token_x_mint:
                                    token_x_name = token_name
                                if token_mint == token_y_mint:
                                    token_y_name = token_name
                            
                            pair_data['tokenXName'] = token_x_name
                            pair_data['tokenYName'] = token_y_name
                            
                            return pair_data
                        
                        return {}
                        
            except Exception as e:
                logger.error(f"Error fetching LB pair details: {e}")
                if retry < max_retries - 1:
                    continue
                return {}
        
        return {}  # Return empty dict if all retries failed
    
    async def fetch_dyn_pool_details(self, pool_address: str) -> Dict:
        """Fetch DYN pool details for a specific pool address with rate limit handling"""
        max_retries = 3
        base_delay = 2  # Base delay in seconds
        
        for retry in range(max_retries):
            try:
                # GraphQL query to get pool details
                query = f"""
                    query DynPoolDetails {{
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
                            feeGrowthGlobalX
                            feeGrowthGlobalY
                        }}
                    }}
                """
                
                # Add delay before request to avoid rate limits
                if retry > 0:
                    # Exponential backoff with jitter
                    delay = base_delay * (2 ** retry) + random.uniform(0, 1)
                    logger.info(f"Retry {retry+1}/{max_retries} after {delay:.2f}s delay")
                    await asyncio.sleep(delay)
                
                # Make the API request to get pool details
                async with aiohttp.ClientSession() as session:
                    async with session.post(
                        f"https://programs.shyft.to/v0/graphql/accounts?api_key={self.shyft_api_key}&network=mainnet-beta",
                        json={
                            "query": query,
                            "variables": {},
                            "operationName": "DynPoolDetails"
                        },
                        headers={"Content-Type": "application/json"}
                    ) as response:
                        response_text = await response.text()
                        
                        # Check for rate limit errors
                        if "RateLimitExceeded" in response_text:
                            if retry < max_retries - 1:
                                logger.warning(f"Rate limit exceeded, retrying in {base_delay * (2 ** (retry+1))}s...")
                                continue
                            else:
                                logger.error(f"Rate limit exceeded after {max_retries} retries")
                                # Return empty dict but don't fail completely
                                return {}
                        
                        if response.status != 200:
                            logger.error(f"Failed to fetch DYN pool details: {response_text}")
                            if retry < max_retries - 1:
                                continue
                            return {}
                        
                        result = await response.json()
                        
                        if "errors" in result:
                            error_msg = str(result['errors'])
                            logger.error(f"GraphQL errors: {error_msg}")
                            
                            # Check for rate limit errors in the error message
                            if "rate limit" in error_msg.lower() or "quota" in error_msg.lower():
                                if retry < max_retries - 1:
                                    logger.warning(f"Rate limit error, retrying in {base_delay * (2 ** (retry+1))}s...")
                                    continue
                            
                            return {}
                        
                        if "data" in result and "meteora_dyn_Pool" in result["data"] and len(result["data"]["meteora_dyn_Pool"]) > 0:
                            pool_data = result["data"]["meteora_dyn_Pool"][0]
                            
                            # Add token names based on token mints
                            token_x_mint = pool_data.get('tokenX', '')
                            token_y_mint = pool_data.get('tokenY', '')
                            
                            token_x_name = "Unknown"
                            token_y_name = "Unknown"
                            
                            for token_name, token_mint in self.token_mints.items():
                                if token_mint == token_x_mint:
                                    token_x_name = token_name
                                if token_mint == token_y_mint:
                                    token_y_name = token_name
                            
                            pool_data['tokenXName'] = token_x_name
                            pool_data['tokenYName'] = token_y_name
                            
                            return pool_data
                        
                        return {}
                        
            except Exception as e:
                logger.error(f"Error fetching DYN pool details: {e}")
                if retry < max_retries - 1:
                    continue
                return {}
        
        return {}  # Return empty dict if all retries failed
    
    async def get_pool_statistics(self, pool_address: str, pool_type: str = None) -> Dict:
        """
        Get statistics for a specific pool
        
        Args:
            pool_address: The address of the pool
            pool_type: The type of pool (DLMM or DYN). If not provided, will attempt to detect.
            
        Returns:
            Dictionary with pool statistics
        """
        try:
            logger.info(f"Calculating statistics for pool: {pool_address}")
            
            # Determine pool type if not provided
            if not pool_type:
                pool_type = await self.detect_pool_type(pool_address)
                
            if not pool_type:
                logger.error(f"Could not determine pool type for {pool_address}")
                return {}
                
            # Get all positions for the pool
            positions = await self.get_all_positions_for_pool(pool_address, pool_type)
            
            if not positions:
                logger.warning(f"No positions found for pool {pool_address}")
                return {
                    "poolAddress": pool_address,
                    "poolType": pool_type,
                    "positionCount": 0,
                    "uniqueWallets": 0,
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }
            
            # Get pool details
            if pool_type.upper() == "DLMM":
                pool_details = await self.fetch_lb_pair_details(pool_address)
            else:
                pool_details = await self.fetch_dyn_pool_details(pool_address)
            
            # Calculate statistics
            unique_wallets = set()
            for position in positions:
                unique_wallets.add(position.get('owner', ''))
            
            # Create statistics object
            statistics = {
                "poolAddress": pool_address,
                "poolType": pool_type,
                "positionCount": len(positions),
                "uniqueWallets": len(unique_wallets),
                "poolDetails": pool_details,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
            
            # Add token-specific information if available
            if pool_details:
                if pool_type.upper() == "DLMM":
                    statistics["token0"] = pool_details.get('tokenXName', 'Unknown')
                    statistics["token1"] = pool_details.get('tokenYName', 'Unknown')
                    statistics["reserveX"] = pool_details.get('reserveX', 0)
                    statistics["reserveY"] = pool_details.get('reserveY', 0)
                else:
                    statistics["token0"] = pool_details.get('tokenXName', 'Unknown')
                    statistics["token1"] = pool_details.get('tokenYName', 'Unknown')
                    statistics["liquidity"] = pool_details.get('liquidity', 0)
            
            logger.info(f"Statistics for pool {pool_address}: {len(positions)} positions, {len(unique_wallets)} unique wallets")
            return statistics
            
        except Exception as e:
            logger.error(f"Error calculating pool statistics: {e}")
            return {}

async def main():
    """Main function to run the pool mapper"""
    try:
        # Parse command line arguments
        import argparse
        parser = argparse.ArgumentParser(description='Get LP positions for a specific pool')
        parser.add_argument('pool_address', help='The address of the pool to analyze')
        parser.add_argument('--type', choices=['DLMM', 'DYN'], help='The type of pool (DLMM or DYN)')
        parser.add_argument('--stats', action='store_true', help='Get pool statistics instead of positions')
        parser.add_argument('--output', help='Output file path for JSON results')
        args = parser.parse_args()
        
        # Initialize the pool mapper
        mapper = PoolMapper()
        
        # Get positions or statistics based on arguments
        if args.stats:
            result = await mapper.get_pool_statistics(args.pool_address, args.type)
        else:
            result = await mapper.get_all_positions_for_pool(args.pool_address, args.type)
        
        # Output results
        if args.output:
            with open(args.output, 'w') as f:
                json.dump(result, f, indent=2)
            logger.info(f"Results saved to {args.output}")
        else:
            print(json.dumps(result, indent=2))
        
        return result
    except Exception as e:
        logger.error(f"Unhandled error in main function: {e}")
        return {"status": "error", "message": str(e)}

if __name__ == "__main__":
    asyncio.run(main())
