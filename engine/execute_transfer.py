#!/usr/bin/env python3
import os
import sys
import json
import time
import base58
import asyncio

# Debug information about Python environment
print("Python version:", sys.version)
print("Python executable:", sys.executable)
print("Current working directory:", os.getcwd())

# Debug imports
try:
    import solana
    print("Solana package found:", solana.__file__)
except ImportError:
    print("Solana package not found")

try:
    import solders
    print("Solders package found:", solders.__file__)
except ImportError:
    print("Solders package not found")
from datetime import datetime, timezone
import requests
from dotenv import load_dotenv
from solders.keypair import Keypair
from solders.pubkey import Pubkey
from solana.rpc.async_api import AsyncClient
from solana.rpc.types import TxOpts
from solana.transaction import Transaction
# Try to import PublicKey from different possible locations
try:
    from solana.publickey import PublicKey
except ImportError:
    try:
        from solders.pubkey import Pubkey as PublicKey
    except ImportError:
        # As a last resort, create a simple wrapper class
        class PublicKey:
            def __init__(self, address):
                self.address = address
                
            def __str__(self):
                return self.address
from spl.token.instructions import get_associated_token_address, transfer, create_associated_token_account

def setup_logging():
    """Set up basic logging configuration"""
    import logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[logging.StreamHandler()]
    )
    return logging.getLogger('execute_transfer')

