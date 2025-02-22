import sys
from pathlib import Path
import os
import asyncio
from datetime import datetime
import logging
from dotenv import load_dotenv
from solders.keypair import Keypair
from solders.transaction import Transaction
from solders.message import Message
from solana.rpc.async_api import AsyncClient
import base58

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
        
        # Get wallet address and private key from environment
        wallet_address = os.getenv('STRATEGY_WALLET')
        private_key = os.getenv('STRATEGY_WALLET_PRIVATE_KEY')
        
        if not wallet_address or not private_key:
            raise ValueError("Wallet configuration missing")
            
        # Create Solana client
        client = AsyncClient("https://api.mainnet-beta.solana.com")
        
        try:
            # Convert private key to Keypair
            private_key_bytes = base58.b58decode(private_key)
            wallet_keypair = Keypair.from_bytes(private_key_bytes)
            
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
            in_amount = float(quote['inAmount']) / 1e6
            out_amount = float(quote['outAmount']) / 1e6
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

            # Get fresh blockhash
            blockhash = await client.get_latest_blockhash()
            if not blockhash or not blockhash.value:
                raise Exception("Failed to get recent blockhash")

            # Deserialize transaction
            transaction = Transaction.from_bytes(transaction_bytes)

            # Update blockhash directly on the transaction message
            transaction.message.recent_blockhash = blockhash.value.blockhash

            # Sign transaction
            transaction.sign([wallet_keypair])

            logger.info("Sending transaction to network...")

            # Send transaction with retry logic
            max_retries = 3
            for attempt in range(max_retries):
                try:
                    result = await client.send_transaction(
                        transaction,
                        opts={
                            "skip_preflight": False,
                            "preflight_commitment": "confirmed",
                            "max_retries": 2
                        }
                    )
                    
                    if result.value:
                        logger.info(f"✅ Transaction successful!")
                        logger.info(f"Transaction signature: {result.value}")
                        logger.info(f"View on Solscan: https://solscan.io/tx/{result.value}")
                        break
                        
                except Exception as e:
                    if attempt == max_retries - 1:
                        raise
                    logger.warning(f"Attempt {attempt + 1} failed, retrying...")
                    await asyncio.sleep(1)
            
            if result.value:
                logger.info(f"✅ Transaction successful!")
                logger.info(f"Transaction signature: {result.value}")
                logger.info(f"View on Solscan: https://solscan.io/tx/{result.value}")
            else:
                raise Exception("Transaction failed to send")

        finally:
            await client.close()
            
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
        required_vars = ['STRATEGY_WALLET']
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
