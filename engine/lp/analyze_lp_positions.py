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
                                        signals: Dict[str, Dict]) -> str:
        """Get recommendation from Claude AI for LP allocations"""
        try:
            logger.info("Requesting Claude recommendation for LP allocations...")
            
            # Format data for Claude
            lp_positions_str = json.dumps(lp_positions, indent=2)
            wallet_snapshot_str = json.dumps(wallet_snapshot, indent=2)
            token_snapshots_str = json.dumps(token_snapshots, indent=2)
            signals_str = json.dumps(signals, indent=2)
            
            # Create system prompt
            system_prompt = """You are an expert cryptocurrency liquidity pool (LP) allocation advisor. 
Your task is to analyze the current LP positions, wallet snapshot, token snapshots, and trading signals 
to provide strategic recommendations for optimal LP allocations.

Focus on:
1. Balancing risk and reward across different pools
2. Optimizing for impermanent loss protection
3. Maximizing yield based on current market conditions
4. Considering token price trends and trading signals
5. Providing specific allocation percentages for each pool

Your recommendations should be data-driven, specific, and actionable."""

            # Create user prompt with all the data
            user_prompt = f"""Please analyze the following data and provide recommendations for LP allocations:

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

Based on this data, please provide:
1. A summary of the current LP positions and their performance
2. Analysis of token price trends and how they might impact LP positions
3. Specific recommendations for adjusting LP allocations (increase, decrease, or maintain)
4. Target allocation percentages for each pool
5. Reasoning behind each recommendation

Format your response as a structured analysis with clear sections and actionable recommendations."""

            # Call Claude API
            response = self.claude_client.messages.create(
                model="claude-3-7-sonnet-20250219",
                max_tokens=4000,
                system=system_prompt,
                messages=[
                    {"role": "user", "content": user_prompt}
                ]
            )
            
            recommendation = response.content[0].text
            logger.info("Claude recommendation received")
            
            return recommendation
        except Exception as e:
            logger.error(f"Error getting Claude recommendation: {e}")
            return f"Error generating recommendation: {str(e)}"
    
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
        """Main function to analyze LP positions and provide recommendations"""
        try:
            logger.info("Starting LP position analysis...")
            
            # Get LP positions
            lp_positions = self.get_lp_positions()
            if not lp_positions:
                logger.warning("No active LP positions found")
                return {"status": "error", "message": "No active LP positions found"}
            
            # Take wallet snapshot
            wallet_snapshot = await self.take_wallet_snapshot()
            
            # Take token snapshots for UBC, COMPUTE, and SOL
            token_snapshots = await self.take_token_snapshots(['UBC', 'COMPUTE', 'SOL'])
            
            # Generate signals for UBC, COMPUTE, and SOL
            signals = await self.generate_signals(['UBC', 'COMPUTE', 'SOL'])
            
            # Get recommendation from Claude
            recommendation = await self.get_claude_recommendation(
                lp_positions, 
                wallet_snapshot, 
                token_snapshots, 
                signals
            )
            
            # Save recommendation as THOUGHT
            thought = self.save_thought(recommendation)
            
            # Update LP positions with pending status
            self.update_lp_positions(lp_positions, recommendation)
            
            logger.info("LP position analysis and recommendation completed successfully")
            
            return {
                "status": "success",
                "positions_analyzed": len(lp_positions),
                "recommendation": recommendation[:500] + "...",  # Truncated for logging
                "thought_id": thought['id'] if thought else None
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
            logger.info(f"Analyzed {result['positions_analyzed']} positions")
            logger.info(f"Recommendation preview: {result['recommendation']}")
            logger.info(f"Thought ID: {result['thought_id']}")
        else:
            logger.error(f"LP position analysis failed: {result['message']}")
        
        return result
    except Exception as e:
        logger.error(f"Unhandled error in main function: {e}")
        return {"status": "error", "message": str(e)}

if __name__ == "__main__":
    asyncio.run(main())
