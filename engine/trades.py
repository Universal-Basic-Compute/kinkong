import sys
from pathlib import Path
import os
from datetime import datetime, timezone
import asyncio
import aiohttp
from airtable import Airtable
from dotenv import load_dotenv
import json
import logging
from typing import List, Dict, Optional

# Get absolute path to project root and .env file
project_root = Path(__file__).parent.parent.absolute()
env_path = project_root / '.env'

# Load environment variables with explicit path
load_dotenv(dotenv_path=env_path)

# Add debug prints
print("\nEnvironment variables loaded from:", env_path)
print(f"AIRTABLE_BASE_ID: {'✓' if os.getenv('KINKONG_AIRTABLE_BASE_ID') else '✗'}")
print(f"AIRTABLE_API_KEY: {'✓' if os.getenv('KINKONG_AIRTABLE_API_KEY') else '✗'}")
print(f"BIRDEYE_API_KEY: {'✓' if os.getenv('BIRDEYE_API_KEY') else '✗'}")

# Add project root to Python path
project_root = str(Path(__file__).parent.parent.absolute())
if project_root not in sys.path:
    sys.path.insert(0, project_root)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)

class TradeExecutor:
    def __init__(self):
        load_dotenv()
        self.base_id = os.getenv('KINKONG_AIRTABLE_BASE_ID')
        self.api_key = os.getenv('KINKONG_AIRTABLE_API_KEY')
        self.signals_table = Airtable(self.base_id, 'SIGNALS', self.api_key)
        self.trades_table = Airtable(self.base_id, 'TRADES', self.api_key)

    async def get_active_buy_signals(self) -> List[Dict]:
        """Get all non-expired BUY signals"""
        try:
            now = datetime.now(timezone.utc).isoformat()
            
            # Get BUY signals that haven't expired and haven't been executed
            signals = self.signals_table.get_all(
                formula=f"AND("
                f"{{type}}='BUY', "
                f"IS_AFTER({{expiryDate}}, '{now}'), "
                f"OR({{status}}='PENDING', {{status}}=''))"
            )
            
            logger.info(f"Found {len(signals)} active BUY signals")
            return signals
            
        except Exception as e:
            logger.error(f"Error fetching active signals: {e}")
            return []

    async def check_entry_conditions(self, signal: Dict) -> bool:
        """Check if entry conditions are met for a signal"""
        try:
            # Get current price from Birdeye API
            token_mint = signal['fields'].get('mint')
            if not token_mint:
                logger.warning(f"No mint address for signal {signal['id']}")
                return False

            current_price = await self.get_current_price(token_mint)
            if not current_price:
                return False

            entry_price = float(signal['fields'].get('entryPrice', 0))
            
            # Check if price is within 1% of entry price
            price_diff = abs(current_price - entry_price) / entry_price
            meets_conditions = price_diff <= 0.01

            logger.info(f"Signal {signal['id']} entry check:")
            logger.info(f"Entry price: {entry_price}")
            logger.info(f"Current price: {current_price}")
            logger.info(f"Price difference: {price_diff:.2%}")
            logger.info(f"Meets conditions: {meets_conditions}")

            return meets_conditions

        except Exception as e:
            logger.error(f"Error checking entry conditions: {e}")
            return False

    async def get_current_price(self, token_mint: str) -> Optional[float]:
        """Get current token price from Birdeye"""
        try:
            url = f"https://public-api.birdeye.so/public/price?address={token_mint}"
            headers = {
                'x-api-key': os.getenv('BIRDEYE_API_KEY'),
                'accept': 'application/json'
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.get(url, headers=headers) as response:
                    if response.status == 200:
                        data = await response.json()
                        if data.get('success'):
                            return float(data['data']['value'])
                    
                    logger.warning(f"Failed to get price for {token_mint}")
                    return None

        except Exception as e:
            logger.error(f"Error getting price: {e}")
            return None

    async def execute_trade(self, signal: Dict) -> bool:
        """Execute a trade for a signal"""
        try:
            # First check if trade already exists for this signal
            existing_trades = self.trades_table.get_all(
                formula=f"{{signalId}} = '{signal['id']}'"
            )
            
            if existing_trades:
                logger.warning(f"Trade already exists for signal {signal['id']}")
                return False

            # Create trade record
            trade_data = {
                'signalId': signal['id'],
                'token': signal['fields']['token'],
                'type': 'BUY',
                'timeframe': signal['fields']['timeframe'],
                'status': 'PENDING',
                'entryPrice': float(signal['fields']['entryPrice']),
                'targetPrice': float(signal['fields']['targetPrice']),
                'stopLoss': float(signal['fields']['stopLoss']),
                'createdAt': datetime.now(timezone.utc).isoformat(),
                'amount': 0,  # Will be updated after execution
                'entryValue': 0  # Will be updated after execution
            }
            
            # Create trade record
            trade = self.trades_table.insert(trade_data)
            logger.info(f"Created trade record: {trade['id']}")

            # Update signal status
            self.signals_table.update(signal['id'], {
                'status': 'ACTIVE',
                'tradeId': trade['id']
            })
            
            # TODO: Implement actual trade execution logic here
            # This would integrate with your trading infrastructure
            
            return True

        except Exception as e:
            logger.error(f"Error executing trade: {e}")
            return False

    async def monitor_signals(self):
        """Main loop to monitor signals and execute trades"""
        try:
            while True:
                logger.info("Checking for active signals...")
                
                # Get active signals
                signals = await self.get_active_buy_signals()
                
                for signal in signals:
                    try:
                        # Check entry conditions
                        if await self.check_entry_conditions(signal):
                            logger.info(f"Entry conditions met for signal {signal['id']}")
                            
                            # Execute trade
                            if await self.execute_trade(signal):
                                logger.info(f"Successfully executed trade for signal {signal['id']}")
                            else:
                                logger.error(f"Failed to execute trade for signal {signal['id']}")
                    
                    except Exception as e:
                        logger.error(f"Error processing signal {signal['id']}: {e}")
                        continue

                # Wait before next check
                await asyncio.sleep(60)  # Check every minute

        except Exception as e:
            logger.error(f"Error in monitor loop: {e}")
            raise

def main():
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

        # Create and run trade executor
        executor = TradeExecutor()
        asyncio.run(executor.monitor_signals())

    except Exception as e:
        logger.error(f"Fatal error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
