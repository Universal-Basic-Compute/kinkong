import os
import json
from datetime import datetime, timezone
import requests
from airtable import Airtable
from dotenv import load_dotenv
import asyncio
from typing import List, Dict, Optional
from datetime import timedelta
import logging

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)

class TokenSnapshotTaker:
    def __init__(self):
        self.base_id = os.getenv('KINKONG_AIRTABLE_BASE_ID')
        self.api_key = os.getenv('KINKONG_AIRTABLE_API_KEY')
        self.tokens_table = Airtable(self.base_id, 'TOKENS', self.api_key)
        self.snapshots_table = Airtable(
            os.getenv('KINKONG_AIRTABLE_BASE_ID'),
            'TOKEN_SNAPSHOTS',
            os.getenv('KINKONG_AIRTABLE_API_KEY')
        )
        self.birdeye_api_key = os.getenv('BIRDEYE_API_KEY')
        # Initialize logger
        self.logger = logging.getLogger(__name__)

    def get_active_tokens(self) -> List[Dict]:
        """Get all active tokens from Airtable"""
        try:
            records = self.tokens_table.get_all(
                formula="{isActive}=1"
            )
            return records
        except Exception as e:
            print(f"Error fetching active tokens: {str(e)}")
            return []

    def get_token_price(self, token_mint: str) -> dict:
        """Get current token metrics from DexScreener"""
        try:
            url = f"https://api.dexscreener.com/latest/dex/tokens/{token_mint}"
            headers = {
                'User-Agent': 'Mozilla/5.0',
                'Accept': 'application/json'
            }
            
            print(f"\nFetching DexScreener data for {token_mint}")
            response = requests.get(url, headers=headers)
            
            if response.ok:
                data = response.json()
                
                if not data.get('pairs'):
                    print(f"No pairs found for token {token_mint}")
                    return {
                        'price': 0,
                        'volume24h': 0,
                        'liquidity': 0,
                        'priceChange24h': 0
                    }
                    
                # Get all Solana pairs
                sol_pairs = [p for p in data['pairs'] if p.get('chainId') == 'solana']
                if not sol_pairs:
                    print(f"No Solana pairs found for token {token_mint}")
                    return {
                        'price': 0,
                        'volume24h': 0,
                        'liquidity': 0,
                        'priceChange24h': 0
                    }
                
                # Get the most liquid pair
                main_pair = max(sol_pairs, key=lambda x: float(x.get('liquidity', {}).get('usd', 0) or 0))
                
                # Calculate totals across all pairs
                total_volume = sum(float(p.get('volume', {}).get('h24', 0) or 0) for p in sol_pairs)
                total_liquidity = sum(float(p.get('liquidity', {}).get('usd', 0) or 0) for p in sol_pairs)
                
                # Get price and change from main pair
                price = float(main_pair.get('priceUsd', 0) or 0)
                price_change = float(main_pair.get('priceChange', {}).get('h24', 0) or 0)
                
                print(f"Found {len(sol_pairs)} Solana pairs")
                print(f"Price: ${price:.4f}")
                print(f"24h Volume: ${total_volume:,.2f}")
                print(f"Liquidity: ${total_liquidity:,.2f}")
                print(f"24h Change: {price_change:.2f}%")
                
                return {
                    'price': price,
                    'volume24h': total_volume,
                    'liquidity': total_liquidity,
                    'priceChange24h': price_change
                }
                
            else:
                print(f"DexScreener API error: {response.status_code}")
                print(f"Response: {response.text}")
                return {
                    'price': 0,
                    'volume24h': 0,
                    'liquidity': 0,
                    'priceChange24h': 0
                }
                
        except Exception as e:
            print(f"Error getting metrics for {token_mint}: {e}")
            return {
                'price': 0,
                'volume24h': 0,
                'liquidity': 0,
                'priceChange24h': 0
            }

    async def calculate_volume_growth(self, token: str, volume24h: float, volume7d: float) -> float:
        """Calculate volume growth percentage comparing 24h to 7d average"""
        try:
            if volume7d <= 0:
                self.logger.warning(f"No 7-day volume data for {token}")
                return 0
                
            # Calculate growth percentage
            growth = ((volume24h - volume7d) / volume7d) * 100
                
            self.logger.info(f"Volume growth for {token}:")
            self.logger.info(f"Latest 24h volume: ${volume24h:,.2f}")
            self.logger.info(f"7-day average volume: ${volume7d:,.2f}")
            self.logger.info(f"Growth: {growth:+.2f}%")
            
            return growth
            
        except Exception as e:
            self.logger.error(f"Error calculating volume growth for {token}: {e}")
            return 0

    async def calculate_metrics(self, token: Dict, snapshot: Dict) -> Dict:
        """Calculate all metrics for a token"""
        try:
            token_name = token['fields'].get('token')
            if not token_name:
                return {}
                
            self.logger.info(f"\nCalculating metrics for {token_name}...")
            
            # Get values from current snapshot
            volume24h = float(snapshot.get('volume24h', 0))
            
            # Get 7-day average volume from historical snapshots
            seven_days_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
            historical_snapshots = self.snapshots_table.get_all(
                formula=f"AND({{token}}='{token_name}', IS_AFTER({{createdAt}}, '{seven_days_ago}'))"
            )
            
            if historical_snapshots:
                volumes = [float(snap['fields'].get('volume24h', 0)) for snap in historical_snapshots]
                volume7d = sum(volumes) / len(volumes)
            else:
                volume7d = volume24h  # Use current volume if no history
                
            # Now calculate volume growth using both values
            volume_growth = await self.calculate_volume_growth(token_name, volume24h, volume7d)
            
            metrics = {
                'volumeGrowth': volume_growth
            }
            
            self.logger.info(f"Metrics calculated for {token_name}:")
            self.logger.info(json.dumps(metrics, indent=2))
            
            return metrics
            
        except Exception as e:
            self.logger.error(f"Error calculating metrics for {token['fields'].get('token')}: {e}")
            return {}

    async def take_snapshot(self):
        """Take snapshots of all active tokens"""
        try:
            logger.info("\n📸 Taking token snapshots...")
            
            # Get active tokens
            active_tokens = self.get_active_tokens()
            logger.info(f"\nFound {len(active_tokens)} active tokens")
            
            # Current timestamp
            created_at = datetime.now(timezone.utc).isoformat()
            
            # Create snapshots for each token
            for token in active_tokens:
                try:
                    token_name = token['fields'].get('token')
                    mint = token['fields'].get('mint')
                    
                    if not token_name or not mint:
                        continue
                        
                    logger.info(f"\nProcessing {token_name}...")
                    
                    # Get current metrics
                    metrics = self.get_token_price(mint)
                    
                    # Create snapshot
                    snapshot = {
                        'token': token_name,
                        'price': metrics['price'],
                        'volume24h': metrics['volume24h'],
                        'liquidity': metrics['liquidity'],
                        'priceChange24h': metrics['priceChange24h'],
                        'createdAt': created_at,
                        'isActive': True
                    }
                    
                    # Calculate additional metrics using snapshot data
                    calculated_metrics = await self.calculate_metrics(token, snapshot)
                    
                    # Update snapshot with calculated metrics
                    snapshot.update({
                        'token': token_name,
                        'price': metrics['price'],
                        'volume24h': metrics['volume24h'],
                        'liquidity': metrics['liquidity'],
                        'priceChange24h': metrics['priceChange24h'],
                        'createdAt': created_at,
                        'isActive': True,
                        **calculated_metrics  # Add calculated metrics
                    })
                    
                    # Save snapshot
                    self.snapshots_table.insert(snapshot)
                    logger.info(f"✅ Snapshot saved for {token_name}")
                    
                except Exception as e:
                    logger.error(f"❌ Error processing {token_name}: {e}")
                    continue
            
            logger.info("\n✅ Token snapshots completed")
            
        except Exception as e:
            logger.error(f"Error taking snapshots: {str(e)}")

async def main():
    try:
        # Verify environment variables
        required_vars = [
            'KINKONG_AIRTABLE_BASE_ID',
            'KINKONG_AIRTABLE_API_KEY'
        ]
        
        missing = [var for var in required_vars if not os.getenv(var)]
        if missing:
            raise Exception(f"Missing environment variables: {', '.join(missing)}")

        # Take snapshots
        snapshot_taker = TokenSnapshotTaker()
        await snapshot_taker.take_snapshot()

    except Exception as e:
        print(f"\n❌ Script failed: {str(e)}")
        exit(1)

if __name__ == "__main__":
    asyncio.run(main())
