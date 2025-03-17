"""
LP Position Analyzer

This script analyzes liquidity pool positions, takes wallet and token snapshots,
generates trading signals, and uses Claude AI to provide recommendations for LP allocations.
"""

import sys
import os
from pathlib import Path
import logging
import json
import asyncio
from datetime import datetime, timezone
from typing import Dict, List, Any, Optional
from dotenv import load_dotenv
import anthropic

# Add project root to Python path
project_root = str(Path(__file__).parent.parent.parent.absolute())
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from engine.lp.pool_mapping import PoolMapper

class CustomJSONEncoder(json.JSONEncoder):
    """Custom JSON encoder that can handle ChartAnalysis objects"""
    def default(self, obj):
        # Check if the object has a to_dict method (like ChartAnalysis)
        if hasattr(obj, 'to_dict'):
            return obj.to_dict()
        # Check if it's a datetime object
        elif isinstance(obj, datetime):
            return obj.isoformat()
        # Let the base class handle anything else
        return super().default(obj)

# Import project modules
from engine.wallet_snapshots import WalletSnapshotTaker
from engine.token_snapshots import TokenSnapshotTaker
from engine.signals import SignalGenerator
from airtable import Airtable

# Configure logging
def setup_logging():
    """Set up logging configuration"""
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    return logging.getLogger(__name__)

logger = setup_logging()

