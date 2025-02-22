import sys
from pathlib import Path
import os
from datetime import datetime, timezone
import asyncio
import requests
from airtable import Airtable
from dotenv import load_dotenv
import json
import logging
from typing import List, Dict, Optional
from solders.keypair import Keypair
from solders.pubkey import Pubkey
from solders.transaction import Transaction, VersionedTransaction
from solders.message import Message, MessageV0
from solders.instruction import Instruction
from solders.hash import Hash
from solana.rpc.async_api import AsyncClient
from solana.rpc import types
from solana.rpc.commitment import Commitment
import base58
import base64
import urllib.parse
from solana.rpc.async_api import AsyncClient
from solders.pubkey import Pubkey
from spl.token.constants import TOKEN_PROGRAM_ID
from spl.token.instructions import get_associated_token_address

def setup_logging():
    """Configure logging with a single handler"""
    logger = logging.getLogger(__name__)
    
    # Only add handler if none exist to avoid duplicates
    if not logger.handlers:
        handler = logging.StreamHandler()
        formatter = logging.Formatter(
            '%(asctime)s - %(levelname)s - %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        )
        handler.setFormatter(formatter)
        logger.addHandler(handler)
        
    # Force logging level to INFO
    logger.setLevel(logging.INFO)
    
    # Ensure parent loggers don't filter our messages
    logger.propagate = False
    
    return logger

# Set Windows event loop policy
if os.name == 'nt':  # Windows
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

def get_associated_token_address(owner: Pubkey, mint: Pubkey) -> Pubkey:
    """Derive the associated token account address"""
    seeds = [
        bytes(owner),
        bytes(TOKEN_PROGRAM_ID),
        bytes(mint)
    ]
    return Pubkey.find_program_address(seeds, TOKEN_PROGRAM_ID)[0]
import json
from spl.token.instructions import get_associated_token_address
import base58
from decimal import Decimal
import aiohttp

# Solana USDC mint address
USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"

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

# Initialize logger
logger = setup_logging()

class TradeExecutor:
    def __init__(self):
        load_dotenv()
        self.base_id = os.getenv('KINKONG_AIRTABLE_BASE_ID')
        self.api_key = os.getenv('KINKONG_AIRTABLE_API_KEY')
        self.signals_table = Airtable(self.base_id, 'SIGNALS', self.api_key)
        self.trades_table = Airtable(self.base_id, 'TRADES', self.api_key)
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


    async def get_active_buy_signals(self) -> List[Dict]:
        """Get all non-expired BUY signals"""
        try:
            now = datetime.now(timezone.utc).isoformat()
            
            # Get BUY signals that haven't expired
            signals = self.signals_table.get_all(
                formula=f"AND("
                f"{{type}}='BUY', "
                f"IS_AFTER({{expiryDate}}, '{now}'))"
            )
            
            logger.info(f"Found {len(signals)} active BUY signals")

            # Get token data from TOKENS table
            tokens_table = Airtable(self.base_id, 'TOKENS', self.api_key)
            tokens = {
                record['fields'].get('token'): record['fields'].get('mint')
                for record in tokens_table.get_all()
            }

            # Enrich signals with mint addresses
            enriched_signals = []
            for signal in signals:
                token_name = signal['fields'].get('token')
                if token_name and token_name in tokens:
                    signal['fields']['mint'] = tokens[token_name]
                    enriched_signals.append(signal)
                else:
                    logger.warning(f"Could not find mint address for token {token_name}")

            logger.info(f"Enriched {len(enriched_signals)} signals with mint addresses")
            return enriched_signals
            
        except Exception as e:
            logger.error(f"Error fetching active signals: {e}")
            return []

    def check_entry_conditions(self, signal: Dict) -> bool:
        """Check if entry conditions are met for a signal"""
        try:
            # First check if trade already exists for this signal
            existing_trades = self.trades_table.get_all(
                formula=f"{{signalId}} = '{signal['id']}'"
            )
            
            if existing_trades:
                logger.warning(f"Trade already exists for signal {signal['id']}")
                return False

            # Get current price from Birdeye API
            token_mint = signal['fields'].get('mint')
            if not token_mint:
                logger.warning(f"No mint address for signal {signal['id']}")
                return False

            # Use DexScreener API for current price
            url = f"https://api.dexscreener.com/latest/dex/tokens/{token_mint}"
            headers = {
                'User-Agent': 'Mozilla/5.0',
                'Accept': 'application/json'
            }
            
            response = requests.get(url, headers=headers)
            if not response.ok:
                logger.error(f"DexScreener API error: {response.status_code}")
                return False
                
            data = response.json()
            if not data.get('pairs'):
                logger.warning(f"No pairs found for token {token_mint}")
                return False
                
            # Get most liquid Solana pair
            sol_pairs = [p for p in data['pairs'] if p.get('chainId') == 'solana']
            if not sol_pairs:
                logger.warning(f"No Solana pairs found for {token_mint}")
                return False
                
            main_pair = max(sol_pairs, key=lambda x: float(x.get('liquidity', {}).get('usd', 0) or 0))
            current_price = float(main_pair.get('priceUsd', 0))
            
            if not current_price:
                logger.error(f"Could not get current price for {token_mint}")
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

    async def create_buy_transaction(
        self,
        client: AsyncClient,
        token_mint: str,
        amount: float,
        wallet_keypair: Keypair
    ) -> Transaction:
        """Create a buy transaction using Jupiter SDK"""
        try:
            # Get the ATA for the token
            token_account = get_associated_token_address(
                owner=wallet_keypair.public_key,
                mint=Pubkey.from_string(token_mint)
            )

            # Use Jupiter API to get the swap route
            route_url = f"https://quote-api.jup.ag/v6/quote"
            params = {
                "inputMint": USDC_MINT,  # Changed from SOL to USDC
                "outputMint": token_mint,
                "amount": str(int(amount * 1e6)),  # Convert to USDC decimals
                "slippageBps": 100  # 1% slippage
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.get(route_url, params=params) as response:
                    route_data = await response.json()

            # Get the transaction data
            swap_url = "https://quote-api.jup.ag/v6/swap"
            swap_data = {
                "quoteResponse": route_data,
                "userPublicKey": str(wallet_keypair.public_key),
                "wrapUnwrapSOL": False  # Changed to False since we're using USDC
            }

            async with aiohttp.ClientSession() as session:
                async with session.post(swap_url, json=swap_data) as response:
                    transaction_data = await response.json()

            # Create and sign transaction
            transaction = Transaction.deserialize(base58.b58decode(transaction_data['swapTransaction']))
            transaction.sign(wallet_keypair)

            return transaction

        except Exception as e:
            self.logger.error(f"Failed to create buy transaction: {e}")
            raise

    async def calculate_trade_amount(
        self,
        client: AsyncClient,
        wallet_keypair: Keypair,
        entry_price: float
    ) -> float:
        """Calculate trade amount with 3% allocation, min $10, max $1000"""
        try:
            # Get USDC token account
            usdc_ata = get_associated_token_address(
                owner=wallet_keypair.public_key,
                mint=Pubkey.from_string(USDC_MINT)
            )
            
            # Get USDC balance
            token_balance = await client.get_token_account_balance(usdc_ata)
            if not token_balance:
                self.logger.error("Failed to get USDC balance")
                return 0
                
            # Calculate wallet value in USD (USDC balance is already in USD)
            wallet_value_usd = float(token_balance.value.amount) / 10**6  # Convert from decimals
            
            # Calculate 3% of wallet value
            trade_value_usd = wallet_value_usd * 0.03
            
            # Apply min/max constraints
            trade_value_usd = max(10.0, min(1000.0, trade_value_usd))
            
            # Convert to token amount based on entry price
            token_amount = trade_value_usd / entry_price
            
            self.logger.info(f"Trade calculation:")
            self.logger.info(f"USDC balance: ${wallet_value_usd:.2f}")
            self.logger.info(f"Trade value: ${trade_value_usd:.2f}")
            self.logger.info(f"Token amount: {token_amount:.4f}")
            
            return token_amount

        except Exception as e:
            self.logger.error(f"Error calculating trade amount: {e}")
            raise

    async def get_token_price(self, token_mint: str) -> Optional[float]:
        """Get current token price from Birdeye API"""
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
                            
                    self.logger.error(f"Failed to get price from Birdeye: {await response.text()}")
                    
            # Fallback to DexScreener
            self.logger.info(f"Falling back to DexScreener for {token_mint}")
            dexscreener_url = f"https://api.dexscreener.com/latest/dex/tokens/{token_mint}"
            
            async with aiohttp.ClientSession() as session:
                async with session.get(dexscreener_url) as response:
                    if response.status == 200:
                        data = await response.json()
                        pairs = data.get('pairs', [])
                        if pairs:
                            # Use most liquid pair
                            best_pair = max(pairs, key=lambda x: float(x.get('liquidity', {}).get('usd', 0) or 0))
                            return float(best_pair.get('priceUsd', 0))
                            
            self.logger.error(f"Could not get price for {token_mint}")
            return None
            
        except Exception as e:
            self.logger.error(f"Error getting token price: {str(e)}")
            return None

    async def handle_failed_trade(self, trade_id: str, error_message: str):
        """Handle failed trade updates"""
        try:
            self.trades_table.update(trade_id, {
                'status': 'FAILED'  # Only update the status
            })
        except Exception as e:
            self.logger.error(f"Error updating failed trade status: {e}")

    async def get_jupiter_quote(self, input_token: str, output_token: str, amount: float) -> Optional[Dict]:
        """Get quote from Jupiter with proper amount handling"""
        try:
            # Convert amount to proper decimals (USDC has 6 decimals)
            amount_raw = int(amount * 1e6)  # Convert to USDC decimals
            
            params = {
                "inputMint": str(input_token),
                "outputMint": str(output_token),
                "amount": str(amount_raw),
                "slippageBps": "100",
                "onlyDirectRoutes": "false",  # Allow indirect routes
                "asLegacyTransaction": "true"  # Force legacy transaction format
            }
            
            url = "https://quote-api.jup.ag/v6/quote"
            
            self.logger.info("\nJupiter Quote Request:")
            self.logger.info(f"Input Token: {input_token}")
            self.logger.info(f"Output Token: {output_token}")
            self.logger.info(f"Amount USD: ${amount:.2f}")
            self.logger.info(f"Amount Raw: {amount_raw}")
            self.logger.info(f"Full URL: {url}?{urllib.parse.urlencode(params)}")
            
            async with aiohttp.ClientSession() as session:
                try:
                    async with session.get(url, params=params) as response:
                        # Log raw response
                        response_text = await response.text()
                        self.logger.info(f"Response Status: {response.status}")
                        self.logger.info(f"Raw Response: {response_text}")
                        
                        if not response.ok:
                            self.logger.error(f"Jupiter API HTTP error: {response.status}")
                            self.logger.error(f"Response headers: {dict(response.headers)}")
                            self.logger.error(f"Response body: {response_text}")
                            return None
                            
                        try:
                            data = json.loads(response_text)
                        except json.JSONDecodeError as e:
                            self.logger.error(f"Failed to parse JSON response: {e}")
                            self.logger.error(f"Invalid JSON: {response_text}")
                            return None
                        
                        # Log parsed response
                        self.logger.info(f"Parsed Response: {json.dumps(data, indent=2)}")
                        
                        if not data.get('success'):
                            error_msg = data.get('error', 'No error message provided')
                            self.logger.error(f"Jupiter API returned error: {error_msg}")
                            
                            # Check specific error conditions
                            if "Could not find any route" in str(error_msg):
                                self.logger.error("No liquidity route found - possible reasons:")
                                self.logger.error("- Insufficient liquidity in pools")
                                self.logger.error("- Token pair not supported")
                                self.logger.error("- Amount too small or too large")
                                self.logger.error(f"Attempted amount: {amount}")
                            return None
                            
                        quote_data = data.get('data', {})
                        
                        # Validate quote data
                        if not quote_data.get('outAmount'):
                            self.logger.error("Quote missing output amount")
                            self.logger.error(f"Quote data: {json.dumps(quote_data, indent=2)}")
                            return None
                        
                        # Log successful quote details    
                        self.logger.info("Quote received successfully:")
                        self.logger.info(f"Input amount: {quote_data.get('inAmount')}")
                        self.logger.info(f"Output amount: {quote_data.get('outAmount')}")
                        self.logger.info(f"Price impact: {quote_data.get('priceImpactPct')}%")
                        
                        return quote_data
                        
                except aiohttp.ClientError as e:
                    self.logger.error(f"HTTP request failed: {str(e)}")
                    return None
                    
        except Exception as e:
            self.logger.error(f"Error getting Jupiter quote: {str(e)}")
            if hasattr(e, '__traceback__'):
                import traceback
                self.logger.error("Traceback:")
                traceback.print_tb(e.__traceback__)
            return None

    async def get_jupiter_transaction(self, quote_data: dict) -> Optional[bytes]:
        """Get swap transaction from Jupiter"""
        try:
            url = "https://quote-api.jup.ag/v6/swap"
            swap_data = {
                "quoteResponse": quote_data,
                "userPublicKey": self.wallet_address,
                "wrapAndUnwrapSol": False,
                "asLegacyTransaction": True,  # Force legacy transaction format
                "dynamicComputeUnitLimit": True,
                "prioritizationFeeLamports": {
                    "priorityLevelWithMaxLamports": {
                        "maxLamports": 10000000,
                        "priorityLevel": "high"
                    }
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
                    
                    # Get transaction data
                    transaction_base64 = transaction_data.get('swapTransaction')
                    if not transaction_base64:
                        self.logger.error("No transaction data in response")
                        return None

                    # Decode and validate transaction
                    try:
                        transaction_bytes = base64.b64decode(transaction_base64)
                        self.logger.info(f"Transaction bytes length: {len(transaction_bytes)}")
                        
                        # Deserialize as legacy transaction
                        Transaction.from_bytes(transaction_bytes)
                        return transaction_bytes
                        
                    except Exception as e:
                        self.logger.error(f"Invalid transaction format: {e}")
                        return None

        except Exception as e:
            self.logger.error(f"Error getting swap transaction: {e}")
            return None

    async def execute_trade(self, signal: Dict) -> bool:
        """Execute a trade for a signal"""
        try:
            self.logger.info(f"\nExecuting trade for signal {signal['id']}")
            
            # Validate wallet first
            if not self.wallet_keypair or not self.wallet_address:
                self.logger.error("No wallet configured")
                return False
                
            # Get USDC balance first
            balance = await self.get_usdc_balance(self.wallet_address)
            if balance <= 0:
                self.logger.error("Could not get USDC balance")
                return False
            if balance < 10:
                self.logger.error(f"Insufficient USDC balance: ${balance:.2f}")
                return False
                
            # Get current token price
            token_price = await self.get_token_price(signal['fields']['mint'])
            if not token_price:
                self.logger.error("Could not get token price")
                return False
                
            # Calculate trade amount (3% of balance, min $10, max $1000)
            trade_amount_usd = min(balance * 0.03, 1000)
            trade_amount_usd = max(trade_amount_usd, 10)
            
            self.logger.info(f"\nTrade calculation:")
            self.logger.info(f"USDC balance: ${balance:.2f}")
            self.logger.info(f"Trade amount: ${trade_amount_usd:.2f}")
            self.logger.info(f"Token price: ${token_price:.4f}")

            # Create trade record BEFORE execution
            try:
                trade_data = {
                    'signalId': signal['id'],
                    'token': signal['fields']['token'],
                    'createdAt': datetime.now(timezone.utc).isoformat(),
                    'type': signal['fields']['type'],  # BUY or SELL
                    'amount': 0,  # Will be updated after execution
                    'price': float(signal['fields']['entryPrice']),
                    'status': 'PENDING',
                    'timeframe': signal['fields']['timeframe'],
                    'entryPrice': float(signal['fields']['entryPrice']),
                    'targetPrice': float(signal['fields']['targetPrice']),
                    'stopLoss': float(signal['fields']['stopLoss'])
                }
                
                trade = self.trades_table.insert(trade_data)
                self.logger.info(f"Created trade record: {trade['id']}")
                
            except Exception as e:
                self.logger.error(f"Failed to create trade record: {e}")
                return False

            # Initialize Solana client
            client = AsyncClient("https://api.mainnet-beta.solana.com")
            
            # Execute trade using Jupiter API
            try:
                # Get current token price first
                token_price = await self.get_token_price(signal['fields']['mint'])
                if not token_price:
                    self.logger.error("Could not get token price for amount calculation")
                    return False

                # Calculate USD value we want to trade (3% of USDC balance, min $10, max $1000)
                trade_amount_usd = min(balance * 0.03, 1000)
                trade_amount_usd = max(trade_amount_usd, 10)

                # Convert USD amount to token amount
                token_amount = trade_amount_usd / token_price
            
                # Convert to proper decimals for Jupiter quote
                amount_raw = int(trade_amount_usd * 1e6)  # USDC has 6 decimals

                self.logger.info(f"Trade calculation:")
                self.logger.info(f"Token price: ${token_price}")
                self.logger.info(f"Trade USD value: ${trade_amount_usd:.2f}")
                self.logger.info(f"Token amount: {token_amount:.8f}")
                self.logger.info(f"Raw amount (USDC decimals): {amount_raw}")

                # Get Jupiter quote with proper amount
                quote = await self.get_jupiter_quote(
                    USDC_MINT,
                    signal['fields']['mint'],
                    amount_raw  # Pass raw amount with decimals
                )

                if not quote:
                    await self.handle_failed_trade(trade['id'], "Failed to get quote")
                    return False

                # Use Jupiter quote API endpoint
                quote_url = "https://quote-api.jup.ag/v6/quote"
                
                async with aiohttp.ClientSession() as session:
                    try:
                        # Build quote request parameters
                        quote_params = {
                            "inputMint": USDC_MINT,
                            "outputMint": signal['fields']['mint'],
                            "amount": str(int(trade_amount_usd * 1e6)),
                            "slippageBps": "100"
                        }
                        
                        async with session.get(quote_url, params=quote_params) as response:
                            if not response.ok:
                                self.logger.error(f"Failed to get Jupiter quote: {response.status}")
                                self.logger.error(f"Response text: {await response.text()}")
                                await self.handle_failed_trade(trade['id'], "Failed to get quote")
                                return False
                                
                            response_text = await response.text()
                            self.logger.info(f"Raw quote response: {response_text}")
                            
                            try:
                                quote_data = json.loads(response_text)
                            except json.JSONDecodeError as e:
                                self.logger.error(f"Failed to parse quote response: {e}")
                                self.logger.error(f"Response text causing error: {response_text}")
                                await self.handle_failed_trade(trade['id'], "Invalid quote response")
                                return False

                        # Get transaction data
                        swap_url = "https://quote-api.jup.ag/v6/swap"
                        swap_data = {
                            "quoteResponse": quote_data,
                            "userPublicKey": self.wallet_address,
                            "wrapUnwrapSOL": False
                        }
                        
                        self.logger.info(f"Requesting swap with data: {json.dumps(swap_data)}")

                        async with session.post(swap_url, json=swap_data) as response:
                            if not response.ok:
                                self.logger.error(f"Failed to get swap transaction: {response.status}")
                                self.logger.error(f"Response text: {await response.text()}")
                                await self.handle_failed_trade(trade['id'], "Failed to get swap transaction")
                                return False
                                
                            response_text = await response.text()
                            self.logger.info(f"Raw swap response: {response_text}")
                            
                            try:
                                transaction_data = json.loads(response_text)
                            except json.JSONDecodeError as e:
                                self.logger.error(f"Failed to parse swap response: {e}")
                                self.logger.error(f"Response text causing error: {response_text}")
                                await self.handle_failed_trade(trade['id'], "Invalid swap response")
                                return False

                    except Exception as e:
                        self.logger.error(f"API request error: {str(e)}")
                        await self.handle_failed_trade(trade['id'], f"API request failed: {str(e)}")
                        return False

                # Get Jupiter quote and transaction
                quote = await self.get_jupiter_quote(USDC_MINT, signal['fields']['mint'], trade_amount_usd)
                if not quote:
                    await self.handle_failed_trade(trade['id'], "Failed to get quote")
                    return False

                transaction_bytes = await self.get_jupiter_transaction(quote)
                if not transaction_bytes:
                    await self.handle_failed_trade(trade['id'], "Failed to get transaction")
                    return False

                # Create and sign transaction
                try:
                    # Always deserialize as legacy transaction since we requested it
                    transaction = Transaction.from_bytes(transaction_bytes)
                    
                    # Get fresh blockhash
                    blockhash = await client.get_latest_blockhash()
                    if not blockhash or not blockhash.value:
                        raise Exception("Failed to get recent blockhash")
                    
                    # Update transaction with new blockhash
                    transaction.message.recent_blockhash = blockhash.value.blockhash
                    
                    # Sign transaction
                    transaction.sign([self.wallet_keypair])

                    # Send transaction
                    result = await client.send_transaction(
                        transaction,
                        opts={
                            "skip_preflight": False,
                            "preflight_commitment": "confirmed",
                            "max_retries": 3
                        }
                    )
                    
                    self.logger.info(f"Transaction sent: {result.value}")
                    return True

                except Exception as e:
                    self.logger.error(f"Transaction processing error: {str(e)}")
                    if hasattr(e, '__traceback__'):
                        import traceback
                        self.logger.error("Traceback:")
                        traceback.print_tb(e.__traceback__)
                    await self.handle_failed_trade(trade['id'], str(e))
                    return False

                # Update trade record with success
                if result.value:
                    transaction_url = f"https://solscan.io/tx/{result.value}"
                    self.trades_table.update(trade['id'], {
                        'status': 'EXECUTED',
                        'signature': result.value,
                        'amount': trade_amount_usd / float(signal['fields']['entryPrice']),
                        'price': float(signal['fields']['entryPrice']),
                        'value': trade_amount_usd
                    })
                    
                    self.logger.info(f"Trade executed successfully: {transaction_url}")
                    
                    # Send notification
                    message = f"🤖 Trade Executed\n\n"
                    message += f"Token: ${signal['fields']['token']}\n"
                    message += f"Type: {signal['fields']['type']}\n"
                    message += f"Amount: ${trade_amount_usd:.2f}\n"
                    message += f"Transaction: {transaction_url}"
                    
                    from scripts.analyze_charts import send_telegram_message
                    send_telegram_message(message)
                    
                    return True

            except Exception as e:
                self.logger.error(f"Transaction error: {str(e)}")
                if hasattr(e, '__traceback__'):
                    import traceback
                    self.logger.error("Traceback:")
                    traceback.print_tb(e.__traceback__)
                await self.handle_failed_trade(trade['id'], str(e))
                return False

            finally:
                if 'client' in locals():
                    await client.close()

        except Exception as e:
            self.logger.error(f"Trade execution failed: {e}")
            if 'trade' in locals():
                await self.handle_failed_trade(trade['id'], str(e))
            return False

        finally:
            if 'client' in locals():
                await client.close()

    async def monitor_signals(self):
        """Main loop to monitor signals and execute trades"""
        while True:
            try:
                logger.info("Checking for active signals...")
                
                try:
                    signals = await self.get_active_buy_signals()
                except Exception as e:
                    logger.error(f"Failed to fetch active signals: {e}")
                    await asyncio.sleep(60)
                    continue

                for signal in signals:
                    try:
                        if self.check_entry_conditions(signal):
                            logger.info(f"Entry conditions met for signal {signal['id']}")
                            
                            # Execute trade with timeout
                            try:
                                async with asyncio.timeout(30):  # 30 second timeout
                                    if await self.execute_trade(signal):
                                        logger.info(f"Successfully executed trade for signal {signal['id']}")
                                    else:
                                        logger.error(f"Failed to execute trade for signal {signal['id']}")
                            except asyncio.TimeoutError:
                                logger.error(f"Trade execution timed out for signal {signal['id']}")
                            except Exception as e:
                                logger.error(f"Error executing trade: {e}")
                    
                    except Exception as e:
                        logger.error(f"Error processing signal {signal['id']}: {e}")
                        continue

                    # Add delay between signals
                    await asyncio.sleep(2)

                # Wait before next check
                await asyncio.sleep(60)

            except Exception as e:
                logger.error(f"Error in monitor loop: {e}")
                await asyncio.sleep(60)  # Wait before retrying

def main():
    try:
        # Verify environment variables
        required_vars = [
            'KINKONG_AIRTABLE_BASE_ID',
            'KINKONG_AIRTABLE_API_KEY',
            'BIRDEYE_API_KEY',
            'STRATEGY_WALLET_PRIVATE_KEY'
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
    async def get_usdc_balance(self, wallet_address: str) -> float:
        """Get USDC balance for wallet"""
        try:
            url = "https://public-api.birdeye.so/v1/wallet/token_balance"
            params = {
                "wallet": wallet_address,
                "token_address": USDC_MINT
            }
            headers = {
                "x-api-key": os.getenv('BIRDEYE_API_KEY'),
                "accept": "application/json"
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.get(url, params=params, headers=headers) as response:
                    if not response.ok:
                        self.logger.error(f"Balance API error: {response.status}")
                        return 0
                        
                    data = await response.json()
                    if not data.get('success'):
                        self.logger.error("Balance API returned error")
                        return 0
                        
                    return float(data['data']['uiAmount'])
                    
        except Exception as e:
            self.logger.error(f"Balance check error: {str(e)}")
            return 0
