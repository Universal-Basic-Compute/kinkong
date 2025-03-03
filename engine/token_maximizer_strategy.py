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
        self.claude_api_key = os.getenv('CLAUDE_API_KEY')
        if not self.claude_api_key:
            self.logger.warning("CLAUDE_API_KEY not found in environment variables")
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
            "reasoning": "Market showing mixed signals with balanced buying and selling pressure."
        }
    
    async def get_token_snapshots(self, token: str) -> List[Dict]:
        """Get recent token snapshots"""
        # This would normally fetch from an API or database
        # For now, return placeholder data
        return [
            {
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "price": 1.0,
                "volume24h": 1000000,
                "marketCap": 10000000,
                "liquidity": 500000,
                "priceChange24h": 0.05,
                "volumeChange24h": 0.1
            }
        ]
    
    async def get_token_scores_from_claude(self) -> Tuple[int, int]:
        """Get token scores from Claude API based on market data"""
        try:
            if not self.claude_api_key:
                self.logger.warning("No Claude API key available, using default scores")
                return (0, 0)
            
            # Get market data
            market_sentiment = await self.get_market_sentiment()
            ubc_snapshots = await self.get_token_snapshots("UBC")
            compute_snapshots = await self.get_token_snapshots("COMPUTE")
            
            # Prepare context for Claude
            context = {
                "market_sentiment": market_sentiment,
                "ubc_snapshots": ubc_snapshots,
                "compute_snapshots": compute_snapshots,
                "current_time": datetime.now(timezone.utc).isoformat()
            }
            
            # Log the context data
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            context_log_path = self.logs_dir / f"claude_context_{timestamp}.json"
            with open(context_log_path, "w") as f:
                json.dump(context, f, indent=2)
            
            self.logger.info(f"Claude context data logged to {context_log_path}")
            
            # Create prompt for Claude
            prompt = f"""
            You are a professional crypto trader specializing in Solana tokens. Your task is to score two tokens (UBC and COMPUTE) relative to SOL on a scale from -10 to +10.

            # Context Data
            
            ## Market Sentiment
            Classification: {market_sentiment['classification']}
            Confidence: {market_sentiment['confidence']}
            Reasoning: {market_sentiment['reasoning']}
            
            ## UBC Token Snapshots (7-day history)
            ```
            {json.dumps(ubc_snapshots, indent=2)}
            ```
            
            ## COMPUTE Token Snapshots (7-day history)
            ```
            {json.dumps(compute_snapshots, indent=2)}
            ```
            
            # Scoring Guidelines
            
            Score each token on a scale from -10 to +10:
            - +10: Extremely bullish on token vs SOL
            - 0: Neutral on token vs SOL
            - -10: Extremely bearish on token vs SOL
            
            # Response Format
            
            Provide your analysis and final scores in this JSON format:
            ```json
            {{
                "ubc_score": 0,  // Integer between -10 and +10
                "compute_score": 0,  // Integer between -10 and +10
                "ubc_reasoning": "",
                "compute_reasoning": ""
            }}
            ```
            
            Only respond with valid JSON. No other text.
            """
            
            # Log the prompt
            prompt_log_path = self.logs_dir / f"claude_prompt_{timestamp}.txt"
            with open(prompt_log_path, "w") as f:
                f.write(prompt)
            
            self.logger.info(f"Claude prompt logged to {prompt_log_path}")
            
            # Call Claude API
            response = self.claude.messages.create(
                model="claude-3-7-sonnet-latest",
                max_tokens=1000,
                temperature=0,
                system="You are a professional crypto trader specializing in Solana tokens, implementing the Token Maximizer strategy. This strategy focuses on maximizing the quantity of tokens held rather than dollar value. The core principle is '1 UBC = 1 UBC' - success is measured by increasing the number of tokens owned, not their USD value. Your task is to analyze market data and provide optimal allocation scores to accumulate more tokens over time through strategic positioning. Provide your analysis in JSON format only.",
                messages=[
                    {"role": "user", "content": prompt}
                ]
            )
            
            # Extract JSON from response
            response_text = response.content[0].text
            
            # Log the response
            response_log_path = self.logs_dir / f"claude_response_{timestamp}.txt"
            with open(response_log_path, "w") as f:
                f.write(response_text)
            
            self.logger.info(f"Claude response logged to {response_log_path}")
            
            # Clean up response to ensure it's valid JSON
            json_str = response_text.strip()
            if json_str.startswith("```json"):
                json_str = json_str[7:]
            if json_str.endswith("```"):
                json_str = json_str[:-3]
            
            json_str = json_str.strip()
            
            # Parse JSON
            score_data = json.loads(json_str)
            
            # Extract scores
            ubc_score = int(score_data.get("ubc_score", 0))
            compute_score = int(score_data.get("compute_score", 0))
            
            # Log the scores
            self.logger.info(f"Claude scores - UBC: {ubc_score}, COMPUTE: {compute_score}")
            self.logger.info(f"UBC reasoning: {score_data.get('ubc_reasoning', '')}")
            self.logger.info(f"COMPUTE reasoning: {score_data.get('compute_reasoning', '')}")
            
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
            
            # If scores are not set manually, get them from Claude
            if self.ubc_score == 0 and self.compute_score == 0:
                self.ubc_score, self.compute_score = await self.get_token_scores_from_claude()
            
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
