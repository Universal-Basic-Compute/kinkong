import sys
from pathlib import Path
import os

# Get absolute path to project root
project_root = Path(__file__).parent.parent.absolute()

# Add project root to Python path
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

# Debug prints
print("\nCurrent working directory:", os.getcwd())
print("Project root:", project_root)
print("Python path:", sys.path)

# Now try the import
try:
    from execute_trade import JupiterTradeExecutor
except ImportError as e:
    print(f"\nImport failed: {e}")
    print("\nTrying alternate import path...")
    try:
        from engine.execute_trade import JupiterTradeExecutor
    except ImportError as e:
        print(f"Alternate import also failed: {e}")
        raise

import os
from datetime import datetime, timezone, timedelta
import asyncio
import requests
import aiohttp
from airtable import Airtable
from dotenv import load_dotenv
from solders.transaction import Transaction
from solders.message import Message
from solders.instruction import AccountMeta, Instruction
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
            
            # Get BUY signals that haven't expired AND have HIGH confidence
            signals = self.signals_table.get_all(
                formula=f"AND("
                f"{{type}}='BUY', "
                f"{{confidence}}='HIGH', "
                f"IS_AFTER({{expiryDate}}, '{now}'))"
            )
        
            logger.info(f"Found {len(signals)} active HIGH confidence BUY signals")

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
            # Check if trade already exists for this signal
            existing_trades = self.trades_table.get_all(
                formula=f"{{signalId}} = '{signal['id']}'"
            )
            
            if existing_trades:
                # Only block if there's an existing trade that's not FAILED
                non_failed_trades = [t for t in existing_trades if t['fields'].get('status') != 'FAILED']
                if non_failed_trades:
                    logger.warning(f"Trade already exists for signal {signal['id']} with status {non_failed_trades[0]['fields'].get('status')}")
                    return False
                else:
                    logger.info(f"Found failed trade for signal {signal['id']}, allowing retry")

            # Get current price from DexScreener API
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
            
            # Check if price is within 1.5% of entry price
            price_diff = abs(current_price - entry_price) / entry_price
            meets_conditions = price_diff <= 0.015

            logger.info(f"Signal {signal['id']} entry check:")
            logger.info(f"Entry price: {entry_price}")
            logger.info(f"Current price: {current_price}")
            logger.info(f"Price difference: {price_diff:.2%}")
            logger.info(f"Meets conditions: {meets_conditions}")

            return meets_conditions

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
                'status': 'FAILED'  # Only update the status
            })
        except Exception as e:
            self.logger.error(f"Error updating failed trade status: {e}")

    async def execute_trade(self, signal: Dict) -> bool:
        """Execute a trade for a signal"""
        try:
            logger.info("🚀 Starting trade execution...")
            
            # Create trade record first with expiryDate from signal
            trade_data = {
                'signalId': signal['id'],
                'token': signal['fields']['token'],
                'createdAt': datetime.now(timezone.utc).isoformat(),
                'type': signal['fields']['type'],
                'status': 'PENDING',
                'timeframe': signal['fields']['timeframe'],
                'entryPrice': float(signal['fields']['entryPrice']),
                'targetPrice': float(signal['fields']['targetPrice']),
                'stopLoss': float(signal['fields']['stopLoss']),
                'expiryDate': signal['fields']['expiryDate'],  # Add expiryDate from signal
                'transactionUrl': ''  # Initialize empty, will be updated after execution
            }
            
            trade = self.trades_table.insert(trade_data)
            self.logger.info(f"Created trade record: {trade['id']}")

            # Get USDC balance using Birdeye API
            usdc_balance = await self.jupiter.get_token_balance("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v")  # USDC address
            if usdc_balance <= 0:
                error_msg = "Insufficient USDC balance"
                logger.error(error_msg)
                await self.handle_failed_trade(trade['id'], error_msg)
                return False

            # Calculate trade amount (5% of USDC balance, min $10, max $1000)
            trade_value = min(usdc_balance * 0.05, 1000)  # Changed from 0.03 to 0.05
            trade_value = max(trade_value, 10)

            if trade_value < 10:
                error_msg = f"Trade value ${trade_value:.2f} below minimum $10"
                logger.error(error_msg)
                await self.handle_failed_trade(trade['id'], error_msg)
                return False

            logger.info(f"\nTrade calculation:")
            logger.info(f"USDC balance: ${usdc_balance:.2f}")
            logger.info(f"Trade value: ${trade_value:.2f} (5% of USDC balance)")

            # Calculate token amount based on entry price
            entry_price = float(signal['fields']['entryPrice'])
            token_amount = trade_value / entry_price

            # Execute validated swap with calculated amount
            success, transaction_bytes = await self.jupiter.execute_validated_swap(
                input_token="EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
                output_token=signal['fields']['mint'],
                amount=trade_value,  # Using USD value for swap
                min_amount=5.0,
                max_slippage=1.0
            )
            
            if not success or not transaction_bytes:
                await self.handle_failed_trade(trade['id'], "Swap validation failed")
                return False

            # Prepare transaction
            transaction = await self.jupiter.prepare_transaction(transaction_bytes)
            if not transaction:
                await self.handle_failed_trade(trade['id'], "Failed to prepare transaction")
                return False

            # Execute transaction
            signature = await self.jupiter.execute_trade_with_retries(transaction)
            if not signature:
                await self.handle_failed_trade(trade['id'], "Transaction failed")
                return False

            # Update trade record
            transaction_url = f"https://solscan.io/tx/{signature}"
            self.trades_table.update(trade['id'], {
                'status': 'EXECUTED',
                'txSignature': signature,  # Changed to 'txSignature'
                'amount': token_amount,  # Token amount
                'value': trade_value,    # USD value
                'price': float(signal['fields']['entryPrice']),
                'transactionUrl': transaction_url,
                'executedAt': datetime.now(timezone.utc).isoformat()
            })
            
            # Send notification
            message = f"🦍 KinKong Trade Alert\n\n"
            message += f"Token: ${signal['fields']['token']}\n"
            message += f"Action: {signal['fields']['type']}\n"
            message += f"Amount: ${trade_value:.2f} USDC\n"
            message += f"Entry Price: ${float(signal['fields']['entryPrice']):.4f}\n"
            message += f"Target: ${float(signal['fields']['targetPrice']):.4f}\n"
            message += f"Stop Loss: ${float(signal['fields']['stopLoss']):.4f}\n"
            message += f"Timeframe: {signal['fields']['timeframe']}\n\n"
            message += f"🔗 View Transaction:\n{transaction_url}"
            
            from scripts.analyze_charts import send_telegram_message
            send_telegram_message(message)
            
            return True

        except Exception as e:
            logger.error(f"Trade execution failed: {e}")
            if 'trade' in locals():
                await self.handle_failed_trade(trade['id'], str(e))
            return False

    async def check_exit_conditions(self, trade: Dict) -> Optional[str]:
        """Check if trade should be closed and return exit reason if so"""
        try:
            # Get token mint from TOKENS table
            tokens_table = Airtable(self.base_id, 'TOKENS', self.api_key)
            token_records = tokens_table.get_all(
                formula=f"{{token}}='{trade['fields'].get('token')}'")
            
            if not token_records:
                self.logger.warning(f"No token record found for {trade['fields'].get('token')}")
                return None
                
            token_mint = token_records[0]['fields'].get('mint')
            if not token_mint:
                self.logger.warning(f"No mint address found for {trade['fields'].get('token')}")
                return None

            # Get current price using mint address
            current_price = await self.get_token_price(token_mint)
            if not current_price:
                self.logger.warning(f"Could not get current price for {token_mint}")
                return None

            entry_price = float(trade['fields'].get('price', 0))
            target_price = float(trade['fields'].get('targetPrice', 0))
            stop_loss = float(trade['fields'].get('stopLoss', 0))
            created_at = datetime.fromisoformat(trade['fields'].get('createdAt').replace('Z', '+00:00'))
            
            # Calculate time elapsed
            time_elapsed = datetime.now(timezone.utc) - created_at
            max_duration = timedelta(days=45)  # Extended to 45 days
        
            # Calculate percentages
            price_change_pct = (current_price - entry_price) / entry_price * 100
            target_pct = (target_price - entry_price) / entry_price * 100
            stop_loss_pct = (stop_loss - entry_price) / entry_price * 100
        
            # Color formatting for console
            GREEN = '\033[92m'
            RED = '\033[91m'
            YELLOW = '\033[93m'
            BLUE = '\033[94m'
            ENDC = '\033[0m'
            
            # Determine price change color
            price_color = GREEN if price_change_pct >= 0 else RED
        
            self.logger.info(f"\n{BLUE}Checking exit conditions for trade {trade['id']}:{ENDC}")
            self.logger.info(f"Token: {trade['fields'].get('token')} ({token_mint})")
            self.logger.info(f"Current price: {price_color}${current_price:.4f}{ENDC}")
            self.logger.info(f"Entry price: ${entry_price:.4f}")
            self.logger.info(f"Target price: {GREEN}${target_price:.4f} (+{target_pct:.1f}%){ENDC}")
            self.logger.info(f"Stop loss: {RED}${stop_loss:.4f} ({stop_loss_pct:.1f}%){ENDC}")
            self.logger.info(f"Price change: {price_color}{price_change_pct:+.2f}%{ENDC}")
            self.logger.info(f"Time elapsed: {YELLOW}{time_elapsed.days}d {time_elapsed.seconds//3600}h{ENDC}")
        
            # Check take profit
            if current_price >= target_price:
                self.logger.info(f"{GREEN}✨ Take profit target reached!{ENDC}")
                return "TAKE_PROFIT"
            
            # Check stop loss
            if current_price <= stop_loss:
                self.logger.info(f"{RED}⚠️ Stop loss triggered!{ENDC}")
                return "STOP_LOSS"
            
            # Check expiry (after 45 days regardless of price)
            if time_elapsed >= max_duration:
                self.logger.info(f"{YELLOW}⏰ Trade duration expired{ENDC}")
                return "EXPIRED"
                
            return None
            
        except Exception as e:
            self.logger.error(f"Error checking exit conditions: {e}")
            return None

    async def get_total_portfolio_value(self) -> float:
        """Get total portfolio value using Birdeye API"""
        try:
            api_key = os.getenv('BIRDEYE_API_KEY')
            if not api_key:
                raise ValueError("BIRDEYE_API_KEY not found")

            url = "https://public-api.birdeye.so/v1/wallet/tokens"
            headers = {
                'x-api-key': api_key,
                'x-chain': 'solana',
                'accept': 'application/json'
            }
            params = {
                'wallet': self.wallet_address
            }

            async with aiohttp.ClientSession() as session:
                async with session.get(url, headers=headers, params=params) as response:
                    if response.status == 200:
                        data = await response.json()
                        if data.get('success'):
                            tokens = data.get('data', [])
                            total_value = sum(
                                float(token.get('valueUsd', 0))
                                for token in tokens
                            )
                            self.logger.info(f"Total portfolio value: ${total_value:.2f}")
                            return total_value
                    
                    self.logger.error(f"Failed to get portfolio value: {await response.text()}")
                    return 0

        except Exception as e:
            self.logger.error(f"Error getting portfolio value: {e}")
            return 0

    async def close_trade(self, trade: Dict, exit_reason: str) -> bool:
        """Close a trade by executing a sell order"""
        try:
            self.logger.info(f"Closing trade {trade['id']} - Reason: {exit_reason}")
            
            # Get token mint from TOKENS table first
            tokens_table = Airtable(self.base_id, 'TOKENS', self.api_key)
            token_records = tokens_table.get_all(
                formula=f"{{token}}='{trade['fields'].get('token')}'")
            
            if not token_records:
                self.logger.error(f"No token record found for {trade['fields'].get('token')}")
                return False
                    
            token_mint = token_records[0]['fields'].get('mint')
            if not token_mint:
                self.logger.error(f"No mint address found for {trade['fields'].get('token')}")
                return False
            
            # Get current price
            current_price = await self.get_token_price(token_mint)
            if not current_price:
                self.logger.error(f"Could not get current price for {token_mint}")
                return False

            # Use the original trade amount but divide by 100 to correct decimals
            token_amount = float(trade['fields'].get('amount', 0)) / 100  # Ajout de la division par 100
            trade_value = token_amount * current_price

            self.logger.info(f"Closing amount: {token_amount:.8f} {trade['fields'].get('token')}")
            self.logger.info(f"Current price: ${current_price:.4f}")
            self.logger.info(f"USD Value: ${trade_value:.2f}")

            # Execute trade if amount is significant
            if trade_value >= 1.0:
                # Add debug logging before swap
                self.logger.info(f"🔍 Pre-swap validation:")
                self.logger.info(f"Token amount: {token_amount}")
                self.logger.info(f"Expected USD value: ${trade_value:.2f}")

                # Validate the amount isn't unreasonably large
                if trade_value > 1000:  # Add safety check for large trades
                    self.logger.warning(f"⚠️ Trade value ${trade_value:.2f} seems unusually large!")
                    self.logger.warning("Original trade details:")
                    self.logger.warning(f"Entry amount: {trade['fields'].get('amount')}")
                    self.logger.warning(f"Entry price: ${trade['fields'].get('price', 0):.4f}")
                    
                    # Cap the trade value at the original investment + reasonable profit
                    original_value = float(trade['fields'].get('value', 0))
                    max_value = original_value * 3  # Allow up to 200% profit
                    if trade_value > max_value:
                        adjusted_token_amount = max_value / current_price
                        self.logger.warning(f"Adjusting trade amount from {token_amount:.8f} to {adjusted_token_amount:.8f}")
                        token_amount = adjusted_token_amount
                        trade_value = max_value

                success, transaction_bytes = await self.jupiter.execute_validated_swap(
                    input_token=token_mint,
                    output_token="EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",  # USDC
                    amount=token_amount,
                    min_amount=0.01,  # Changed from 1.0 to 0.01 ($0.01 minimum)
                    max_slippage=1.0
                )
                
                if not success or not transaction_bytes:
                    self.logger.error(f"Failed to execute sell order for trade {trade['id']}")
                    return False
                    
                # Execute transaction
                transaction = await self.jupiter.prepare_transaction(transaction_bytes)
                if not transaction:
                    self.logger.error(f"Failed to prepare transaction")
                    return False
                    
                signature = await self.jupiter.execute_trade_with_retries(transaction)
                if not signature:
                    self.logger.error(f"Failed to execute transaction")
                    return False
                    
                transaction_url = f"https://solscan.io/tx/{signature}"
            else:
                self.logger.info(f"Balance too small to trade (${trade_value:.2f})")
                signature = None
                transaction_url = None

            # Calculate profit/loss metrics
            entry_price = float(trade['fields'].get('price', 0))
            entry_value = entry_price * token_amount
            exit_value = current_price * token_amount
            realized_pnl = exit_value - entry_value
            roi = (realized_pnl / entry_value * 100) if entry_value > 0 else 0

            # Update trade record
            update_data = {
                'status': 'CLOSED',
                'exitReason': exit_reason,
                'exitPrice': current_price,
                'closedAt': datetime.now(timezone.utc).isoformat(),
                'realizedPnl': realized_pnl,
                'roi': roi,
                'exitValue': exit_value
            }

            if signature:
                update_data.update({
                    'closeTxSignature': signature,
                    'closeTxUrl': transaction_url,
                    'notes': f"Trade closed via {exit_reason} at ${current_price:.4f}"
                })
            else:
                update_data['notes'] = f"Closed with dust balance (${trade_value:.2f})"

            self.trades_table.update(trade['id'], update_data)
            
            # Send Telegram notification
            message = f"🦍 KinKong Trade Closed\n\n"
            message += f"Token: ${trade['fields']['token']}\n"
            message += f"Exit Reason: {exit_reason}\n"
            message += f"Entry Price: ${entry_price:.4f}\n"
            message += f"Exit Price: ${current_price:.4f}\n"
            message += f"ROI: {roi:+.2f}%\n"
            message += f"P&L: ${realized_pnl:+.2f}\n"
            message += f"USD Value: ${exit_value:.2f}\n"
            
            if transaction_url:
                message += f"\n🔗 View Transaction:\n{transaction_url}"
            
            try:
                from scripts.analyze_charts import send_telegram_message
                send_telegram_message(message)  # Remove await since function is not async
                self.logger.info("Telegram notification sent")
            except Exception as e:
                self.logger.error(f"Failed to send Telegram notification: {e}")
            
            return True
            
        except Exception as e:
            self.logger.error(f"Error closing trade: {e}")
            return False

    async def monitor_signals(self):
        """Single run to check trades and signals"""
        try:
            # First check active trades for exit conditions
            active_trades = self.trades_table.get_all(
                formula="status='EXECUTED'"
            )
            
            self.logger.info(f"Checking {len(active_trades)} active trades...")
            
            for trade in active_trades:
                try:
                    exit_reason = await self.check_exit_conditions(trade)
                    if exit_reason:
                        self.logger.info(f"Exit condition met for trade {trade['id']}: {exit_reason}")
                        if await self.close_trade(trade, exit_reason):
                            self.logger.info(f"Successfully closed trade {trade['id']}")
                        else:
                            self.logger.error(f"Failed to close trade {trade['id']}")
                except Exception as e:
                    self.logger.error(f"Error processing trade {trade['id']}: {e}")
                    continue
                
                await asyncio.sleep(2)  # Delay between trades
            
            # Then check for new signals
            self.logger.info("Checking for active signals...")
            
            try:
                signals = await self.get_active_buy_signals()
            except Exception as e:
                self.logger.error(f"Failed to fetch active signals: {e}")
                return  # Exit if we can't get signals

            for signal in signals:
                try:
                    if self.check_entry_conditions(signal):
                        self.logger.info(f"Entry conditions met for signal {signal['id']}")
                        
                        # Execute trade with timeout
                        try:
                            async with asyncio.timeout(30):  # 30 second timeout
                                if await self.execute_trade(signal):
                                    self.logger.info(f"Successfully executed trade for signal {signal['id']}")
                                else:
                                    self.logger.error(f"Failed to execute trade for signal {signal['id']}")
                        except asyncio.TimeoutError:
                            self.logger.error(f"Trade execution timed out for signal {signal['id']}")
                        except Exception as e:
                            self.logger.error(f"Error executing trade: {e}")
                
                except Exception as e:
                    self.logger.error(f"Error processing signal {signal['id']}: {e}")
                    continue

                await asyncio.sleep(2)  # Delay between signals

            self.logger.info("✅ Finished processing all trades and signals")

        except Exception as e:
            self.logger.error(f"Error in monitor process: {e}")

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
