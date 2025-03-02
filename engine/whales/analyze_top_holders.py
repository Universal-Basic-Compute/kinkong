import os
import sys
import json
import time
import asyncio
import aiohttp
import logging
from datetime import datetime, timezone
from pathlib import Path
from dotenv import load_dotenv
from airtable import Airtable
import anthropic

# Add project root to Python path
project_root = str(Path(__file__).parent.parent.parent.absolute())
if project_root not in sys.path:
    sys.path.insert(0, project_root)

# Setup logging
def setup_logging():
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

logger = setup_logging()

# Token configurations
TOKENS = {
    "UBC": {
        "name": "UBC",
        "mint": "9psiRdn9cXYVps4F1kFuoNjd2EtmqNJXrCPmRppJpump",
        "decimals": 9
    },
    "COMPUTE": {
        "name": "COMPUTE",
        "mint": "B1N1HcMm4RysYz4smsXwmk2UnS8NziqKCM6Ho8i62vXo",
        "decimals": 9
    }
}

async def get_top_holders(session, token_mint, limit=20):
    """Get top holders for a token using Birdeye API"""
    url = "https://public-api.birdeye.so/defi/v3/token/holder"
    params = {
        "address": token_mint,
        "offset": 0,
        "limit": limit
    }
    headers = {
        "x-api-key": os.getenv("BIRDEYE_API_KEY"),
        "x-chain": "solana"
    }
    
    try:
        async with session.get(url, params=params, headers=headers) as response:
            if response.status == 200:
                data = await response.json()
                if data.get("success"):
                    return data.get("data", {}).get("items", [])
            logger.error(f"Failed to get top holders: {await response.text()}")
            return []
    except Exception as e:
        logger.error(f"Error getting top holders: {e}")
        return []

async def get_wallet_transactions(session, wallet_address, limit=100):
    """Get transaction history for a wallet using Birdeye API"""
    url = "https://public-api.birdeye.so/v1/wallet/tx_list"
    params = {
        "wallet": wallet_address,
        "limit": limit
    }
    headers = {
        "x-api-key": os.getenv("BIRDEYE_API_KEY"),
        "x-chain": "solana"
    }
    
    try:
        async with session.get(url, params=params, headers=headers) as response:
            if response.status == 200:
                data = await response.json()
                if data.get("success"):
                    return data.get("data", {})
            logger.error(f"Failed to get wallet transactions: {await response.text()}")
            return {}
    except Exception as e:
        logger.error(f"Error getting wallet transactions: {e}")
        return {}

async def analyze_with_claude(wallet_address, transactions, token_name):
    """Analyze wallet transactions using Claude AI"""
    try:
        client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
        
        # Prepare transaction data for Claude
        tx_summary = json.dumps(transactions, indent=2)
        if len(tx_summary) > 50000:  # Limit size for Claude
            tx_summary = tx_summary[:50000] + "... [truncated]"
        
        prompt = f"""
        You are a cryptocurrency analyst specializing in Solana tokens. Analyze the following wallet transactions for a top holder of the {token_name} token.

        Wallet Address: {wallet_address}

        Transaction History:
        {tx_summary}

        Focus on:
        1. Trading patterns (buying/selling behavior)
        2. Interaction with {token_name} token
        3. Other significant tokens in the portfolio
        4. Any signs of accumulation or distribution
        5. Overall sentiment toward {token_name}

        Provide your analysis in JSON format with the following structure:
        {{
            "wallet": "{wallet_address}",
            "token": "{token_name}",
            "holdingPattern": "ACCUMULATION/DISTRIBUTION/HOLDING",
            "tradingActivity": "HIGH/MEDIUM/LOW",
            "diversification": "HIGH/MEDIUM/LOW",
            "outlook": "BULLISH/NEUTRAL/BEARISH",
            "confidenceScore": 0-100,
            "explanation": "Detailed explanation of your analysis",
            "keyInsights": ["Insight 1", "Insight 2", "..."],
            "recommendedAction": "MONITOR/FOLLOW/IGNORE"
        }}

        Ensure your analysis is data-driven and objective.
        """
        
        message = client.messages.create(
            model="claude-3-opus-20240229",
            max_tokens=4000,
            temperature=0.2,
            system="You are a cryptocurrency analyst specializing in on-chain analysis for Solana tokens.",
            messages=[
                {"role": "user", "content": prompt}
            ]
        )
        
        # Extract JSON from Claude's response
        response_text = message.content[0].text
        
        # Find JSON in the response
        json_start = response_text.find('{')
        json_end = response_text.rfind('}') + 1
        
        if json_start >= 0 and json_end > json_start:
            json_str = response_text[json_start:json_end]
            try:
                return json.loads(json_str)
            except json.JSONDecodeError:
                logger.error(f"Failed to parse JSON from Claude response")
                
        logger.error(f"No valid JSON found in Claude response")
        return None
        
    except Exception as e:
        logger.error(f"Error analyzing with Claude: {e}")
        return None