class LPPositionAnalyzer:
    """Analyzes LP positions and provides recommendations for allocations"""
    
    def __init__(self):
        # Load environment variables
        load_dotenv()
        
        # Initialize Airtable
        self.base_id = os.getenv('KINKONG_AIRTABLE_BASE_ID')
        self.api_key = os.getenv('KINKONG_AIRTABLE_API_KEY')
        
        if not self.base_id or not self.api_key:
            raise ValueError("Missing Airtable credentials in environment variables")
            
    @staticmethod
    def safe_len(value):
        """Safely get the length of a value, returning 0 for non-iterable types"""
        try:
            return len(value)
        except (TypeError, AttributeError):
            return 0
        
        # Initialize Airtable tables
        self.lp_positions_table = Airtable(self.base_id, 'LP_POSITIONS', self.api_key)
        self.thoughts_table = Airtable(self.base_id, 'THOUGHTS', self.api_key)
        
        # Initialize Claude API
        self.claude_api_key = os.getenv('ANTHROPIC_API_KEY')
        if not self.claude_api_key:
            raise ValueError("Missing Claude API key in environment variables")
        
        self.claude_client = anthropic.Client(api_key=self.claude_api_key)
        
        # Initialize other components
        self.wallet_snapshot_taker = WalletSnapshotTaker()
        self.token_snapshot_taker = TokenSnapshotTaker()
        self.signal_generator = SignalGenerator()
        
        # Initialize pool mapper
        try:
            self.pool_mapper = PoolMapper()
            logger.info("Pool mapper initialized successfully")
        except Exception as e:
            logger.error(f"Error initializing pool mapper: {e}")
            self.pool_mapper = None
    
    def get_lp_positions(self) -> List[Dict]:
        """Get all LP positions from Airtable"""
        try:
            logger.info("Fetching LP positions from Airtable...")
            records = self.lp_positions_table.get_all(
                formula="AND({status}='ACTIVE', {isActive}=1)"
            )
            
            positions = []
            for record in records:
                position = {
                    'id': record['id'],
                    **record['fields']
                }
                positions.append(position)
            
            logger.info(f"Found {len(positions)} active LP positions")
            return positions
        except Exception as e:
            logger.error(f"Error fetching LP positions: {e}")
            return []
    
    async def get_pool_statistics(self, pool_address: str, pool_type: str) -> Dict:
        """Get statistics for a specific pool using the pool mapper"""
        try:
            if not self.pool_mapper:
                logger.error("Pool mapper not initialized")
                return {}
                
            logger.info(f"Getting statistics for pool {pool_address} ({pool_type})")
            statistics = await self.pool_mapper.get_pool_statistics(pool_address, pool_type)
            
            if statistics:
                unique_wallet_count = statistics.get('uniqueWalletCount', 0)
                logger.info(f"Retrieved statistics for pool {pool_address}: {unique_wallet_count} unique wallets")
            else:
                logger.warning(f"No statistics found for pool {pool_address}")
                
            return statistics
        except Exception as e:
            logger.error(f"Error getting pool statistics: {e}")
            return {}
    
    async def get_all_positions_for_pool(self, pool_address: str, pool_type: str) -> List[Dict]:
        """Get all positions for a specific pool using the pool mapper"""
        try:
            if not self.pool_mapper:
                logger.error("Pool mapper not initialized")
                return []
                
            logger.info(f"Getting all positions for pool {pool_address} ({pool_type})")
            positions = await self.pool_mapper.get_all_positions_for_pool(pool_address, pool_type)
            
            if positions:
                logger.info(f"Retrieved {len(positions)} positions for pool {pool_address}")
            else:
                logger.warning(f"No positions found for pool {pool_address}")
                
            return positions
        except Exception as e:
            logger.error(f"Error getting positions for pool: {e}")
            return []
    
    async def take_wallet_snapshot(self) -> Dict:
        """Take a snapshot of the wallet"""
        try:
            logger.info("Taking wallet snapshot...")
            snapshot = self.wallet_snapshot_taker.take_snapshot()
            logger.info("Wallet snapshot completed")
            return snapshot
        except Exception as e:
            logger.error(f"Error taking wallet snapshot: {e}")
            return {}
    
    async def take_token_snapshots(self, tokens=['UBC', 'COMPUTE', 'SOL']) -> Dict[str, Dict]:
        """Take snapshots of specified tokens"""
        try:
            logger.info(f"Taking token snapshots for {', '.join(tokens)}...")
            snapshots = {}
            
            for token in tokens:
                logger.info(f"Taking snapshot for {token}...")
                snapshot = await self.token_snapshot_taker.take_snapshot(token)
                if snapshot:
                    snapshots[token] = snapshot
                    logger.info(f"Snapshot for {token} completed")
                else:
                    logger.warning(f"Failed to take snapshot for {token}")
            
            logger.info(f"Completed {len(snapshots)} token snapshots")
            return snapshots
        except Exception as e:
            logger.error(f"Error taking token snapshots: {e}")
            return {}
    
    async def generate_signals(self, tokens=['UBC', 'COMPUTE', 'SOL']) -> Dict[str, Dict]:
        """Generate trading signals for specified tokens"""
        try:
            logger.info(f"Generating signals for {', '.join(tokens)}...")
            signals = {}
            
            for token in tokens:
                logger.info(f"Generating signals for {token}...")
                signal = await self.signal_generator.analyze_specific_token(token)
                if signal:
                    signals[token] = signal
                    logger.info(f"Signals for {token} generated successfully")
                else:
                    logger.warning(f"No signals generated for {token}")
            
            logger.info(f"Generated signals for {len(signals)} tokens")
            return signals
        except Exception as e:
            logger.error(f"Error generating signals: {e}")
            return {}
    
    async def get_claude_recommendation(self, 
                                       lp_positions: List[Dict], 
                                       wallet_snapshot: Dict, 
                                       token_snapshots: Dict[str, Dict], 
                                       signals: Dict[str, Dict],
                                       pool_statistics: Dict[str, Dict] = None,
                                       analysis_type: str = "token_accumulation") -> Dict:
        """
        Get recommendation from Claude AI for LP allocations in JSON format
        
        Args:
            lp_positions: Current LP positions
            wallet_snapshot: Current wallet holdings
            token_snapshots: Token price and market data
            signals: Trading signals for tokens
            pool_statistics: Statistics about the pools
            analysis_type: Type of analysis to perform - "token_accumulation" or "token_enhancement"
        
        Returns:
            Dictionary with Claude's recommendations
        """
        try:
            logger.info(f"Requesting Claude recommendation for LP allocations (analysis type: {analysis_type})...")
            
            # Format data for Claude using the custom encoder
            lp_positions_str = json.dumps(lp_positions, indent=2, cls=CustomJSONEncoder)
            wallet_snapshot_str = json.dumps(wallet_snapshot, indent=2, cls=CustomJSONEncoder)
            token_snapshots_str = json.dumps(token_snapshots, indent=2, cls=CustomJSONEncoder)
            signals_str = json.dumps(signals, indent=2, cls=CustomJSONEncoder)
            
            # Ensure pool_statistics is serializable
            safe_pool_statistics = pool_statistics or {}
            # Convert any sets to lists to make them JSON serializable
            for key, stats in safe_pool_statistics.items():
                if isinstance(stats, dict) and 'uniqueWallets' in stats and isinstance(stats['uniqueWallets'], set):
                    stats['uniqueWallets'] = list(stats['uniqueWallets'])
            
            pool_statistics_str = json.dumps(safe_pool_statistics, indent=2, cls=CustomJSONEncoder)
            
            # Create system prompt based on analysis type
            if analysis_type == "token_accumulation":
                system_prompt = """You are an expert cryptocurrency liquidity pool (LP) allocation advisor. 
Your task is to analyze the current LP positions, wallet snapshot, token snapshots, trading signals, 
and pool statistics to provide strategic recommendations for optimal LP allocations.

PRIMARY GOAL: Maximize the accumulation of UBC and COMPUTE tokens over time (not USD value).

Focus on:
1. Strategies that will result in the highest token accumulation through fees and rewards
2. Analyzing which pools and positions will generate the most UBC and COMPUTE tokens
3. Optimizing for impermanent loss scenarios that result in more UBC and COMPUTE tokens
4. Considering token price trends to predict which pools will accumulate more tokens
5. Analyzing pool statistics to identify the most active pools for fee generation
6. Providing specific allocation percentages for each pool

Your recommendations should be data-driven, specific, and actionable, with the primary focus on 
maximizing the number of UBC and COMPUTE tokens accumulated, not their USD value.

IMPORTANT: You must respond with a valid JSON object containing your recommendations."""
            else:  # token_enhancement
                system_prompt = """You are an expert cryptocurrency liquidity pool (LP) allocation advisor. 
Your task is to analyze the current LP positions, wallet snapshot, token snapshots, trading signals, 
and pool statistics to provide strategic recommendations for optimal LP allocations.

PRIMARY GOAL: Enhance the stability and price of UBC and COMPUTE tokens in the market.

Focus on:
1. Strategies that will improve market depth and reduce price volatility
2. Analyzing which pools and positions will provide the most price support
3. Optimizing LP allocations to create price floors and resistance levels
4. Considering token price trends to identify where liquidity is most needed
5. Analyzing pool statistics to identify where additional liquidity would have the most impact
6. Providing specific allocation percentages for each pool

Your recommendations should be data-driven, specific, and actionable, with the primary focus on 
enhancing the stability and supporting the price of UBC and COMPUTE tokens in the market.

IMPORTANT: You must respond with a valid JSON object containing your recommendations."""

            # Create user prompt with all the data, adjusted for analysis type
            if analysis_type == "token_accumulation":
                user_prompt = f"""Please analyze the following data and provide recommendations for LP allocations that will maximize our accumulation of UBC and COMPUTE tokens over time:

## Current LP Positions
```json
{lp_positions_str}
```

## Wallet Snapshot
```json
{wallet_snapshot_str}
```

## Token Snapshots
```json
{token_snapshots_str}
```

## Trading Signals
```json
{signals_str}
```

## Pool Statistics
```json
{pool_statistics_str}
```

Based on this data, create recommendations for LP positions that will maximize our accumulation of UBC and COMPUTE tokens (not USD value). Consider which pools generate the most fees, which positions will result in more tokens due to impermanent loss, and which allocation strategy will result in the highest token count over time.

Return your response in the following JSON format:
```json
{{
  "summary": "Brief summary of your token accumulation strategy",
  "market_analysis": "Analysis of current market conditions and how they affect token accumulation",
  "pool_analysis": "Analysis of pool statistics and fee generation potential",
  "token_accumulation_strategy": "Detailed strategy for maximizing UBC and COMPUTE token count",
  "lp_positions": [
    {{
      "name": "UBC-SOL LP",
      "token0": "UBC",
      "token1": "SOL",
      "platform": "Meteora",
      "poolType": "DLMM",
      "targetAllocation": 50,
      "estimatedTokenAccumulation": "High/Medium/Low",
      "reasoning": "Detailed reasoning for how this allocation will increase token count"
    }},
    {{
      "name": "COMPUTE-SOL LP",
      "token0": "COMPUTE",
      "token1": "SOL",
      "platform": "Meteora",
      "poolType": "DYN",
      "targetAllocation": 50,
      "estimatedTokenAccumulation": "High/Medium/Low",
      "reasoning": "Detailed reasoning for how this allocation will increase token count"
    }}
  ]
}}
```

Ensure your response is valid JSON that can be parsed programmatically."""
            else:  # token_enhancement
                user_prompt = f"""Please analyze the following data and provide recommendations for LP allocations that will enhance the stability and price of UBC and COMPUTE tokens:

## Current LP Positions
```json
{lp_positions_str}
```

## Wallet Snapshot
```json
{wallet_snapshot_str}
```

## Token Snapshots
```json
{token_snapshots_str}
```

## Trading Signals
```json
{signals_str}
```

## Pool Statistics
```json
{pool_statistics_str}
```

Based on this data, create recommendations for LP positions that will enhance the stability and support the price of UBC and COMPUTE tokens. Consider which pools need more liquidity to reduce volatility, which positions will create the strongest price support, and which allocation strategy will have the most positive impact on token price and stability.

Return your response in the following JSON format:
```json
{{
  "summary": "Brief summary of your token enhancement strategy",
  "market_analysis": "Analysis of current market conditions and liquidity needs",
  "pool_analysis": "Analysis of pool statistics and price impact potential",
  "token_enhancement_strategy": "Detailed strategy for improving token stability and price",
  "lp_positions": [
    {{
      "name": "UBC-SOL LP",
      "token0": "UBC",
      "token1": "SOL",
      "platform": "Meteora",
      "poolType": "DLMM",
      "targetAllocation": 50,
      "priceImpact": "High/Medium/Low",
      "reasoning": "Detailed reasoning for how this allocation will enhance token stability and price"
    }},
    {{
      "name": "COMPUTE-SOL LP",
      "token0": "COMPUTE",
      "token1": "SOL",
      "platform": "Meteora",
      "poolType": "DYN",
      "targetAllocation": 50,
      "priceImpact": "High/Medium/Low",
      "reasoning": "Detailed reasoning for how this allocation will enhance token stability and price"
    }}
  ]
}}
```

Ensure your response is valid JSON that can be parsed programmatically."""

            # Call Claude API
            response = self.claude_client.messages.create(
                model="claude-3-7-sonnet-20250219",
                max_tokens=4000,
                system=system_prompt,
                messages=[
                    {"role": "user", "content": user_prompt}
                ]
            )
            
            # Extract JSON from response
            response_text = response.content[0].text
            
            # Clean up the response to extract just the JSON part
            json_start = response_text.find('{')
            json_end = response_text.rfind('}') + 1
            
            if json_start == -1 or json_end == 0:
                logger.error("Could not find JSON in Claude's response")
                return {"error": "Invalid response format"}
                
            json_str = response_text[json_start:json_end]
            
            # Parse the JSON
            recommendation_data = json.loads(json_str)
            logger.info(f"Claude recommendation received in JSON format for {analysis_type} analysis")
            
            return recommendation_data
        except Exception as e:
            logger.error(f"Error getting Claude recommendation: {e}")
            return {"error": f"Error generating recommendation: {str(e)}"}
    
    def create_lp_positions(self, recommendation_data: Dict) -> List[Dict]:
        """Create LP positions based on Claude's recommendations"""
        try:
            logger.info("Creating LP positions from recommendations...")
            
            created_positions = []
            
            # Get LP positions from recommendation
            lp_positions = recommendation_data.get('lp_positions', [])
            
            if not lp_positions:
                logger.warning("No LP positions found in recommendation data")
                return []
            
            # Current timestamp
            current_time = datetime.now(timezone.utc).isoformat()
            
            # Create each LP position
            for position in lp_positions:
                try:
                    # Prepare position data
                    position_data = {
                        'name': position.get('name'),
                        'token0': position.get('token0'),
                        'token1': position.get('token1'),
                        'platform': position.get('platform', 'Meteora'),
                        'poolType': position.get('poolType', 'DLMM'),
                        'targetAllocation': position.get('targetAllocation', 0),
                        'currentAllocation': 0,  # Start with 0
                        'status': 'ACTIVE',
                        'isActive': True,
                        'createdAt': current_time,
                        'updatedAt': current_time,
                        'notes': position.get('reasoning', ''),
                        'rebalanceNeeded': True
                    }
                    
                    # Add token accumulation estimate if available
                    if 'estimatedTokenAccumulation' in position:
                        position_data['estimatedTokenAccumulation'] = position.get('estimatedTokenAccumulation')
                    
                    # Add price impact if available
                    if 'priceImpact' in position:
                        position_data['priceImpact'] = position.get('priceImpact')
                    
                    # Add APR if available (for backward compatibility)
                    if 'apr' in position:
                        position_data['apr'] = position.get('apr', 0)
                    
                    # Create position in Airtable
                    result = self.lp_positions_table.insert(position_data)
                    logger.info(f"Created LP position: {position.get('name')} (ID: {result['id']})")
                    
                    # Add to created positions
                    created_positions.append({
                        'id': result['id'],
                        **position_data
                    })
                    
                except Exception as e:
                    logger.error(f"Error creating LP position {position.get('name')}: {e}")
                    continue
            
            logger.info(f"Created {len(created_positions)} LP positions")
            return created_positions
            
        except Exception as e:
            logger.error(f"Error creating LP positions: {e}")
            return []
            
    def save_thought(self, content: str) -> Optional[Dict]:
        """Save the Claude recommendation as a THOUGHT in Airtable"""
        try:
            logger.info("Saving Claude recommendation as THOUGHT...")
            
            # Create thought record
            thought_data = {
                'title': 'LP Allocation Recommendation',
                'content': content,
                'type': 'LP_ALLOCATION',
                'createdAt': datetime.now(timezone.utc).isoformat(),
                'source': 'CLAUDE',
                'status': 'PENDING'
            }
            
            # Save to Airtable
            result = self.thoughts_table.insert(thought_data)
            logger.info(f"Thought saved with ID: {result['id']}")
            
            return result
        except Exception as e:
            logger.error(f"Error saving thought: {e}")
            return None
    
    def update_lp_positions(self, lp_positions: List[Dict], recommendation: str) -> None:
        """Update LP positions with pending status and recommendation"""
        try:
            logger.info("Updating LP positions with recommendations...")
            
            for position in lp_positions:
                # Update position with recommendation and pending status
                update_data = {
                    'status': 'PENDING',
                    'lastRecommendation': recommendation[:100000],  # Truncate if too long
                    'updatedAt': datetime.now(timezone.utc).isoformat()
                }
                
                self.lp_positions_table.update(position['id'], update_data)
                logger.info(f"Updated LP position {position['id']} with pending status")
            
            logger.info(f"Updated {len(lp_positions)} LP positions")
        except Exception as e:
            logger.error(f"Error updating LP positions: {e}")
    
    async def analyze_and_recommend(self) -> Dict:
        """Main function to analyze LP positions and provide recommendations for both goals"""
        try:
            logger.info("Starting LP position analysis for both token accumulation and token enhancement...")
            
            # Get LP positions
            lp_positions = self.get_lp_positions()
            if not lp_positions:
                logger.info("No active LP positions found - continuing with analysis anyway")
                # Create an empty positions list instead of returning early
                lp_positions = []
                # Return a more informative status
                status_message = "No active LP positions found, creating new positions"
            else:
                status_message = f"Analyzed {len(lp_positions)} positions"
            
            # Take wallet snapshot
            wallet_snapshot = await self.take_wallet_snapshot()
            
            # Take token snapshots for UBC, COMPUTE, and SOL
            token_snapshots = await self.take_token_snapshots(['UBC', 'COMPUTE', 'SOL'])
            
            # Generate signals for UBC, COMPUTE, and SOL
            signals = await self.generate_signals(['UBC', 'COMPUTE', 'SOL'])
            
            # Get pool statistics for known pools
            pool_statistics = {}
            if self.pool_mapper:
                logger.info("Getting pool statistics for known pools")
                pools = [
                    {"name": "UBC/SOL DLMM", "address": "DGtgdZKsVa76LvkNYTT1XMinHevrHmwjiyXGphxAPTgq", "type": "DLMM"},
                    {"name": "COMPUTE/SOL DYN", "address": "HN7ibjiyX399d1EfYXcWaSHZRSMfUmonYvXGFXG41Rr3", "type": "DYN"},
                    {"name": "COMPUTE/UBC DLMM", "address": "xERePvynM5hAozHUE1sit2CgRS7VLHXy4phkypSKZip", "type": "DLMM"},
                    {"name": "COMPUTE/SOL DLMM", "address": "7EVJ9P1M9qeNWLYPWWBbGwrWDtTCWo6r2A7J7XU19tNw", "type": "DLMM"}
                ]
                
                for pool in pools:
                    stats = await self.get_pool_statistics(pool["address"], pool["type"])
                    if stats:
                        pool_statistics[pool["name"]] = stats
            
            # Get recommendations from Claude for both analysis types
            token_accumulation_recommendation = await self.get_claude_recommendation(
                lp_positions, 
                wallet_snapshot, 
                token_snapshots, 
                signals,
                pool_statistics,
                analysis_type="token_accumulation"
            )
            
            token_enhancement_recommendation = await self.get_claude_recommendation(
                lp_positions, 
                wallet_snapshot, 
                token_snapshots, 
                signals,
                pool_statistics,
                analysis_type="token_enhancement"
            )
            
            # Check for errors in recommendations
            if 'error' in token_accumulation_recommendation:
                logger.error(f"Error in token accumulation recommendation: {token_accumulation_recommendation['error']}")
                return {"status": "error", "message": token_accumulation_recommendation['error']}
                
            if 'error' in token_enhancement_recommendation:
                logger.error(f"Error in token enhancement recommendation: {token_enhancement_recommendation['error']}")
                return {"status": "error", "message": token_enhancement_recommendation['error']}
            
            # Combine recommendations for saving
            combined_recommendation = {
                "token_accumulation": token_accumulation_recommendation,
                "token_enhancement": token_enhancement_recommendation,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "analysis_version": "2.0"
            }
            
            # Create new LP positions based on token accumulation recommendations
            # (We prioritize token accumulation for actual position creation)
            created_positions = self.create_lp_positions(token_accumulation_recommendation)
            
            # Update existing LP positions if any
            if lp_positions:
                # Convert combined recommendation to string for existing positions
                recommendation_str = json.dumps(combined_recommendation, indent=2)
                self.update_lp_positions(lp_positions, recommendation_str)
            
            # Save both recommendations as THOUGHTS for reference
            accumulation_thought = self.save_thought(
                f"TOKEN ACCUMULATION STRATEGY:\n\n{json.dumps(token_accumulation_recommendation, indent=2)}"
            )
            
            enhancement_thought = self.save_thought(
                f"TOKEN ENHANCEMENT STRATEGY:\n\n{json.dumps(token_enhancement_recommendation, indent=2)}"
            )
            
            logger.info("LP position analysis and dual recommendations completed successfully")
            
            return {
                "status": "success",
                "positions_analyzed": len(lp_positions),
                "positions_created": len(created_positions),
                "pool_statistics_count": len(pool_statistics),
                "token_accumulation_summary": token_accumulation_recommendation.get('summary', '')[:250] + "...",
                "token_enhancement_summary": token_enhancement_recommendation.get('summary', '')[:250] + "...",
                "created_positions": [p.get('name') for p in created_positions],
                "accumulation_thought_id": accumulation_thought['id'] if accumulation_thought else None,
                "enhancement_thought_id": enhancement_thought['id'] if enhancement_thought else None,
                "message": status_message
            }
        except Exception as e:
            logger.error(f"Error in LP position analysis: {e}")
            return {"status": "error", "message": str(e)}

