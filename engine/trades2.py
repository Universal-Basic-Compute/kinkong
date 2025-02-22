import sys
from pathlib import Path


# Now we can import from engine
from engine.execute_trade import JupiterTradeExecutor

import os
from datetime import datetime, timezone
import asyncio
import requests
import aiohttp
from airtable import Airtable
from dotenv import load_dotenv
from solders.transaction import Transaction
from solana.rpc.types import TxOpts
import json
import logging
from typing import List, Dict, Optional
from solders.keypair import Keypair
from solders.pubkey import Pubkey
from solana.rpc.async_api import AsyncClient
from solana.rpc import types
from solana.rpc.commitment import Commitment
import base58
from spl.token.constants import TOKEN_PROGRAM_ID
from spl.token.instructions import get_associated_token_address

def setup_logging():
    """Configure logging with a single handler"""
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
        
        # Initialize Jupiter trade executor
        self.jupiter = JupiterTradeExecutor()
        
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
        """Check if trade already exists for this signal"""
        try:
            existing_trades = self.trades_table.get_all(
                formula=f"{{signalId}} = '{signal['id']}'"
            )
            
            if existing_trades:
                logger.warning(f"Trade already exists for signal {signal['id']}")
                return False

            return True

        except Exception as e:
            logger.error(f"Error checking entry conditions: {e}")
            return False

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
                'status': 'FAILED',
                'errorMessage': error_message
            })
        except Exception as e:
            self.logger.error(f"Error updating failed trade status: {e}")

    async def execute_trade(self, signal: Dict) -> bool:
        """Execute a trade for a signal using Jupiter"""
        try:
            self.logger.info(f"\nExecuting trade for signal {signal['id']}")
            
            # Create trade record first
            trade_data = {
                'signalId': signal['id'],
                'token': signal['fields']['token'],
                'createdAt': datetime.now(timezone.utc).isoformat(),
                'type': signal['fields']['type'],
                'status': 'PENDING',
                'timeframe': signal['fields']['timeframe'],
                'entryPrice': float(signal['fields']['entryPrice']),
                'targetPrice': float(signal['fields']['targetPrice']),
                'stopLoss': float(signal['fields']['stopLoss'])
            }
            
            trade = self.trades_table.insert(trade_data)
            self.logger.info(f"Created trade record: {trade['id']}")

            # Constants
            USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
            amount = 10.0  # Start with $10 USDC trades
            
            # Execute swap via Jupiter
            success, transaction_bytes = await self.jupiter.execute_validated_swap(
                input_token=USDC_MINT,
                output_token=signal['fields']['mint'],
                amount=amount,
                min_amount=5.0,  # Minimum $5 USDC
                max_slippage=1.0  # Maximum 1% slippage
            )

            if not success or not transaction_bytes:
                await self.handle_failed_trade(trade['id'], "Swap validation failed")
                return False

            # Initialize Solana client
            client = AsyncClient("https://api.mainnet-beta.solana.com")
            
            try:
                # Get fresh blockhash
                blockhash = await client.get_latest_blockhash()
                if not blockhash or not blockhash.value:
                    raise Exception("Failed to get recent blockhash")

                # Deserialize and sign transaction
                transaction = Transaction.from_bytes(transaction_bytes)
                transaction.message.recent_blockhash = blockhash.value.blockhash
                transaction.sign([self.wallet_keypair])

                # Send transaction
                result = await client.send_transaction(
                    transaction,
                    opts=TxOpts(
                        skip_preflight=False,
                        preflight_commitment="confirmed",
                        max_retries=3
                    )
                )

                if result.value:
                    # Update trade record with success
                    transaction_url = f"https://solscan.io/tx/{result.value}"
                    self.trades_table.update(trade['id'], {
                        'status': 'EXECUTED',
                        'signature': result.value,
                        'amount': amount,
                        'price': float(signal['fields']['entryPrice']),
                        'value': amount
                    })
                    
                    self.logger.info(f"Trade executed successfully: {transaction_url}")
                    
                    # Update notification with more details and gorilla emoji
                    message = f"🦍 KinKong Trade Alert\n\n"
                    message += f"Token: ${signal['fields']['token']}\n"
                    message += f"Action: {signal['fields']['type']}\n"
                    message += f"Amount: ${amount:.2f} USDC\n"
                    message += f"Entry Price: ${float(signal['fields']['entryPrice']):.4f}\n"
                    message += f"Target: ${float(signal['fields']['targetPrice']):.4f}\n"
                    message += f"Stop Loss: ${float(signal['fields']['stopLoss']):.4f}\n"
                    message += f"Timeframe: {signal['fields']['timeframe']}\n\n"
                    message += f"🔗 View Transaction:\n{transaction_url}"
                    
                    from scripts.analyze_charts import send_telegram_message
                    send_telegram_message(message)
                    
                    return True
                else:
                    await self.handle_failed_trade(trade['id'], "Transaction failed to confirm")
                    return False

            finally:
                await client.close()

        except Exception as e:
            self.logger.error(f"Trade execution failed: {e}")
            if 'trade' in locals():
                await self.handle_failed_trade(trade['id'], str(e))
            return False

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
