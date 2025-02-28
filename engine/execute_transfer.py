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
from spl.token.instructions import get_associated_token_address, transfer, create_associated_token_account, TransferParams

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

                # Try to get account info using a proper PublicKey object
                try:
                    # Import the correct PublicKey class
                    try:
                        from solana.publickey import PublicKey as SolanaPublicKey
                    except ImportError:
                        # If that fails, use the Pubkey class we already have
                        SolanaPublicKey = Pubkey
                    
                    # Create a proper PublicKey object from the string
                    pubkey_obj = SolanaPublicKey(dest_token_account_str)
                    self.logger.info(f"Created PublicKey object: {pubkey_obj}")
                    response = await client.get_account_info(pubkey_obj)
                except Exception as e:
                    self.logger.error(f"Error getting account info with PublicKey: {e}")
                    
                    # Try a different approach - use the RPC directly with a JSON-RPC call
                    try:
                        self.logger.info("Trying direct JSON-RPC call...")
                        import json
                        import aiohttp
                        
                        async with aiohttp.ClientSession() as session:
                            payload = {
                                "jsonrpc": "2.0",
                                "id": 1,
                                "method": "getAccountInfo",
                                "params": [
                                    dest_token_account_str,
                                    {"encoding": "jsonParsed"}
                                ]
                            }
                            
                            async with session.post(self.rpc_url, json=payload) as resp:
                                result = await resp.json()
                                self.logger.info(f"Direct RPC response: {json.dumps(result, indent=2)}")
                                
                                # Check if the account exists
                                if "result" in result and result["result"] and result["result"]["value"]:
                                    self.logger.info("Account exists according to direct RPC call")
                                    response = type('obj', (object,), {'value': True})  # Create a simple object with value=True
                                else:
                                    self.logger.info("Account does not exist according to direct RPC call")
                                    response = type('obj', (object,), {'value': None})  # Create a simple object with value=None
                    except Exception as direct_error:
                        self.logger.error(f"Error with direct RPC call: {direct_error}")
                        raise ValueError(f"Failed to check if account exists: {e}, {direct_error}")
                
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
                
                # Define the token program ID
                token_program_id = Pubkey.from_string("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA")

                # Create the instruction data for a token transfer
                # The first byte (3) is the instruction index for Transfer in the Token program
                instruction_data = bytes([3]) + amount_lamports.to_bytes(8, byteorder='little')

                # Create the account metas
                account_metas = [
                    {"pubkey": str(source_token_account), "is_signer": False, "is_writable": True},
                    {"pubkey": str(destination_token_account), "is_signer": False, "is_writable": True},
                    {"pubkey": self.wallet, "is_signer": True, "is_writable": False}
                ]

                # Create a transaction directly with Solana SDK
                self.logger.info("Creating transaction directly with Solana SDK...")
                try:
                    # Create a transaction
                    transaction = Transaction()
                    
                    # Define the token program ID
                    token_program_id = Pubkey.from_string("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA")
                    
                    # Create the transfer instruction
                    transfer_ix = transfer(
                        TransferParams(
                            program_id=token_program_id,
                            source=source_token_account,
                            dest=destination_token_account,
                            owner=Pubkey.from_string(self.wallet),
                            amount=amount_lamports
                        )
                    )
                    
                    # Add the instruction to the transaction
                    transaction.add(transfer_ix)
                    
                    # Get recent blockhash
                    blockhash_resp = await client.get_latest_blockhash()
                    transaction.recent_blockhash = blockhash_resp.value.blockhash
                    
                    # Sign the transaction
                    transaction.sign(keypair)
                    
                    # Send the transaction
                    self.logger.info("Sending transaction...")
                    send_resp = await client.send_transaction(
                        transaction,
                        opts=TxOpts(
                            skip_preflight=False,
                            preflight_commitment="confirmed",
                            max_retries=5
                        )
                    )
                    
                    if not send_resp.value:
                        raise ValueError("Failed to send transaction")
                    
                    tx_signature = str(send_resp.value)
                    self.logger.info(f"Transaction sent successfully: {tx_signature}")
                    
                    # Wait for confirmation
                    self.logger.info("Waiting for transaction confirmation...")
                    await asyncio.sleep(5)
                    
                    # Verify the transaction was successful
                    confirm_resp = await client.confirm_transaction(tx_signature)
                    
                    if not confirm_resp.value:
                        self.logger.warning(f"Transaction may not be confirmed: {tx_signature}")
                    
                    return {
                        "success": True,
                        "signature": tx_signature,
                        "token": token,
                        "amount": amount,
                        "destination": destination_wallet
                    }
                except Exception as e:
                    self.logger.error(f"Error with JSON RPC approach: {e}")
                    # Fall back to a simpler approach
                    
                    # Try a simpler approach - use the command line to execute a transfer
                    self.logger.info("Falling back to command line approach...")
                    try:
                        import subprocess
                        
                        # Create a temporary script to execute the transfer
                        script_content = f"""
import os
import json
import base58
import requests
from solders.keypair import Keypair
from solders.pubkey import Pubkey

# Define the token program ID
token_program_id = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"

# Define accounts
source_account = "{source_token_account}"
destination_account = "{destination_token_account}"
owner = "{self.wallet}"
amount = {amount_lamports}

# Load keypair
private_key = base58.b58decode("{self.private_key}")
keypair = Keypair.from_bytes(private_key)

# Create the instruction data for a token transfer
# The first byte (3) is the instruction index for Transfer in the Token program
instruction_data = bytes([3]) + amount.to_bytes(8, byteorder='little')

# Create the transaction using direct JSON RPC
payload = {{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "getLatestBlockhash",
    "params": [{{"commitment": "confirmed"}}]
}}

response = requests.post("{self.rpc_url}", json=payload)
blockhash_data = response.json()
blockhash = blockhash_data["result"]["value"]["blockhash"]

# Create the transaction
transaction = {{
    "recentBlockhash": blockhash,
    "feePayer": owner,
    "instructions": [
        {{
            "programId": token_program_id,
            "accounts": [
                {{"pubkey": source_account, "isSigner": False, "isWritable": True}},
                {{"pubkey": destination_account, "isSigner": False, "isWritable": True}},
                {{"pubkey": owner, "isSigner": True, "isWritable": False}}
            ],
            "data": base58.b58encode(instruction_data).decode('ascii')
        }}
    ]
}}

# Sign the transaction
# This is a simplified approach - in a real implementation, you would use the Solana SDK
# to properly sign the transaction
signature = str(keypair.pubkey())

# Send the transaction
send_payload = {{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "sendTransaction",
    "params": [
        {{"transaction": json.dumps(transaction), "signatures": [signature]}},
        {{"encoding": "json", "skipPreflight": False, "preflightCommitment": "confirmed"}}
    ]
}}

send_response = requests.post("{self.rpc_url}", json=send_payload)
result = send_response.json()
print(json.dumps(result))
"""
                        
                        # Write the script to a temporary file
                        import tempfile
                        with tempfile.NamedTemporaryFile(suffix='.py', delete=False, mode='w') as f:
                            f.write(script_content)
                            temp_script = f.name
                        
                        # Execute the script
                        self.logger.info(f"Executing temporary script: {temp_script}")
                        result = subprocess.run(['python', temp_script], capture_output=True, text=True)
                        
                        # Clean up the temporary file
                        os.unlink(temp_script)
                        
                        # Check the result
                        if result.returncode != 0:
                            self.logger.error(f"Script execution failed: {result.stderr}")
                            raise ValueError(f"Script execution failed: {result.stderr}")
                        
                        # Parse the result
                        try:
                            output = json.loads(result.stdout)
                            tx_signature = output["result"]
                            self.logger.info(f"Transaction sent successfully: {tx_signature}")
                        except json.JSONDecodeError:
                            self.logger.error(f"Failed to parse script output: {result.stdout}")
                            raise ValueError(f"Failed to parse script output: {result.stdout}")
                    except Exception as script_error:
                        self.logger.error(f"Error with command line approach: {script_error}")
                        
                        # If the script approach fails, try using the Solana CLI directly
                        self.logger.info("Falling back to Solana CLI approach...")
                        try:
                            import subprocess
                            import tempfile
                            import re
                            
                            # Write the private key to a temporary file
                            with tempfile.NamedTemporaryFile(suffix='.json', delete=False, mode='w') as f:
                                private_key_bytes = base58.b58decode(self.private_key)
                                private_key_list = list(private_key_bytes)
                                json.dump(private_key_list, f)
                                keypair_path = f.name
                            
                            try:
                                # Use the Solana CLI to transfer tokens
                                cmd = [
                                    "solana", "transfer",
                                    "--from", keypair_path,
                                    "--fee-payer", keypair_path,
                                    destination_wallet,
                                    str(amount),
                                    token,
                                    "--url", self.rpc_url,
                                    "--commitment", "confirmed"
                                ]
                                
                                self.logger.info(f"Executing Solana CLI command: {' '.join(cmd)}")
                                result = subprocess.run(cmd, capture_output=True, text=True)
                                
                                # Check the result
                                if result.returncode != 0:
                                    self.logger.error(f"Solana CLI execution failed: {result.stderr}")
                                    raise ValueError(f"Solana CLI execution failed: {result.stderr}")
                                
                                # Extract transaction signature from stdout
                                output = result.stdout
                                signature_match = re.search(r'Signature: ([a-zA-Z0-9]+)', output)
                                if signature_match:
                                    tx_signature = signature_match.group(1)
                                    self.logger.info(f"Transaction sent successfully via CLI: {tx_signature}")
                                    
                                    return {
                                        "success": True,
                                        "signature": tx_signature,
                                        "token": token,
                                        "amount": amount,
                                        "destination": destination_wallet
                                    }
                                else:
                                    self.logger.error(f"Could not extract signature from CLI output: {output}")
                                    raise ValueError(f"Could not extract signature from CLI output: {output}")
                            finally:
                                # Clean up the temporary keypair file
                                os.unlink(keypair_path)
                        except Exception as cli_error:
                            self.logger.error(f"Error with Solana CLI approach: {cli_error}")
                            raise ValueError(f"All transfer approaches failed: {e}, {script_error}, {cli_error}")
                
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
