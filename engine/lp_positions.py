import sys
from pathlib import Path
import os
import asyncio
import json
import logging
from typing import List, Dict, Optional
from datetime import datetime, timezone
import aiohttp
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
        self.wallet_address = os.getenv('STRATEGY_WALLET_PUBLIC_KEY')
        
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
            "UBC": "UBCgZu1mAkwBqHKzR5vUjNFPMxYFy3mEAQmXQZxDqQV",
            "COMPUTE": "COMPkZjd5pJECCJXkX8c6NykNDccpVpPmkb7CEW5ekKQ"
        }

    async def deactivate_existing_positions(self):
        """Deactivate all existing LP positions"""
        try:
            # Get all active positions
            active_positions = self.positions_table.get_all(
                formula="active=TRUE()"
            )
            
            self.logger.info(f"Found {len(active_positions)} active positions to deactivate")
            
            # Update each position to inactive
            for position in active_positions:
                self.positions_table.update(
                    position['id'],
                    {'active': False, 'updatedAt': datetime.now(timezone.utc).isoformat()}
                )
                
            self.logger.info(f"Successfully deactivated {len(active_positions)} positions")
            
        except Exception as e:
            self.logger.error(f"Error deactivating existing positions: {e}")
            raise

    async def fetch_dlmm_positions(self, pool_address: str) -> List[Dict]:
        """Fetch DLMM positions for a specific pool"""
        try:
            # Use Kamino API to fetch DLMM positions
            url = f"https://api.kamino.finance/v2/dlmm/positions?address={pool_address}&owner={self.wallet_address}"
            
            async with aiohttp.ClientSession() as session:
                async with session.get(url) as response:
                    if response.status != 200:
                        self.logger.error(f"Failed to fetch DLMM positions: {await response.text()}")
                        return []
                    
                    data = await response.json()
                    positions = data.get('positions', [])
                    
                    self.logger.info(f"Found {len(positions)} DLMM positions for pool {pool_address}")
                    return positions
                    
        except Exception as e:
            self.logger.error(f"Error fetching DLMM positions: {e}")
            return []

    async def fetch_dyn_positions(self, pool_address: str) -> List[Dict]:
        """Fetch DYN positions for a specific pool"""
        try:
            # Use Meteora API to fetch DYN positions
            url = f"https://api.meteora.ag/v1/pools/{pool_address}/positions?owner={self.wallet_address}"
            
            async with aiohttp.ClientSession() as session:
                async with session.get(url) as response:
                    if response.status != 200:
                        self.logger.error(f"Failed to fetch DYN positions: {await response.text()}")
                        return []
                    
                    data = await response.json()
                    positions = data.get('positions', [])
                    
                    self.logger.info(f"Found {len(positions)} DYN positions for pool {pool_address}")
                    return positions
                    
        except Exception as e:
            self.logger.error(f"Error fetching DYN positions: {e}")
            return []

    async def fetch_positions_for_pool(self, pool: Dict) -> List[Dict]:
        """Fetch positions for a specific pool based on its type"""
        pool_address = pool['address']
        pool_type = pool['type']
        
        if pool_type == "DLMM":
            return await self.fetch_dlmm_positions(pool_address)
        elif pool_type == "DYN":
            return await self.fetch_dyn_positions(pool_address)
        else:
            self.logger.error(f"Unknown pool type: {pool_type}")
            return []

    def normalize_dlmm_position(self, position: Dict, pool: Dict) -> Dict:
        """Normalize DLMM position data"""
        try:
            # Extract token amounts and USD values
            token0_amount = float(position.get('token0Amount', 0))
            token1_amount = float(position.get('token1Amount', 0))
            token0_usd = float(position.get('token0AmountUsd', 0))
            token1_usd = float(position.get('token1AmountUsd', 0))
            total_value_usd = token0_usd + token1_usd
            
            # Calculate fees if available
            fees_usd = float(position.get('feesUsd', 0))
            
            # Get position bounds
            lower_bound = position.get('lowerBound', 0)
            upper_bound = position.get('upperBound', 0)
            
            # Get current price if available
            current_price = position.get('currentPrice', 0)
            
            return {
                'poolAddress': pool['address'],
                'poolName': pool['name'],
                'poolType': pool['type'],
                'token0': pool['token0'],
                'token1': pool['token1'],
                'positionAddress': position.get('address', ''),
                'token0Amount': token0_amount,
                'token1Amount': token1_amount,
                'token0ValueUsd': token0_usd,
                'token1ValueUsd': token1_usd,
                'totalValueUsd': total_value_usd,
                'feesUsd': fees_usd,
                'lowerBound': lower_bound,
                'upperBound': upper_bound,
                'currentPrice': current_price,
                'active': True,
                'createdAt': datetime.now(timezone.utc).isoformat(),
                'updatedAt': datetime.now(timezone.utc).isoformat()
            }
        except Exception as e:
            self.logger.error(f"Error normalizing DLMM position: {e}")
            return {}

    def normalize_dyn_position(self, position: Dict, pool: Dict) -> Dict:
        """Normalize DYN position data"""
        try:
            # Extract token amounts and USD values
            token0_amount = float(position.get('token0', {}).get('amount', 0))
            token1_amount = float(position.get('token1', {}).get('amount', 0))
            token0_usd = float(position.get('token0', {}).get('usdValue', 0))
            token1_usd = float(position.get('token1', {}).get('usdValue', 0))
            total_value_usd = token0_usd + token1_usd
            
            # Get fees if available
            fees_usd = float(position.get('feesUsd', 0))
            
            # Get position bounds if available
            lower_bound = position.get('lowerPrice', 0)
            upper_bound = position.get('upperPrice', 0)
            
            # Get current price if available
            current_price = position.get('currentPrice', 0)
            
            return {
                'poolAddress': pool['address'],
                'poolName': pool['name'],
                'poolType': pool['type'],
                'token0': pool['token0'],
                'token1': pool['token1'],
                'positionAddress': position.get('address', position.get('positionAddress', '')),
                'token0Amount': token0_amount,
                'token1Amount': token1_amount,
                'token0ValueUsd': token0_usd,
                'token1ValueUsd': token1_usd,
                'totalValueUsd': total_value_usd,
                'feesUsd': fees_usd,
                'lowerBound': lower_bound,
                'upperBound': upper_bound,
                'currentPrice': current_price,
                'active': True,
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
                
            # Check if position already exists by address
            existing_positions = self.positions_table.get_all(
                formula=f"positionAddress='{position_data['positionAddress']}'"
            )
            
            if existing_positions:
                # Update existing position
                self.logger.info(f"Updating existing position: {position_data['positionAddress']}")
                position_data['updatedAt'] = datetime.now(timezone.utc).isoformat()
                self.positions_table.update(existing_positions[0]['id'], position_data)
            else:
                # Create new position
                self.logger.info(f"Creating new position: {position_data['positionAddress']}")
                self.positions_table.insert(position_data)
                
        except Exception as e:
            self.logger.error(f"Error saving position: {e}")

    async def process_all_positions(self):
        """Process all positions for all pools"""
        try:
            # First deactivate all existing positions
            await self.deactivate_existing_positions()
            
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
                
                # Small delay between pools
                await asyncio.sleep(1)
                
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