async def main():
    """Main function to run the LP position analyzer"""
    try:
        # Initialize the analyzer
        analyzer = LPPositionAnalyzer()
        
        # Run analysis and get recommendations
        result = await analyzer.analyze_and_recommend()
        
        # Log result
        if result["status"] == "success":
            logger.info(f"LP position analysis completed successfully")
            logger.info(result["message"])  # Use the message from the result
            
            # Log token accumulation summary
            if "token_accumulation_summary" in result:
                logger.info(f"Token Accumulation Strategy: {result['token_accumulation_summary']}")
            
            # Log token enhancement summary
            if "token_enhancement_summary" in result:
                logger.info(f"Token Enhancement Strategy: {result['token_enhancement_summary']}")
                
            # Log thought IDs
            if "accumulation_thought_id" in result:
                logger.info(f"Token Accumulation Thought ID: {result['accumulation_thought_id']}")
            
            if "enhancement_thought_id" in result:
                logger.info(f"Token Enhancement Thought ID: {result['enhancement_thought_id']}")
                
            # Log pool statistics count safely
            if "pool_statistics_count" in result:
                logger.info(f"Pool Statistics Count: {result['pool_statistics_count']}")
        else:
            logger.error(f"LP position analysis failed: {result['message']}")
        
        return result
    except Exception as e:
        logger.error(f"Unhandled error in main function: {e}")
        return {"status": "error", "message": str(e)}

if __name__ == "__main__":
    asyncio.run(main())
