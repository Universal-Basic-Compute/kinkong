import os
import json
import logging
import asyncio
import aiohttp
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional, Tuple, Any
from dotenv import load_dotenv
from pathlib import Path

# Get absolute path to project root
project_root = Path(__file__).parent.parent.absolute()

# Add project root to Python path
import sys
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

# Import trade executor
from engine.execute_trade import JupiterTradeExecutor

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

# Load environment variables
load_dotenv()

# Initialize logger
logger = setup_logging()

class TokenMaximizerExecutor:
    """
    Executes trades for the Token Maximizer allocation strategy
    """
    
    # Token mint addresses - Update with correct mint addresses
    UBC_MINT = "EPeUFDgHRxs9xxEPVaL6kfGQvCon7jmAWKVUHuux1Tpz"  # UBC token
    COMPUTE_MINT = "5Ycj5XGpGwYPT5UkXJYZnwUXbvTZwGfpYdgDrRQyZYAE"  # COMPUTE token
    SOL_MINT = "So11111111111111111111111111111111111111112"  # Native SOL
    USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"  # USDC
    
    def __init__(self):
        """Initialize the executor"""
        self.logger = setup_logging()
        self.jupiter = JupiterTradeExecutor()
        
        # Initialize token prices
        self.token_prices = {
            "ubc": 0.0,
            "compute": 0.0,
            "sol": 0.0,
            "usdc": 1.0  # USDC is pegged to USD
        }
        
        # Initialize token balances
        self.token_balances = {
            "ubc": 0.0,
            "compute": 0.0,
            "sol": 0.0,
            "usdc": 0.0
        }
        
        # LP positions and values
        self.lp_positions = {}
        self.lp_values = {
            "ubc_sol_lp": 0.0,
            "compute_sol_lp": 0.0,
            "compute_ubc_lp": 0.0,
            "ubc_usdc_lp": 0.0,
            "compute_usdc_lp": 0.0
        }
        
        # LP fees earned
        self.lp_fees_earned = {
            "ubc_sol_lp": 0.0,
            "compute_sol_lp": 0.0,
            "compute_ubc_lp": 0.0,
            "ubc_usdc_lp": 0.0,
            "compute_usdc_lp": 0.0
        }
        
        # Transaction history
        self.transactions = []
        
        # Minimum trade amounts (in USD)
        self.min_trade_amount = 1.0
        
        # Maximum slippage (in %)
        self.max_slippage = 1.0
    
    async def update_token_prices(self):
        """Update token prices from Jupiter API"""
        self.logger.info("Updating token prices...")
        
        # Hardcoded pair addresses
        hardcoded_pairs = {
            "UBC": "hbjg1zpronbeiv86qdt1wzwgymts1ppxjcfoz819cbjd",
            "COMPUTE": "hn7ibjiyx399d1efyxcwashzrsmfumonyvxgfxg41rr3"
        }
        
        # List of tokens to update
        tokens = [
            {"name": "ubc", "mint": self.UBC_MINT},
            {"name": "compute", "mint": self.COMPUTE_MINT},
            {"name": "sol", "mint": self.SOL_MINT}
        ]
        
        for token in tokens:
            try:
                # Check if we have a hardcoded pair for this token
                token_upper = token["name"].upper()
                if token_upper in hardcoded_pairs:
                    # Use hardcoded pair address
                    pair_address = hardcoded_pairs[token_upper]
                    self.logger.info(f"Using hardcoded pair address for {token_upper}: {pair_address}")
                    
                    # Fetch data from DexScreener using the pair address
                    dexscreener_url = f"https://api.dexscreener.com/latest/dex/pairs/solana/{pair_address}"
                    
                    async with aiohttp.ClientSession() as session:
                        async with session.get(dexscreener_url) as response:
                            if response.status == 200:
                                data = await response.json()
                                pairs = data.get('pairs', [])
                                
                                if pairs and len(pairs) > 0:
                                    # Use the first pair (should be only one since we requested by pair address)
                                    best_pair = pairs[0]
                                    price = float(best_pair.get('priceUsd', 0))
                                    
                                    if price > 0:
                                        self.token_prices[token["name"]] = price
                                        self.logger.info(f"{token_upper} price: ${price:.6f}")
                                    else:
                                        self.logger.warning(f"Invalid price (0) for {token_upper} from hardcoded pair")
                                else:
                                    self.logger.warning(f"No pair data found for hardcoded {token_upper} pair: {pair_address}")
                            else:
                                self.logger.error(f"DexScreener API error for {token_upper}: {response.status}")
                else:
                    # Use regular Jupiter price API
                    price = await self.jupiter.get_token_price(token["mint"])
                    if price:
                        self.token_prices[token["name"]] = price
                        self.logger.info(f"{token_upper} price: ${price:.6f}")
                    else:
                        self.logger.warning(f"Could not get price for {token_upper}")
            except Exception as e:
                self.logger.error(f"Error getting {token['name'].upper()} price: {e}")
        
        self.logger.info("Token prices updated")
    
    async def update_token_balances(self):
        """Update token balances from wallet"""
        self.logger.info("Updating token balances...")
        
        # List of tokens to update
        tokens = [
            {"name": "ubc", "mint": self.UBC_MINT},
            {"name": "compute", "mint": self.COMPUTE_MINT},
            {"name": "sol", "mint": self.SOL_MINT},
            {"name": "usdc", "mint": self.USDC_MINT}
        ]
        
        for token in tokens:
            try:
                balance = await self.jupiter.get_token_balance(token["mint"])
                self.token_balances[token["name"]] = balance
                self.logger.info(f"{token['name'].upper()} balance: {balance}")
            except Exception as e:
                self.logger.error(f"Error getting {token['name'].upper()} balance: {e}")
        
        self.logger.info("Token balances updated")
    
    async def execute_buy_trade(self, token: str, value_usd: float) -> bool:
        """Execute a buy trade for a token using USDC"""
        self.logger.info(f"Executing buy trade for {token.upper()}: ${value_usd:.2f}")
        
        # Get token mint address
        token_mint = getattr(self, f"{token.upper()}_MINT", None)
        if not token_mint:
            self.logger.error(f"No mint address found for {token.upper()}")
            return False
        
        # Check if we have enough USDC
        usdc_balance = self.token_balances["usdc"]
        usdc_value = usdc_balance * self.token_prices["usdc"]
        
        if usdc_value < value_usd:
            self.logger.warning(f"Insufficient USDC balance: ${usdc_value:.2f} < ${value_usd:.2f}")
            # Adjust trade size to available USDC
            value_usd = usdc_value
            self.logger.info(f"Adjusted trade size to ${value_usd:.2f}")
        
        if value_usd < 1.0:
            self.logger.warning(f"Trade value too small: ${value_usd:.2f}")
            return False
        
        # Execute trade using Jupiter
        success, transaction_bytes, quote_data = await self.jupiter.execute_validated_swap(
            input_token=self.USDC_MINT,
            output_token=token_mint,
            amount=value_usd,  # Amount in USDC
            min_amount=1.0,
            max_slippage=1.0
        )
        
        if not success or not transaction_bytes:
            self.logger.error(f"Failed to prepare buy transaction for {token.upper()}")
            return False
        
        # Prepare and execute transaction
        transaction = await self.jupiter.prepare_transaction(transaction_bytes)
        if not transaction:
            self.logger.error(f"Failed to prepare transaction")
            return False
        
        result = await self.jupiter.execute_trade_with_retries(
            transaction,
            token_mint,
            quote_data
        )
        
        if result and result.get('signature'):
            self.logger.info(f"Buy trade for {token.upper()} successful: {result['signature']}")
            
            # Record transaction
            self.transactions.append({
                'type': 'BUY',
                'token': token,
                'value_usd': value_usd,
                'amount': result.get('amount', 0),
                'price': self.token_prices[token],
                'timestamp': datetime.now(timezone.utc).isoformat(),
                'signature': result['signature']
            })
            
            return True
        else:
            self.logger.error(f"Buy trade for {token.upper()} failed")
            return False
    
    async def execute_sell_trade(self, token: str, value_usd: float) -> bool:
        """Execute a sell trade for a token to USDC"""
        self.logger.info(f"Executing sell trade for {token.upper()}: ${value_usd:.2f}")
        
        # Get token mint address
        token_mint = getattr(self, f"{token.upper()}_MINT", None)
        if not token_mint:
            self.logger.error(f"No mint address found for {token.upper()}")
            return False
        
        # Calculate token amount to sell
        token_price = self.token_prices[token]
        if token_price <= 0:
            self.logger.error(f"Invalid token price for {token.upper()}: ${token_price:.6f}")
            return False
        
        token_amount = value_usd / token_price
        token_balance = self.token_balances[token]
        
        if token_balance < token_amount:
            self.logger.warning(f"Insufficient {token.upper()} balance: {token_balance} < {token_amount}")
            # Adjust trade size to available balance
            token_amount = token_balance
            value_usd = token_amount * token_price
            self.logger.info(f"Adjusted trade size to {token_amount} {token.upper()} (${value_usd:.2f})")
        
        if value_usd < 1.0:
            self.logger.warning(f"Trade value too small: ${value_usd:.2f}")
            return False
        
        # Execute trade using Jupiter
        success, transaction_bytes, quote_data = await self.jupiter.execute_validated_swap(
            input_token=token_mint,
            output_token=self.USDC_MINT,
            amount=token_amount,  # Amount in token units
            min_amount=0.1,
            max_slippage=1.0
        )
        
        if not success or not transaction_bytes:
            self.logger.error(f"Failed to prepare sell transaction for {token.upper()}")
            return False
        
        # Prepare and execute transaction
        transaction = await self.jupiter.prepare_transaction(transaction_bytes)
        if not transaction:
            self.logger.error(f"Failed to prepare transaction")
            return False
        
        result = await self.jupiter.execute_trade_with_retries(
            transaction,
            self.USDC_MINT,
            quote_data
        )
        
        if result and result.get('signature'):
            self.logger.info(f"Sell trade for {token.upper()} successful: {result['signature']}")
            
            # Record transaction
            self.transactions.append({
                'type': 'SELL',
                'token': token,
                'value_usd': value_usd,
                'amount': token_amount,
                'price': token_price,
                'timestamp': datetime.now(timezone.utc).isoformat(),
                'signature': result['signature']
            })
            
            return True
        else:
            self.logger.error(f"Sell trade for {token.upper()} failed")
            return False
    
    async def execute_rebalance_trades(self, current_allocation: Dict[str, float], target_allocation: Dict[str, float], portfolio_value: float, dry_run: bool = False) -> bool:
        """Execute trades to rebalance portfolio according to target allocation, with optional dry-run mode"""
        self.logger.info(f"{'Simulating' if dry_run else 'Executing'} rebalance trades...")
        
        # Update token prices and balances
        await self.update_token_prices()
        await self.update_token_balances()
        
        # Calculate trade values for each token
        trades = []
        for token in ["ubc", "compute", "sol", "usdc"]:
            current_value = portfolio_value * current_allocation.get(token, 0)
            target_value = portfolio_value * target_allocation.get(token, 0)
            value_diff = target_value - current_value
            
            # Only trade if difference is significant (>5% of portfolio or >$10)
            if abs(value_diff) > max(portfolio_value * 0.05, 10):
                trades.append({
                    "token": token,
                    "value_diff": value_diff,
                    "current_value": current_value,
                    "target_value": target_value,
                    "current_allocation": current_allocation.get(token, 0) * 100,
                    "target_allocation": target_allocation.get(token, 0) * 100
                })
                self.logger.info(f"{token.upper()} needs adjustment of ${value_diff:.2f}")
        
        # If no significant trades needed
        if not trades:
            self.logger.info("No significant allocation changes needed (all within threshold)")
            return True
        
        # Sort trades: first sell, then buy
        sell_trades = [t for t in trades if t["value_diff"] < 0]
        buy_trades = [t for t in trades if t["value_diff"] > 0]
        
        # Create a summary of planned trades
        trade_summary = {
            "portfolio_value": portfolio_value,
            "current_prices": {
                "ubc": self.token_prices["ubc"],
                "compute": self.token_prices["compute"],
                "sol": self.token_prices["sol"],
                "usdc": self.token_prices["usdc"]
            },
            "current_balances": {
                "ubc": self.token_balances["ubc"],
                "compute": self.token_balances["compute"],
                "sol": self.token_balances["sol"],
                "usdc": self.token_balances["usdc"]
            },
            "sell_trades": [],
            "buy_trades": [],
            "lp_positions": [],
            "is_dry_run": dry_run
        }
        
        # Process sell trades
        for trade in sell_trades:
            token = trade["token"]
            value = abs(trade["value_diff"])
            token_price = self.token_prices[token]
            token_amount = value / token_price if token_price > 0 else 0
            
            trade_info = {
                "token": token.upper(),
                "value_usd": value,
                "token_amount": token_amount,
                "token_price": token_price,
                "current_allocation": trade["current_allocation"],
                "target_allocation": trade["target_allocation"],
                "allocation_change": trade["target_allocation"] - trade["current_allocation"]
            }
            
            trade_summary["sell_trades"].append(trade_info)
            
            self.logger.info(f"{'Would sell' if dry_run else 'Selling'} {token_amount:.6f} {token.upper()} (${value:.2f})")
            
            # Execute the trade if not in dry-run mode
            if not dry_run:
                # Determine which token to sell to (prefer USDC for intermediate steps)
                sell_to = "usdc"
                success = await self.execute_swap(token, sell_to, token_amount, dry_run=dry_run)
                if not success:
                    self.logger.error(f"Failed to sell {token.upper()} to {sell_to.upper()}")
        
        # Update balances after sells if not in dry-run mode
        if not dry_run and sell_trades:
            await self.update_token_balances()
        
        # Process buy trades
        for trade in buy_trades:
            token = trade["token"]
            value = trade["value_diff"]
            token_price = self.token_prices[token]
            token_amount = value / token_price if token_price > 0 else 0
            
            trade_info = {
                "token": token.upper(),
                "value_usd": value,
                "token_amount": token_amount,
                "token_price": token_price,
                "current_allocation": trade["current_allocation"],
                "target_allocation": trade["target_allocation"],
                "allocation_change": trade["target_allocation"] - trade["current_allocation"]
            }
            
            trade_summary["buy_trades"].append(trade_info)
            
            self.logger.info(f"{'Would buy' if dry_run else 'Buying'} {token_amount:.6f} {token.upper()} (${value:.2f})")
            
            # Execute the trade if not in dry-run mode
            if not dry_run:
                # Buy from USDC if available, otherwise from SOL
                buy_from = "usdc" if self.token_balances["usdc"] * self.token_prices["usdc"] >= value else "sol"
                buy_amount = value / self.token_prices[buy_from] if self.token_prices[buy_from] > 0 else 0
                
                # Ensure we don't try to spend more than we have
                available_amount = self.token_balances[buy_from] * 0.99  # 99% to account for fees
                buy_amount = min(buy_amount, available_amount)
                
                success = await self.execute_swap(buy_from, token, buy_amount, dry_run=dry_run)
                if not success:
                    self.logger.error(f"Failed to buy {token.upper()} from {buy_from.upper()}")
        
        # Update balances after buys if not in dry-run mode
        if not dry_run and buy_trades:
            await self.update_token_balances()
        
        # Process LP positions
        await self.process_lp_positions(target_allocation, portfolio_value, dry_run)
        
        # Calculate expected new allocation after trades
        expected_new_balances = {}
        for token in ["ubc", "compute", "sol", "usdc"]:
            expected_new_balances[token] = self.token_balances[token]
            
            # Adjust for sell trades
            for trade in sell_trades:
                if trade["token"] == token:
                    token_price = self.token_prices[token]
                    token_amount = abs(trade["value_diff"]) / token_price if token_price > 0 else 0
                    expected_new_balances[token] -= token_amount
            
            # Adjust for buy trades
            for trade in buy_trades:
                if trade["token"] == token:
                    token_price = self.token_prices[token]
                    token_amount = trade["value_diff"] / token_price if token_price > 0 else 0
                    expected_new_balances[token] += token_amount
        
        # Calculate expected new values and allocations
        expected_new_values = {
            token: expected_new_balances[token] * self.token_prices[token]
            for token in ["ubc", "compute", "sol", "usdc"]
        }
        
        # Add LP values
        for lp_name, lp_value in self.lp_values.items():
            if lp_value > 0:
                expected_new_values[lp_name] = lp_value
        
        expected_total_value = sum(expected_new_values.values())
        
        expected_new_allocations = {
            token: (expected_new_values[token] / expected_total_value) * 100 if expected_total_value > 0 else 0
            for token in expected_new_values
        }
        
        # Add expected results to summary
        trade_summary["expected_results"] = {
            "new_balances": expected_new_balances,
            "new_values": expected_new_values,
            "new_allocations": expected_new_allocations,
            "total_value": expected_total_value
        }
        
        # Log summary
        self.logger.info(f"\n{'Dry Run' if dry_run else 'Rebalance'} Summary:")
        self.logger.info(f"Portfolio Value: ${portfolio_value:.2f}")
        self.logger.info(f"Sell Trades: {len(sell_trades)}")
        self.logger.info(f"Buy Trades: {len(buy_trades)}")
        
        if dry_run:
            self.logger.info("\nExpected New Allocations:")
            for token, allocation in expected_new_allocations.items():
                if allocation > 0:
                    self.logger.info(f"  {token.upper()}: {allocation:.2f}%")
        
        # Store the trade summary
        self._last_rebalance_summary = trade_summary
        
        self.logger.info(f"Rebalance {'simulation' if dry_run else 'execution'} completed")
        return True
    
    def get_transaction_history(self) -> List[Dict]:
        """Get transaction history"""
        return self.transactions
    def get_last_rebalance_summary(self) -> Dict:
        """Get the summary of the last rebalance operation"""
        return getattr(self, '_last_rebalance_summary', {})
    async def process_lp_positions(self, target_allocation: Dict[str, float], portfolio_value: float, dry_run: bool = False) -> bool:
        """Process LP positions based on target allocation"""
        try:
            self.logger.info(f"Processing LP positions {'(DRY RUN)' if dry_run else ''}")
            
            # Get LP allocations from target
            lp_allocations = {
                "ubc_sol_lp": target_allocation.get("ubc_sol_lp", 0),
                "compute_sol_lp": target_allocation.get("compute_sol_lp", 0),
                "compute_ubc_lp": target_allocation.get("compute_ubc_lp", 0),
                "ubc_usdc_lp": target_allocation.get("ubc_usdc_lp", 0),
                "compute_usdc_lp": target_allocation.get("compute_usdc_lp", 0)
            }
            
            # Process each LP position
            for lp_name, allocation in lp_allocations.items():
                if allocation <= 0:
                    continue
                
                # Calculate target value for this LP
                target_value = portfolio_value * allocation
                
                # Skip if target value is too small
                if target_value < 10:  # Minimum $10 LP position
                    self.logger.info(f"Skipping {lp_name} - target value too small: ${target_value:.2f}")
                    continue
                
                # Parse LP name to get tokens
                tokens = lp_name.split('_')
                token1 = tokens[0]
                token2 = tokens[1]
                
                # Calculate token amounts (50/50 split for now)
                token1_value = target_value * 0.5
                token2_value = target_value * 0.5
                
                token1_price = self.token_prices.get(token1, 0)
                token2_price = self.token_prices.get(token2, 0)
                
                if token1_price <= 0 or token2_price <= 0:
                    self.logger.warning(f"Invalid prices for {lp_name}: {token1}=${token1_price}, {token2}=${token2_price}")
                    continue
                
                token1_amount = token1_value / token1_price
                token2_amount = token2_value / token2_price
                
                # Create LP position
                self.logger.info(f"Creating {lp_name} with {token1_amount:.6f} {token1.upper()} and {token2_amount:.6f} {token2.upper()}")
                
                if not dry_run:
                    # Check if we have enough tokens
                    have_token1 = self.token_balances.get(token1, 0) >= token1_amount
                    have_token2 = self.token_balances.get(token2, 0) >= token2_amount
                    
                    # If we don't have enough tokens, swap to get them
                    if not have_token1:
                        # Determine which token to swap from
                        swap_from = "usdc" if self.token_balances["usdc"] * self.token_prices["usdc"] >= token1_value else "sol"
                        swap_amount = token1_value / self.token_prices[swap_from] if self.token_prices[swap_from] > 0 else 0
                        
                        # Ensure we don't try to spend more than we have
                        available_amount = self.token_balances[swap_from] * 0.99  # 99% to account for fees
                        swap_amount = min(swap_amount, available_amount)
                        
                        success = await self.execute_swap(swap_from, token1, swap_amount, dry_run=dry_run)
                        if not success:
                            self.logger.error(f"Failed to swap {swap_from.upper()} to {token1.upper()} for LP")
                            continue
                        
                        # Update balances
                        await self.update_token_balances()
                    
                    if not have_token2:
                        # Determine which token to swap from
                        swap_from = "usdc" if self.token_balances["usdc"] * self.token_prices["usdc"] >= token2_value else "sol"
                        swap_amount = token2_value / self.token_prices[swap_from] if self.token_prices[swap_from] > 0 else 0
                        
                        # Ensure we don't try to spend more than we have
                        available_amount = self.token_balances[swap_from] * 0.99  # 99% to account for fees
                        swap_amount = min(swap_amount, available_amount)
                        
                        success = await self.execute_swap(swap_from, token2, swap_amount, dry_run=dry_run)
                        if not success:
                            self.logger.error(f"Failed to swap {swap_from.upper()} to {token2.upper()} for LP")
                            continue
                        
                        # Update balances
                        await self.update_token_balances()
                    
                    # Create LP position with available tokens
                    token1_amount = min(token1_amount, self.token_balances.get(token1, 0) * 0.99)
                    token2_amount = min(token2_amount, self.token_balances.get(token2, 0) * 0.99)
                    
                    # Create LP position
                    await self.create_lp_position(token1, token2, token1_amount, token2_amount, dry_run=dry_run)
                else:
                    # In dry run mode, just log what we would do
                    self.logger.info(f"DRY RUN: Would create {lp_name} with {token1_amount:.6f} {token1.upper()} and {token2_amount:.6f} {token2.upper()}")
                    
                    # Update LP values for dry run simulation
                    self.lp_values[lp_name] = token1_value + token2_value
            
            return True
            
        except Exception as e:
            self.logger.error(f"Error processing LP positions: {e}")
            return False
    
    async def create_lp_position(self, token1: str, token2: str, amount1: float, amount2: float, dry_run: bool = False) -> bool:
        """Create a liquidity pool position"""
        try:
            lp_name = f"{token1}_{token2}_lp"
            
            if dry_run:
                self.logger.info(f"DRY RUN: Would create LP position {lp_name} with {amount1:.6f} {token1.upper()} and {amount2:.6f} {token2.upper()}")
                return True
            
            self.logger.info(f"Creating LP position {lp_name} with {amount1:.6f} {token1.upper()} and {amount2:.6f} {token2.upper()}")
            
            # This is where the actual LP creation logic would go
            # For now, just simulate it by updating our tracking variables
            
            # Update LP positions
            self.lp_positions[lp_name] = {
                "token1": token1,
                "token2": token2,
                "amount1": amount1,
                "amount2": amount2,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            
            # Update LP values
            token1_value = amount1 * self.token_prices.get(token1, 0)
            token2_value = amount2 * self.token_prices.get(token2, 0)
            self.lp_values[lp_name] = token1_value + token2_value
            
            # Deduct tokens from balances
            self.token_balances[token1] -= amount1
            self.token_balances[token2] -= amount2
            
            self.logger.info(f"LP position {lp_name} created with value: ${self.lp_values[lp_name]:.2f}")
            
            return True
            
        except Exception as e:
            self.logger.error(f"Error creating LP position: {e}")
            return False
    
    async def execute_swap(self, input_token: str, output_token: str, amount: float, dry_run: bool = False) -> bool:
        """Execute a swap between two tokens"""
        try:
            if dry_run:
                self.logger.info(f"DRY RUN: Would swap {amount:.6f} {input_token.upper()} to {output_token.upper()}")
                return True
            
            self.logger.info(f"Executing swap: {amount:.6f} {input_token.upper()} to {output_token.upper()}")
            
            # Get token mint addresses
            input_mint = getattr(self, f"{input_token.upper()}_MINT")
            output_mint = getattr(self, f"{output_token.upper()}_MINT")
            
            if not input_mint or not output_mint:
                self.logger.error(f"Invalid token mint addresses - Input: {input_mint}, Output: {output_mint}")
                return False
            
            # Execute the swap
            success, tx_bytes, quote = await self.jupiter.execute_validated_swap(
                input_mint,
                output_mint,
                amount,
                min_amount=self.min_trade_amount,
                max_slippage=self.max_slippage
            )
            
            if not success or not tx_bytes:
                self.logger.error("Failed to prepare swap transaction")
                return False
            
            # Prepare and execute the transaction
            transaction = await self.jupiter.prepare_transaction(tx_bytes)
            if not transaction:
                self.logger.error("Failed to prepare transaction")
                return False
            
            # Execute the trade
            result = await self.jupiter.execute_trade_with_retries(transaction, output_mint, quote)
            
            if result and result.get('signature'):
                self.logger.info(f"Swap executed successfully: {result['signature']}")
                
                # Update token balances after swap
                await self.update_token_balances()
                
                # Record transaction
                self.transactions.append({
                    'type': 'SWAP',
                    'input_token': input_token,
                    'output_token': output_token,
                    'input_amount': amount,
                    'output_amount': result.get('amount', 0),
                    'timestamp': datetime.now(timezone.utc).isoformat(),
                    'signature': result['signature']
                })
                
                return True
            else:
                self.logger.error("Swap execution failed")
                return False
            
        except Exception as e:
            self.logger.error(f"Error executing swap: {e}")
            return False
    
    async def execute_triangle_arbitrage(
        self,
        start_token: str,
        mid1_token: str,
        mid2_token: str,
        end_token: str,
        min_profit: float = 0.005,
        position_size_pct: float = 0.05,
        dry_run: bool = False
    ) -> bool:
        """
        Execute a triangle arbitrage trade
        
        Args:
            start_token: Token to start with
            mid1_token: First intermediate token
            mid2_token: Second intermediate token
            end_token: Final token (should be same as start_token)
            min_profit: Minimum profit threshold (after fees)
            position_size_pct: Percentage of available balance to use
            dry_run: Whether to simulate the trades
        
        Returns:
            bool: Success or failure
        """
        try:
            if start_token != end_token:
                self.logger.error(f"Start token ({start_token}) must match end token ({end_token})")
                return False
            
            self.logger.info(f"Executing triangle arbitrage: {start_token} -> {mid1_token} -> {mid2_token} -> {end_token}")
            
            # Get current balances and prices
            await self.update_token_balances()
            await self.update_token_prices()
            
            # Calculate position size
            start_balance = self.token_balances.get(start_token, 0)
            position_size = start_balance * position_size_pct
            
            # Ensure minimum position size
            min_position_value = 10  # $10 minimum
            position_value = position_size * self.token_prices.get(start_token, 0)
            
            if position_value < min_position_value:
                self.logger.warning(f"Position value too small: ${position_value:.2f} < ${min_position_value}")
                return False
            
            if dry_run:
                self.logger.info(f"DRY RUN: Would execute triangle arbitrage with {position_size:.6f} {start_token.upper()}")
                return True
            
            # Execute the first swap
            success1 = await self.execute_swap(start_token, mid1_token, position_size)
            if not success1:
                self.logger.error(f"Failed first swap: {start_token} -> {mid1_token}")
                return False
            
            # Get new balance of mid1_token
            await self.update_token_balances()
            mid1_balance = self.token_balances.get(mid1_token, 0)
            
            # Execute the second swap
            success2 = await self.execute_swap(mid1_token, mid2_token, mid1_balance * 0.99)  # 99% to account for fees
            if not success2:
                self.logger.error(f"Failed second swap: {mid1_token} -> {mid2_token}")
                return False
            
            # Get new balance of mid2_token
            await self.update_token_balances()
            mid2_balance = self.token_balances.get(mid2_token, 0)
            
            # Execute the third swap
            success3 = await self.execute_swap(mid2_token, end_token, mid2_balance * 0.99)  # 99% to account for fees
            if not success3:
                self.logger.error(f"Failed third swap: {mid2_token} -> {end_token}")
                return False
            
            # Calculate profit
            await self.update_token_balances()
            end_balance = self.token_balances.get(end_token, 0)
            profit = end_balance - start_balance + position_size
            profit_pct = (profit / position_size) * 100
            
            self.logger.info(f"Triangle arbitrage complete - Profit: {profit:.6f} {end_token.upper()} ({profit_pct:.2f}%)")
            
            # Record arbitrage transaction
            self.transactions.append({
                'type': 'ARBITRAGE',
                'start_token': start_token,
                'end_token': end_token,
                'start_amount': position_size,
                'end_amount': end_balance,
                'profit': profit,
                'profit_pct': profit_pct,
                'path': f"{start_token} -> {mid1_token} -> {mid2_token} -> {end_token}",
                'timestamp': datetime.now(timezone.utc).isoformat()
            })
            
            return profit > 0
            
        except Exception as e:
            self.logger.error(f"Error executing triangle arbitrage: {e}")
            return False
