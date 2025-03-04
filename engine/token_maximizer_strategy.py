import os
import json
import logging
import asyncio
import aiohttp
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional, Tuple, Any
from dotenv import load_dotenv
from pathlib import Path
import anthropic

# Get absolute path to project root
project_root = Path(__file__).parent.parent.absolute()

# Add project root to Python path
import sys
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

# Import executor
from engine.token_maximizer_executor import TokenMaximizerExecutor
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

class TokenMaximizerStrategy:
    """
    Implements the Token Maximizer strategy for UBC/COMPUTE/SOL allocation
    """
    
    def __init__(self):
        """Initialize the strategy"""
        self.logger = setup_logging()
        self.executor = TokenMaximizerExecutor()
        
        # Initialize Claude client
        self.claude_api_key = os.getenv('ANTHROPIC_API_KEY')
        if not self.claude_api_key:
            self.logger.warning("ANTHROPIC_API_KEY not found in environment variables")
        else:
            self.claude = anthropic.Anthropic(api_key=self.claude_api_key)
        
        # Token scores (-10 to +10)
        self.ubc_score = 0
        self.compute_score = 0
        
        # Create logs directory if it doesn't exist
        self.logs_dir = project_root / "logs" / "claude"
        self.logs_dir.mkdir(parents=True, exist_ok=True)
        
    def set_token_scores(self, ubc_score: int, compute_score: int):
        """Set token scores manually"""
        # Validate scores are in range -10 to +10
        self.ubc_score = max(-10, min(10, ubc_score))
        self.compute_score = max(-10, min(10, compute_score))
        
        self.logger.info(f"Token scores set - UBC: {self.ubc_score}, COMPUTE: {self.compute_score}")
    
    async def get_market_sentiment(self) -> Dict:
        """Get current market sentiment data"""
        # This would normally fetch from an API or database
        # For now, return a placeholder
        return {
            "classification": "NEUTRAL",
            "confidence": 0.5,
            "indicators": "Market showing mixed signals with balanced buying and selling pressure."
        }
    
    async def get_token_dexscreener_data(self, token: str) -> Dict:
        """Get token data directly from DexScreener API"""
        try:
            self.logger.info(f"Fetching DexScreener data for {token}...")
            
            # Get token mint address
            token_mint = getattr(self.executor, f"{token.upper()}_MINT", None)
            if not token_mint:
                self.logger.error(f"No mint address found for {token}")
                return {}
            
            # Hardcoded pair addresses
            hardcoded_pairs = {
                "UBC": "hbjg1zpronbeiv86qdt1wzwgymts1ppxjcfoz819cbjd",
                "COMPUTE": "hn7ibjiyx399d1efyxcwashzrsmfumonyvxgfxg41rr3"
            }
            
            # Check if we have a hardcoded pair for this token
            if token.upper() in hardcoded_pairs:
                pair_address = hardcoded_pairs[token.upper()]
                self.logger.info(f"Using hardcoded pair address for {token}: {pair_address}")
                
                # Fetch data from DexScreener using the pair address
                dexscreener_url = f"https://api.dexscreener.com/latest/dex/pairs/solana/{pair_address}"
                
                async with aiohttp.ClientSession() as session:
                    async with session.get(dexscreener_url) as response:
                        if response.status != 200:
                            self.logger.error(f"DexScreener API error: {response.status}")
                            return {}
                        
                        data = await response.json()
                        pairs = data.get('pairs', [])
                        
                        if not pairs or len(pairs) == 0:
                            self.logger.warning(f"No pair data found for hardcoded {token} pair: {pair_address}")
                            return {}
                        
                        # Use the first pair (should be only one since we requested by pair address)
                        best_pair = pairs[0]
            else:
                # Original code for tokens without hardcoded pairs
                dexscreener_url = f"https://api.dexscreener.com/latest/dex/tokens/{token_mint}"
                
                async with aiohttp.ClientSession() as session:
                    async with session.get(dexscreener_url) as response:
                        if response.status != 200:
                            self.logger.error(f"DexScreener API error: {response.status}")
                            return {}
                        
                        data = await response.json()
                        pairs = data.get('pairs', [])
                        
                        if not pairs:
                            self.logger.warning(f"No pairs found for {token}")
                            return {}
                        
                        # Filter for Solana pairs
                        sol_pairs = [p for p in pairs if p.get('chainId') == 'solana']
                        if not sol_pairs:
                            self.logger.warning(f"No Solana pairs found for {token}")
                            return {}
                        
                        # Use the most liquid pair
                        best_pair = max(sol_pairs, key=lambda x: float(x.get('liquidity', {}).get('usd', 0) or 0))
                    
                    # Extract relevant data with additional validation
                    price_usd = best_pair.get('priceUsd', '0')
                    price_change = best_pair.get('priceChange', {}).get('h24', '0')
                    volume = best_pair.get('volume', {}).get('h24', '0')
                    liquidity = best_pair.get('liquidity', {}).get('usd', '0')
                    fdv = best_pair.get('fdv', '0')
                    
                    # Ensure all values are valid floats
                    try:
                        price_usd = float(price_usd) if price_usd else 0
                        price_change = float(price_change) if price_change else 0
                        volume = float(volume) if volume else 0
                        liquidity = float(liquidity) if liquidity else 0
                        fdv = float(fdv) if fdv else 0
                    except (ValueError, TypeError) as e:
                        self.logger.warning(f"Error parsing numeric values for {token}: {e}")
                        price_usd = 0
                        price_change = 0
                        volume = 0
                        liquidity = 0
                        fdv = 0
                    
                    # Validate price is reasonable (not extremely high or low)
                    if price_usd > 1000000 or price_usd < 0.0000001:
                        self.logger.warning(f"Suspicious price for {token}: ${price_usd}. Setting to 0 for safety.")
                        price_usd = 0
                    
                    token_data = {
                        "symbol": token,
                        "name": best_pair.get('baseToken', {}).get('name', token),
                        "address": token_mint,
                        "price": price_usd,
                        "priceChange24h": price_change,
                        "volume24h": volume,
                        "liquidity": liquidity,
                        "fdv": fdv,
                        "pairAddress": best_pair.get('pairAddress', ''),
                        "dexId": best_pair.get('dexId', ''),
                        "url": f"https://dexscreener.com/solana/{best_pair.get('pairAddress', '')}"
                    }
                    
                    self.logger.info(f"DexScreener data for {token}: Price=${token_data['price']:.4f}, 24h Change={token_data['priceChange24h']:.2f}%")
                    
                    return token_data
                    
        except Exception as e:
            self.logger.error(f"Error fetching DexScreener data for {token}: {e}")
            return {}
    
    async def get_token_score_from_claude(self, token: str) -> int:
        """Get score for a specific token from Claude API based on market data"""
        try:
            if not self.claude_api_key:
                self.logger.warning(f"No Claude API key available, using default score for {token}")
                return 0
            
            # Get market data
            market_sentiment = await self.get_market_sentiment()
            token_data = await self.get_token_dexscreener_data(token)
            
            # Prepare context for Claude
            context = {
                "market_sentiment": market_sentiment,
                "token_data": token_data,
                "current_time": datetime.now(timezone.utc).isoformat()
            }
            
            # Log the context data
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            context_log_path = self.logs_dir / f"claude_{token.lower()}_context_{timestamp}.json"
            with open(context_log_path, "w") as f:
                json.dump(context, f, indent=2)
            
            self.logger.info(f"Claude context data for {token} logged to {context_log_path}")
            
            # Create prompt for Claude (now much simpler)
            prompt = f"""
            Score the {token} token relative to SOL on a scale from -10 to +10.
            
            Provide your analysis and final score in this JSON format:
            ```json
            {{
                "score": 0,  // Integer between -10 and +10
                "reasoning": ""
            }}
            ```
            
            Only respond with valid JSON. No other text.
            """
            
            # Log the prompt
            prompt_log_path = self.logs_dir / f"claude_{token.lower()}_prompt_{timestamp}.txt"
            with open(prompt_log_path, "w") as f:
                f.write(prompt)
            
            self.logger.info(f"Claude prompt for {token} logged to {prompt_log_path}")
            
            # Create system prompt with context data
            system_prompt = f"""You are a professional crypto trader specializing in Solana tokens, implementing the Token Maximizer strategy. This strategy focuses on maximizing the quantity of tokens held rather than dollar value. The core principle is '1 {token} = 1 {token}' - success is measured by increasing the number of tokens owned, not their USD value. Your task is to analyze market data and provide optimal allocation score to accumulate more tokens over time through strategic positioning. Provide your analysis in JSON format only.

# Context Data

## Market Sentiment
Classification: {market_sentiment['classification']}
Confidence: {market_sentiment['confidence']}
Indicators: {market_sentiment['indicators']}

## {token} Token Data (DexScreener)
```
{json.dumps(token_data, indent=2)}
```

# Scoring Guidelines

Score {token} on a scale from -10 to +10 relative to SOL:
- +10: Extremely bullish on {token} vs SOL
- 0: Neutral on {token} vs SOL
- -10: Extremely bearish on {token} vs SOL
"""
            
            # Log the system prompt directly in the logs instead of writing to a file
            self.logger.info(f"\n===== SYSTEM PROMPT FOR {token} =====\n{system_prompt}\n=====END SYSTEM PROMPT=====")
            
            # Call Claude API with context in system prompt
            response = self.claude.messages.create(
                model="claude-3-7-sonnet-latest",
                max_tokens=1000,
                temperature=0,
                system=system_prompt,
                messages=[
                    {"role": "user", "content": prompt}
                ]
            )
            
            # Extract JSON from response
            response_text = response.content[0].text
            
            # Log the response
            response_log_path = self.logs_dir / f"claude_{token.lower()}_response_{timestamp}.txt"
            with open(response_log_path, "w") as f:
                f.write(response_text)
            
            self.logger.info(f"Claude response for {token} logged to {response_log_path}")
            
            # Clean up response to ensure it's valid JSON
            json_str = response_text.strip()
            if json_str.startswith("```json"):
                json_str = json_str[7:]
            if json_str.endswith("```"):
                json_str = json_str[:-3]
            
            json_str = json_str.strip()
            
            # Parse JSON
            score_data = json.loads(json_str)
            
            # Extract score
            score = int(score_data.get("score", 0))
            reasoning = score_data.get("reasoning", "")
            
            # Log the score
            self.logger.info(f"Claude score for {token}: {score}")
            self.logger.info(f"{token} reasoning: {reasoning}")
            
            return score
            
        except Exception as e:
            self.logger.error(f"Error getting token score for {token} from Claude: {e}")
            
            # Fallback to a simple price-based score if Claude fails
            try:
                token_data = await self.get_token_dexscreener_data(token)
                if token_data:
                    # Simple scoring based on 24h price change
                    price_change = token_data.get('priceChange24h', 0)
                    
                    # Convert price change to a score between -10 and 10
                    # 20% change = max score, linear scale
                    fallback_score = int((price_change / 20) * 10)
                    fallback_score = max(-10, min(10, fallback_score))
                    
                    self.logger.info(f"Using fallback score for {token} based on price change: {fallback_score}")
                    return fallback_score
            except Exception as fallback_err:
                self.logger.error(f"Fallback scoring also failed for {token}: {fallback_err}")
            
            # If all else fails, return neutral score
            return 0

    async def get_token_scores_from_claude(self) -> Tuple[int, int]:
        """Get token scores from Claude API based on market data"""
        try:
            if not self.claude_api_key:
                self.logger.warning("No Claude API key available, using default scores")
                return (0, 0)
            
            # Make separate calls for each token
            self.logger.info("Getting UBC score from Claude...")
            ubc_score = await self.get_token_score_from_claude("UBC")
            
            self.logger.info("Getting COMPUTE score from Claude...")
            compute_score = await self.get_token_score_from_claude("COMPUTE")
            
            self.logger.info(f"Claude scores - UBC: {ubc_score}, COMPUTE: {compute_score}")
            
            return (ubc_score, compute_score)
            
        except Exception as e:
            self.logger.error(f"Error getting token scores from Claude: {e}")
            return (0, 0)
    
    def calculate_allocation(self) -> Dict[str, float]:
        """Calculate allocation percentages based on token scores"""
        try:
            self.logger.info(f"Calculating allocation with scores - UBC: {self.ubc_score}, COMPUTE: {self.compute_score}")
            
            # Base allocation (1/6 for each option)
            base_allocation = 1/6  # 16.67%
            
            # Calculate direct token holdings
            ubc_direct = base_allocation + (self.ubc_score * 0.0167)  # +1.67% per point
            compute_direct = base_allocation + (self.compute_score * 0.0167)  # +1.67% per point
            
            # Calculate LP positions
            ubc_sol_lp = base_allocation + ((-self.ubc_score) * 0.0167)  # +1.67% per negative point
            compute_sol_lp = base_allocation + ((-self.compute_score) * 0.0167)  # +1.67% per negative point
            
            # Calculate UBC/COMPUTE LP based on score similarity
            score_diff = abs(self.ubc_score - self.compute_score)
            ubc_compute_lp = base_allocation * (1 + (10 - score_diff) / 10)
            
            # Calculate SOL position
            # Increases when both tokens are negative
            if self.ubc_score < 0 and self.compute_score < 0:
                sol_direct = base_allocation * (1 + (abs(self.ubc_score) + abs(self.compute_score)) / 20)
            else:
                sol_direct = base_allocation * (1 - (max(0, self.ubc_score) + max(0, self.compute_score)) / 20)
            
            # Ensure all allocations are non-negative
            ubc_direct = max(0, ubc_direct)
            compute_direct = max(0, compute_direct)
            ubc_sol_lp = max(0, ubc_sol_lp)
            compute_sol_lp = max(0, compute_sol_lp)
            ubc_compute_lp = max(0, ubc_compute_lp)
            sol_direct = max(0, sol_direct)
            
            # Normalize to ensure sum is 1.0
            total = ubc_direct + compute_direct + ubc_sol_lp + compute_sol_lp + ubc_compute_lp + sol_direct
            
            allocation = {
                "ubc": ubc_direct / total,
                "compute": compute_direct / total,
                "ubc_sol_lp": ubc_sol_lp / total,
                "compute_sol_lp": compute_sol_lp / total,
                "ubc_compute_lp": ubc_compute_lp / total,
                "sol": sol_direct / total
            }
            
            # Log the allocation
            self.logger.info("Calculated allocation:")
            for key, value in allocation.items():
                self.logger.info(f"  {key}: {value:.2%}")
            
            return allocation
            
        except Exception as e:
            self.logger.error(f"Error calculating allocation: {e}")
            # Return default allocation
            return {
                "ubc": 1/6,
                "compute": 1/6,
                "ubc_sol_lp": 1/6,
                "compute_sol_lp": 1/6,
                "ubc_compute_lp": 1/6,
                "sol": 1/6
            }
    
    async def get_current_allocation(self) -> Dict[str, float]:
        """Get current portfolio allocation"""
        try:
            # Update token prices and balances
            await self.executor.update_token_prices()
            await self.executor.update_token_balances()
            
            # Calculate current value of each position
            ubc_value = self.executor.token_balances["ubc"] * self.executor.token_prices["ubc"]
            compute_value = self.executor.token_balances["compute"] * self.executor.token_prices["compute"]
            sol_value = self.executor.token_balances["sol"] * self.executor.token_prices["sol"]
            
            # For now, we don't have LP positions, so set them to 0
            ubc_sol_lp_value = 0
            compute_sol_lp_value = 0
            ubc_compute_lp_value = 0
            
            # Calculate total portfolio value
            total_value = ubc_value + compute_value + sol_value + ubc_sol_lp_value + compute_sol_lp_value + ubc_compute_lp_value
            
            # Calculate allocation percentages
            if total_value > 0:
                allocation = {
                    "ubc": ubc_value / total_value,
                    "compute": compute_value / total_value,
                    "ubc_sol_lp": ubc_sol_lp_value / total_value,
                    "compute_sol_lp": compute_sol_lp_value / total_value,
                    "ubc_compute_lp": ubc_compute_lp_value / total_value,
                    "sol": sol_value / total_value
                }
            else:
                # Default allocation if portfolio is empty
                allocation = {
                    "ubc": 0,
                    "compute": 0,
                    "ubc_sol_lp": 0,
                    "compute_sol_lp": 0,
                    "ubc_compute_lp": 0,
                    "sol": 0
                }
            
            # Log the current allocation
            self.logger.info("Current allocation:")
            for key, value in allocation.items():
                self.logger.info(f"  {key}: {value:.2%}")
            
            return allocation
            
        except Exception as e:
            self.logger.error(f"Error getting current allocation: {e}")
            return {
                "ubc": 0,
                "compute": 0,
                "ubc_sol_lp": 0,
                "compute_sol_lp": 0,
                "ubc_compute_lp": 0,
                "sol": 0
            }
    
    async def execute_rebalance(self, target_allocation: Dict[str, float], dry_run: bool = False) -> bool:
        """Execute rebalance to match target allocation, with optional dry-run mode"""
        try:
            # Get current allocation
            current_allocation = await self.get_current_allocation()
            
            # Calculate total portfolio value
            await self.executor.update_token_prices()
            await self.executor.update_token_balances()
            
            ubc_value = self.executor.token_balances["ubc"] * self.executor.token_prices["ubc"]
            compute_value = self.executor.token_balances["compute"] * self.executor.token_prices["compute"]
            sol_value = self.executor.token_balances["sol"] * self.executor.token_prices["sol"]
            
            # For now, we don't have LP positions, so set them to 0
            ubc_sol_lp_value = 0
            compute_sol_lp_value = 0
            ubc_compute_lp_value = 0
            
            total_value = ubc_value + compute_value + sol_value + ubc_sol_lp_value + compute_sol_lp_value + ubc_compute_lp_value
            
            # For now, we only handle direct token holdings (not LP positions)
            simplified_current = {
                "ubc": current_allocation.get("ubc", 0),
                "compute": current_allocation.get("compute", 0),
                "sol": current_allocation.get("sol", 0)
            }
            
            simplified_target = {
                "ubc": target_allocation.get("ubc", 0),
                "compute": target_allocation.get("compute", 0),
                "sol": target_allocation.get("sol", 0)
            }
            
            # Normalize simplified allocations
            simplified_current_total = sum(simplified_current.values())
            simplified_target_total = sum(simplified_target.values())
            
            if simplified_current_total > 0:
                simplified_current = {k: v / simplified_current_total for k, v in simplified_current.items()}
            
            if simplified_target_total > 0:
                simplified_target = {k: v / simplified_target_total for k, v in simplified_target.items()}
            
            # Execute or simulate rebalance trades
            success = await self.executor.execute_rebalance_trades(
                simplified_current,
                simplified_target,
                total_value,
                dry_run=dry_run
            )
            
            return success
            
        except Exception as e:
            self.logger.error(f"Error executing rebalance: {e}")
            return False
    
    async def run_daily_update(self, dry_run: bool = False) -> bool:
        """Run daily update process with optional dry-run mode"""
        try:
            self.logger.info(f"Starting Token Maximizer daily update {'(DRY RUN)' if dry_run else ''}")
            
            # Always get scores from Claude unless they were explicitly set
            # This ensures we use AI-generated scores by default
            if not (self.ubc_score != 0 or self.compute_score != 0):
                self.logger.info("Getting token scores from Claude AI...")
                self.ubc_score, self.compute_score = await self.get_token_scores_from_claude()
                self.logger.info(f"Claude AI scores - UBC: {self.ubc_score}, COMPUTE: {self.compute_score}")
            else:
                self.logger.info(f"Using manually set scores - UBC: {self.ubc_score}, COMPUTE: {self.compute_score}")
            
            # Calculate target allocation
            target_allocation = self.calculate_allocation()
            
            # Execute rebalance (or simulate in dry-run mode)
            success = await self.execute_rebalance(target_allocation, dry_run=dry_run)
            
            if success:
                self.logger.info(f"Token Maximizer daily update {'simulation' if dry_run else 'execution'} completed successfully")
            else:
                self.logger.error(f"Token Maximizer daily update {'simulation' if dry_run else 'execution'} failed")
            
            return success
            
        except Exception as e:
            self.logger.error(f"Error in Token Maximizer daily update: {e}")
            return False
