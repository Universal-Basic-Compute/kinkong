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
from solana.rpc.async_api import AsyncClient
from solana.transaction import Transaction
import base58
from spl.token.constants import TOKEN_PROGRAM_ID

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
        
        # Initialize logger
        self.logger = logging.getLogger(__name__)
        self.logger.setLevel(logging.INFO)
        
        # Add handler if none exist
        if not self.logger.handlers:
            handler = logging.StreamHandler()
            formatter = logging.Formatter(
                '%(asctime)s - %(levelname)s - %(message)s',
                datefmt='%Y-%m-%d %H:%M:%S'
            )
            handler.setFormatter(formatter)
            self.logger.addHandler(handler)

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

            current_price = self.get_current_price(token_mint)
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

    def get_current_price(self, token_mint: str) -> Optional[float]:
        """Get current token price from Birdeye or DexScreener"""
        try:
            # First try Birdeye
            birdeye_url = f"https://public-api.birdeye.so/public/price?address={token_mint}"
            birdeye_headers = {
                'x-api-key': os.getenv('BIRDEYE_API_KEY'),
                'accept': 'application/json'
            }
            
            response = requests.get(birdeye_url, headers=birdeye_headers)
            if response.status_code == 200:
                data = response.json()
                if data.get('success'):
                    return float(data['data']['value'])
        
            # If Birdeye fails, try DexScreener
            logger.info(f"Falling back to DexScreener for {token_mint}")
            dexscreener_url = f"https://api.dexscreener.com/latest/dex/tokens/{token_mint}"
            dexscreener_headers = {
                'User-Agent': 'Mozilla/5.0',
                'Accept': 'application/json'
            }
            
            response = requests.get(dexscreener_url, headers=dexscreener_headers)
            if response.ok:
                data = response.json()
                
                if not data.get('pairs'):
                    logger.warning(f"No pairs found for token {token_mint}")
                    return None
                    
                # Get all Solana pairs
                sol_pairs = [p for p in data['pairs'] if p.get('chainId') == 'solana']
                if not sol_pairs:
                    logger.warning(f"No Solana pairs found for token {token_mint}")
                    return None
                    
                # Get the most liquid pair
                main_pair = max(sol_pairs, key=lambda x: float(x.get('liquidity', {}).get('usd', 0) or 0))
                price = float(main_pair.get('priceUsd', 0))
                
                logger.info(f"Got price from DexScreener: ${price:.4f}")
                return price

            logger.warning(f"Failed to get price from both APIs for {token_mint}")
            return None

        except Exception as e:
            logger.error(f"Error getting price: {e}")
            return None

    async def handle_failed_trade(self, trade_id: str, error_message: str):
        """Handle failed trade updates"""
        try:
            self.trades_table.update(trade_id, {
                'status': 'FAILED',
                'error': error_message,
                'failedAt': datetime.now(timezone.utc).isoformat()
            })
        except Exception as e:
            self.logger.error(f"Error updating failed trade status: {e}")

    async def execute_trade(self, signal: Dict) -> bool:
        """Execute a trade for a signal"""
        try:
            # First check if trade already exists
            try:
                existing_trades = self.trades_table.get_all(
                    formula=f"{{signalId}} = '{signal['id']}'"
                )
            except Exception as e:
                self.logger.error(f"Failed to check existing trades: {e}")
                return False

            if existing_trades:
                self.logger.warning(f"Trade already exists for signal {signal['id']}")
                return False

            # Get token mint with error handling
            try:
                tokens_table = Airtable(self.base_id, 'TOKENS', self.api_key)
                token_records = tokens_table.get_all(
                    formula=f"{{token}}='{signal['fields']['token']}'"
                )
            except Exception as e:
                self.logger.error(f"Failed to fetch token data: {e}")
                return False

            if not token_records:
                self.logger.error(f"Token {signal['fields']['token']} not found in TOKENS table")
                return False

            token_mint = token_records[0]['fields'].get('mint')
            if not token_mint:
                self.logger.error(f"No mint address found for token {signal['fields']['token']}")
                return False

            # Initialize Solana client with error handling
            try:
                client = AsyncClient("https://api.mainnet-beta.solana.com")
                await client.is_connected()  # Test connection
            except Exception as e:
                self.logger.error(f"Failed to initialize Solana client: {e}")
                return False

            # Load wallet with validation
            try:
                private_key = os.getenv('STRATEGY_WALLET_PRIVATE_KEY')
                if not private_key:
                    self.logger.error("STRATEGY_WALLET_PRIVATE_KEY not found")
                    return False
                
                # Convert base58 private key to bytes
                private_key_bytes = base58.b58decode(private_key)
                
                # Create keypair from bytes
                wallet_keypair = Keypair.from_bytes(private_key_bytes)
                
                # Get USDC ATA using Solders types directly
                usdc_mint = Pubkey.from_string(USDC_MINT)
                usdc_ata = get_associated_token_address(
                    owner=wallet_keypair.pubkey(),
                    mint=usdc_mint
                )
                
                # Convert back to string for RPC call
                usdc_balance = await client.get_token_account_balance(str(usdc_ata))
                
                if not usdc_balance or float(usdc_balance.value.amount) / 1e6 < 10:  # Minimum $10 USDC
                    self.logger.error("Insufficient USDC balance")
                    return False
            except Exception as e:
                self.logger.error(f"Wallet initialization failed: {e}")
                return False

            # Calculate trade amount with validation
            try:
                entry_price = float(signal['fields']['entryPrice'])
                trade_amount = await self.calculate_trade_amount(
                    client,
                    wallet_keypair,
                    entry_price
                )
                if trade_amount <= 0:
                    self.logger.error("Invalid trade amount calculated")
                    return False
            except Exception as e:
                self.logger.error(f"Trade amount calculation failed: {e}")
                return False

            # Create trade record with error handling
            try:
                trade_data = {
                    'signalId': signal['id'],
                    'token': signal['fields']['token'],
                    'type': 'BUY',
                    'timeframe': signal['fields']['timeframe'],
                    'status': 'PENDING',
                    'entryPrice': entry_price,
                    'targetPrice': float(signal['fields']['targetPrice']),
                    'stopLoss': float(signal['fields']['stopLoss']),
                    'createdAt': datetime.now(timezone.utc).isoformat(),
                    'amount': trade_amount,
                    'entryValue': trade_amount * entry_price
                }
                trade = self.trades_table.insert(trade_data)
            except Exception as e:
                self.logger.error(f"Failed to create trade record: {e}")
                return False

            # Execute transaction with proper cleanup
            try:
                transaction = await self.create_buy_transaction(
                    client,
                    token_mint,
                    trade_amount,
                    wallet_keypair
                )
                
                result = await client.send_transaction(transaction)
                
                if result.value:
                    transaction_url = f"https://solscan.io/tx/{result.value}"
                    try:
                        self.trades_table.update(trade['id'], {
                            'status': 'EXECUTED',
                            'transactionUrl': transaction_url,
                            'executedAt': datetime.now(timezone.utc).isoformat()
                        })
                    except Exception as e:
                        self.logger.error(f"Failed to update trade status: {e}")
                        # Don't return False here as trade was executed
                    
                    self.logger.info(f"Trade executed successfully: {transaction_url}")
                    return True
                else:
                    self.logger.error("Transaction failed with no error")
                    await self.handle_failed_trade(trade['id'], "Transaction failed with no error")
                    return False

            except Exception as e:
                self.logger.error(f"Transaction execution failed: {e}")
                await self.handle_failed_trade(trade['id'], str(e))
                return False

        except Exception as e:
            self.logger.error(f"Unexpected error in execute_trade: {e}")
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
