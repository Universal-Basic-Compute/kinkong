import os
import json
import aiohttp
import asyncio
import base58
import base64
from datetime import datetime
import logging
from typing import Dict, Optional
import urllib.parse
from dotenv import load_dotenv
import socket
from solders.keypair import Keypair
from solders.transaction import Transaction
from solders.message import Message
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

    async def get_jupiter_quote(self, input_token: str, output_token: str, amount: float) -> Optional[Dict]:
        """Get quote from Jupiter API v6"""
        try:
            # Convert amount to proper decimals (USDC has 6 decimals)
            amount_raw = int(amount * 1e6)  # Convert to USDC decimals
            
            # Build URL with parameters
            base_url = "https://quote-api.jup.ag/v6/quote"
            params = {
                "inputMint": str(input_token),
                "outputMint": str(output_token),
                "amount": str(amount_raw),
                "slippageBps": "100",  # 1% slippage
                "onlyDirectRoutes": "false",
                "asLegacyTransaction": "true"
            }
            
            url = f"{base_url}?{urllib.parse.urlencode(params)}"
            
            self.logger.info("\nJupiter Quote Request:")
            self.logger.info(f"URL: {url}")
            self.logger.info(f"Amount USD: ${amount:.2f}")
            self.logger.info(f"Amount Raw: {amount_raw}")
            
            async with aiohttp.ClientSession() as session:
                async with session.get(url) as response:
                    response_text = await response.text()
                    self.logger.info(f"Response Status: {response.status}")
                    
                    if not response.ok:
                        self.logger.error(f"Jupiter API error: {response.status}")
                        return None
                        
                    data = json.loads(response_text)
                    
                    # La réponse est déjà la donnée dont nous avons besoin
                    if not data:
                        self.logger.error("Empty response from Jupiter API")
                        return None

                    # Log quote details
                    self.logger.info(f"Quote received:")
                    self.logger.info(f"Input Amount: {data['inAmount']}")
                    self.logger.info(f"Output Amount: {data['outAmount']}")
                    self.logger.info(f"Price Impact: {data['priceImpactPct']}%")
                    self.logger.info(f"Route Plan: {json.dumps(data['routePlan'], indent=2)}")
                    
                    return data  # Retourner directement la réponse
                    
        except Exception as e:
            self.logger.error(f"Error getting Jupiter quote: {str(e)}")
            if hasattr(e, '__traceback__'):
                import traceback
                self.logger.error("Traceback:")
                traceback.print_tb(e.__traceback__)
            return None

    async def execute_swap(
        self,
        input_token: str,
        output_token: str,
        amount: float
    ) -> bool:
        """Execute a token swap"""
        try:
            # Convert amount to proper decimals (USDC has 6 decimals)
            amount_raw = int(amount * 1e6)
            
            params = {
                "inputMint": str(input_token),
                "outputMint": str(output_token),
                "amount": str(amount_raw),
                "slippageBps": "100",
                "onlyDirectRoutes": "false",
                "asLegacyTransaction": "true"
            }
            
            url = "https://quote-api.jup.ag/v6/quote"
            
            self.logger.info("\nJupiter Quote Request:")
            self.logger.info(f"Input Token: {input_token}")
            self.logger.info(f"Output Token: {output_token}")
            self.logger.info(f"Amount USD: ${amount:.2f}")
            self.logger.info(f"Amount Raw: {amount_raw}")
            self.logger.info(f"Full URL: {url}?{urllib.parse.urlencode(params)}")

            connector = aiohttp.TCPConnector(family=socket.AF_INET)
            
            async with aiohttp.ClientSession(connector=connector) as session:
                async with session.get(url, params=params) as response:
                    response_text = await response.text()
                    self.logger.info(f"Response Status: {response.status}")
                    self.logger.info(f"Raw Response: {response_text}")
                    
                    if not response.ok:
                        self.logger.error(f"Jupiter API error: {response.status}")
                        self.logger.error(f"Response headers: {dict(response.headers)}")
                        self.logger.error(f"Response body: {response_text}")
                        return None
                        
                    try:
                        data = json.loads(response_text)
                    except json.JSONDecodeError as e:
                        self.logger.error(f"Failed to parse JSON response: {e}")
                        self.logger.error(f"Invalid JSON: {response_text}")
                        return None
                    
                    # Vérifier que les champs requis sont présents
                    if not all(key in data for key in ['inputMint', 'outputMint', 'inAmount', 'outAmount']):
                        self.logger.error("Missing required fields in response")
                        self.logger.error(f"Response data: {json.dumps(data, indent=2)}")
                        return None
                    
                    self.logger.info("Quote received successfully:")
                    self.logger.info(f"Input amount: {data['inAmount']}")
                    self.logger.info(f"Output amount: {data['outAmount']}")
                    self.logger.info(f"Price impact: {data.get('priceImpactPct', 'N/A')}%")
                    
                    return data
                    
        except Exception as e:
            self.logger.error(f"Error getting Jupiter quote: {str(e)}")
            if hasattr(e, '__traceback__'):
                import traceback
                self.logger.error("Traceback:")
                traceback.print_tb(e.__traceback__)
            return None

    async def get_jupiter_transaction(
        self, 
        quote_data: dict,
        wallet_address: str
    ) -> Optional[bytes]:
        """Get swap transaction from Jupiter"""
        try:
            url = "https://quote-api.jup.ag/v6/swap"
            
            swap_data = {
                "quoteResponse": quote_data,
                "userPublicKey": wallet_address,
                "wrapAndUnwrapSol": False,
                "asLegacyTransaction": True,  # Force legacy transaction format
                "dynamicComputeUnitLimit": True,
                "prioritizationFeeLamports": {
                    "priorityLevelWithMaxLamports": {
                        "maxLamports": 10000000,
                        "priorityLevel": "high"
                    }
                },
                "dynamicSlippage": {
                    "maxBps": 100  # 1% max slippage
                }
            }
            
            self.logger.info(f"Requesting swap transaction with data: {json.dumps(swap_data, indent=2)}")
            
            async with aiohttp.ClientSession() as session:
                async with session.post(url, json=swap_data) as response:
                    if not response.ok:
                        self.logger.error(f"Jupiter API error: {response.status}")
                        self.logger.error(f"Response: {await response.text()}")
                        return None
                        
                    transaction_data = await response.json()
                    
                    transaction_base64 = transaction_data.get('swapTransaction')
                    if not transaction_base64:
                        self.logger.error("No transaction data in response")
                        return None

                    try:
                        transaction_bytes = base64.b64decode(transaction_base64)
                        self.logger.info(f"Transaction bytes length: {len(transaction_bytes)}")
                        
                        # Log dynamic slippage report if available
                        if 'dynamicSlippageReport' in transaction_data:
                            self.logger.info("Dynamic Slippage Report:")
                            self.logger.info(json.dumps(transaction_data['dynamicSlippageReport'], indent=2))
                        
                        return transaction_bytes
                        
                    except Exception as e:
                        self.logger.error(f"Invalid transaction format: {e}")
                        return None

        except Exception as e:
            self.logger.error(f"Error getting swap transaction: {e}")
            return None

