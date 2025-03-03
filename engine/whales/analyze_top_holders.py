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

# Set Windows event loop policy
if os.name == 'nt':  # Windows
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

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
            model="claude-3-7-sonnet-20250219",
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

async def generate_meta_analysis(token_key="ALL", timeframe="7d"):
    """Generate meta-analysis of whale behavior for a specific token or all tokens"""
    load_dotenv(dotenv_path=os.path.join(project_root, '.env'))
    
    # Initialize Airtable
    base_id = os.getenv("KINKONG_AIRTABLE_BASE_ID")
    api_key = os.getenv("KINKONG_AIRTABLE_API_KEY")
    
    if not base_id or not api_key:
        logger.error("Missing Airtable credentials")
        return
    
    # Create WHALE_ANALYSIS table
    whale_analysis_table = Airtable(base_id, "WHALE_ANALYSIS", api_key)
    
    # Calculate date range based on timeframe
    now = datetime.now(timezone.utc)
    if timeframe == "30d":
        start_date = now.replace(day=now.day - 30)
    elif timeframe == "90d":
        start_date = now.replace(day=now.day - 90)
    else:  # Default to 7d
        start_date = now.replace(day=now.day - 7)
    
    start_date_str = start_date.strftime("%Y-%m-%d")
    
    # Build filter formula
    filter_formula = f"IS_AFTER({{createdAt}}, '{start_date_str}')"
    
    if token_key != "ALL":
        filter_formula = f"AND({filter_formula}, {{token}}='{token_key}')"
    
    # Fetch data from WHALE_ANALYSIS table
    records = whale_analysis_table.get_all(formula=filter_formula)
    
    # Transform records
    whale_data = [{"id": record["id"], **record["fields"]} for record in records]
    
    # If no data, return early
    if not whale_data:
        logger.info(f"Insufficient data for meta-analysis of {token_key}")
        return
    
    # Calculate metrics for the prompt
    total_whales = len(whale_data)
    bullish = sum(1 for item in whale_data if item.get("outlook") == "BULLISH")
    bearish = sum(1 for item in whale_data if item.get("outlook") == "BEARISH")
    neutral = sum(1 for item in whale_data if item.get("outlook") == "NEUTRAL")
    
    bullish_percentage = (bullish / total_whales) * 100 if total_whales > 0 else 0
    bearish_percentage = (bearish / total_whales) * 100 if total_whales > 0 else 0
    neutral_percentage = (neutral / total_whales) * 100 if total_whales > 0 else 0
    
    accumulation = sum(1 for item in whale_data if item.get("holdingPattern") == "ACCUMULATION")
    distribution = sum(1 for item in whale_data if item.get("holdingPattern") == "DISTRIBUTION")
    holding = sum(1 for item in whale_data if item.get("holdingPattern") == "HOLDING")
    
    accumulation_percentage = (accumulation / total_whales) * 100 if total_whales > 0 else 0
    distribution_percentage = (distribution / total_whales) * 100 if total_whales > 0 else 0
    holding_percentage = (holding / total_whales) * 100 if total_whales > 0 else 0
    
    high_activity = sum(1 for item in whale_data if item.get("tradingActivity") == "HIGH")
    medium_activity = sum(1 for item in whale_data if item.get("tradingActivity") == "MEDIUM")
    low_activity = sum(1 for item in whale_data if item.get("tradingActivity") == "LOW")
    
    high_activity_percentage = (high_activity / total_whales) * 100 if total_whales > 0 else 0
    medium_activity_percentage = (medium_activity / total_whales) * 100 if total_whales > 0 else 0
    low_activity_percentage = (low_activity / total_whales) * 100 if total_whales > 0 else 0
    
    confidence_sum = sum(float(item.get("confidenceScore", 0)) for item in whale_data)
    avg_confidence = confidence_sum / total_whales if total_whales > 0 else 0
    
    # Create a prompt for Claude to analyze the data
    token_display = "all tokens" if token_key == "ALL" else token_key
    timeframe_display = "7 days" if timeframe == "7d" else "30 days" if timeframe == "30d" else "90 days"
    
    prompt = f"""
    You are a cryptocurrency analyst specializing in whale behavior analysis. Analyze the following aggregated data about whale behavior for {token_display} over the past {timeframe_display}.

    Whale Metrics:
    - Total Whales Analyzed: {total_whales}
    - Sentiment: {bullish_percentage:.1f}% Bullish, {bearish_percentage:.1f}% Bearish, {neutral_percentage:.1f}% Neutral
    - Holding Patterns: {accumulation_percentage:.1f}% Accumulation, {distribution_percentage:.1f}% Distribution, {holding_percentage:.1f}% Holding
    - Trading Activity: {high_activity_percentage:.1f}% High, {medium_activity_percentage:.1f}% Medium, {low_activity_percentage:.1f}% Low
    - Average Confidence Score: {avg_confidence:.1f}/100

    """
    
    if token_key != "ALL":
        # Sort whale data by holding amount (descending)
        sorted_whales = sorted(
            [w for w in whale_data if "holdingAmount" in w],
            key=lambda x: float(x.get("holdingAmount", 0)),
            reverse=True
        )
        
        top_holdings = ", ".join([
            f"{float(w.get('holdingAmount', 0)):,.0f} {token_key}" 
            for w in sorted_whales[:3]
        ]) if sorted_whales else "N/A"
        
        prompt += f"""
        Additional Token-Specific Data:
        - Token: {token_key}
        - Number of Whales: {total_whales}
        - Top Whale Holdings: {top_holdings}
        """
    
    prompt += """
    Provide a comprehensive meta-analysis of whale behavior based on this data. Include:
    1. Overall market sentiment interpretation
    2. Likely price direction based on whale behavior
    3. Key patterns or trends identified
    4. Actionable insights for traders
    5. Risk assessment (low/medium/high)

    Format your response as JSON with the following structure:
    {
      "summary": "Brief 1-2 sentence summary of the analysis",
      "sentiment": "BULLISH/NEUTRAL/BEARISH",
      "confidenceScore": 0-100,
      "priceOutlook": "Brief price prediction based on whale behavior",
      "keyPatterns": ["Pattern 1", "Pattern 2", "Pattern 3"],
      "actionableInsights": ["Insight 1", "Insight 2", "Insight 3"],
      "riskAssessment": "LOW/MEDIUM/HIGH",
      "riskFactors": ["Factor 1", "Factor 2"],
      "detailedAnalysis": "Detailed paragraph explaining the analysis",
      "recommendedStrategy": "ACCUMULATE/HOLD/REDUCE"
    }
    """
    
    # Call Claude API for analysis
    try:
        client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
        
        message = client.messages.create(
            model="claude-3-7-sonnet-latest",
            max_tokens=4000,
            temperature=0.2,
            system="You are a cryptocurrency analyst specializing in whale behavior analysis. Provide concise, data-driven insights.",
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
                analysis = json.loads(json_str)
                
                # Save meta-analysis to Airtable
                meta_analysis_table = Airtable(base_id, "WHALE_META_ANALYSIS", api_key)
                
                record_data = {
                    "token": token_key,
                    "timeframe": timeframe,
                    "totalWhales": total_whales,
                    "summary": analysis.get("summary", ""),
                    "sentiment": analysis.get("sentiment", "NEUTRAL"),
                    "confidenceScore": analysis.get("confidenceScore", 50),
                    "priceOutlook": analysis.get("priceOutlook", ""),
                    "keyPatterns": "\n".join(analysis.get("keyPatterns", [])),
                    "actionableInsights": "\n".join(analysis.get("actionableInsights", [])),
                    "riskAssessment": analysis.get("riskAssessment", "MEDIUM"),
                    "riskFactors": "\n".join(analysis.get("riskFactors", [])),
                    "detailedAnalysis": analysis.get("detailedAnalysis", ""),
                    "recommendedStrategy": analysis.get("recommendedStrategy", "HOLD"),
                    "createdAt": datetime.now(timezone.utc).isoformat()
                }
                
                meta_analysis_table.insert(record_data)
                logger.info(f"✅ Meta-analysis for {token_key} ({timeframe}) completed and saved")
                
                return analysis
                
            except json.JSONDecodeError:
                logger.error(f"Failed to parse JSON from Claude response")
        else:
            logger.error(f"No valid JSON found in Claude response")
            
    except Exception as e:
        logger.error(f"Error generating meta-analysis: {e}")
    
    return None

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
        
        # Parse command line arguments
        import argparse
        parser = argparse.ArgumentParser(description='Analyze whale holders and generate meta-analysis')
        parser.add_argument('--meta-only', action='store_true', help='Only generate meta-analysis without analyzing top holders')
        parser.add_argument('--token', type=str, default='ALL', choices=['UBC', 'COMPUTE', 'ALL'], help='Token to analyze')
        parser.add_argument('--timeframe', type=str, default='7d', choices=['7d', '30d', '90d'], help='Timeframe for analysis')
        args = parser.parse_args()
        
        if args.meta_only:
            # Only run meta-analysis
            logger.info(f"Generating meta-analysis for {args.token} ({args.timeframe})...")
            asyncio.run(generate_meta_analysis(args.token, args.timeframe))
            logger.info("✅ Meta-analysis completed")
        else:
            # Run full analysis
            asyncio.run(analyze_top_holders())
            logger.info("✅ Whale analysis completed")
            
            # Generate meta-analysis for each token and combined
            for token_key in ["UBC", "COMPUTE", "ALL"]:
                for timeframe in ["7d", "30d"]:
                    logger.info(f"Generating meta-analysis for {token_key} ({timeframe})...")
                    asyncio.run(generate_meta_analysis(token_key, timeframe))
        
    except Exception as e:
        logger.error(f"❌ Script failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
