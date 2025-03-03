import os
import json
import logging
import asyncio
import aiohttp
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional, Tuple
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

class TokenNativeStrategy:
    """
    Implements the Score-Based Token-Native Strategy for UBC/COMPUTE/SOL allocation
    """
    
    # Token mint addresses
    UBC_MINT = "EPeUFDgHRxs9xxEPVaL6kfGQvCon7jmAWKVUHuux1Tpz"  # UBC token
    COMPUTE_MINT = "5Ycj5XGpGwYPT5UkXJYZnwUXbvTZwGfpYdgDrRQyZYAE"  # COMPUTE token
    SOL_MINT = "So11111111111111111111111111111111111111112"  # Native SOL
    USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"  # USDC
    
    # LP token mint addresses (to be updated with actual values)
    UBC_SOL_LP_MINT = ""  # UBC/SOL LP token
    COMPUTE_SOL_LP_MINT = ""  # COMPUTE/SOL LP token
    UBC_COMPUTE_LP_MINT = ""  # UBC/COMPUTE LP token
    
    def __init__(self):
        """Initialize the strategy with default values"""
        self.logger = setup_logging()
        self.jupiter = JupiterTradeExecutor()
        
        # Initialize scores
        self.ubc_score = 0  # Neutral by default
        self.compute_score = 0  # Neutral by default
        
        # Initialize current allocations
        self.current_allocations = {
            "ubc": 0.0,
            "compute": 0.0,
            "sol": 0.0,
            "ubc_sol_lp": 0.0,
            "compute_sol_lp": 0.0,
            "ubc_compute_lp": 0.0
        }
        
        # Initialize target allocations
        self.target_allocations = {
            "ubc": 0.1667,  # 1/6 of portfolio
            "compute": 0.1667,
            "sol": 0.1667,
            "ubc_sol_lp": 0.1667,
            "compute_sol_lp": 0.1667,
            "ubc_compute_lp": 0.1667
        }
        
        # Initialize token balances
        self.token_balances = {
            "ubc": 0.0,
            "compute": 0.0,
            "sol": 0.0,
            "ubc_sol_lp": 0.0,
            "compute_sol_lp": 0.0,
            "ubc_compute_lp": 0.0,
            "usdc": 0.0
        }
        
        # Initialize token prices in USD
        self.token_prices = {
            "ubc": 0.0,
            "compute": 0.0,
            "sol": 0.0,
            "ubc_sol_lp": 0.0,
            "compute_sol_lp": 0.0,
            "ubc_compute_lp": 0.0,
            "usdc": 1.0  # USDC is pegged to USD
        }
        
        # Last rebalance timestamp
        self.last_rebalance = datetime.now(timezone.utc)
        
        # Performance metrics
        self.initial_token_amounts = {
            "ubc": 0.0,
            "compute": 0.0,
            "sol": 0.0
        }
        
        self.current_token_amounts = {
            "ubc": 0.0,
            "compute": 0.0,
            "sol": 0.0
        }
        
        # LP fee tracking
        self.lp_fees_earned = {
            "ubc_sol_lp": 0.0,
            "compute_sol_lp": 0.0,
            "ubc_compute_lp": 0.0
        }
    
    async def update_token_prices(self):
        """Update token prices from DexScreener API"""
        self.logger.info("Updating token prices...")
        
        # List of tokens to update
        tokens = [
            {"name": "ubc", "mint": self.UBC_MINT},
            {"name": "compute", "mint": self.COMPUTE_MINT},
            {"name": "sol", "mint": self.SOL_MINT}
        ]
        
        for token in tokens:
            try:
                price = await self.jupiter.get_token_price(token["mint"])
                if price:
                    self.token_prices[token["name"]] = price
                    self.logger.info(f"{token['name'].upper()} price: ${price:.6f}")
                else:
                    self.logger.warning(f"Could not get price for {token['name'].upper()}")
            except Exception as e:
                self.logger.error(f"Error getting {token['name'].upper()} price: {e}")
        
        # For LP tokens, we would need to calculate based on reserves
        # This is a simplified placeholder
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
        
        # For LP tokens, we would need to get the LP token balance
        # This is a simplified placeholder
        self.logger.info("Token balances updated")
    
    def calculate_portfolio_value(self) -> float:
        """Calculate total portfolio value in USD"""
        total_value = 0.0
        
        # Add direct token holdings
        for token in ["ubc", "compute", "sol", "usdc"]:
            value = self.token_balances[token] * self.token_prices[token]
            total_value += value
            self.logger.info(f"{token.upper()} value: ${value:.2f}")
        
        # Add LP token holdings (simplified)
        for lp in ["ubc_sol_lp", "compute_sol_lp", "ubc_compute_lp"]:
            value = self.token_balances[lp] * self.token_prices[lp]
            total_value += value
            self.logger.info(f"{lp.upper()} value: ${value:.2f}")
        
        self.logger.info(f"Total portfolio value: ${total_value:.2f}")
        return total_value
    
    def calculate_current_allocations(self):
        """Calculate current allocation percentages"""
        total_value = self.calculate_portfolio_value()
        
        if total_value <= 0:
            self.logger.warning("Portfolio value is zero or negative")
            return
        
        # Calculate direct token allocations
        for token in ["ubc", "compute", "sol"]:
            value = self.token_balances[token] * self.token_prices[token]
            self.current_allocations[token] = value / total_value
            self.logger.info(f"{token.upper()} allocation: {self.current_allocations[token]:.2%}")
        
        # Calculate LP token allocations (simplified)
        for lp in ["ubc_sol_lp", "compute_sol_lp", "ubc_compute_lp"]:
            value = self.token_balances[lp] * self.token_prices[lp]
            self.current_allocations[lp] = value / total_value
            self.logger.info(f"{lp.upper()} allocation: {self.current_allocations[lp]:.2%}")
    
    def set_token_scores(self, ubc_score: int, compute_score: int):
        """Set the scores for UBC and COMPUTE tokens"""
        # Validate scores are in range -10 to +10
        self.ubc_score = max(-10, min(10, ubc_score))
        self.compute_score = max(-10, min(10, compute_score))
        
        self.logger.info(f"Set UBC score to {self.ubc_score}")
        self.logger.info(f"Set COMPUTE score to {self.compute_score}")
        
        # Recalculate target allocations based on new scores
        self.calculate_target_allocations()
    
    def calculate_target_allocations(self):
        """Calculate target allocations based on current scores"""
        # Base allocation for each position (1/6 of portfolio)
        base_allocation = 1/6
        
        # Adjustment factor per score point (1.67% per point)
        adjustment_factor = base_allocation / 10
        
        # 1. Direct UBC Holdings
        ubc_adjustment = max(0, self.ubc_score) * adjustment_factor
        self.target_allocations["ubc"] = base_allocation + ubc_adjustment
        
        # 2. Direct COMPUTE Holdings
        compute_adjustment = max(0, self.compute_score) * adjustment_factor
        self.target_allocations["compute"] = base_allocation + compute_adjustment
        
        # 3. UBC/SOL LP
        ubc_sol_adjustment = max(0, -self.ubc_score) * adjustment_factor
        self.target_allocations["ubc_sol_lp"] = base_allocation + ubc_sol_adjustment
        
        # 4. COMPUTE/SOL LP
        compute_sol_adjustment = max(0, -self.compute_score) * adjustment_factor
        self.target_allocations["compute_sol_lp"] = base_allocation + compute_sol_adjustment
        
        # 5. UBC/COMPUTE LP
        # Higher when scores are similar (narrower spread)
        score_spread = abs(self.ubc_score - self.compute_score)
        spread_factor = 1 - (score_spread / 20)  # 1 when identical, 0 when opposite extremes
        self.target_allocations["ubc_compute_lp"] = base_allocation + (base_allocation * spread_factor)
        
        # 6. Direct SOL Holdings
        # Increases when both UBC and COMPUTE scores are negative
        sol_adjustment = 0
        if self.ubc_score < 0 and self.compute_score < 0:
            sol_adjustment = (abs(self.ubc_score) + abs(self.compute_score)) / 20 * base_allocation
        self.target_allocations["sol"] = base_allocation + sol_adjustment
        
        # Normalize allocations to ensure they sum to 100%
        total_allocation = sum(self.target_allocations.values())
        if total_allocation > 0:
            for key in self.target_allocations:
                self.target_allocations[key] /= total_allocation
        
        # Log target allocations
        self.logger.info("Target allocations calculated:")
        for key, value in self.target_allocations.items():
            self.logger.info(f"{key}: {value:.2%}")
    
    def should_rebalance(self) -> bool:
        """Determine if rebalancing is needed based on allocation drift"""
        # Check if it's been at least 24 hours since last rebalance
        time_since_rebalance = datetime.now(timezone.utc) - self.last_rebalance
        if time_since_rebalance < timedelta(hours=24):
            self.logger.info(f"Last rebalance was {time_since_rebalance.total_seconds() / 3600:.1f} hours ago")
            return False
        
        # Check if any allocation is off by more than 5%
        for key in self.target_allocations:
            drift = abs(self.current_allocations[key] - self.target_allocations[key])
            if drift > 0.05:  # 5% threshold
                self.logger.info(f"{key} allocation drift: {drift:.2%} (exceeds 5% threshold)")
                return True
        
        self.logger.info("All allocations within 5% of targets, no rebalance needed")
        return False
    
    async def rebalance_portfolio(self):
        """Rebalance portfolio to match target allocations"""
        self.logger.info("Starting portfolio rebalance...")
        
        # Update token prices and balances
        await self.update_token_prices()
        await self.update_token_balances()
        
        # Calculate current allocations
        self.calculate_current_allocations()
        
        # Check if rebalancing is needed
        if not self.should_rebalance():
            self.logger.info("Rebalance not needed at this time")
            return
        
        # Calculate total portfolio value
        total_value = self.calculate_portfolio_value()
        
        # Calculate target values for each position
        target_values = {}
        for key in self.target_allocations:
            target_values[key] = total_value * self.target_allocations[key]
            self.logger.info(f"{key} target value: ${target_values[key]:.2f}")
        
        # Calculate current values
        current_values = {}
        for key in self.current_allocations:
            current_values[key] = total_value * self.current_allocations[key]
            self.logger.info(f"{key} current value: ${current_values[key]:.2f}")
        
        # Calculate trades needed
        trades_needed = []
        for key in target_values:
            value_diff = target_values[key] - current_values[key]
            if abs(value_diff) > total_value * 0.01:  # Only trade if diff > 1% of portfolio
                trades_needed.append({
                    "position": key,
                    "value_diff": value_diff
                })
                self.logger.info(f"{key} needs adjustment of ${value_diff:.2f}")
        
        # Execute trades (simplified implementation)
        for trade in trades_needed:
            position = trade["position"]
            value_diff = trade["value_diff"]
            
            # Skip LP positions for now (would require LP interactions)
            if "_lp" in position:
                self.logger.info(f"Skipping LP position {position} (not implemented)")
                continue
            
            # For direct token holdings
            if value_diff > 0:
                # Need to buy more of this token
                await self.execute_buy_trade(position, value_diff)
            else:
                # Need to sell some of this token
                await self.execute_sell_trade(position, abs(value_diff))
        
        # Update last rebalance timestamp
        self.last_rebalance = datetime.now(timezone.utc)
        self.logger.info("Portfolio rebalance completed")
        
        # Update token balances after rebalance
        await self.update_token_balances()
        self.calculate_current_allocations()
    
    async def execute_buy_trade(self, token: str, value_usd: float):
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
            return True
        else:
            self.logger.error(f"Buy trade for {token.upper()} failed")
            return False
    
    async def execute_sell_trade(self, token: str, value_usd: float):
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
            return True
        else:
            self.logger.error(f"Sell trade for {token.upper()} failed")
            return False
    
    async def track_token_growth(self):
        """Track token growth over time"""
        # Update current token amounts
        await self.update_token_balances()
        
        # If initial amounts are zero, set them
        if sum(self.initial_token_amounts.values()) == 0:
            self.initial_token_amounts = {
                "ubc": self.token_balances["ubc"],
                "compute": self.token_balances["compute"],
                "sol": self.token_balances["sol"]
            }
            self.logger.info("Initial token amounts set")
            return
        
        # Update current amounts
        self.current_token_amounts = {
            "ubc": self.token_balances["ubc"],
            "compute": self.token_balances["compute"],
            "sol": self.token_balances["sol"]
        }
        
        # Calculate growth percentages
        growth = {}
        for token in self.initial_token_amounts:
            if self.initial_token_amounts[token] > 0:
                growth[token] = (self.current_token_amounts[token] / self.initial_token_amounts[token] - 1) * 100
                self.logger.info(f"{token.upper()} growth: {growth[token]:.2f}%")
            else:
                growth[token] = 0
                self.logger.info(f"{token.upper()} growth: N/A (initial amount was 0)")
        
        return growth
    
    async def run_daily_update(self):
        """Run daily update process"""
        self.logger.info("Starting daily update process...")
        
        # 1. Update token prices and balances
        await self.update_token_prices()
        await self.update_token_balances()
        
        # 2. Calculate current allocations
        self.calculate_current_allocations()
        
        # 3. Track token growth
        await self.track_token_growth()
        
        # 4. Rebalance portfolio if needed
        await self.rebalance_portfolio()
        
        self.logger.info("Daily update process completed")

async def main():
    """Main function to run the strategy"""
    logger = setup_logging()
    logger.info("Starting Token Native Strategy")
    
    strategy = TokenNativeStrategy()
    
    # Example: Set scores based on market analysis
    strategy.set_token_scores(5, -3)  # UBC +5, COMPUTE -3
    
    # Run daily update
    await strategy.run_daily_update()
    
    logger.info("Strategy execution completed")

if __name__ == "__main__":
    asyncio.run(main())