async def execute_test_trade():
    """Test function to execute a small USDC -> SOL trade"""
    try:
        # Initialize executor
        executor = JupiterTradeExecutor()
        
        # USDC and SOL mint addresses
        USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
        SOL_MINT = "So11111111111111111111111111111111111111112"
        
        # Test wallet address (replace with your wallet)
        wallet_address = os.getenv('STRATEGY_WALLET_ADDRESS')
        
        if not wallet_address:
            raise ValueError("STRATEGY_WALLET_ADDRESS not found in environment")
        
        # Get quote for 1 USDC -> SOL
        quote = await executor.get_jupiter_quote(
            input_token=USDC_MINT,
            output_token=SOL_MINT,
            amount=1.0  # 1 USDC
        )
        
        if not quote:
            raise Exception("Failed to get quote")
            
        # Get transaction
        transaction_bytes = await executor.get_jupiter_transaction(
            quote_data=quote,
            wallet_address=wallet_address
        )
        
        if not transaction_bytes:
            raise Exception("Failed to get transaction")
            
        logger.info("✅ Successfully generated swap transaction")
        logger.info(f"Transaction size: {len(transaction_bytes)} bytes")
        
        # Note: Actual transaction signing and sending would go here
        # But we're just testing the Jupiter API integration for now
        
    except Exception as e:
        logger.error(f"Test trade failed: {e}")
        raise

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

    async def execute_trade_with_retries(self, transaction: Transaction, max_retries: int = 3) -> Optional[str]:
        """Execute a trade transaction with retries and return signature if successful"""
        client = AsyncClient("https://api.mainnet-beta.solana.com")
        try:
            for attempt in range(max_retries):
                try:
                    result = await client.send_transaction(
                        transaction,
                        opts=TxOpts(
                            skip_preflight=False,
                            preflight_commitment="confirmed",
                            max_retries=2
                        )
                    )
                    
                    if result.value:
                        self.logger.info(f"✅ Transaction successful!")
                        self.logger.info(f"Transaction signature: {result.value}")
                        return str(result.value)
                        
                except Exception as e:
                    if attempt == max_retries - 1:
                        raise
                    self.logger.warning(f"Attempt {attempt + 1} failed, retrying...")
                    await asyncio.sleep(1)
            return None
        finally:
            await client.close()

    async def prepare_transaction(self, transaction_bytes: bytes) -> Optional[Transaction]:
        """Prepare a transaction from bytes with fresh blockhash"""
        try:
            client = AsyncClient("https://api.mainnet-beta.solana.com")
            try:
                # Get fresh blockhash
                blockhash = await client.get_latest_blockhash()
                if not blockhash or not blockhash.value:
                    raise Exception("Failed to get recent blockhash")

                # Deserialize original transaction
                original_transaction = Transaction.from_bytes(transaction_bytes)

                # Convert CompiledInstructions to Instructions
                instructions = []
                for compiled_instruction in original_transaction.message.instructions:
                    program_id = original_transaction.message.account_keys[compiled_instruction.program_id_index]
                    header = original_transaction.message.header
                    account_keys = original_transaction.message.account_keys
                    
                    writable_signers = header.num_required_signatures - header.num_readonly_signed_accounts
                    total_non_signers = len(account_keys) - header.num_required_signatures
                    writable_non_signers = total_non_signers - header.num_readonly_unsigned_accounts
                    
                    account_metas = []
                    for idx in compiled_instruction.accounts:
                        pubkey = account_keys[idx]
                        is_signer = idx < header.num_required_signatures
                        if is_signer:
                            is_writable = idx < writable_signers
                        else:
                            non_signer_idx = idx - header.num_required_signatures
                            is_writable = non_signer_idx < writable_non_signers
                        
                        account_meta = AccountMeta(
                            pubkey=pubkey,
                            is_signer=is_signer,
                            is_writable=is_writable
                        )
                        account_metas.append(account_meta)
                    
                    instruction = Instruction(
                        program_id=program_id,
                        accounts=account_metas,
                        data=compiled_instruction.data
                    )
                    instructions.append(instruction)

                # Create new message with converted instructions
                new_message = Message.new_with_blockhash(
                    instructions,
                    self.wallet_keypair.pubkey(),
                    blockhash.value.blockhash
                )

                # Create and sign new transaction
                new_transaction = Transaction.new_unsigned(message=new_message)
                new_transaction.sign(
                    [self.wallet_keypair],
                    new_transaction.message.recent_blockhash
                )

                return new_transaction

            finally:
                await client.close()

        except Exception as e:
            self.logger.error(f"Error preparing transaction: {e}")
            return None

if __name__ == "__main__":
    try:
        asyncio.run(execute_test_trade())
    except KeyboardInterrupt:
        print("\nScript interrupted by user")
    except Exception as e:
        print(f"Script failed: {e}")