class TokenTransferExecutor:
    def __init__(self):
        # Load environment variables from .env file
        load_dotenv(dotenv_path=os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env'))
        self.logger = setup_logging()
        
        # Initialize Helius RPC URL
        self.rpc_url = os.getenv('NEXT_PUBLIC_HELIUS_RPC_URL', 'https://api.mainnet-beta.solana.com')
        
        # Token mint addresses
        self.token_mints = {
            "UBC": "9psiRdn9cXYVps4F1kFuoNjd2EtmqNJXrCPmRppJpump",
            "COMPUTE": "B1N1HcMm4RysYz4smsXwmk2UnS8NziqKCM6Ho8i62vXo",
            "USDC": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
        }
        
        # Token decimals
        self.token_decimals = {
            "UBC": 6,
            "COMPUTE": 6,
            "USDC": 6
        }
        
        # Load wallet from private key
        private_key_str = os.getenv('KINKONG_WALLET_PRIVATE_KEY')
        if not private_key_str:
            raise ValueError("KINKONG_WALLET_PRIVATE_KEY not found in environment variables")
        
        # Store private key for later use
        self.private_key = private_key_str
        
        # Get wallet address
        try:
            # Use KINKONG_WALLET environment variable
            self.wallet = os.getenv('KINKONG_WALLET')
            if not self.wallet:
                raise ValueError("KINKONG_WALLET not found in environment variables")
            
            self.logger.info(f"Wallet loaded: {self.wallet}")
        except Exception as e:
            self.logger.error(f"Error loading wallet: {e}")
            raise ValueError(f"Invalid wallet configuration: {e}")
    
    async def execute_transfer(self, destination_wallet, token, amount):
        """Execute a token transfer to the destination wallet using Solana RPC
        
        Args:
            destination_wallet (str): The destination wallet address
            token (str): The token symbol (UBC, COMPUTE, USDC)
            amount (float): The amount to transfer
            
        Returns:
            dict: Result of the transfer operation
        """
        try:
            # Validate token
            if token not in self.token_mints:
                raise ValueError(f"Unsupported token: {token}. Supported tokens: {', '.join(self.token_mints.keys())}")
            
            # Get token mint and decimals
            token_mint = self.token_mints[token]
            decimals = self.token_decimals[token]
            
            # Convert amount to lamports
            amount_lamports = int(amount * (10 ** decimals))
            
            # Verify the conversion is correct by doing the reverse calculation
            reverse_check = amount_lamports / (10 ** decimals)
            if abs(reverse_check - amount) > 0.000001:  # Allow for small floating point differences
                self.logger.warning(f"Amount conversion verification failed: {amount} vs {reverse_check}")
                
            self.logger.info(f"Preparing to transfer {amount} {token} ({amount_lamports} lamports) to {destination_wallet}")
            self.logger.info(f"Token decimals: {decimals}")
            
            # Get RPC URL
            rpc_url = self.rpc_url
            if not rpc_url:
                raise ValueError("RPC URL not found in environment variables")
            
            # Create a Solana client
            client = AsyncClient(rpc_url)
            
            try:
                # Convert private key to keypair
                private_key_bytes = base58.b58decode(self.private_key)
                keypair = Keypair.from_bytes(private_key_bytes)
                
                # Get the source token account (the token account for our wallet)
                self.logger.info(f"Finding source {token} token account for wallet: {self.wallet}")
                
                # Get the associated token account for the source wallet
                source_token_account = get_associated_token_address(
                    Pubkey.from_string(self.wallet),
                    Pubkey.from_string(token_mint)
                )
                
                self.logger.info(f"Source token account: {source_token_account}")
                
                # Get or create the destination token account
                destination_token_account = get_associated_token_address(
                    Pubkey.from_string(destination_wallet),
                    Pubkey.from_string(token_mint)
                )
                
                self.logger.info(f"Destination token account: {destination_token_account}")
                
                # Check if the destination token account exists
                # Use the string representation directly with the RPC client
                dest_token_account_str = str(destination_token_account)
                self.logger.info(f"Destination token account string: {dest_token_account_str}")

                # Try to get account info using the string directly
                try:
                    response = await client.get_account_info(dest_token_account_str)
                except Exception as e:
                    self.logger.error(f"Error getting account info with string: {e}")
                    
                    # As a fallback, try to extract the base58 encoded string
                    # The string representation might be something like "PublicKey(base58_string)"
                    import re
                    match = re.search(r'([1-9A-HJ-NP-Za-km-z]{32,44})', dest_token_account_str)
                    if match:
                        extracted_address = match.group(1)
                        self.logger.info(f"Extracted address: {extracted_address}")
                        response = await client.get_account_info(extracted_address)
                    else:
                        raise ValueError(f"Could not extract valid address from {dest_token_account_str}")
                
                # If the account doesn't exist, we need to create it
                if not response.value:
                    self.logger.info(f"Destination token account doesn't exist, creating it...")
                    
                    # Create the associated token account instruction
                    create_ata_ix = create_associated_token_account(
                        payer=Pubkey.from_string(self.wallet),
                        owner=Pubkey.from_string(destination_wallet),
                        mint=Pubkey.from_string(token_mint)
                    )
                    
                    # Create a transaction to create the associated token account
                    create_ata_tx = Transaction().add(create_ata_ix)
                    
                    # Get recent blockhash
                    blockhash_resp = await client.get_latest_blockhash()
                    create_ata_tx.recent_blockhash = blockhash_resp.value.blockhash
                    
                    # Sign and send the transaction
                    create_ata_tx.sign(keypair)
                    
                    self.logger.info("Sending transaction to create destination token account...")
                    create_resp = await client.send_transaction(create_ata_tx)
                    
                    if not create_resp.value:
                        raise ValueError("Failed to create destination token account")
                    
                    self.logger.info(f"Created destination token account: {create_resp.value}")
                    
                    # Wait for the transaction to confirm
                    self.logger.info("Waiting for token account creation to confirm...")
                    await asyncio.sleep(5)
                
                # Create the transfer instruction
                transfer_ix = transfer(
                    source=source_token_account,
                    dest=destination_token_account,
                    owner=Pubkey.from_string(self.wallet),
                    amount=amount_lamports
                )
                
                # Create a transaction
                transfer_tx = Transaction().add(transfer_ix)
                
                # Get recent blockhash with retry logic
                max_retries = 3
                for retry in range(max_retries):
                    try:
                        blockhash_resp = await client.get_latest_blockhash()
                        transfer_tx.recent_blockhash = blockhash_resp.value.blockhash
                        break
                    except Exception as e:
                        if retry < max_retries - 1:
                            self.logger.warning(f"Error getting blockhash (attempt {retry+1}/{max_retries}): {e}")
                            await asyncio.sleep(1)
                        else:
                            raise ValueError(f"Failed to get blockhash after {max_retries} attempts: {e}")
                
                # Sign the transaction
                transfer_tx.sign(keypair)
                
                # Send the transaction with retry logic
                self.logger.info("Sending transfer transaction...")
                max_retries = 3
                for retry in range(max_retries):
                    try:
                        response = await client.send_transaction(transfer_tx)
                        
                        if not response.value:
                            if retry < max_retries - 1:
                                self.logger.warning(f"Failed to send transaction (attempt {retry+1}/{max_retries})")
                                await asyncio.sleep(1)
                            else:
                                raise ValueError("Failed to send transfer transaction after multiple attempts")
                        else:
                            break
                    except Exception as e:
                        if retry < max_retries - 1:
                            self.logger.warning(f"Error sending transaction (attempt {retry+1}/{max_retries}): {e}")
                            await asyncio.sleep(1)
                        else:
                            raise ValueError(f"Failed to send transaction after {max_retries} attempts: {e}")
                
                tx_signature = str(response.value)
                self.logger.info(f"Transaction sent successfully: {tx_signature}")
                
                # Wait for confirmation
                self.logger.info("Waiting for transaction confirmation...")
                
                # Improved confirmation logic with retries
                max_retries = 5
                for retry in range(max_retries):
                    try:
                        confirm_resp = await client.confirm_transaction(tx_signature)
                        if confirm_resp.value:
                            self.logger.info(f"Transaction confirmed: {tx_signature}")
                            break
                        else:
                            self.logger.warning(f"Transaction not yet confirmed (attempt {retry+1}/{max_retries})")
                            if retry < max_retries - 1:
                                await asyncio.sleep(2 * (retry + 1))  # Exponential backoff
                    except Exception as e:
                        self.logger.warning(f"Error confirming transaction (attempt {retry+1}/{max_retries}): {e}")
                        if retry < max_retries - 1:
                            await asyncio.sleep(2 * (retry + 1))
                
                return {
                    "success": True,
                    "signature": tx_signature,
                    "token": token,
                    "amount": amount,
                    "destination": destination_wallet
                }
                
            finally:
                # Close the client connection
                await client.close()
                
        except Exception as e:
            self.logger.error(f"Error executing transfer to {destination_wallet}: {e}")
            if hasattr(e, '__traceback__'):
                import traceback
                self.logger.error("Traceback:")
                traceback.print_tb(e.__traceback__)
            return {
                "success": False,
                "error": str(e),
                "token": token,
                "amount": amount,
                "destination": destination_wallet
            }
    
    def send_telegram_notification(self, transfer_data, tx_signature):
        """Send a Telegram notification for a completed transfer"""
        try:
            self.logger.info(f"Sending Telegram notification for transfer to: {transfer_data['destination']}")
            
            # Get Telegram bot token and use the specified channel ID
            bot_token = os.getenv('TELEGRAM_BOT_TOKEN')
            chat_id = "-1001699255893"  # Use the specified channel ID
            
            if not bot_token:
                self.logger.warning("Telegram bot token not found in environment variables")
                return False
            
            # Format wallet address for display
            wallet = transfer_data['destination']
            if len(wallet) > 20:
                wallet_display = wallet[:10] + '...' + wallet[-10:]
            else:
                wallet_display = wallet
            
            # Create message text
            message = f"""🎉 *KinKong Token Transfer Completed*
            
📊 *Recipient*: `{wallet_display}`
🪙 *Amount*: {transfer_data['amount']:.2f} {transfer_data['token']}
✅ *Status*: Completed

🔗 [View Transaction](https://solscan.io/tx/{tx_signature})
"""
            
            # First try to send with image
            image_path = "public/copilot.png"
            
            # Check if image exists
            if os.path.exists(image_path):
                # Send photo with caption
                telegram_url = f"https://api.telegram.org/bot{bot_token}/sendPhoto"
                
                # Open and read the image file
                with open(image_path, 'rb') as photo:
                    files = {'photo': photo}
                    payload = {
                        "chat_id": chat_id,
                        "caption": message,
                        "parse_mode": "Markdown"
                    }
                    
                    response = requests.post(telegram_url, data=payload, files=files)
                    response.raise_for_status()
            else:
                # If image doesn't exist, just send the text message
                self.logger.warning(f"Image file not found at {image_path}, sending text-only message")
                telegram_url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
                payload = {
                    "chat_id": chat_id,
                    "text": message,
                    "parse_mode": "Markdown"
                }
                
                response = requests.post(telegram_url, json=payload)
                response.raise_for_status()
            
            self.logger.info(f"Telegram notification sent successfully for {wallet_display}")
            return True
        except Exception as e:
            self.logger.error(f"Error sending Telegram notification: {e}")
            return False
    
async def async_main():
    try:
        # Load environment variables from .env file
        load_dotenv(dotenv_path=os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env'))
        
        # Verify environment variables
        required_vars = [
            'KINKONG_WALLET_PRIVATE_KEY',
            'KINKONG_WALLET',
            'NEXT_PUBLIC_HELIUS_RPC_URL',
            'TELEGRAM_BOT_TOKEN'
        ]
        
        missing = [var for var in required_vars if not os.getenv(var)]
        if missing:
            raise Exception(f"Missing environment variables: {', '.join(missing)}")
        
        # Check for test parameter
        if len(sys.argv) == 2 and sys.argv[1].lower() == "test":
            # Test mode - send 0.1 USDC to the specified wallet
            test_wallet = "8qFuqCdFsvFYwpP7FDiDhqucTXsDdRmkhvzJ8JvBUXmZ"
            test_token = "USDC"
            test_amount = 0.1
            
            print(f"\n🧪 TEST MODE: Sending {test_amount} {test_token} to {test_wallet}")
            
            # Initialize and run transfer executor
            executor = TokenTransferExecutor()
            result = await executor.execute_transfer(test_wallet, test_token, test_amount)
            
            if result["success"]:
                print(f"\n✅ Test transfer of {test_amount} {test_token} to {test_wallet} completed")
                print(f"Transaction signature: {result['signature']}")
                
                # Send Telegram notification
                executor.send_telegram_notification(result, result["signature"])
            else:
                print(f"\n❌ Test transfer failed: {result['error']}")
                sys.exit(1)
                
            return  # Exit after test
        
        # Regular mode - check command line arguments
        if len(sys.argv) < 4:
            print("Usage: python execute_transfer.py <destination_wallet> <token> <amount>")
            print("       python execute_transfer.py test  # Run test mode")
            print("Example: python execute_transfer.py 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU UBC 1000")
            sys.exit(1)
        
        destination_wallet = sys.argv[1]
        token = sys.argv[2].upper()  # Convert to uppercase
        try:
            amount = float(sys.argv[3])
        except ValueError:
            print(f"Error: Amount must be a number, got '{sys.argv[3]}'")
            sys.exit(1)
        
        # Initialize and run transfer executor
        executor = TokenTransferExecutor()
        result = await executor.execute_transfer(destination_wallet, token, amount)
        
        if result["success"]:
            print(f"\n✅ Transfer of {amount} {token} to {destination_wallet} completed")
            print(f"Transaction signature: {result['signature']}")
            
            # Send Telegram notification
            executor.send_telegram_notification(result, result["signature"])
        else:
            print(f"\n❌ Transfer failed: {result['error']}")
            sys.exit(1)
        
    except Exception as e:
        print(f"\n❌ Script failed: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

def main():
    # Set up asyncio event loop policy for Windows if needed
    if os.name == 'nt':  # Windows
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    
    # Run the async main function
    asyncio.run(async_main())

if __name__ == "__main__":
    main()
