import os
import json
import aiohttp
import traceback
import asyncio
import base58
import base64
import urllib.parse
from datetime import datetime
import logging
from typing import Dict, Optional
import urllib.parse
from dotenv import load_dotenv
import socket
from solders.keypair import Keypair
from solders.transaction import Transaction, VersionedTransaction
from solders.message import Message, MessageV0
from solders.instruction import AccountMeta, Instruction
from solana.rpc.async_api import AsyncClient
from solana.rpc.types import TxOpts
from solders.pubkey import Pubkey
from spl.token.instructions import get_associated_token_address

def setup_logging():
    """Configure logging"""
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

# Configure Windows event loop policy
if os.name == 'nt':  # Windows
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())






class JupiterTradeExecutor:
    def __init__(self):
        load_dotenv()
        self.logger = setup_logging()
        
        # Initialize wallet during class initialization
        try:
            private_key = os.getenv('STRATEGY_WALLET_PRIVATE_KEY')
            if not private_key:
                raise ValueError("STRATEGY_WALLET_PRIVATE_KEY not found")
            
            private_key_bytes = base58.b58decode(private_key)
            self.wallet_keypair = Keypair.from_bytes(private_key_bytes)
            self.wallet_address = str(self.wallet_keypair.pubkey())
            self.logger.info(f"Wallet initialized: {self.wallet_address[:8]}...")
            
        except Exception as e:
            self.logger.error(f"Failed to initialize wallet: {e}")
            self.wallet_keypair = None
            self.wallet_address = None

    async def get_token_balance(self, token_mint: str) -> float:
        """Get token balance using Birdeye API"""
        try:
            # Get API key from environment
            api_key = os.getenv('BIRDEYE_API_KEY')
            if not api_key:
                raise ValueError("BIRDEYE_API_KEY not found in environment variables")

            # Prepare request
            url = "https://public-api.birdeye.so/v1/wallet/token_balance"
            headers = {
                'x-api-key': api_key,
                'x-chain': 'solana',
                'accept': 'application/json'
            }
            params = {
                'wallet': self.wallet_address,
                'token_address': token_mint
            }

            self.logger.info(f"Fetching balance for token {token_mint}")
            self.logger.info(f"Wallet address: {self.wallet_address}")

            async with aiohttp.ClientSession() as session:
                async with session.get(url, headers=headers, params=params) as response:
                    if response.status == 200:
                        data = await response.json()
                        self.logger.debug(f"Birdeye API response: {json.dumps(data, indent=2)}")
                        
                        if data.get('success'):
                            token_data = data.get('data', {})
                            # Get balance and handle decimals (USDC has 6 decimals)
                            raw_balance = float(token_data.get('balance', 0))
                            decimals = int(token_data.get('decimals', 6))  # Default to 6 for USDC
                            balance = raw_balance / (10 ** decimals)
                            
                            usd_value = float(token_data.get('usd_value', 0))
                            
                            self.logger.info(f"Token balance: {balance:.4f}")
                            self.logger.info(f"USD value: ${usd_value:.2f}")
                            
                            return balance if balance > 0 else usd_value  # Return either balance or USD value
                        else:
                            self.logger.error(f"Birdeye API error: {data.get('message')}")
                    else:
                        self.logger.error(f"Birdeye API request failed: {response.status}")
                        self.logger.error(f"Response: {await response.text()}")

                # If we get here, try fallback to DexScreener
                self.logger.info("Attempting fallback to DexScreener...")
                dexscreener_url = f"https://api.dexscreener.com/latest/dex/tokens/{token_mint}"
                
                async with aiohttp.ClientSession() as session:
                    async with session.get(dexscreener_url) as response:
                        if response.status == 200:
                            data = await response.json()
                            pairs = data.get('pairs', [])
                            if pairs:
                                best_pair = max(pairs, key=lambda x: float(x.get('liquidity', {}).get('usd', 0) or 0))
                                price = float(best_pair.get('priceUsd', 0))
                                self.logger.info(f"DexScreener price: ${price:.4f}")
                                return price
                
                return 0

        except Exception as e:
            self.logger.error(f"Error getting token balance from Birdeye: {e}")
            if hasattr(e, '__traceback__'):
                import traceback
                self.logger.error("Traceback:")
                traceback.print_tb(e.__traceback__)
            return 0

    async def get_jupiter_quote(self, input_token: str, output_token: str, amount: float) -> Optional[Dict]:
        """Get quote from Jupiter API v1"""
        try:
            amount_raw = int(amount * 1e6)  # Convert to USDC decimals
            
            base_url = "https://api.jup.ag/swap/v1/quote"
            params = {
                "inputMint": str(input_token),
                "outputMint": str(output_token),
                "amount": str(amount_raw),
                "slippageBps": "100"
            }
            
            if os.getenv('JUPITER_API_KEY'):
                params["apiKey"] = os.getenv('JUPITER_API_KEY')
            
            url = f"{base_url}?{urllib.parse.urlencode(params)}"
            
            self.logger.info("\nJupiter Quote Request:")
            self.logger.info(f"URL: {url}")
            self.logger.info(f"Amount USD: ${amount:.2f}")
            self.logger.info(f"Amount Raw: {amount_raw}")
            
            async with aiohttp.ClientSession() as session:
                async with session.get(url) as response:
                    if not response.ok:
                        self.logger.error(f"Jupiter API error: {response.status}")
                        self.logger.error(f"Response: {await response.text()}")
                        return None
                        
                    data = await response.json()
                    
                    # Ensure the response has the required fields
                    required_fields = ['inputMint', 'outputMint', 'inAmount', 'outAmount', 'otherAmountThreshold', 'swapMode']
                    if not all(field in data for field in required_fields):
                        self.logger.error("Quote response missing required fields")
                        self.logger.debug(f"Response data: {json.dumps(data, indent=2)}")
                        return None
                    
                    return data
                    
        except Exception as e:
            self.logger.error(f"Error getting Jupiter quote: {str(e)}")
            if hasattr(e, '__traceback__'):
                import traceback
                self.logger.error("Traceback:")
                traceback.print_tb(e.__traceback__)
            return None

    async def execute_validated_swap(
        self,
        input_token: str,
        output_token: str,
        amount: float,
        min_amount: float = 1.0,
        max_slippage: float = 1.0
    ) -> tuple[bool, Optional[bytes]]:  # Modified to return transaction bytes
        """Execute swap with validation"""
        try:
            # Validate trade first
            if not await self.validate_trade(
                input_token,
                output_token,
                amount,
                min_amount,
                max_slippage
            ):
                return False, None

            # Get quote
            quote = await self.get_jupiter_quote(input_token, output_token, amount)
            if not quote:
                return False, None

            # Get transaction bytes
            transaction_bytes = await self.get_jupiter_transaction(quote, self.wallet_address)
            if not transaction_bytes:
                return False, None

            return True, transaction_bytes
            
        except Exception as e:
            self.logger.error(f"Validated swap failed: {e}")
            return False, None

    async def validate_trade(
        self,
        input_token: str,
        output_token: str,
        amount: float,
        min_amount: float = 1.0,
        max_slippage: float = 1.0
    ) -> bool:
        """Validate trade parameters before execution"""
        try:
            # Check minimum amount
            if amount < min_amount:
                self.logger.error(f"Amount {amount} below minimum {min_amount}")
                return False
                
            # Get and validate quote
            quote = await self.get_jupiter_quote(input_token, output_token, amount)
            if not quote:
                self.logger.error("Failed to get quote")
                return False
                
            # Check slippage
            if not await self.check_slippage(quote, max_slippage):
                return False
                
            self.logger.info("Trade validation passed")
            return True
            
        except Exception as e:
            self.logger.error(f"Trade validation failed: {e}")
            return False

    async def check_slippage(self, quote_data: dict, max_slippage: float = 1.0) -> bool:
        """Check if quote slippage is within acceptable range"""
        try:
            price_impact = float(quote_data.get('priceImpactPct', 0))
            
            if price_impact > max_slippage:
                self.logger.warning(f"Price impact {price_impact:.2f}% exceeds max slippage {max_slippage}%")
                return False
                
            self.logger.info(f"Price impact {price_impact:.2f}% within acceptable range")
            return True
            
        except Exception as e:
            self.logger.error(f"Error checking slippage: {e}")
            return False

    async def execute_trade_with_retries(self, transaction: Transaction, max_retries: int = 3) -> Optional[str]:
        """Execute a trade transaction with optimized sending options"""
        client = AsyncClient("https://api.mainnet-beta.solana.com")
        try:
            for attempt in range(max_retries):
                try:
                    # Send with optimized options
                    result = await client.send_transaction(
                        transaction,
                        opts=TxOpts(
                            skip_preflight=True,  # Skip preflight for faster sending
                            max_retries=2,  # Allow RPC retries
                            preflight_commitment="confirmed"
                        )
                    )
                    
                    if result.value:
                        # Wait for confirmation
                        confirmation = await client.confirm_transaction(
                            result.value,
                            commitment="finalized"
                        )
                        
                        if confirmation.value.err:
                            self.logger.error(f"Transaction failed: {confirmation.value.err}")
                            self.logger.error(f"View transaction: https://solscan.io/tx/{result.value}")
                            if attempt < max_retries - 1:
                                continue
                            return None
                        
                        self.logger.info(f"✅ Transaction successful!")
                        self.logger.info(f"View transaction: https://solscan.io/tx/{result.value}")
                        return str(result.value)
                        
                except Exception as e:
                    if attempt == max_retries - 1:
                        raise
                    self.logger.warning(f"Attempt {attempt + 1} failed, retrying...")
                    await asyncio.sleep(1)
            return None
        finally:
            await client.close()

    async def get_jupiter_transaction(self, quote_data: dict, wallet_address: str) -> Optional[bytes]:
        """Get swap transaction from Jupiter v1 API with optimizations"""
        try:
            url = "https://api.jup.ag/swap/v1/swap"
            
            # Ensure quote_data has all required fields
            if not all(key in quote_data for key in ['inputMint', 'outputMint', 'inAmount', 'outAmount', 'otherAmountThreshold', 'swapMode']):
                self.logger.error("Missing required fields in quote data")
                self.logger.debug(f"Quote data: {json.dumps(quote_data, indent=2)}")
                return None

            # Construct the request body according to v1 API spec
            swap_data = {
                "quoteResponse": {
                    "inputMint": quote_data["inputMint"],
                    "inAmount": quote_data["inAmount"],
                    "outputMint": quote_data["outputMint"],
                    "outAmount": quote_data["outAmount"],
                    "otherAmountThreshold": quote_data["otherAmountThreshold"],
                    "swapMode": quote_data["swapMode"],
                    "slippageBps": quote_data.get("slippageBps", 100),
                    "platformFee": quote_data.get("platformFee", None),
                    "priceImpactPct": quote_data.get("priceImpactPct", "0"),
                    "routePlan": quote_data.get("routePlan", []),
                    "contextSlot": quote_data.get("contextSlot", 0),
                    "timeTaken": quote_data.get("timeTaken", 0)
                },
                "userPublicKey": wallet_address,
                "wrapAndUnwrapSol": True,
                "useSharedAccounts": True,
                "dynamicComputeUnitLimit": True,
                "prioritizationFeeLamports": {
                    "priorityLevelWithMaxLamports": {
                        "priorityLevel": "medium",
                        "maxLamports": 10000000
                    }
                }
            }

            # Add API key if available
            if os.getenv('JUPITER_API_KEY'):
                swap_data["trackingAccount"] = os.getenv('JUPITER_API_KEY')
            
            self.logger.info("Requesting optimized swap transaction...")
            self.logger.debug(f"Swap parameters: {json.dumps(swap_data, indent=2)}")
            
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    url, 
                    json=swap_data,
                    headers={'Content-Type': 'application/json'}
                ) as response:
                    if not response.ok:
                        self.logger.error(f"Jupiter API error: {response.status}")
                        self.logger.error(f"Response: {await response.text()}")
                        return None
                
                    try:
                        transaction_data = await response.json()
                    except json.JSONDecodeError as e:
                        self.logger.error(f"Invalid JSON response: {e}")
                        return None
                
                    # Get the base64 encoded transaction
                    transaction_base64 = transaction_data.get('swapTransaction')
                    if not transaction_base64:
                        self.logger.error("No transaction data in response")
                        return None

                    try:
                        transaction_bytes = base64.b64decode(transaction_base64)
                        self.logger.info(f"Transaction bytes length: {len(transaction_bytes)}")
                        return transaction_bytes
                        
                    except Exception as e:
                        self.logger.error(f"Invalid transaction format: {e}")
                        return None

        except Exception as e:
            self.logger.error(f"Error getting swap transaction: {e}")
            if hasattr(e, '__traceback__'):
                traceback.print_tb(e.__traceback__)
            return None

    async def prepare_transaction(self, transaction_bytes: bytes) -> Optional[Transaction]:
        """Prepare a versioned transaction by recompiling with fresh blockhash"""
        try:
            client = AsyncClient("https://api.mainnet-beta.solana.com")
            try:
                # Get fresh blockhash first
                blockhash_response = await client.get_latest_blockhash()
                if not blockhash_response or not blockhash_response.value:
                    raise Exception("Failed to get recent blockhash")
                
                fresh_blockhash = blockhash_response.value.blockhash
                self.logger.info(f"Got fresh blockhash: {fresh_blockhash}")

                # Deserialize the original transaction
                original_tx = VersionedTransaction.from_bytes(transaction_bytes)
                
                # Extract the message components
                message = original_tx.message
                
                # Preserve the original address table lookups
                address_table_lookups = getattr(message, 'address_table_lookups', [])
                
                # Create new message with fresh blockhash
                new_message = MessageV0(
                    header=message.header,
                    account_keys=message.account_keys,
                    recent_blockhash=fresh_blockhash,
                    instructions=message.instructions,
                    address_table_lookups=address_table_lookups  # Use original lookups
                )
                
                # Create new transaction using constructor
                new_transaction = VersionedTransaction(
                    message=new_message,
                    keypairs=[self.wallet_keypair]  # Pass keypair for signing
                )
                
                self.logger.info("Successfully prepared versioned transaction with fresh blockhash")
                return new_transaction

            except Exception as e:
                self.logger.error(f"Failed to prepare transaction: {e}")
                if hasattr(e, '__traceback__'):
                    self.logger.error("Traceback:")
                    traceback.print_tb(e.__traceback__)
                return None

            finally:
                await client.close()

        except Exception as e:
            self.logger.error(f"Error in prepare_transaction: {e}")
            if hasattr(e, '__traceback__'):
                self.logger.error("Traceback:")
                traceback.print_tb(e.__traceback__)
            return None

if __name__ == "__main__":
    print("This module is not meant to be run directly")