async def analyze_top_holders():
    """Main function to analyze top holders for UBC and COMPUTE tokens"""
    load_dotenv(dotenv_path=os.path.join(project_root, '.env'))
    
    # Initialize Airtable
    base_id = os.getenv("KINKONG_AIRTABLE_BASE_ID")
    api_key = os.getenv("KINKONG_AIRTABLE_API_KEY")
    
    if not base_id or not api_key:
        logger.error("Missing Airtable credentials")
        return
    
    # Create WHALE_ANALYSIS table if it doesn't exist
    whale_analysis_table = Airtable(base_id, "WHALE_ANALYSIS", api_key)
    
    async with aiohttp.ClientSession() as session:
        for token_key, token_info in TOKENS.items():
            logger.info(f"Analyzing top holders for {token_key}...")
            
            # Get top holders
            holders = await get_top_holders(session, token_info["mint"])
            logger.info(f"Found {len(holders)} holders for {token_key}")
            
            for i, holder in enumerate(holders):
                wallet = holder.get("owner")
                amount = holder.get("ui_amount", 0)
                
                logger.info(f"Analyzing holder {i+1}/{len(holders)}: {wallet[:8]}... ({amount:,.0f} {token_key})")
                
                # Check if we already analyzed this wallet recently
                existing_records = whale_analysis_table.get_all(
                    formula=f"AND({{wallet}}='{wallet}', {{token}}='{token_key}', IS_AFTER({{createdAt}}, 'TODAY-7'))"
                )
                
                if existing_records:
                    logger.info(f"Skipping recent analysis for {wallet[:8]}...")
                    continue
                
                # Get wallet transactions
                transactions = await get_wallet_transactions(session, wallet)
                
                if not transactions:
                    logger.warning(f"No transactions found for {wallet[:8]}...")
                    continue
                
                # Analyze with Claude
                analysis = await analyze_with_claude(wallet, transactions, token_key)
                
                if not analysis:
                    logger.warning(f"Failed to analyze {wallet[:8]}...")
                    continue
                
                # Save to Airtable
                record_data = {
                    "wallet": wallet,
                    "token": token_key,
                    "holdingAmount": amount,
                    "holdingPattern": analysis.get("holdingPattern", "UNKNOWN"),
                    "tradingActivity": analysis.get("tradingActivity", "UNKNOWN"),
                    "diversification": analysis.get("diversification", "UNKNOWN"),
                    "outlook": analysis.get("outlook", "NEUTRAL"),
                    "confidenceScore": analysis.get("confidenceScore", 50),
                    "explanation": analysis.get("explanation", ""),
                    "keyInsights": "\n".join(analysis.get("keyInsights", [])),
                    "recommendedAction": analysis.get("recommendedAction", "MONITOR"),
                    "createdAt": datetime.now(timezone.utc).isoformat()
                }
                
                whale_analysis_table.insert(record_data)
                logger.info(f"Saved analysis for {wallet[:8]} with outlook: {analysis.get('outlook')}")
                
                # Rate limiting
                await asyncio.sleep(2)

def main():
    try:
        # Load environment variables from project root
        load_dotenv(dotenv_path=os.path.join(project_root, '.env'))
        
        # Verify environment variables
        required_vars = [
            "KINKONG_AIRTABLE_BASE_ID",
            "KINKONG_AIRTABLE_API_KEY",
            "BIRDEYE_API_KEY",
            "ANTHROPIC_API_KEY"
        ]
        
        missing = [var for var in required_vars if not os.getenv(var)]
        if missing:
            raise ValueError(f"Missing environment variables: {', '.join(missing)}")
        
        # Run analysis
        asyncio.run(analyze_top_holders())
        logger.info("✅ Whale analysis completed")
        
    except Exception as e:
        logger.error(f"❌ Script failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
