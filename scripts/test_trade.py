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
from solders.instruction import AccountMeta, Instruction
from solana.rpc.async_api import AsyncClient
from solana.rpc.types import TxOpts
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
    """Test a validated swap of 10 USDC to USDT"""
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
            
            # Execute validated swap
            success = await executor.execute_validated_swap(
                input_token=USDC_MINT,
                output_token=USDT_MINT,
                amount=10.0,          # 10 USDC
                min_amount=5.0,       # Minimum 5 USDC
                max_slippage=1.0      # Maximum 1% slippage
            )
            
            if not success:
                raise Exception("Validated swap failed")

            if not transaction_bytes:
                raise Exception("Failed to get transaction")

            # Get fresh blockhash
            blockhash = await client.get_latest_blockhash()
            if not blockhash or not blockhash.value:
                raise Exception("Failed to get recent blockhash")

            # Deserialize original transaction
            original_transaction = Transaction.from_bytes(transaction_bytes)

            # Convert CompiledInstructions to Instructions
            instructions = []
            for compiled_instruction in original_transaction.message.instructions:
                # Get the program id from the accounts list
                program_id = original_transaction.message.account_keys[compiled_instruction.program_id_index]
                
                # Get header info
                header = original_transaction.message.header
                account_keys = original_transaction.message.account_keys
                
                # Calculate writable thresholds
                writable_signers = header.num_required_signatures - header.num_readonly_signed_accounts
                total_non_signers = len(account_keys) - header.num_required_signatures
                writable_non_signers = total_non_signers - header.num_readonly_unsigned_accounts
                
                # Convert accounts to AccountMeta objects
                account_metas = []
                for idx in compiled_instruction.accounts:
                    pubkey = account_keys[idx]
                    
                    # Determine if account is signer
                    is_signer = idx < header.num_required_signatures
                    
                    # Determine if account is writable based on its position
                    if is_signer:
                        # For signers, check if within writable signers range
                        is_writable = idx < writable_signers
                    else:
                        # For non-signers, adjust index and check against writable non-signers
                        non_signer_idx = idx - header.num_required_signatures
                        is_writable = non_signer_idx < writable_non_signers
                    
                    account_meta = AccountMeta(
                        pubkey=pubkey,
                        is_signer=is_signer,
                        is_writable=is_writable
                    )
                    account_metas.append(account_meta)
                
                # Create new Instruction with AccountMeta objects
                instruction = Instruction(
                    program_id=program_id,
                    accounts=account_metas,
                    data=compiled_instruction.data
                )
                instructions.append(instruction)

            # Create new message with converted instructions
            new_message = Message.new_with_blockhash(
                instructions,  # List of uncompiled Instructions
                wallet_keypair.pubkey(),
                blockhash.value.blockhash
            )

            # Create new unsigned transaction with the message
            new_transaction = Transaction.new_unsigned(message=new_message)

            # Sign transaction with both keypair and blockhash
            new_transaction.sign(
                [wallet_keypair],
                new_transaction.message.recent_blockhash  # Pass the blockhash
            )

            logger.info("Sending transaction to network...")

            # Send transaction with retry logic
            max_retries = 3
            for attempt in range(max_retries):
                try:
                    result = await client.send_transaction(
                        new_transaction,
                        opts=TxOpts(
                            skip_preflight=False,
                            preflight_commitment="confirmed",
                            max_retries=2
                        )
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
