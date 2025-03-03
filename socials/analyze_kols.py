#!/usr/bin/env python3
import os
import json
import time
import logging
import asyncio
import platform
import requests
from typing import Dict, List, Optional, Any
from dotenv import load_dotenv
from airtable import Airtable
from anthropic import Anthropic

# Fix for Windows asyncio
if platform.system() == 'Windows':
    import asyncio
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

def setup_logging():
    """Configure logging for the script"""
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            logging.StreamHandler(),
            logging.FileHandler("kol_analysis.log")
        ]
    )
    logger = logging.getLogger("kol_analyzer")
    
    # Add a debug file handler
    debug_handler = logging.FileHandler("kol_analysis_debug.log")
    debug_handler.setLevel(logging.DEBUG)
    debug_handler.setFormatter(logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s'))
    logger.addHandler(debug_handler)
    
    return logger

class KOLAnalyzer:
    def __init__(self):
        # Load environment variables
        load_dotenv()
        self.logger = setup_logging()
        
        # Initialize Airtable
        self.base_id = os.getenv('KINKONG_AIRTABLE_BASE_ID')
        self.api_key = os.getenv('KINKONG_AIRTABLE_API_KEY')
        
        if not self.base_id or not self.api_key:
            raise ValueError("Missing Airtable credentials in environment variables")
        
        self.kol_table = Airtable(self.base_id, 'KOL_ANALYSIS', self.api_key)
        
        # API keys
        self.birdeye_api_key = os.getenv('BIRDEYE_API_KEY')
        self.x_api_key = os.getenv('X_BEARER_TOKEN')
        self.claude_api_key = os.getenv('ANTHROPIC_API_KEY')
        
        if not self.birdeye_api_key:
            self.logger.warning("Missing Birdeye API key - wallet analysis will be limited")
        
        if not self.x_api_key:
            self.logger.warning("Missing X API key - social analysis will be limited")
            
        if not self.claude_api_key:
            self.logger.warning("Missing Claude API key - insights generation will be limited")
        
        # Initialize Claude client
        if self.claude_api_key:
            self.claude = Anthropic(api_key=self.claude_api_key)
    
    def get_all_kols(self) -> List[Dict]:
        """Fetch all KOL records from Airtable"""
        try:
            self.logger.info("Fetching KOL records from Airtable")
            records = self.kol_table.get_all()
            self.logger.info(f"Found {len(records)} KOL records")
            return records
        except Exception as e:
            self.logger.error(f"Error fetching KOL records: {e}")
            return []
    
    def get_wallet_holdings(self, wallet_address: str) -> Dict[str, Any]:
        """Get wallet holdings data from Birdeye API"""
        if not self.birdeye_api_key or not wallet_address:
            return {"error": "Missing API key or wallet address"}
        
        try:
            self.logger.info(f"Fetching wallet holdings for {wallet_address}")
            url = f"https://public-api.birdeye.so/v1/wallet/token_list"  # Updated endpoint
            headers = {
                "X-API-KEY": self.birdeye_api_key,
                "x-chain": "solana"  # Required header
            }
            params = {
                "wallet": wallet_address
            }
            
            response = requests.get(url, headers=headers, params=params)
            
            if response.status_code != 200:
                self.logger.error(f"Error from Birdeye API: {response.status_code} - {response.text}")
                return {"error": f"API error: {response.status_code}"}
            
            # Log the raw response for debugging
            self.logger.debug(f"Birdeye holdings API response: {response.text[:500]}...")
            
            # Check if response is valid JSON before parsing
            try:
                data = response.json()
            except json.JSONDecodeError as e:
                self.logger.error(f"Invalid JSON response from Birdeye API: {e}")
                self.logger.debug(f"Response content: {response.text[:100]}...")
                return {"error": "Invalid API response format"}
            
            # Calculate metrics
            holdings = []
            total_value = 0
            token_count = 0
            tokens = []  # Initialize tokens list
            
            # Check the structure of the response and extract data
            if "success" in data and data["success"] and "data" in data:
                tokens_data = data["data"]
                found_tokens = False
                
                # Handle the case where data contains a "solana" key
                if "solana" in tokens_data:
                    self.logger.debug(f"Found 'solana' key in response data")
                    # If solana is a dict, use it for further processing
                    if isinstance(tokens_data["solana"], dict):
                        tokens_data = tokens_data["solana"]
                        self.logger.debug(f"'solana' is a dict with keys: {tokens_data.keys()}")
                    # If solana is a list, use it directly as tokens
                    elif isinstance(tokens_data["solana"], list):
                        tokens = tokens_data["solana"]
                        self.logger.debug(f"Found {len(tokens)} tokens directly in 'solana' list")
                        found_tokens = True
                    else:
                        self.logger.warning(f"'solana' key exists but has unexpected type: {type(tokens_data['solana'])}")
                
                # Only check these structures if we didn't find tokens directly
                if not found_tokens:
                    # Check if items is directly in data
                    if "items" in tokens_data and isinstance(tokens_data["items"], list):
                        tokens = tokens_data["items"]
                        self.logger.debug(f"Found tokens in 'items' key")
                    # Or if tokens are directly in data
                    elif "tokens" in tokens_data and isinstance(tokens_data["tokens"], list):
                        tokens = tokens_data["tokens"]
                        self.logger.debug(f"Found tokens in 'tokens' key")
                    # Or if the data itself is a list
                    elif isinstance(tokens_data, list):
                        tokens = tokens_data
                        self.logger.debug(f"tokens_data itself is a list of tokens")
                    else:
                        # Log the structure for debugging
                        self.logger.warning(f"Unexpected data structure in Birdeye response: {tokens_data.keys() if isinstance(tokens_data, dict) else 'not a dict'}")
                
                # Log the number of tokens found
                self.logger.debug(f"Found {len(tokens)} tokens in Birdeye response")
                
                for token in tokens:
                    # Extract token data, handling different possible structures
                    symbol = token.get("symbol", token.get("tokenSymbol", "Unknown"))
                    value = token.get("value", token.get("usdValue", 0))
                    amount = token.get("amount", token.get("tokenAmount", 0))
                    
                    if value > 0:
                        holdings.append({
                            "symbol": symbol,
                            "value": value,
                            "amount": amount
                        })
                        total_value += value
                        token_count += 1
                
                # Log the extracted holdings
                self.logger.debug(f"Extracted {len(holdings)} token holdings with total value ${total_value:.2f}")
            else:
                self.logger.warning(f"Birdeye API returned unsuccessful response or missing data: {data.get('success', False)}")
            
            # Calculate diversity score (0-100)
            diversity_score = 0
            if token_count > 0 and total_value > 0:
                # Higher score for more tokens and more even distribution
                concentration = sum((h["value"] / total_value) ** 2 for h in holdings)
                diversity_score = min(100, int(100 * (1 - concentration) * (1 - 1/token_count)))
            
            return {
                "holdings": holdings[:10],  # Top 10 holdings
                "totalValue": total_value,
                "tokenCount": token_count,
                "diversity": diversity_score
            }
        except Exception as e:
            self.logger.error(f"Error fetching wallet holdings: {e}")
            return {"error": str(e)}
    
    def get_wallet_transactions(self, wallet_address: str) -> Dict[str, Any]:
        """Get wallet transaction history from Birdeye API"""
        if not self.birdeye_api_key or not wallet_address:
            return {"error": "Missing API key or wallet address"}
        
        try:
            self.logger.info(f"Fetching transaction history for {wallet_address}")
            url = f"https://public-api.birdeye.so/v1/wallet/tx_list"  # Updated endpoint
            headers = {
                "X-API-KEY": self.birdeye_api_key,
                "x-chain": "solana"  # Required header
            }
            params = {
                "wallet": wallet_address,
                "limit": 100
            }
            
            response = requests.get(url, headers=headers, params=params)
            
            if response.status_code != 200:
                self.logger.error(f"Error from Birdeye API: {response.status_code} - {response.text}")
                return {"error": f"API error: {response.status_code}"}
            
            # Log the raw response for debugging
            self.logger.debug(f"Birdeye transactions API response: {response.text[:500]}...")
            
            # Check if response is valid JSON before parsing
            try:
                data = response.json()
            except json.JSONDecodeError as e:
                self.logger.error(f"Invalid JSON response from Birdeye API: {e}")
                self.logger.debug(f"Response content: {response.text[:100]}...")
                return {"error": "Invalid API response format"}
            
            # Calculate metrics
            thirty_days_ago = time.time() - (30 * 24 * 60 * 60)
            recent_txns = []
            value_30d_ago = 0
            current_value = 0
            risk_score = 50  # Default medium risk
            transactions = []  # Initialize transactions list
            
            # Check the structure of the response and extract data
            if "success" in data and data["success"] and "data" in data:
                txn_data = data["data"]
                found_transactions = False
                
                # Handle the case where data contains a "solana" key
                if "solana" in txn_data:
                    self.logger.debug(f"Found 'solana' key in response data")
                    # If solana is a dict, use it for further processing
                    if isinstance(txn_data["solana"], dict):
                        txn_data = txn_data["solana"]
                        self.logger.debug(f"'solana' is a dict with keys: {txn_data.keys()}")
                    # If solana is a list, use it directly as transactions
                    elif isinstance(txn_data["solana"], list):
                        transactions = txn_data["solana"]
                        self.logger.debug(f"Found {len(transactions)} transactions directly in 'solana' list")
                        found_transactions = True
                    else:
                        self.logger.warning(f"'solana' key exists but has unexpected type: {type(txn_data['solana'])}")
                
                # Only check these structures if we didn't find transactions directly
                if not found_transactions:
                    # Check if items is directly in data
                    if "items" in txn_data and isinstance(txn_data["items"], list):
                        transactions = txn_data["items"]
                        self.logger.debug(f"Found transactions in 'items' key")
                    # Or if transactions are directly in data
                    elif "transactions" in txn_data and isinstance(txn_data["transactions"], list):
                        transactions = txn_data["transactions"]
                        self.logger.debug(f"Found transactions in 'transactions' key")
                    # Or if the data itself is a list
                    elif isinstance(txn_data, list):
                        transactions = txn_data
                        self.logger.debug(f"txn_data itself is a list of transactions")
                    else:
                        # Log the structure for debugging
                        self.logger.warning(f"Unexpected data structure in Birdeye response: {txn_data.keys() if isinstance(txn_data, dict) else 'not a dict'}")
                
                # Log the number of transactions found
                self.logger.debug(f"Found {len(transactions)} transactions in Birdeye response")
                
                # Get recent transactions
                for txn in transactions[:20]:
                    # Extract transaction data, handling different possible structures
                    txn_type = txn.get("type", txn.get("txType", "Unknown"))
                    symbol = txn.get("symbol", txn.get("tokenSymbol", "Unknown"))
                    value = txn.get("value", txn.get("usdValue", 0))
                    timestamp = txn.get("timestamp", txn.get("blockTime", 0))
                    
                    recent_txns.append({
                        "type": txn_type,
                        "symbol": symbol,
                        "value": value,
                        "timestamp": timestamp
                    })
                
                # Calculate 30-day change
                if len(transactions) > 0:
                    # Try different field names for portfolio value
                    current_value = transactions[0].get("portfolioValue", 
                                    transactions[0].get("walletValue", 
                                    transactions[0].get("totalValue", 0)))
                    
                    # Find portfolio value 30 days ago
                    for txn in transactions:
                        txn_time = txn.get("timestamp", txn.get("blockTime", 0))
                        if txn_time < thirty_days_ago:
                            value_30d_ago = txn.get("portfolioValue", 
                                            txn.get("walletValue", 
                                            txn.get("totalValue", 0)))
                            break
                
                # Calculate risk score based on transaction patterns
                if len(transactions) > 10:
                    # Factors that increase risk:
                    # 1. High transaction frequency
                    txn_frequency = min(100, len([t for t in transactions 
                                                if t.get("timestamp", t.get("blockTime", 0)) > thirty_days_ago]))
                    
                    # 2. Trading low-cap tokens
                    low_cap_trades = sum(1 for t in transactions[:50] 
                                        if t.get("symbol", t.get("tokenSymbol", "")) not in ["SOL", "USDC", "USDT"])
                    
                    # 3. High value volatility
                    values = [t.get("value", t.get("usdValue", 0)) for t in transactions[:20] 
                            if t.get("value", t.get("usdValue", 0)) > 0]
                    value_volatility = 0
                    if len(values) > 1:
                        avg_value = sum(values) / len(values)
                        value_volatility = sum(abs(v - avg_value) for v in values) / (avg_value * len(values))
                    
                    # Combine factors
                    risk_score = min(100, int((txn_frequency * 0.3) + (low_cap_trades * 2) + (value_volatility * 30)))
            else:
                self.logger.warning(f"Birdeye API returned unsuccessful response or missing data: {data.get('success', False)}")
            
            # Calculate 30-day change percentage
            change_30d = 0
            if value_30d_ago > 0 and current_value > 0:
                change_30d = ((current_value - value_30d_ago) / value_30d_ago) * 100
            
            return {
                "recentTransactions": recent_txns[:5],  # Top 5 recent transactions
                "30DayChange": change_30d,
                "riskScore": risk_score
            }
        except Exception as e:
            self.logger.error(f"Error fetching wallet transactions: {e}")
            return {"error": str(e)}
    
    def get_x_profile(self, username: str) -> Dict[str, Any]:
        """Get X (Twitter) profile information"""
        if not self.x_api_key or not username:
            return {"error": "Missing API key or username"}
        
        try:
            self.logger.info(f"Fetching X profile for {username}")
            # Remove @ if present
            username = username.replace("@", "")
            
            url = f"https://api.twitter.com/2/users/by/username/{username}"
            params = {
                "user.fields": "public_metrics,profile_image_url,description"
            }
            headers = {"Authorization": f"Bearer {self.x_api_key}"}
            
            response = requests.get(url, params=params, headers=headers)
            
            if response.status_code != 200:
                self.logger.error(f"Error from X API: {response.status_code} - {response.text}")
                return {"error": f"API error: {response.status_code}"}
            
            data = response.json()
            
            if "data" not in data:
                return {"error": "User not found"}
            
            user_data = data["data"]
            metrics = user_data.get("public_metrics", {})
            
            # Calculate influence score (0-100)
            followers = metrics.get("followers_count", 0)
            following = metrics.get("following_count", 0) or 1  # Avoid division by zero
            tweets = metrics.get("tweet_count", 0)
            
            # Factors for influence score:
            # 1. Follower count (logarithmic scale)
            follower_score = min(70, int(10 * (1 + (followers / 1000))))
            
            # 2. Follower/following ratio
            ratio_score = min(20, int(10 * (followers / following)))
            
            # 3. Activity level
            activity_score = min(10, int(tweets / 1000))
            
            influence_score = follower_score + ratio_score + activity_score
            
            return {
                "profilePicture": user_data.get("profile_image_url", ""),
                "followers": followers,
                "following": following,
                "tweets": tweets,
                "description": user_data.get("description", ""),
                "influenceScore": influence_score
            }
        except Exception as e:
            self.logger.error(f"Error fetching X profile: {e}")
            return {"error": str(e)}
    
    def generate_insights(self, kol_data: Dict[str, Any]) -> Dict[str, str]:
        """Generate insights using Claude AI"""
        if not self.claude_api_key:
            return {
                "analysis": "Claude API key not configured",
                "insights": "Unable to generate insights",
                "profile": "Unknown"
            }
        
        try:
            self.logger.info(f"Generating insights for KOL: {kol_data.get('name', 'Unknown')}")
            
            # Prepare context for Claude
            context = f"""
            KOL Analysis Data:
            
            Name: {kol_data.get('name', 'Unknown')}
            X Username: {kol_data.get('xUsername', 'Unknown')}
            Wallet Address: {kol_data.get('wallet', 'Unknown')}
            
            Wallet Holdings:
            - Total Value: ${kol_data.get('totalValue', 0):,.2f}
            - Token Count: {kol_data.get('tokenCount', 0)}
            - Diversity Score: {kol_data.get('diversity', 0)}/100
            
            Top Holdings:
            {json.dumps(kol_data.get('holdings', []), indent=2)}
            
            Transaction History:
            - 30 Day Change: {kol_data.get('30DayChange', 0):.2f}%
            - Risk Score: {kol_data.get('riskScore', 50)}/100
            
            Recent Transactions:
            {json.dumps(kol_data.get('recentTransactions', []), indent=2)}
            
            Social Influence:
            - Influence Score: {kol_data.get('influenceScore', 0)}/100
            - Followers: {kol_data.get('followers', 0):,}
            - Following: {kol_data.get('following', 0):,}
            - Tweets: {kol_data.get('tweets', 0):,}
            - Bio: {kol_data.get('description', 'None')}
            """
            
            prompt = f"""
            You are a crypto analyst specializing in evaluating Key Opinion Leaders (KOLs) in the Solana ecosystem.
            
            Analyze the following data about a crypto KOL and provide:
            1. A concise analysis of their trading behavior, risk profile, and influence
            2. Key insights about their investment strategy and potential value as an influencer
            3. Assign them ONE profile type that best matches their behavior
            
            {context}
            
            Profile types to choose from (select exactly ONE that best fits):
            - Alpha: First to find winning plays before anyone else.
            - Storyteller: Creates narratives that move markets.
            - Chartist: Lives by the charts, dies by the charts.
            - Contrarian: Always against the crowd, often right.
            - Maxi: Devoted to one ecosystem above all others.
            - Detective: Digs deeper than anyone else for edge.
            - Catalyst: Makes things happen through sheer influence.
            - Strategist: Chess player thinking multiple moves ahead.
            - Whale: Big money moves that others follow.
            - Degen: Lives for the community, thrives in chaos.
            
            Provide your response in three parts:
            1. Analysis: A paragraph summarizing the KOL's profile, trading behavior, and influence
            2. Insights: 3-5 bullet points with specific observations about their strategy and value as an influencer
            3. Profile: The ONE profile type that best describes this KOL (just the name, no explanation)
            """
            
            response = self.claude.messages.create(
                model="claude-3-7-sonnet-latest",
                max_tokens=1000,
                temperature=0.2,
                system="You are a crypto analyst specializing in evaluating Key Opinion Leaders (KOLs) in the Solana ecosystem.",
                messages=[
                    {"role": "user", "content": prompt}
                ]
            )
            
            # Extract analysis, insights, and profile from response
            content = response.content[0].text
            
            # Split into sections
            sections = content.split("Insights:")
            analysis_section = sections[0].replace("Analysis:", "").strip()
            
            if len(sections) > 1:
                remaining = sections[1]
                insights_profile = remaining.split("Profile:")
                insights_section = insights_profile[0].strip()
                profile_section = insights_profile[1].strip() if len(insights_profile) > 1 else "Unknown"
            else:
                insights_section = "No insights generated"
                profile_section = "Unknown"
            
            # Clean up profile to just get the type name
            profile_type = profile_section.split("\n")[0].strip()
            
            return {
                "analysis": analysis_section,
                "insights": insights_section,
                "profile": profile_type
            }
        except Exception as e:
            self.logger.error(f"Error generating insights: {e}")
            return {
                "analysis": f"Error generating analysis: {str(e)}",
                "insights": "Unable to generate insights due to an error",
                "profile": "Unknown"
            }
    
    def update_kol_record(self, record_id: str, data: Dict[str, Any]) -> bool:
        """Update KOL record in Airtable with new data"""
        try:
            self.logger.info(f"Updating KOL record: {record_id}")
            self.kol_table.update(record_id, data)
            self.logger.info(f"Successfully updated KOL record: {record_id}")
            return True
        except Exception as e:
            self.logger.error(f"Error updating KOL record: {e}")
            return False
    
    def analyze_kol(self, kol_record: Dict) -> Dict[str, Any]:
        """Analyze a single KOL and return updated data"""
        record_id = kol_record["id"]
        fields = kol_record["fields"]
        
        # Use "X" field for the name instead of "name"
        kol_name = fields.get("X", "Unknown")
        self.logger.info(f"Analyzing KOL: {kol_name}")
        
        # Extract key fields
        wallet_address = fields.get("wallet", "")
        x_username = fields.get("xUsername", "")
        
        # Initialize result data with correct field name
        result_data = {
            "name": kol_name,  # Store as "name" for internal use
            "X": kol_name,     # Also store as "X" for Airtable update
            "wallet": wallet_address,
            "xUsername": x_username
        }
        
        # Get wallet holdings data
        if wallet_address:
            holdings_data = self.get_wallet_holdings(wallet_address)
            if "error" not in holdings_data:
                result_data.update(holdings_data)
        
        # Get wallet transaction history
        if wallet_address:
            transaction_data = self.get_wallet_transactions(wallet_address)
            if "error" not in transaction_data:
                result_data.update(transaction_data)
        
        # Get X profile data
        if x_username:
            x_data = self.get_x_profile(x_username)
            if "error" not in x_data:
                result_data.update(x_data)
        
        # Generate insights with all collected data
        insights_data = self.generate_insights(result_data)
        result_data.update(insights_data)
        
        # Prepare data for Airtable update
        update_data = {
            "X": result_data.get("X", "Unknown"),  # Use X field for name
            "totalValue": result_data.get("totalValue", 0),
            "diversity": result_data.get("diversity", 0),
            "30DayChange": result_data.get("30DayChange", 0),
            "riskScore": result_data.get("riskScore", 50),
            "influenceScore": result_data.get("influenceScore", 0),
            "profilePicture": result_data.get("profilePicture", ""),
            "analysis": result_data.get("analysis", ""),
            "insights": result_data.get("insights", ""),
            "profile": result_data.get("profile", "Unknown"),
            "lastUpdated": time.strftime("%Y-%m-%d %H:%M:%S")
        }
        
        # Update holdings as JSON string - ensure it's not empty
        holdings = result_data.get("holdings", [])
        if holdings:
            self.logger.info(f"Found {len(holdings)} holdings for {kol_name}")
            update_data["holdingsJSON"] = json.dumps(holdings)
        else:
            self.logger.warning(f"No holdings found for {kol_name}")
            update_data["holdingsJSON"] = json.dumps([{"symbol": "No data", "value": 0, "amount": 0}])
        
        # Update recent transactions as JSON string - ensure it's not empty
        transactions = result_data.get("recentTransactions", [])
        if transactions:
            self.logger.info(f"Found {len(transactions)} transactions for {kol_name}")
            update_data["transactionsJSON"] = json.dumps(transactions)
        else:
            self.logger.warning(f"No transactions found for {kol_name}")
            update_data["transactionsJSON"] = json.dumps([{"type": "No data", "symbol": "Unknown", "value": 0, "timestamp": 0}])
        
        return {
            "record_id": record_id,
            "update_data": update_data,
            "full_data": result_data
        }
    
    async def analyze_all_kols(self):
        """Analyze all KOLs and update their records"""
        kol_records = self.get_all_kols()
        
        if not kol_records:
            self.logger.warning("No KOL records found to analyze")
            return
        
        self.logger.info(f"Starting analysis of {len(kol_records)} KOLs")
        
        for kol_record in kol_records:
            try:
                result = self.analyze_kol(kol_record)
                self.update_kol_record(result["record_id"], result["update_data"])
                
                # Sleep to avoid rate limiting
                await asyncio.sleep(2)
            except Exception as e:
                self.logger.error(f"Error analyzing KOL {kol_record.get('id', 'Unknown')}: {e}")
        
        self.logger.info("KOL analysis completed")

async def main():
    try:
        analyzer = KOLAnalyzer()
        await analyzer.analyze_all_kols()
    except Exception as e:
        logging.error(f"Error in main execution: {e}")

if __name__ == "__main__":
    asyncio.run(main())
