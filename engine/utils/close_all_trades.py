import sys
from pathlib import Path
import asyncio
import os
from datetime import datetime, timezone
from airtable import Airtable
from dotenv import load_dotenv
import logging

# Add project root to Python path
project_root = str(Path(__file__).parent.parent.parent.absolute())
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from engine.trades import TradeExecutor

def setup_logging():
    """Configure logging"""
    logger = logging.getLogger(__name__)
    logger.setLevel(logging.INFO)
    
    # Console handler
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(logging.Formatter(
        '%(asctime)s - %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    ))
    
    if not logger.handlers:
        logger.addHandler(console_handler)
    
    return logger

logger = setup_logging()

async def close_all_trades():
    """Close all executed trades"""
    try:
        logger.info("🔄 Starting emergency trade closure process...")
        
        # Initialize TradeExecutor
        executor = TradeExecutor()
        
        # Get all executed trades
        active_trades = executor.trades_table.get_all(
            formula="status='EXECUTED'"
        )
        
        logger.info(f"Found {len(active_trades)} active trades to close")
        
        # Close each trade
        for trade in active_trades:
            try:
                logger.info(f"\nClosing trade for {trade['fields'].get('token')}...")
                
                success = await executor.close_trade(
                    trade=trade,
                    exit_reason="EMERGENCY_CLOSURE"
                )
                
                if success:
                    logger.info(f"✅ Successfully closed trade {trade['id']}")
                else:
                    logger.error(f"❌ Failed to close trade {trade['id']}")
                    
                # Add delay between trades
                await asyncio.sleep(2)
                
            except Exception as e:
                logger.error(f"Error closing trade {trade['id']}: {e}")
                continue
        
        logger.info("\n🏁 Trade closure process completed")
        
    except Exception as e:
        logger.error(f"Fatal error in close_all_trades: {e}")
        raise

def main():
    try:
        # Load environment variables
        load_dotenv()
        
        # Verify required environment variables
        required_vars = [
            'KINKONG_AIRTABLE_BASE_ID',
            'KINKONG_AIRTABLE_API_KEY',
            'BIRDEYE_API_KEY',
            'STRATEGY_WALLET_PRIVATE_KEY'
        ]
        
        missing = [var for var in required_vars if not os.getenv(var)]
        if missing:
            raise ValueError(f"Missing environment variables: {', '.join(missing)}")
            
        # Run the async function
        asyncio.run(close_all_trades())
        
    except Exception as e:
        logger.error(f"Script failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
