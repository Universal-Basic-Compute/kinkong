import sys
from pathlib import Path
import os
import asyncio
from datetime import datetime
import logging
from dotenv import load_dotenv

# Get absolute path to project root and .env file
project_root = Path(__file__).parent.parent.absolute()
env_path = project_root / '.env'

# Load environment variables with explicit path
load_dotenv(dotenv_path=env_path)

# Add debug prints
print("\nEnvironment variables loaded from:", env_path)
print("Current working directory:", os.getcwd())
print("Project root:", project_root)

# Add project root to Python path
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

# Import our trade executor
from engine.execute_trade import JupiterTradeExecutor

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)

# Token addresses
USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
USDT_MINT = "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB"

async def test_usdc_usdt_swap():
    """Test a swap of 10 USDC to USDT"""
    try:
        logger.info("🚀 Starting USDC -> USDT swap test")
        
        # Initialize trade executor
        executor = JupiterTradeExecutor()
        
        # Get wallet address from environment
        wallet_address = os.getenv('STRATEGY_WALLET_ADDRESS')
        if not wallet_address:
            raise ValueError("STRATEGY_WALLET_ADDRESS not found in environment")
            
        logger.info(f"Using wallet: {wallet_address[:8]}...{wallet_address[-8:]}")
        
        # Amount to swap (10 USDC)
        amount = 10.0
        
        logger.info(f"\nGetting quote for {amount} USDC -> USDT")
        
        # Get quote
        quote = await executor.get_jupiter_quote(
            input_token=USDC_MINT,
            output_token=USDT_MINT,
            amount=amount
        )
        
        if not quote:
            raise Exception("Failed to get quote")
            
        # Log quote details
        in_amount = float(quote['inAmount']) / 1e6  # Convert from USDC decimals
        out_amount = float(quote['outAmount']) / 1e6  # Convert from USDT decimals
        price_impact = float(quote.get('priceImpactPct', 0))
        
        logger.info("\nQuote details:")
        logger.info(f"Input: {in_amount:.2f} USDC")
        logger.info(f"Output: {out_amount:.2f} USDT")
        logger.info(f"Price impact: {price_impact:.4f}%")
        logger.info(f"Rate: {out_amount/in_amount:.6f} USDT/USDC")
        
        # Get transaction
        logger.info("\nGenerating swap transaction...")
        
        transaction_bytes = await executor.get_jupiter_transaction(
            quote_data=quote,
            wallet_address=wallet_address
        )
        
        if not transaction_bytes:
            raise Exception("Failed to get transaction")
            
        logger.info("✅ Successfully generated swap transaction")
        logger.info(f"Transaction size: {len(transaction_bytes)} bytes")
        
        # Save transaction bytes to file for inspection
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"usdc_usdt_swap_{timestamp}.tx"
        
        with open(filename, "wb") as f:
            f.write(transaction_bytes)
            
        logger.info(f"\nTransaction saved to {filename}")
        logger.info("\n✅ Test completed successfully")
        
        # Note: This test only generates the transaction
        # Actual signing and sending would require private key access
        
    except Exception as e:
        logger.error(f"\n❌ Test failed: {str(e)}")
        if hasattr(e, '__traceback__'):
            import traceback
            logger.error("\nTraceback:")
            traceback.print_tb(e.__traceback__)
        raise

def main():
    try:
        # Load environment variables
        load_dotenv()
        
        # Verify required environment variables
        required_vars = ['STRATEGY_WALLET_ADDRESS']
        missing = [var for var in required_vars if not os.getenv(var)]
        
        if missing:
            raise ValueError(f"Missing environment variables: {', '.join(missing)}")
            
        # Run the test
        asyncio.run(test_usdc_usdt_swap())
        
    except Exception as e:
        logger.error(f"Script failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
