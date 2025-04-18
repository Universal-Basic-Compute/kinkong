import os
import sys
import json
import traceback
from datetime import datetime, timezone
import asyncio

# Set Windows event loop policy
if os.name == 'nt':  # Windows
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
import requests
from airtable import Airtable
from dotenv import load_dotenv
import asyncio
from typing import List, Dict, Optional, Any
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
        load_dotenv()
        self.base_id = os.getenv('KINKONG_AIRTABLE_BASE_ID')
        self.api_key = os.getenv('KINKONG_AIRTABLE_API_KEY')
        
        # Make sure these are properly initialized
        if not self.base_id or not self.api_key:
            raise ValueError("Missing Airtable credentials in environment variables")
        
        # Initialize Airtable tables
        self.tokens_table = Airtable(self.base_id, 'TOKENS', self.api_key)
        self.snapshots_table = Airtable(self.base_id, 'TOKEN_SNAPSHOTS', self.api_key)
        self.birdeye_api_key = os.getenv('BIRDEYE_API_KEY')
        
        # Initialize logger
        self.logger = logging.getLogger(__name__)
        
        # Log initialization info
        self.logger.info(f"TokenSnapshotTaker initialized with base_id: {self.base_id[:5]}...")
        self.logger.info(f"Snapshots table type: {type(self.snapshots_table)}")

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
            
            # Get current values from snapshot
            volume24h = float(snapshot.get('volume24h', 0))
            current_price = float(snapshot.get('price', 0))
            
            # Get 7-day historical data for token
            seven_days_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
            try:
                # Debug the Airtable object
                self.logger.info(f"Fetching historical snapshots for {token_name}")
                
                # Use get_all with formula
                historical_snapshots = self.snapshots_table.get_all(
                    formula=f"AND({{token}}='{token_name}', IS_AFTER({{createdAt}}, '{seven_days_ago}'))"
                )
                self.logger.info(f"Found {len(historical_snapshots)} historical snapshots")
            except Exception as e:
                self.logger.error(f"Error fetching historical snapshots: {e}")
                self.logger.error(traceback.format_exc())
                historical_snapshots = []
            
            # Get SOL historical data
            try:
                self.logger.info("Fetching SOL historical data")
                
                # Use get_all with formula
                sol_snapshots = self.snapshots_table.get_all(
                    formula=f"AND({{token}}='SOL', IS_AFTER({{createdAt}}, '{seven_days_ago}'))"
                )
                self.logger.info(f"Found {len(sol_snapshots)} SOL historical snapshots")
            except Exception as e:
                self.logger.error(f"Error fetching SOL snapshots: {e}")
                self.logger.error(traceback.format_exc())
                sol_snapshots = []
            
            # Calculate metrics
            if historical_snapshots and sol_snapshots:
                # Token metrics
                volumes = [float(snap['fields'].get('volume24h', 0)) for snap in historical_snapshots]
                prices = [float(snap['fields'].get('price', 0)) for snap in historical_snapshots]
                
                # SOL metrics
                sol_prices = [float(snap['fields'].get('price', 0)) for snap in sol_snapshots]
                
                # Basic averages
                volume7d = sum(volumes) / len(volumes)
                price7dAvg = sum(prices) / len(prices)
                
                # Calculate trends
                volume_growth = ((volume24h - volume7d) / volume7d * 100) if volume7d > 0 else 0
                price_trend = ((current_price - price7dAvg) / price7dAvg * 100) if price7dAvg > 0 else 0
                
                # Calculate volatility
                if len(prices) > 1:
                    price_changes = [(prices[i] - prices[i-1])/prices[i-1] * 100 for i in range(1, len(prices))]
                    mean_change = sum(price_changes) / len(price_changes)
                    squared_diff = sum((x - mean_change) ** 2 for x in price_changes)
                    volatility = (squared_diff / len(price_changes)) ** 0.5
                else:
                    volatility = 0
                    
                # Calculate vs SOL performance
                if len(prices) > 1 and len(sol_prices) > 1:
                    # Get first and last prices for both
                    token_start_price = prices[0]
                    token_end_price = prices[-1]
                    sol_start_price = sol_prices[0]
                    sol_end_price = sol_prices[-1]
                    
                    # Calculate percentage changes
                    token_return = ((token_end_price - token_start_price) / token_start_price) * 100
                    sol_return = ((sol_end_price - sol_start_price) / sol_start_price) * 100
                    
                    # Calculate relative performance
                    vs_sol_performance = token_return - sol_return
                else:
                    vs_sol_performance = 0
                    
            else:
                volume7d = volume24h
                price7dAvg = current_price
                volume_growth = 0
                price_trend = 0
                volatility = 0
                vs_sol_performance = 0
                
            metrics = {
                'volume7d': volume7d,
                'volumeGrowth': volume_growth,
                'price7dAvg': price7dAvg,
                'priceTrend': price_trend,
                'priceVolatility': volatility,
                'vsSolPerformance': vs_sol_performance
            }
            
            self.logger.info(f"Metrics calculated for {token_name}:")
            self.logger.info(json.dumps(metrics, indent=2))
            
            return metrics
            
        except Exception as e:
            self.logger.error(f"Error calculating metrics for {token['fields'].get('token')}: {e}")
            return {}

    async def take_snapshot_for_token(self, token_symbol: str) -> Optional[Dict]:
        """Take snapshot for a specific token by symbol
        
        Args:
            token_symbol: The token symbol to take snapshot for
            
        Returns:
            The created snapshot record or None if failed
        """
        try:
            logger.info(f"\n📸 Taking snapshot for token: {token_symbol}")
            
            # Get token from TOKENS table
            token_records = self.tokens_table.get_all(
                formula=f"{{token}}='{token_symbol}'"
            )
            
            if not token_records:
                logger.error(f"Token {token_symbol} not found in database")
                return None
                
            token = token_records[0]
            
            # Current timestamp
            created_at = datetime.now(timezone.utc).isoformat()
            
            token_name = token['fields'].get('token')
            mint = token['fields'].get('mint')
            
            if not token_name or not mint:
                logger.error(f"Token {token_symbol} has missing data (name or mint)")
                return None
                
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
            
            # Log snapshot details
            self.logger.info(f"Created snapshot for {token_name}:")
            self.logger.info(f"Price: ${metrics['price']:.6f}")
            self.logger.info(f"24h Volume: ${metrics['volume24h']:,.2f}")
            
            # Calculate additional metrics using snapshot data
            calculated_metrics = await self.calculate_metrics(token, snapshot)
            
            # Update snapshot with calculated metrics
            snapshot.update(calculated_metrics)
            
            # Save snapshot with error handling
            try:
                record = self.snapshots_table.insert(snapshot)
                logger.info(f"✅ Snapshot saved for {token_name}")
            except Exception as e:
                logger.error(f"❌ Error saving snapshot for {token_name}: {e}")
                logger.error(traceback.format_exc())
                return None
            
            # Return the created snapshot with record ID
            snapshot['id'] = record['id']
            return snapshot
            
        except Exception as e:
            logger.error(f"❌ Error taking snapshot for {token_symbol}: {e}")
            return None

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
                    snapshot.update(calculated_metrics)  # Just add the new metrics to existing snapshot
                    
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
            'KINKONG_AIRTABLE_API_KEY',
            'BIRDEYE_API_KEY'
        ]
        
        missing = [var for var in required_vars if not os.getenv(var)]
        if missing:
            raise ValueError(f"Missing environment variables: {', '.join(missing)}")

        # Initialize snapshot taker
        snapshot_taker = TokenSnapshotTaker()
        
        # Check if a specific token was provided as argument
        if len(sys.argv) > 1:
            token_symbol = sys.argv[1].upper()
            logger.info(f"Taking snapshot for specific token: {token_symbol}")
            
            # Take snapshot for the specified token
            snapshot = await snapshot_taker.take_snapshot_for_token(token_symbol)
            
            if snapshot:
                logger.info(f"✅ Successfully created snapshot for {token_symbol}")
                # Print snapshot details
                logger.info(f"Snapshot details:")
                logger.info(f"Price: ${snapshot['price']:.6f}")
                logger.info(f"24h Volume: ${snapshot['volume24h']:,.2f}")
                logger.info(f"Liquidity: ${snapshot['liquidity']:,.2f}")
                logger.info(f"24h Price Change: {snapshot['priceChange24h']:+.2f}%")
                if 'volume7d' in snapshot:
                    logger.info(f"7d Avg Volume: ${snapshot['volume7d']:,.2f}")
                if 'volumeGrowth' in snapshot:
                    logger.info(f"Volume Growth: {snapshot['volumeGrowth']:+.2f}%")
                
                # Return success
                sys.exit(0)
            else:
                logger.error(f"❌ Failed to create snapshot for {token_symbol}")
                sys.exit(1)
        else:
            # Take snapshots for all active tokens
            await snapshot_taker.take_snapshot()
            logger.info("\n✅ Token snapshots completed for all active tokens")
            sys.exit(0)

    except Exception as e:
        logger.error(f"\n❌ Script failed: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except Exception as e:
        print(f"Fatal error: {e}")
        sys.exit(1)
