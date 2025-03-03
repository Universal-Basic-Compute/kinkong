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
    
    # Token mint addresses
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
        
        # Transaction history
        self.transactions = []
    
    async def update_token_prices(self):
        """Update token prices from Jupiter API"""
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
    
    async def execute_rebalance_trades(self, current_allocation: Dict[str, float], target_allocation: Dict[str, float], portfolio_value: float) -> bool:
        """Execute trades to rebalance portfolio according to target allocation"""
        self.logger.info("Executing rebalance trades...")
        
        # Update token prices and balances
        await self.update_token_prices()
        await self.update_token_balances()
        
        # Calculate trade values for each token
        trades = []
        for token in ["ubc", "compute", "sol"]:
            current_value = portfolio_value * current_allocation.get(token, 0)
            target_value = portfolio_value * target_allocation.get(token, 0)
            value_diff = target_value - current_value
            
            # Only trade if difference is significant (>1% of portfolio)
            if abs(value_diff) > portfolio_value * 0.01:
                trades.append({
                    "token": token,
                    "value_diff": value_diff
                })
                self.logger.info(f"{token.upper()} needs adjustment of ${value_diff:.2f}")
        
        # Sort trades: first sell, then buy
        sell_trades = [t for t in trades if t["value_diff"] < 0]
        buy_trades = [t for t in trades if t["value_diff"] > 0]
        
        # Execute sell trades first to get USDC
        for trade in sell_trades:
            token = trade["token"]
            value = abs(trade["value_diff"])
            
            if token == "sol":
                # Special handling for SOL
                self.logger.info(f"Selling {token.upper()} for ${value:.2f}")
                success = await self.execute_sell_trade(token, value)
                if not success:
                    self.logger.error(f"Failed to sell {token.upper()}")
            else:
                self.logger.info(f"Selling {token.upper()} for ${value:.2f}")
                success = await self.execute_sell_trade(token, value)
                if not success:
                    self.logger.error(f"Failed to sell {token.upper()}")
        
        # Update balances after sells
        await self.update_token_balances()
        
        # Execute buy trades
        for trade in buy_trades:
            token = trade["token"]
            value = trade["value_diff"]
            
            if token == "sol":
                # Special handling for SOL
                self.logger.info(f"Buying {token.upper()} for ${value:.2f}")
                success = await self.execute_buy_trade(token, value)
                if not success:
                    self.logger.error(f"Failed to buy {token.upper()}")
            else:
                self.logger.info(f"Buying {token.upper()} for ${value:.2f}")
                success = await self.execute_buy_trade(token, value)
                if not success:
                    self.logger.error(f"Failed to buy {token.upper()}")
        
        # Update balances after buys
        await self.update_token_balances()
        
        self.logger.info("Rebalance trades completed")
        return True
    
    def get_transaction_history(self) -> List[Dict]:
        """Get transaction history"""
        return self.transactions
