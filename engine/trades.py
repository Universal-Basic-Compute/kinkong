import sys
from pathlib import Path
import os
import argparse
from typing import List, Dict, Optional, Literal

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
from solders.signature import Signature
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
        
        # Initialize wallet
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

    async def get_current_market_sentiment(self) -> str:
        """Get the most recent market sentiment from MARKET_SENTIMENT table"""
        try:
            sentiment_table = Airtable(self.base_id, 'MARKET_SENTIMENT', self.api_key)
            records = sentiment_table.get_all(
                sort=[('createdAt', 'desc')],
                maxRecords=1
            )
            
            if not records:
                self.logger.warning("No market sentiment found, defaulting to NEUTRAL")
                return "NEUTRAL"
                
            return records[0]['fields'].get('classification', 'NEUTRAL')
            
        except Exception as e:
            self.logger.error(f"Error getting market sentiment: {e}")
            return "NEUTRAL"  # Default to neutral if error

    async def get_allocation_percentage(self, sentiment: str) -> float:
        """Get AI tokens allocation percentage based on market sentiment"""
        allocations = {
            "BULLISH": 0.70,  # 70% in bull market
            "NEUTRAL": 0.50,  # 50% in neutral market
            "BEARISH": 0.30,  # 30% in bear market
        }
        return allocations.get(sentiment, 0.50)  # Default to neutral allocation

    async def get_active_buy_signals(self) -> List[Dict]:
        """Get all non-expired BUY signals from last 24 hours"""
        try:
            # Calculate timestamps for now and 24 hours ago
            now = datetime.now(timezone.utc).isoformat()
            twenty_four_hours_ago = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
            
            # Get BUY signals that:
            # 1. Were created in last 24 hours
            # 2. Have HIGH confidence
            # 3. Haven't expired yet
            signals = self.signals_table.get_all(
                formula=f"AND("
                f"{{type}}='BUY', "
                f"{{confidence}}='HIGH', "
                f"IS_AFTER({{createdAt}}, '{twenty_four_hours_ago}'), "
                f"IS_BEFORE({{createdAt}}, '{now}'), "
                f"IS_AFTER({{expiryDate}}, '{now}'))"  # Added expiry check
            )
        
            logger.info(f"Found {len(signals)} active HIGH confidence BUY signals from last 24h")

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
            # Add color formatting
            GREEN = '\033[92m'
            RED = '\033[91m'
            YELLOW = '\033[93m'
            BLUE = '\033[94m'
            BOLD = '\033[1m'
            ENDC = '\033[0m'

            self.logger.info(f"\n{BLUE}{BOLD}Analyzing Signal{ENDC} {signal['id']}")
            self.logger.info(f"Token: {BOLD}{signal['fields'].get('token')}{ENDC}")
            self.logger.info(f"Type: {BOLD}{signal['fields'].get('type')}{ENDC}")
            self.logger.info(f"Timeframe: {BOLD}{signal['fields'].get('timeframe')}{ENDC}")

            # Check existing trades
            existing_trades = self.trades_table.get_all(
                formula=f"{{signalId}} = '{signal['id']}'"
            )
            
            if existing_trades:
                non_failed_trades = [t for t in existing_trades if t['fields'].get('status') != 'FAILED']
                if non_failed_trades:
                    self.logger.warning(f"{YELLOW}⚠️ Trade already exists with status: {non_failed_trades[0]['fields'].get('status')}{ENDC}")
                    return False

            # Get current price
            token_mint = signal['fields'].get('mint')
            if not token_mint:
                self.logger.warning(f"{YELLOW}⚠️ No mint address found{ENDC}")
                return False

            url = f"https://api.dexscreener.com/latest/dex/tokens/{token_mint}"
            headers = {
                'User-Agent': 'Mozilla/5.0',
                'Accept': 'application/json'
            }
            
            response = requests.get(url, headers=headers)
            if not response.ok:
                self.logger.error(f"{RED}❌ DexScreener API error: {response.status_code}{ENDC}")
                return False
                
            data = response.json()
            if not data.get('pairs'):
                self.logger.warning(f"{YELLOW}⚠️ No pairs found{ENDC}")
                return False
                
            sol_pairs = [p for p in data['pairs'] if p.get('chainId') == 'solana']
            if not sol_pairs:
                self.logger.warning(f"{YELLOW}⚠️ No Solana pairs found{ENDC}")
                return False
                
            main_pair = max(sol_pairs, key=lambda x: float(x.get('liquidity', {}).get('usd', 0) or 0))
            current_price = float(main_pair.get('priceUsd', 0))
            
            if not current_price:
                self.logger.error(f"{RED}❌ Could not get current price{ENDC}")
                return False

            entry_price = float(signal['fields'].get('entryPrice', 0))
            price_diff = abs(current_price - entry_price) / entry_price
            meets_conditions = price_diff <= 0.02

            # Price analysis logs
            self.logger.info(f"\n{BOLD}Price Analysis:{ENDC}")
            self.logger.info(f"Entry Price: ${entry_price:.6f}")
            self.logger.info(f"Current Price: ${current_price:.6f}")
            self.logger.info(f"Difference: {GREEN if price_diff <= 0.02 else RED}{price_diff:.2%}{ENDC}")
            
            # Additional market data
            self.logger.info(f"\n{BOLD}Market Data:{ENDC}")
            self.logger.info(f"24h Volume: ${float(main_pair.get('volume', {}).get('h24', 0)):,.2f}")
            self.logger.info(f"Liquidity: ${float(main_pair.get('liquidity', {}).get('usd', 0)):,.2f}")
            
            # Final decision
            if meets_conditions:
                self.logger.info(f"\n{GREEN}✅ Entry conditions met{ENDC}")
            else:
                self.logger.info(f"\n{RED}❌ Price outside entry range{ENDC}")

            return meets_conditions

        except Exception as e:
            self.logger.error(f"Error checking entry conditions: {e}")
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
        """Handle failed trade updates with improved error tracking"""
        try:
            self.logger.error(f"❌ Trade {trade_id} failed: {error_message}")
            
            # Update trade with ERROR status and error message
            self.trades_table.update(trade_id, {
                'status': 'ERROR',
                'notes': error_message
            })
            
            # Send error notification
            message = f"⚠️ KinKong Trade Error\n\n"
            message += f"Trade ID: {trade_id}\n"
            message += f"Error: {error_message}\n"
            message += f"Time: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}"
            
            try:
                from scripts.analyze_charts import send_telegram_message
                send_telegram_message(message)
            except Exception as e:
                self.logger.error(f"Failed to send error notification: {e}")
                
        except Exception as e:
            self.logger.error(f"Error handling failed trade: {e}")

    async def execute_trade(self, signal: Dict) -> bool:
        """Execute a trade for a signal"""
        try:
            logger.info("🚀 Starting trade execution...")
            
            # Get token mint from TOKENS table first
            tokens_table = Airtable(self.base_id, 'TOKENS', self.api_key)
            token_records = tokens_table.get_all(
                formula=f"{{token}}='{signal['fields'].get('token')}'")
            
            if not token_records:
                logger.error(f"No token record found for {signal['fields'].get('token')}")
                return False
                    
            token_mint = token_records[0]['fields'].get('mint')
            if not token_mint:
                logger.error(f"No mint address found for {signal['fields'].get('token')}")
                return False

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

            # Get current market sentiment and allocation percentage
            sentiment = await self.get_current_market_sentiment()
            allocation_pct = await self.get_allocation_percentage(sentiment)
            
            # Calculate trade value (10% of USDC balance * allocation percentage)
            trade_value = min(usdc_balance * 0.10 * allocation_pct, 1000)  # Still cap at $1000
            trade_value = max(trade_value, 10)  # Minimum $10

            if trade_value < 10:
                error_msg = f"Trade value ${trade_value:.2f} below minimum $10"
                logger.error(error_msg)
                await self.handle_failed_trade(trade['id'], error_msg)
                return False

            logger.info(f"\nTrade calculation:")
            logger.info(f"Market Sentiment: {sentiment}")
            logger.info(f"AI Token Allocation: {allocation_pct*100:.0f}%")
            logger.info(f"USDC balance: ${usdc_balance:.2f}")
            logger.info(f"Trade value: ${trade_value:.2f} (10% of USDC * {allocation_pct*100:.0f}% allocation)")

            # Calculate token amount based on entry price (this gives the actual number of tokens)
            entry_price = float(signal['fields']['entryPrice'])
            token_amount = trade_value / entry_price  # This amount is already in correct token units

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
            # Execute transaction
            trade_result = await self.jupiter.execute_trade_with_retries(
                transaction,
                token_mint
            )
            
            # Si on a un résultat avec signature, la transaction a réussi (balance vérifiée)
            if trade_result and trade_result.get('signature'):
                # Update trade record
                transaction_url = f"https://solscan.io/tx/{trade_result['signature']}"
                self.trades_table.update(trade['id'], {
                    'status': 'EXECUTED',
                    'txSignature': trade_result['signature'],
                    'amount': trade_result['amount'],
                    'value': trade_value,
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

            # If no signature, transaction failed
            await self.handle_failed_trade(trade['id'], "Transaction failed")
            return False

        except Exception as e:
            # Ignorer l'erreur de version si on a déjà un trade_result avec signature
            if "UnsupportedTransactionVersion" in str(e) and 'trade_result' in locals() and trade_result and trade_result.get('signature'):
                logger.info("Ignoring version error since transaction is confirmed")
                return True
                
            logger.error(f"Trade execution failed: {e}")
            if 'trade' in locals():
                await self.handle_failed_trade(trade['id'], str(e))
            return False

    async def check_exit_conditions(self, trade: Dict) -> Optional[str]:
        """Check if trade should be closed and return exit reason if so"""
        try:
            # Get token info
            token = trade['fields'].get('token')
            token_mint = None

            # Get token mint from TOKENS table
            tokens_table = Airtable(self.base_id, 'TOKENS', self.api_key)
            token_records = tokens_table.get_all(
                formula=f"{{token}}='{token}'")
            
            if not token_records:
                self.logger.warning(f"No token record found for {token}")
                return None
                
            token_mint = token_records[0]['fields'].get('mint')
            if not token_mint:
                self.logger.warning(f"No mint address found for {token}")
                return None

            # Log trade details
            created_at = datetime.fromisoformat(trade['fields'].get('createdAt').replace('Z', '+00:00'))
            time_elapsed = datetime.now(timezone.utc) - created_at
            max_duration = timedelta(days=45)
            time_remaining = max_duration - time_elapsed

            self.logger.info(f"\n🕒 Trade Duration Analysis for {token}:")
            self.logger.info(f"Trade ID: {trade['id']}")
            self.logger.info(f"Entry Time: {created_at.strftime('%Y-%m-%d %H:%M:%S UTC')}")
            self.logger.info(f"Time Elapsed: {time_elapsed.days}d {time_elapsed.seconds//3600}h {(time_elapsed.seconds//60)%60}m")
            self.logger.info(f"Time Remaining: {time_remaining.days}d {time_remaining.seconds//3600}h {(time_remaining.seconds//60)%60}m")

            # Get current price using mint address
            self.logger.info(f"\n💰 Price Check:")
            self.logger.info(f"Token: {token} ({token_mint})")
            current_price = await self.get_token_price(token_mint)
            if not current_price:
                self.logger.warning(f"Could not get current price for {token_mint}")
                return None

            # Get trade parameters
            entry_price = float(trade['fields'].get('price', 0))
            target_price = float(trade['fields'].get('targetPrice', 0))
            stop_loss = float(trade['fields'].get('stopLoss', 0))
            
            # Calculate percentages
            price_change_pct = ((current_price - entry_price) / entry_price * 100) if entry_price > 0 else 0
            target_pct = ((target_price - entry_price) / entry_price * 100) if entry_price > 0 else 0
            stop_loss_pct = ((stop_loss - entry_price) / entry_price * 100) if entry_price > 0 else 0

            # Color formatting for console
            GREEN = '\033[92m'
            RED = '\033[91m'
            YELLOW = '\033[93m'
            BLUE = '\033[94m'
            ENDC = '\033[0m'
            
            # Determine price change color
            price_color = GREEN if price_change_pct >= 0 else RED

            self.logger.info(f"\n📊 Price Analysis:")
            self.logger.info(f"Current Price: {price_color}${current_price:.4f}{ENDC}")
            self.logger.info(f"Entry Price: ${entry_price:.4f}")
            self.logger.info(f"Target Price: {GREEN}${target_price:.4f} (+{target_pct:.1f}%){ENDC}")
            self.logger.info(f"Stop Loss: {RED}${stop_loss:.4f} ({stop_loss_pct:.1f}%){ENDC}")
            self.logger.info(f"Price Change: {price_color}{price_change_pct:+.2f}%{ENDC}")

            # Check conditions
            self.logger.info(f"\n🎯 Exit Conditions:")
            
            # Check take profit
            if current_price >= target_price:
                self.logger.info(f"{GREEN}✨ Take profit target reached!{ENDC}")
                return "TAKE_PROFIT"
            else:
                self.logger.info(f"Take Profit: Need {GREEN}+{((target_price/current_price)-1)*100:.2f}%{ENDC} more")
            
            # Check stop loss - handle differently for BUY vs SELL trades
            trade_type = trade['fields'].get('type', 'BUY')
            if (trade_type == 'BUY' and current_price <= stop_loss) or (trade_type == 'SELL' and current_price >= stop_loss):
                self.logger.info(f"{RED}⚠️ Stop loss triggered!{ENDC}")
                return "STOP_LOSS"
            else:
                if trade_type == 'BUY':
                    self.logger.info(f"Stop Loss: {RED}{((stop_loss/current_price)-1)*100:.2f}%{ENDC} below current price")
                else:
                    self.logger.info(f"Stop Loss: {RED}{((current_price/stop_loss)-1)*100:.2f}%{ENDC} above current price")
            
            # Check if we've reached minimum profit target for SCALP trades
            price_change_pct = ((current_price - entry_price) / entry_price * 100)
            timeframe = trade['fields'].get('timeframe', '')
            
            # Only apply minimum profit target to SCALP trades
            if timeframe == 'SCALP' and price_change_pct >= 12.0:
                self.logger.info(f"{GREEN}✨ Minimum profit target of 12% reached for SCALP trade: {price_change_pct:.2f}%{ENDC}")
                return "MIN_PROFIT_TARGET"
            
            # Check expiry
            if time_elapsed >= max_duration:
                self.logger.info(f"{YELLOW}⏰ Trade duration expired{ENDC}")
                return "EXPIRED"
            
            self.logger.info(f"{BLUE}✋ Holding position{ENDC}")
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
            
            # Get original amount from trade record
            original_amount = float(trade['fields'].get('amount', 0))
            if not original_amount:
                self.logger.error("No amount found in trade record")
                return False

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
            
            # Check current token balance
            current_balance = await self.jupiter.get_token_balance(token_mint)
            
            # Use minimum between current balance and original amount
            token_amount = min(current_balance, original_amount)
            
            # Get current price
            current_price = await self.get_token_price(token_mint)
            if not current_price:
                self.logger.error(f"Could not get current price for {token_mint}")
                return False

            trade_value = token_amount * current_price

            self.logger.info(f"Original amount: {original_amount:.8f} {trade['fields'].get('token')}")
            self.logger.info(f"Current balance: {current_balance:.8f} {trade['fields'].get('token')}")
            self.logger.info(f"Closing amount: {token_amount:.8f} {trade['fields'].get('token')}")
            self.logger.info(f"Current price: ${current_price:.4f}")
            self.logger.info(f"USD Value: ${trade_value:.2f}")

            # Get original trade value from the record
            original_value = float(trade['fields'].get('value', 0))
            
            # Calculate current trade value
            current_value = token_amount * current_price

            self.logger.info(f"Original amount: {original_amount:.8f} {trade['fields'].get('token')}")
            self.logger.info(f"Current balance: {current_balance:.8f} {trade['fields'].get('token')}")
            self.logger.info(f"Closing amount: {token_amount:.8f} {trade['fields'].get('token')}")
            self.logger.info(f"Current price: ${current_price:.4f}")
            self.logger.info(f"Original value: ${original_value:.2f}")
            self.logger.info(f"Current value: ${current_value:.2f}")

            # Protection contre les trades trop importants
            if current_value > 10000:  # Increased from 1000 to 10000 for WETH
                error_msg = f"Trade value ${current_value:.2f} exceeds maximum allowed ($10000)"
                self.logger.error(f"❌ {error_msg}")
                
                # Mettre le trade en ERROR avec les détails
                self.trades_table.update(trade['id'], {
                    'status': 'ERROR',
                    'exitReason': 'SAFETY_LIMIT',
                    'notes': error_msg,
                    'updatedAt': datetime.now(timezone.utc).isoformat()
                })
                
                # Envoyer une notification Telegram
                message = f"⚠️ KinKong Safety Alert\n\n"
                message += f"Trade {trade['id']} exceeded safety limit:\n"
                message += f"Token: {trade['fields'].get('token')}\n"
                message += f"Value: ${trade_value:.2f}\n"
                message += f"Action required: Manual intervention needed"
                
                try:
                    from scripts.analyze_charts import send_telegram_message
                    send_telegram_message(message)
                except Exception as e:
                    self.logger.error(f"Failed to send safety alert: {e}")
                
                return False

            # Execute trade if amount is significant
            if current_value >= 1.0:
                # Add debug logging before swap
                self.logger.info(f"🔍 Pre-swap validation:")
                self.logger.info(f"Token amount: {token_amount}")
                self.logger.info(f"Expected USD value: ${current_value:.2f}")

                # Validate the amount isn't unreasonably large
                if current_value > 10000:  # Increased from 1000 to 10000 for WETH
                    self.logger.warning(f"⚠️ Trade value ${current_value:.2f} seems unusually large!")
                    self.logger.warning("Original trade details:")
                    self.logger.warning(f"Entry amount: {trade['fields'].get('amount')}")
                    self.logger.warning(f"Entry price: ${trade['fields'].get('price', 0):.4f}")
                    
                    # Cap the trade value at the original investment + reasonable profit
                    max_value = original_value * 3  # Allow up to 200% profit
                    if current_value > max_value:
                        adjusted_token_amount = max_value / current_price
                        self.logger.warning(f"Adjusting trade amount from {token_amount:.8f} to {adjusted_token_amount:.8f}")
                        token_amount = adjusted_token_amount
                        current_value = max_value

                # IMPORTANT FIX: Determine token decimals and adjust amount if needed
                token_symbol = trade['fields'].get('token', '').upper()
                
                # Get token decimals using Jupiter executor's helper method
                decimals = self.jupiter.get_token_decimals(token_mint)
                
                # Log more details about the token and amount
                self.logger.info(f"Using {decimals} decimals for {token_symbol} ({token_mint})")
                self.logger.info(f"Token amount before adjustment: {token_amount}")
                
                # Double-check if the amount seems reasonable
                if token_amount > 1000000:
                    self.logger.warning(f"⚠️ Token amount {token_amount} seems unusually large!")
                    # Try to get the actual balance to verify
                    try:
                        actual_balance = await self.jupiter.get_token_balance(token_mint)
                        self.logger.info(f"Actual balance from API: {actual_balance}")
                        if actual_balance < token_amount:
                            self.logger.warning(f"⚠️ Adjusting token amount to match actual balance: {actual_balance}")
                            token_amount = actual_balance
                    except Exception as e:
                        self.logger.error(f"Error checking actual balance: {e}")
                
                # Add additional safety check based on original trade value
                if original_value > 0 and current_value > original_value * 5:
                    self.logger.warning(f"⚠️ Trade value ${current_value:.2f} is more than 5x original value ${original_value:.2f}")
                    self.logger.warning(f"Limiting to 5x original value")
                    token_amount = (original_value * 5) / current_price
                    current_value = original_value * 5
                    self.logger.warning(f"Adjusted token amount: {token_amount:.8f}")

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
                    
                signature = await self.jupiter.execute_trade_with_retries(
                    transaction,
                    token_mint  # We already have token_mint in this function
                )
                if not signature:
                    self.logger.error(f"Failed to execute transaction")
                    return False
                    
                transaction_url = f"https://solscan.io/tx/{signature}"
            else:
                self.logger.info(f"Balance too small to trade (${trade_value:.2f})")
                signature = None
                transaction_url = None

            # Calculate profit/loss metrics - FIXED CALCULATION
            entry_price = float(trade['fields'].get('price', 0))
            
            # IMPORTANT: Use the original value from the trade record
            if original_value <= 0:
                # Fallback calculation if original value is missing
                original_value = entry_price * original_amount
                
            # Calculate exit value based on current price and amount
            exit_value = current_price * token_amount
            
            # Debug log to identify the issue
            self.logger.info(f"Exit value calculation details:")
            self.logger.info(f"Current price: ${current_price:.6f}")
            self.logger.info(f"Token amount: {token_amount}")
            self.logger.info(f"Calculated exit value: ${exit_value:.2f}")
            
            # Ensure exit_value is not zero when it shouldn't be
            if exit_value <= 0 and current_price > 0 and token_amount > 0:
                self.logger.warning(f"⚠️ Exit value calculation resulted in ${exit_value:.2f} despite positive price and amount")
                self.logger.warning(f"Recalculating with explicit float conversion")
                exit_value = float(current_price) * float(token_amount)
                self.logger.info(f"Recalculated exit value: ${exit_value:.2f}")
            
            # Sanity check on exit value
            if exit_value > original_value * 10:
                self.logger.warning(f"⚠️ Exit value ${exit_value:.2f} is more than 10x original value ${original_value:.2f}")
                self.logger.warning(f"Capping exit value to 10x original value for P&L calculation")
                exit_value = original_value * 10
                
            # Calculate P&L and ROI
            realized_pnl = exit_value - original_value
            roi = (realized_pnl / original_value * 100) if original_value > 0 else 0
            
            # Ensure we're not storing zero for exit_value when we have valid data
            if exit_value <= 0 and current_price > 0:
                self.logger.warning(f"⚠️ Exit value is still zero or negative: ${exit_value:.2f}")
                # Use a minimum value based on original value as fallback
                exit_value = max(0.01, original_value * 0.1)  # At least 10% of original or 1 cent
                self.logger.info(f"Using fallback exit value: ${exit_value:.2f}")
            
            # Additional sanity check on ROI
            if roi > 1000:  # Cap ROI at 1000%
                self.logger.warning(f"⚠️ ROI {roi:.2f}% exceeds reasonable limits, capping at 1000%")
                roi = 1000
                realized_pnl = (roi / 100) * original_value
                exit_value = original_value + realized_pnl
                
            # Fix for negative ROI - it should never be below -100%
            if roi < -100:
                self.logger.warning(f"⚠️ ROI {roi:.2f}% is below -100%, capping at -100%")
                roi = -100
                realized_pnl = -original_value
                exit_value = 0
                
            # Log the calculation details for debugging
            self.logger.info(f"P&L Calculation Details:")
            self.logger.info(f"Original Value: ${original_value:.2f}")
            self.logger.info(f"Exit Value: ${exit_value:.2f}")
            self.logger.info(f"Realized P&L: ${realized_pnl:.2f}")
            self.logger.info(f"ROI: {roi:.2f}%")

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
            # Check both PENDING and EXECUTED trades
            active_trades = self.trades_table.get_all(
                formula="OR(status='EXECUTED', status='PENDING')"
            )
            
            self.logger.info(f"Checking {len(active_trades)} active trades (PENDING + EXECUTED)...")
            
            for trade in active_trades:
                try:
                    status = trade['fields'].get('status')
                    signal_id = trade['fields'].get('signalId')
                    
                    if not signal_id:
                        self.logger.error(f"Trade {trade['id']} has no signal ID")
                        continue

                    # Get the signal data
                    signal = self.signals_table.get(signal_id)
                    if not signal:
                        self.logger.error(f"Signal {signal_id} not found for trade {trade['id']}")
                        continue

                    if status == 'PENDING':
                        # Pour les trades PENDING, vérifier les conditions d'entrée
                        self.logger.info(f"Checking entry conditions for PENDING trade {trade['id']}")
                        if self.check_entry_conditions(signal):
                            self.logger.info(f"Entry conditions met for trade {trade['id']}")
                            if await self.execute_trade(signal):
                                self.logger.info(f"Successfully executed trade {trade['id']}")
                            else:
                                self.logger.error(f"Failed to execute trade {trade['id']}")
                        else:
                            self.logger.info(f"Entry conditions not met for trade {trade['id']}")
                    
                    elif status == 'EXECUTED':
                        # Pour les trades EXECUTED, vérifier les conditions de sortie
                        self.logger.info(f"Checking exit conditions for EXECUTED trade {trade['id']}")
                        exit_reason = await self.check_exit_conditions(trade)
                        if exit_reason:
                            self.logger.info(f"Exit condition met for trade {trade['id']}: {exit_reason}")
                            if await self.close_trade(trade, exit_reason):
                                self.logger.info(f"Successfully closed trade {trade['id']}")
                            else:
                                self.logger.error(f"Failed to close trade {trade['id']}")
                        else:
                            self.logger.info(f"No exit conditions met for trade {trade['id']}")
                                
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
            
    async def monitor_existing_trades(self):
        """Check only existing trades for exit conditions"""
        try:
            # Check both PENDING and EXECUTED trades
            active_trades = self.trades_table.get_all(
                formula="OR(status='EXECUTED', status='PENDING')"
            )
            
            self.logger.info(f"Checking {len(active_trades)} active trades (PENDING + EXECUTED)...")
            
            for trade in active_trades:
                try:
                    status = trade['fields'].get('status')
                    signal_id = trade['fields'].get('signalId')
                    
                    if not signal_id:
                        self.logger.error(f"Trade {trade['id']} has no signal ID")
                        continue

                    # Get the signal data
                    signal = self.signals_table.get(signal_id)
                    if not signal:
                        self.logger.error(f"Signal {signal_id} not found for trade {trade['id']}")
                        continue

                    if status == 'PENDING':
                        # Pour les trades PENDING, vérifier les conditions d'entrée
                        self.logger.info(f"Checking entry conditions for PENDING trade {trade['id']}")
                        if self.check_entry_conditions(signal):
                            self.logger.info(f"Entry conditions met for trade {trade['id']}")
                            if await self.execute_trade(signal):
                                self.logger.info(f"Successfully executed trade {trade['id']}")
                            else:
                                self.logger.error(f"Failed to execute trade {trade['id']}")
                        else:
                            self.logger.info(f"Entry conditions not met for trade {trade['id']}")
                    
                    elif status == 'EXECUTED':
                        # Pour les trades EXECUTED, vérifier les conditions de sortie
                        self.logger.info(f"Checking exit conditions for EXECUTED trade {trade['id']}")
                        exit_reason = await self.check_exit_conditions(trade)
                        if exit_reason:
                            self.logger.info(f"Exit condition met for trade {trade['id']}: {exit_reason}")
                            if await self.close_trade(trade, exit_reason):
                                self.logger.info(f"Successfully closed trade {trade['id']}")
                            else:
                                self.logger.error(f"Failed to close trade {trade['id']}")
                        else:
                            self.logger.info(f"No exit conditions met for trade {trade['id']}")
                                
                except Exception as e:
                    self.logger.error(f"Error processing trade {trade['id']}: {e}")
                    continue
                
                await asyncio.sleep(2)  # Delay between trades
                
            self.logger.info("✅ Finished monitoring existing trades")
            
        except Exception as e:
            self.logger.error(f"Error in monitor_existing_trades: {e}")

    async def open_new_trades(self):
        """Check for new signals and open trades"""
        try:
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

            self.logger.info("✅ Finished opening new trades")
            
        except Exception as e:
            self.logger.error(f"Error in open_new_trades: {e}")

    async def close_eligible_trades(self):
        """Check all executed trades and close those meeting exit conditions"""
        try:
            # Get all EXECUTED trades
            executed_trades = self.trades_table.get_all(
                formula="status='EXECUTED'"
            )
            
            self.logger.info(f"Checking {len(executed_trades)} executed trades for exit conditions...")
            
            for trade in executed_trades:
                try:
                    # Check exit conditions
                    exit_reason = await self.check_exit_conditions(trade)
                    if exit_reason:
                        self.logger.info(f"Exit condition met for trade {trade['id']}: {exit_reason}")
                        if await self.close_trade(trade, exit_reason):
                            self.logger.info(f"Successfully closed trade {trade['id']}")
                        else:
                            self.logger.error(f"Failed to close trade {trade['id']}")
                    else:
                        self.logger.info(f"No exit conditions met for trade {trade['id']}")
                            
                except Exception as e:
                    self.logger.error(f"Error processing trade {trade['id']}: {e}")
                    continue
                
                await asyncio.sleep(2)  # Delay between trades
                
            self.logger.info("✅ Finished checking trades for exit conditions")
            
        except Exception as e:
            self.logger.error(f"Error in close_eligible_trades: {e}")

    async def open_specific_trade(self, signal_id: str):
        """Open a specific trade by signal ID"""
        try:
            self.logger.info(f"Opening specific trade for signal {signal_id}")
            
            # Get the signal
            signal = self.signals_table.get(signal_id)
            if not signal:
                self.logger.error(f"Signal {signal_id} not found")
                return
                
            # Check entry conditions
            if self.check_entry_conditions(signal):
                self.logger.info(f"Entry conditions met for signal {signal_id}")
                
                # Execute trade
                if await self.execute_trade(signal):
                    self.logger.info(f"Successfully executed trade for signal {signal_id}")
                else:
                    self.logger.error(f"Failed to execute trade for signal {signal_id}")
            else:
                self.logger.info(f"Entry conditions not met for signal {signal_id}")
                
        except Exception as e:
            self.logger.error(f"Error opening specific trade: {e}")

    async def close_specific_trade(self, trade_id: str, exit_reason: str):
        """Close a specific trade by ID with given exit reason"""
        try:
            self.logger.info(f"Closing specific trade {trade_id} with reason: {exit_reason}")
            
            # Get the trade
            trade = self.trades_table.get(trade_id)
            if not trade:
                self.logger.error(f"Trade {trade_id} not found")
                return
                
            # Check if trade is in EXECUTED status
            status = trade['fields'].get('status')
            if status != 'EXECUTED':
                self.logger.error(f"Trade {trade_id} is not in EXECUTED status (current: {status})")
                return
                
            # Close the trade
            if await self.close_trade(trade, exit_reason):
                self.logger.info(f"Successfully closed trade {trade_id}")
            else:
                self.logger.error(f"Failed to close trade {trade_id}")
                
        except Exception as e:
            self.logger.error(f"Error closing specific trade: {e}")
            
    async def execute_test_trade(self):
        """Execute a test trade: 1 USDC -> USDT -> USDC"""
        try:
            self.logger.info("🧪 Starting test trade: 1 USDC -> USDT -> USDC")
            
            # Définir les adresses des tokens
            usdc_mint = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"  # USDC
            usdt_mint = "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB"  # USDT
            
            # Étape 1: USDC -> USDT
            self.logger.info("\n🔄 Step 1: USDC -> USDT")
            success1, transaction_bytes1 = await self.jupiter.execute_validated_swap(
                input_token=usdc_mint,
                output_token=usdt_mint,
                amount=1.0,  # 1 USDC
                min_amount=0.01,
                max_slippage=1.0
            )
            
            if not success1 or not transaction_bytes1:
                self.logger.error("❌ Failed to prepare USDC -> USDT swap")
                return False
                
            # Préparer la transaction
            transaction1 = await self.jupiter.prepare_transaction(transaction_bytes1)
            if not transaction1:
                self.logger.error("❌ Failed to prepare transaction for USDC -> USDT")
                return False
                
            # Exécuter la transaction
            result1 = await self.jupiter.execute_trade_with_retries(
                transaction1,
                usdt_mint
            )
            
            if not result1 or not result1.get('signature'):
                self.logger.error("❌ Failed to execute USDC -> USDT swap")
                return False
                
            self.logger.info(f"✅ USDC -> USDT swap successful: {result1['signature']}")
            
            if result1 and 'swap_analysis' in result1:
                self.logger.info("\n📊 Analyse du swap USDC -> USDT:")
                self.logger.info(f"Perte totale: {result1['swap_analysis']['total_loss_percent']:.2f}%")
                self.logger.info(f"Slippage: {result1['swap_analysis']['slippage_percent']:.2f}%")
                self.logger.info(f"Frais: {result1['swap_analysis']['fees_percent']:.2f}%")
            
            # Attendre un peu pour que la transaction soit confirmée
            self.logger.info("⏳ Waiting 10 seconds for transaction confirmation...")
            await asyncio.sleep(10)
            
            # Étape 2: USDT -> USDC
            self.logger.info("\n🔄 Step 2: USDT -> USDC")
            
            # Vérifier le solde USDT
            usdt_balance = await self.jupiter.get_token_balance(usdt_mint)
            self.logger.info(f"Current USDT balance: {usdt_balance}")
            
            if usdt_balance <= 0:
                self.logger.error("❌ No USDT balance available for swap back")
                return False
            
            # Utiliser tout le solde USDT pour revenir en USDC
            success2, transaction_bytes2 = await self.jupiter.execute_validated_swap(
                input_token=usdt_mint,
                output_token=usdc_mint,
                amount=usdt_balance,
                min_amount=0.01,
                max_slippage=1.0
            )
            
            if not success2 or not transaction_bytes2:
                self.logger.error("❌ Failed to prepare USDT -> USDC swap")
                return False
                
            # Préparer la transaction
            transaction2 = await self.jupiter.prepare_transaction(transaction_bytes2)
            if not transaction2:
                self.logger.error("❌ Failed to prepare transaction for USDT -> USDC")
                return False
                
            # Exécuter la transaction
            result2 = await self.jupiter.execute_trade_with_retries(
                transaction2,
                usdc_mint
            )
            
            if not result2 or not result2.get('signature'):
                self.logger.error("❌ Failed to execute USDT -> USDC swap")
                return False
                
            self.logger.info(f"✅ USDT -> USDC swap successful: {result2['signature']}")
            
            if result2 and 'swap_analysis' in result2:
                self.logger.info("\n📊 Analyse du swap USDT -> USDC:")
                self.logger.info(f"Perte totale: {result2['swap_analysis']['total_loss_percent']:.2f}%")
                self.logger.info(f"Slippage: {result2['swap_analysis']['slippage_percent']:.2f}%")
                self.logger.info(f"Frais: {result2['swap_analysis']['fees_percent']:.2f}%")
            
            # Résumé du test
            self.logger.info("\n📊 Test Trade Summary:")
            self.logger.info(f"USDC -> USDT: {result1['signature']}")
            self.logger.info(f"USDT -> USDC: {result2['signature']}")
            
            # Résumé des pertes
            self.logger.info("\n💰 Résumé des pertes:")
            total_loss_pct = 0
            if result1 and 'swap_analysis' in result1:
                total_loss_pct += result1['swap_analysis']['total_loss_percent']
            if result2 and 'swap_analysis' in result2:
                total_loss_pct += result2['swap_analysis']['total_loss_percent']
            self.logger.info(f"Perte totale sur les deux swaps: {total_loss_pct:.2f}%")
            
            self.logger.info("✅ Test trade completed successfully")
            
            return True
            
        except Exception as e:
            self.logger.error(f"❌ Test trade failed: {e}")
            return False

def main():
    try:
        # Configurer l'analyseur d'arguments
        parser = argparse.ArgumentParser(description='KinKong Trade Executor')
        parser.add_argument('--action', type=str, 
                            choices=['monitor', 'open', 'close', 'all', 'test'], 
                            default='all', 
                            help='Action to perform: monitor, open, close, all, or test')
        parser.add_argument('--trade-id', type=str, 
                            help='Specific trade ID to close (only with --action=close)')
        parser.add_argument('--exit-reason', type=str, 
                            choices=['TAKE_PROFIT', 'STOP_LOSS', 'EXPIRED', 'MANUAL', 'MIN_PROFIT_TARGET'],
                            help='Exit reason when closing a specific trade')
        parser.add_argument('--signal-id', type=str, 
                            help='Specific signal ID to open (only with --action=open)')
        
        args = parser.parse_args()
        
        logger.info(f"🔄 Trade executor running with action: {args.action}")
        
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

        # Create trade executor
        executor = TradeExecutor()
        
        # Execute based on action parameter
        if args.action == 'test':
            # Run test trade
            asyncio.run(executor.execute_test_trade())
            
        elif args.action == 'all':
            # Run full monitoring process
            asyncio.run(executor.monitor_signals())
            
        elif args.action == 'monitor':
            # Only check exit conditions for existing trades
            asyncio.run(executor.monitor_existing_trades())
            
        elif args.action == 'open':
            # Only open new trades
            if args.signal_id:
                # Open specific trade by signal ID
                asyncio.run(executor.open_specific_trade(args.signal_id))
            else:
                # Open all eligible trades
                asyncio.run(executor.open_new_trades())
                
        elif args.action == 'close':
            # Only close trades
            if args.trade_id:
                # Close specific trade
                if not args.exit_reason:
                    logger.error("--exit-reason is required when closing a specific trade")
                    sys.exit(1)
                asyncio.run(executor.close_specific_trade(args.trade_id, args.exit_reason))
            else:
                # Close all eligible trades
                asyncio.run(executor.close_eligible_trades())

    except Exception as e:
        logger.error(f"Fatal error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
