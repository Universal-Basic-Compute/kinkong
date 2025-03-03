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
            url = "https://public-api.birdeye.so/v1/wallet/token_list"
            headers = {
                "X-API-KEY": self.birdeye_api_key,
                "x-chain": "solana"
            }
            params = {
                "wallet": wallet_address
            }
            
            response = requests.get(url, headers=headers, params=params)
        
            # Log the API request details
            self.logger.info(f"Birdeye Holdings API Request: URL={url}, Params={params}")
            self.logger.info(f"Birdeye Holdings API Response Status: {response.status_code}")
        
            if response.status_code != 200:
                self.logger.error(f"Error from Birdeye API: {response.status_code} - {response.text}")
                return {"error": f"API error: {response.status_code}"}
        
            # Log the raw response for debugging
            self.logger.debug(f"Birdeye holdings API response: {response.text[:1000]}...")
            # Log the raw response
            self.logger.info(f"Birdeye Holdings API Response: {response.text[:500]}...")
            
            try:
                data = response.json()
            except json.JSONDecodeError as e:
                self.logger.error(f"Invalid JSON response from Birdeye API: {e}")
                return {"error": "Invalid API response format"}
            
            # Calculate metrics
            holdings = []
            total_value = 0
            token_count = 0
            
            # Check if the response is successful
            if data.get("success", False):
                # The tokens are likely in data -> tokens
                tokens_data = data.get("data", {})
                
                # Try different possible paths to the tokens list
                tokens = []
                
                # Path 1: data -> tokens
                if "tokens" in tokens_data and isinstance(tokens_data["tokens"], list):
                    tokens = tokens_data["tokens"]
                    self.logger.debug(f"Found tokens in data->tokens: {len(tokens)} tokens")
                
                # Path 2: data -> solana -> tokens
                elif "solana" in tokens_data:
                    solana_data = tokens_data["solana"]
                    if isinstance(solana_data, dict) and "tokens" in solana_data:
                        tokens = solana_data["tokens"]
                        self.logger.debug(f"Found tokens in data->solana->tokens: {len(tokens)} tokens")
                    elif isinstance(solana_data, list):
                        tokens = solana_data
                        self.logger.debug(f"Found tokens in data->solana (list): {len(tokens)} tokens")
                
                # Path 3: data -> items
                elif "items" in tokens_data and isinstance(tokens_data["items"], list):
                    tokens = tokens_data["items"]
                    self.logger.debug(f"Found tokens in data->items: {len(tokens)} tokens")
                
                # If we found tokens, process them
                if tokens:
                    for token in tokens:
                        # Try different field names for token data
                        symbol = token.get("symbol", token.get("tokenSymbol", "Unknown"))
                        
                        # Try different field names for value
                        value = 0
                        for value_field in ["usdValue", "value", "valueUsd", "priceUsd"]:
                            if value_field in token:
                                try:
                                    value = float(token[value_field])
                                    break
                                except (ValueError, TypeError):
                                    pass
                        
                        # Try different field names for amount
                        amount = 0
                        for amount_field in ["amount", "tokenAmount", "balance"]:
                            if amount_field in token:
                                try:
                                    amount = float(token[amount_field])
                                    break
                                except (ValueError, TypeError):
                                    pass
                        
                        if value > 0:
                            holdings.append({
                                "symbol": symbol,
                                "value": value,
                                "amount": amount
                            })
                            total_value += value
                            token_count += 1
                    
                    self.logger.info(f"Extracted {len(holdings)} token holdings with total value ${total_value:.2f}")
                else:
                    self.logger.warning(f"No tokens found in response. Response structure: {list(tokens_data.keys())}")
            else:
                self.logger.warning(f"Birdeye API returned unsuccessful response: {data.get('success', False)}")
            
            # Calculate diversity score (0-100)
            diversity_score = 0
            if token_count > 0 and total_value > 0:
                # Higher score for more tokens and more even distribution
                concentration = sum((h["value"] / total_value) ** 2 for h in holdings)
                diversity_score = min(100, int(100 * (1 - concentration) * (1 - 1/token_count)))
            
            return {
                "holdings": sorted(holdings, key=lambda x: x["value"], reverse=True)[:10],  # Top 10 holdings by value
                "totalValue": total_value,
                "tokenCount": token_count,
                "diversity": diversity_score
            }
        except Exception as e:
            self.logger.error(f"Error fetching wallet holdings: {e}")
            self.logger.exception("Exception details:")
            return {"error": str(e)}
    
    def get_wallet_transactions(self, wallet_address: str) -> Dict[str, Any]:
        """Get wallet transaction history from Birdeye API"""
        if not self.birdeye_api_key or not wallet_address:
            self.logger.warning(f"Missing API key or wallet address for transactions")
            return {
                "recentTransactions": [],
                "30DayChange": 0,
                "riskScore": 50
            }
        
        try:
            self.logger.info(f"Fetching transaction history for {wallet_address}")
            url = "https://public-api.birdeye.so/v1/wallet/tx_list"
            headers = {
                "X-API-KEY": self.birdeye_api_key,
                "x-chain": "solana"
            }
            params = {
                "wallet": wallet_address,
                "limit": 200  # Increased limit to get more transactions
            }
            
            # Log the API request details
            self.logger.info(f"Birdeye Transactions API Request: URL={url}, Params={params}")
        
            response = requests.get(url, headers=headers, params=params, timeout=15)  # Increased timeout
            self.logger.info(f"Birdeye Transactions API Response Status: {response.status_code}")
        
            if response.status_code != 200:
                # Try alternative endpoint
                self.logger.warning(f"Primary endpoint failed, trying alternative endpoint")
                url = "https://public-api.birdeye.so/v1/wallet/history"
                self.logger.info(f"Birdeye Alternative API Request: URL={url}, Params={params}")
            
                response = requests.get(url, headers=headers, params=params, timeout=15)
                self.logger.info(f"Birdeye Alternative API Response Status: {response.status_code}")
            
                if response.status_code != 200:
                    self.logger.error(f"Error from Birdeye API: {response.status_code} - {response.text}")
                    return {
                        "recentTransactions": [],
                        "30DayChange": 0,
                        "riskScore": 50
                    }
            
            # Log the raw response for debugging
            self.logger.debug(f"Birdeye transactions API response: {response.text[:1000]}...")
            # Log the raw response
            self.logger.info(f"Birdeye Transactions API Response: {response.text[:500]}...")
            
            try:
                data = response.json()
            except json.JSONDecodeError as e:
                self.logger.error(f"Invalid JSON response from Birdeye API: {e}")
                return {"error": "Invalid API response format"}
            
            # Calculate metrics
            thirty_days_ago = time.time() - (30 * 24 * 60 * 60)
            recent_txns = []
            value_30d_ago = 0
            current_value = 0
            risk_score = 50  # Default medium risk
            
            # Check if the response is successful
            if data.get("success", False):
                # The transactions are likely in data -> transactions
                txn_data = data.get("data", {})
                
                # Try different possible paths to the transactions list
                transactions = []
                
                # Check all possible paths to find transactions
                possible_paths = [
                    # Direct paths
                    txn_data.get("transactions", []),
                    txn_data.get("items", []),
                    # Nested under solana
                    txn_data.get("solana", {}).get("transactions", []) if isinstance(txn_data.get("solana"), dict) else [],
                    txn_data.get("solana", []) if isinstance(txn_data.get("solana"), list) else [],
                    # Nested under other possible keys
                    txn_data.get("history", []),
                    txn_data.get("txs", []),
                    txn_data.get("tx_list", [])
                ]
                
                # Use the first non-empty path
                for path in possible_paths:
                    if path and isinstance(path, list):
                        transactions = path
                        self.logger.debug(f"Found {len(transactions)} transactions")
                        break
                
                # If we found transactions, process them
                if transactions:
                    for txn in transactions[:50]:  # Process more transactions
                        # Try different field names for transaction data
                        txn_type = txn.get("type", txn.get("txType", txn.get("transactionType", "Unknown")))
                        symbol = txn.get("symbol", txn.get("tokenSymbol", txn.get("token", "Unknown")))
                        
                        # Try different field names for value
                        value = 0
                        for value_field in ["usdValue", "value", "valueUsd", "amountUsd", "amount_usd"]:
                            if value_field in txn:
                                try:
                                    value = float(txn[value_field])
                                    break
                                except (ValueError, TypeError):
                                    pass
                        
                        # Try different field names for timestamp
                        timestamp = 0
                        for time_field in ["timestamp", "blockTime", "time", "date", "block_time"]:
                            if time_field in txn:
                                try:
                                    if isinstance(txn[time_field], str):
                                        # Try to parse string timestamp
                                        timestamp = float(txn[time_field])
                                    else:
                                        timestamp = txn[time_field]
                                    break
                                except (ValueError, TypeError):
                                    pass
                        
                        # Add more transaction details if available
                        tx_details = {
                            "type": txn_type,
                            "symbol": symbol,
                            "value": value,
                            "timestamp": timestamp
                        }
                        
                        # Add optional fields if available
                        for field, key in [
                            ("txHash", ["txHash", "signature", "tx_hash", "id"]),
                            ("fee", ["fee", "transaction_fee"]),
                            ("status", ["status", "tx_status"])
                        ]:
                            for k in key:
                                if k in txn:
                                    tx_details[field] = txn[k]
                                    break
                        
                        recent_txns.append(tx_details)
                    
                    self.logger.info(f"Extracted {len(recent_txns)} recent transactions")
                    
                    # Calculate 30-day change
                    if len(transactions) > 0:
                        # Try different field names for portfolio value
                        current_value = transactions[0].get("portfolioValue", 
                                        transactions[0].get("walletValue", 
                                        transactions[0].get("totalValue", 0)))
                        
                        # Find portfolio value 30 days ago
                        for txn in transactions:
                            # Ensure timestamp is a number for comparison
                            txn_time = txn.get("timestamp", txn.get("blockTime", 0))
                            if isinstance(txn_time, str):
                                try:
                                    txn_time = float(txn_time)
                                except (ValueError, TypeError):
                                    txn_time = 0
                        
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
                                                    if self._get_numeric_timestamp(t) > thirty_days_ago]))
                        
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
                    self.logger.warning(f"No transactions found in response. Response structure: {list(txn_data.keys())}")
            else:
                self.logger.warning(f"Birdeye API returned unsuccessful response: {data.get('success', False)}")
            
            # Calculate 30-day change percentage
            change_30d = 0
            if value_30d_ago > 0 and current_value > 0:
                change_30d = ((current_value - value_30d_ago) / value_30d_ago) * 100
            
            return {
                "recentTransactions": recent_txns[:10],  # Return more recent transactions
                "30DayChange": change_30d,
                "riskScore": risk_score
            }
        except Exception as e:
            self.logger.error(f"Error fetching wallet transactions: {e}")
            self.logger.exception("Exception details:")
            return {
                "recentTransactions": [],
                "30DayChange": 0,
                "riskScore": 50
            }
    
    def get_x_profile(self, username: str) -> Dict[str, Any]:
        """Get X (Twitter) profile information"""
        if not self.x_api_key or not username:
            self.logger.warning(f"Missing X API key or username")
            return {
                "profilePicture": "",
                "followers": 0,
                "following": 0,
                "tweets": 0,
                "description": "",
                "influenceScore": 0
            }
        
        try:
            self.logger.info(f"Fetching X profile for {username}")
            # Remove @ if present
            username = username.replace("@", "")
            
            # Updated endpoint URL
            url = f"https://api.x.com/2/users/by/username/{username}"
            params = {
                "user.fields": "public_metrics,profile_image_url,description,created_at"
            }
            headers = {"Authorization": f"Bearer {self.x_api_key}"}
            
            # Log the API request details
            self.logger.info(f"X API Request: URL={url}, Params={params}")
            
            response = requests.get(url, params=params, headers=headers, timeout=10)
            self.logger.info(f"X API Response Status: {response.status_code}")
            
            # If the new endpoint fails, try the old one as fallback
            if response.status_code != 200:
                self.logger.warning(f"New X API endpoint failed with status {response.status_code}, trying legacy endpoint")
                url = f"https://api.twitter.com/2/users/by/username/{username}"
                self.logger.info(f"X Legacy API Request: URL={url}, Params={params}")
                
                response = requests.get(url, params=params, headers=headers, timeout=10)
                self.logger.info(f"X Legacy API Response Status: {response.status_code}")
            
            if response.status_code != 200:
                self.logger.error(f"Error from X API: {response.status_code} - {response.text}")
                return {
                    "profilePicture": "",
                    "followers": 0,
                    "following": 0,
                    "tweets": 0,
                    "description": "",
                    "influenceScore": 0
                }
            
            # Log the raw response
            self.logger.info(f"X API Response: {response.text}")
            
            data = response.json()
            
            if "data" not in data:
                self.logger.warning(f"User not found in X API response: {data}")
                return {
                    "profilePicture": "",
                    "followers": 0,
                    "following": 0,
                    "tweets": 0,
                    "description": "",
                    "influenceScore": 0
                }
            
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
            return {
                "profilePicture": "",
                "followers": 0,
                "following": 0,
                "tweets": 0,
                "description": "",
                "influenceScore": 0
            }
    
    def generate_insights(self, kol_data: Dict[str, Any]) -> Dict[str, str]:
        """Generate insights using Claude AI and return as structured JSON"""
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
            
            # Log the context being sent to Claude
            self.logger.info(f"Claude API Context: {context[:500]}...")
            
            prompt = f"""
            You are a crypto analyst specializing in evaluating Key Opinion Leaders (KOLs) in the Solana ecosystem.
            
            Analyze the following data about a crypto KOL and provide your analysis in JSON format.
            
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
            
            Return your analysis as a valid JSON object with the following structure:
            {{
              "analysis": "A paragraph summarizing the KOL's profile, trading behavior, and influence",
              "insights": [
                "First key insight about their strategy",
                "Second key insight about their strategy",
                "Third key insight about their strategy",
                "Fourth key insight about their strategy",
                "Fifth key insight about their strategy"
              ],
              "profile": "ONE_PROFILE_TYPE"
            }}
            
            Ensure your response is ONLY the JSON object, with no additional text before or after.
            """
            
            response = self.claude.messages.create(
                model="claude-3-7-sonnet-latest",
                max_tokens=1000,
                temperature=0.2,
                system="You are a crypto analyst specializing in evaluating Key Opinion Leaders (KOLs) in the Solana ecosystem. Always respond with valid JSON.",
                messages=[
                    {"role": "user", "content": prompt}
                ]
            )
            
            # Extract JSON from response
            content = response.content[0].text.strip()
            
            # Log the Claude API response
            self.logger.info(f"Claude API Response: {content[:500]}...")
            
            # Try to parse the JSON response
            try:
                result = json.loads(content)
                # Ensure all expected fields are present
                if not all(k in result for k in ["analysis", "insights", "profile"]):
                    self.logger.warning(f"Missing fields in Claude JSON response: {result.keys()}")
                    # Add any missing fields
                    if "analysis" not in result:
                        result["analysis"] = "Analysis not provided"
                    if "insights" not in result:
                        result["insights"] = ["No insights provided"]
                    if "profile" not in result:
                        result["profile"] = "Unknown"
                
                # Convert insights list to string if needed
                if isinstance(result["insights"], list):
                    result["insights"] = "\n• " + "\n• ".join(result["insights"])
                
                return result
            except json.JSONDecodeError as e:
                self.logger.error(f"Failed to parse Claude response as JSON: {e}")
                self.logger.debug(f"Raw response: {content}")
                
                # Fallback to text parsing if JSON parsing fails
                try:
                    # Try to extract sections manually
                    if "Analysis:" in content and "Insights:" in content and "Profile:" in content:
                        analysis = content.split("Analysis:")[1].split("Insights:")[0].strip()
                        insights_section = content.split("Insights:")[1].split("Profile:")[0].strip()
                        profile = content.split("Profile:")[1].strip().split("\n")[0].strip()
                        
                        # Format insights as bullet points
                        insights_list = [line.strip().strip('*•-') for line in insights_section.split("\n") if line.strip()]
                        insights = "\n• " + "\n• ".join(insights_list)
                        
                        return {
                            "analysis": analysis,
                            "insights": insights,
                            "profile": profile
                        }
                    else:
                        return {
                            "analysis": "Error parsing Claude response",
                            "insights": "Unable to extract insights from response",
                            "profile": "Unknown"
                        }
                except Exception as parsing_error:
                    self.logger.error(f"Error parsing Claude text response: {parsing_error}")
                    return {
                        "analysis": "Error parsing Claude response",
                        "insights": "Unable to extract insights from response",
                        "profile": "Unknown"
                    }
        except Exception as e:
            self.logger.error(f"Error generating insights: {e}")
            return {
                "analysis": f"Error generating analysis: {str(e)}",
                "insights": "Unable to generate insights due to an error",
                "profile": "Unknown"
            }
    
    def _get_numeric_timestamp(self, transaction):
        """Helper method to safely extract a numeric timestamp from a transaction"""
        timestamp = transaction.get("timestamp", transaction.get("blockTime", 0))
        if isinstance(timestamp, str):
            try:
                return float(timestamp)
            except (ValueError, TypeError):
                return 0
        return timestamp
        
    def _print_nested_structure(self, data, prefix="", max_depth=3, current_depth=0):
        """Helper to print the structure of nested dictionaries and lists"""
        if current_depth >= max_depth:
            print(f"{prefix}... (max depth reached)")
            return
        
        if isinstance(data, dict):
            print(f"{prefix}dict with keys: {list(data.keys())}")
            for key, value in data.items():
                print(f"{prefix}{key}:", end=" ")
                if isinstance(value, (dict, list)):
                    print()
                    self._print_nested_structure(value, prefix + "  ", max_depth, current_depth + 1)
                else:
                    print(f"{type(value).__name__}: {str(value)[:50]}")
        elif isinstance(data, list):
            print(f"{prefix}list with {len(data)} items")
            if data and current_depth < max_depth - 1:
                print(f"{prefix}First item:")
                self._print_nested_structure(data[0], prefix + "  ", max_depth, current_depth + 1)
        else:
            print(f"{prefix}{type(data).__name__}: {str(data)[:50]}")
    
    def test_birdeye_api(self, wallet_address: str):
        """Test the Birdeye API and print the full response structure"""
        if not self.birdeye_api_key or not wallet_address:
            print("Missing API key or wallet address")
            return
        
        print(f"Testing Birdeye API for wallet: {wallet_address}")
        
        # Test token list endpoint
        url = "https://public-api.birdeye.so/v1/wallet/token_list"
        headers = {
            "X-API-KEY": self.birdeye_api_key,
            "x-chain": "solana"
        }
        params = {
            "wallet": wallet_address
        }
        
        print("\nTesting token list endpoint...")
        response = requests.get(url, headers=headers, params=params)
        print(f"Status code: {response.status_code}")
        
        if response.status_code == 200:
            try:
                data = response.json()
                print("\nResponse structure:")
                self._print_nested_structure(data)
                print("\nFull response:")
                print(json.dumps(data, indent=2)[:2000] + "...")  # Print first 2000 chars
            except Exception as e:
                print(f"Error parsing response: {e}")
                print(f"Raw response: {response.text[:500]}...")
        
        # Test transaction list endpoint
        url = "https://public-api.birdeye.so/v1/wallet/tx_list"
        params = {
            "wallet": wallet_address,
            "limit": 10  # Limit to 10 for testing
        }
        
        print("\nTesting transaction list endpoint...")
        response = requests.get(url, headers=headers, params=params)
        print(f"Status code: {response.status_code}")
        
        if response.status_code == 200:
            try:
                data = response.json()
                print("\nResponse structure:")
                self._print_nested_structure(data)
                print("\nFull response:")
                print(json.dumps(data, indent=2)[:2000] + "...")  # Print first 2000 chars
            except Exception as e:
                print(f"Error parsing response: {e}")
                print(f"Raw response: {response.text[:500]}...")
    
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
            "xUsername": x_username,
            # Initialize with default values to ensure they exist
            "totalValue": 0,
            "tokenCount": 0,
            "diversity": 0,
            "holdings": [],
            "recentTransactions": [],
            "30DayChange": 0,
            "riskScore": 50,
            "profilePicture": "",
            "followers": 0,
            "following": 0,
            "tweets": 0,
            "description": "",
            "influenceScore": 0
        }
        
        # Get wallet holdings data
        if wallet_address:
            holdings_data = self.get_wallet_holdings(wallet_address)
            if "error" not in holdings_data:
                result_data.update(holdings_data)
                self.logger.info(f"Updated holdings data for {kol_name}: ${result_data.get('totalValue', 0):,.2f}")
        
        # Get wallet transaction history
        if wallet_address:
            transaction_data = self.get_wallet_transactions(wallet_address)
            if "error" not in transaction_data:
                result_data.update(transaction_data)
                self.logger.info(f"Updated transaction data for {kol_name}: {len(result_data.get('recentTransactions', []))} transactions")
        
        # Get X profile data
        if x_username:
            x_data = self.get_x_profile(x_username)
            if "error" not in x_data:
                result_data.update(x_data)
                self.logger.info(f"Updated X profile data for {kol_name}: {result_data.get('followers', 0):,} followers")
        
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
        
        # Test mode - uncomment to test API with a specific wallet
        # Replace with a valid wallet address
        # test_wallet = "BCnqsPEtA1TkgednYEebRpkmwFRJDCjMQcKZMMtEdArc"
        # analyzer.test_birdeye_api(test_wallet)
        # return
        
        await analyzer.analyze_all_kols()
    except Exception as e:
        logging.error(f"Error in main execution: {e}")

if __name__ == "__main__":
    asyncio.run(main())
