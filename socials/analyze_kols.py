#!/usr/bin/env python3
import os
import json
import time
import logging
import asyncio
import platform
import requests
import matplotlib.pyplot as plt
import matplotlib.patches as patches
from matplotlib.offsetbox import OffsetImage, AnnotationBbox
from PIL import Image, ImageDraw, ImageFont
import numpy as np
import io
from datetime import datetime
import argparse
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
                "riskScore": 50
            }
        
        try:
            self.logger.info(f"Fetching transaction history for {wallet_address}")
            url = "https://public-api.birdeye.so/v1/wallet/tx_list"
            headers = {
                "X-API-KEY": self.birdeye_api_key,
                "x-chain": "solana",
                "accept": "application/json"  # Added as per documentation
            }
            params = {
                "wallet": wallet_address,
                "limit": 100  # Use the default limit as per documentation
            }
            
            # Log the API request details
            self.logger.info(f"Birdeye Transactions API Request: URL={url}, Params={params}")
            
            response = requests.get(url, headers=headers, params=params, timeout=15)
            self.logger.info(f"Birdeye Transactions API Response Status: {response.status_code}")
            
            if response.status_code != 200:
                self.logger.error(f"Error from Birdeye API: {response.status_code} - {response.text}")
                return {
                    "recentTransactions": [],
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
            thirty_days_ago_timestamp = time.time() - (30 * 24 * 60 * 60)
            recent_txns = []
            risk_score = 50  # Default medium risk
            
            # Check if the response is successful
            if data.get("success", False):
                # Extract transactions from the response
                txn_data = data.get("data", {})
                transactions = []
                
                # Check all possible paths to find transactions
                if "solana" in txn_data and isinstance(txn_data["solana"], list):
                    transactions = txn_data["solana"]
                    self.logger.info(f"Found {len(transactions)} transactions in data->solana")
                else:
                    possible_paths = [
                        # Direct paths
                        txn_data.get("transactions", []),
                        txn_data.get("items", []),
                        # Nested under solana
                        txn_data.get("solana", {}).get("transactions", []) if isinstance(txn_data.get("solana"), dict) else [],
                        # Nested under other possible keys
                        txn_data.get("history", []),
                        txn_data.get("txs", []),
                        txn_data.get("tx_list", [])
                    ]
                    
                    # Use the first non-empty path
                    for path in possible_paths:
                        if path and isinstance(path, list):
                            transactions = path
                            self.logger.info(f"Found {len(transactions)} transactions in alternative path")
                            break
                
                # If we found transactions, process them
                if transactions:
                    # Sort transactions by timestamp if possible
                    try:
                        # First, ensure all transactions have a numeric timestamp
                        for txn in transactions:
                            if "blockTime" in txn and isinstance(txn["blockTime"], str):
                                try:
                                    # Convert ISO format to timestamp
                                    if "T" in txn["blockTime"]:
                                        from datetime import datetime
                                        dt = datetime.fromisoformat(txn["blockTime"].replace("Z", "+00:00"))
                                        txn["timestamp_numeric"] = dt.timestamp()
                                    else:
                                        txn["timestamp_numeric"] = float(txn["blockTime"])
                                except (ValueError, TypeError):
                                    txn["timestamp_numeric"] = 0
                            elif "blockTime" in txn:
                                txn["timestamp_numeric"] = float(txn["blockTime"])
                            elif "timestamp" in txn:
                                if isinstance(txn["timestamp"], str):
                                    try:
                                        if "T" in txn["timestamp"]:
                                            from datetime import datetime
                                            dt = datetime.fromisoformat(txn["timestamp"].replace("Z", "+00:00"))
                                            txn["timestamp_numeric"] = dt.timestamp()
                                        else:
                                            txn["timestamp_numeric"] = float(txn["timestamp"])
                                    except (ValueError, TypeError):
                                        txn["timestamp_numeric"] = 0
                                else:
                                    txn["timestamp_numeric"] = float(txn["timestamp"])
                            else:
                                txn["timestamp_numeric"] = 0
                        
                        # Sort by timestamp_numeric in descending order (newest first)
                        transactions.sort(key=lambda x: x.get("timestamp_numeric", 0), reverse=True)
                        self.logger.info(f"Sorted {len(transactions)} transactions by timestamp")
                    except Exception as e:
                        self.logger.error(f"Error sorting transactions: {e}")
                    
                    # Process transactions for display
                    for txn in transactions[:100]:  # Process more transactions for analysis
                        # Extract transaction data
                        tx_details = self._extract_transaction_details(txn)
                        if tx_details:
                            recent_txns.append(tx_details)
                    
                    self.logger.info(f"Extracted {len(recent_txns)} formatted transactions")
                    
                    # Calculate risk score based on transaction patterns
                    try:
                        # Only calculate if we have enough transactions
                        if len(transactions) >= 5:
                            # 1. Transaction frequency (0-40 points)
                            # Count transactions in the last 30 days
                            recent_tx_count = sum(1 for t in transactions if t.get("timestamp_numeric", 0) > thirty_days_ago_timestamp)
                            tx_frequency_score = min(40, int(recent_tx_count * 0.8))
                            
                            # 2. Token diversity (0-30 points)
                            # Count unique tokens in transactions
                            unique_tokens = set()
                            for t in transactions[:50]:  # Look at last 50 transactions
                                token_symbol = None
                                # Try different fields that might contain the token symbol
                                for field in ["symbol", "tokenSymbol", "token"]:
                                    if field in t:
                                        token_symbol = t[field]
                                        break
                                
                                # Also check in balanceChange if it exists
                                if "balanceChange" in t and isinstance(t["balanceChange"], list):
                                    for change in t["balanceChange"]:
                                        if "symbol" in change:
                                            token_symbol = change["symbol"]
                                
                                if token_symbol:
                                    unique_tokens.add(token_symbol)
                            
                            # More unique tokens = higher risk
                            token_diversity_score = min(30, len(unique_tokens) * 3)
                            
                            # 3. Transaction size volatility (0-30 points)
                            # Calculate coefficient of variation of transaction values
                            tx_values = []
                            for t in transactions[:20]:  # Look at last 20 transactions
                                value = 0
                                # Try to extract value from different possible fields
                                for field in ["value", "usdValue", "amountUsd"]:
                                    if field in t and t[field]:
                                        try:
                                            value = float(t[field])
                                            break
                                        except (ValueError, TypeError):
                                            pass
                                
                                # Also check in balanceChange if it exists
                                if value == 0 and "balanceChange" in t and isinstance(t["balanceChange"], list):
                                    for change in t["balanceChange"]:
                                        if "usdValue" in change:
                                            try:
                                                value += abs(float(change["usdValue"]))
                                            except (ValueError, TypeError):
                                                pass
                                
                                if value > 0:
                                    tx_values.append(value)
                            
                            volatility_score = 0
                            if tx_values and len(tx_values) >= 3:
                                mean_value = sum(tx_values) / len(tx_values)
                                if mean_value > 0:
                                    std_dev = (sum((v - mean_value) ** 2 for v in tx_values) / len(tx_values)) ** 0.5
                                    cv = std_dev / mean_value  # Coefficient of variation
                                    volatility_score = min(30, int(cv * 100))
                            
                            # Combine scores
                            risk_score = tx_frequency_score + token_diversity_score + volatility_score
                            self.logger.info(f"Risk score components: frequency={tx_frequency_score}, diversity={token_diversity_score}, volatility={volatility_score}")
                        else:
                            # Not enough transactions to calculate a meaningful risk score
                            risk_score = 50  # Default medium risk
                            self.logger.info(f"Not enough transactions ({len(transactions)}) to calculate risk score, using default")
                    except Exception as e:
                        self.logger.error(f"Error calculating risk score: {e}")
                        risk_score = 50  # Default on error
                else:
                    self.logger.warning(f"No transactions found in response. Response structure: {list(txn_data.keys())}")
            else:
                self.logger.warning(f"Birdeye API returned unsuccessful response: {data.get('success', False)}")
            
            return {
                "recentTransactions": recent_txns[:15],  # Return more recent transactions
                "riskScore": risk_score
            }
        except Exception as e:
            self.logger.error(f"Error fetching wallet transactions: {e}")
            self.logger.exception("Exception details:")
            return {
                "recentTransactions": [],
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
        
    def _extract_transaction_details(self, txn: Dict) -> Optional[Dict]:
        """Extract relevant details from a transaction"""
        try:
            # Initialize with default values
            tx_details = {
                "type": "Unknown",
                "symbol": "Unknown",
                "value": 0,
                "timestamp": 0
            }
            
            # Extract transaction type
            for type_field in ["type", "txType", "transactionType", "mainAction"]:
                if type_field in txn and txn[type_field]:
                    tx_details["type"] = txn[type_field]
                    break
            
            # Extract symbol
            symbol = None
            # Try direct symbol fields
            for symbol_field in ["symbol", "tokenSymbol", "token"]:
                if symbol_field in txn and txn[symbol_field]:
                    symbol = txn[symbol_field]
                    break
            
            # If no symbol found, check balanceChange
            if not symbol and "balanceChange" in txn and isinstance(txn["balanceChange"], list) and txn["balanceChange"]:
                # Use the symbol from the first balance change with the largest value
                max_value = 0
                for change in txn["balanceChange"]:
                    if "symbol" in change and change["symbol"]:
                        try:
                            value = abs(float(change.get("usdValue", 0)))
                            if value > max_value:
                                max_value = value
                                symbol = change["symbol"]
                        except (ValueError, TypeError):
                            pass
            
            if symbol:
                tx_details["symbol"] = symbol
            
            # Extract value
            value = 0
            # Try direct value fields
            for value_field in ["usdValue", "value", "valueUsd", "amountUsd", "amount_usd"]:
                if value_field in txn and txn[value_field]:
                    try:
                        value = float(txn[value_field])
                        break
                    except (ValueError, TypeError):
                        pass
            
            # If no value found, sum balanceChange values
            if value == 0 and "balanceChange" in txn and isinstance(txn["balanceChange"], list):
                for change in txn["balanceChange"]:
                    if "usdValue" in change:
                        try:
                            value += abs(float(change["usdValue"]))
                        except (ValueError, TypeError):
                            pass
            
            tx_details["value"] = value
            
            # Extract timestamp
            timestamp = txn.get("timestamp_numeric", 0)
            if timestamp == 0:
                # Try to get timestamp from other fields
                for time_field in ["timestamp", "blockTime", "time", "date", "block_time"]:
                    if time_field in txn and txn[time_field]:
                        try:
                            if isinstance(txn[time_field], str):
                                # Try to parse ISO format
                                if "T" in txn[time_field]:
                                    from datetime import datetime
                                    dt = datetime.fromisoformat(txn[time_field].replace("Z", "+00:00"))
                                    timestamp = dt.timestamp()
                                else:
                                    timestamp = float(txn[time_field])
                            else:
                                timestamp = float(txn[time_field])
                            break
                        except (ValueError, TypeError):
                            pass
            
            tx_details["timestamp"] = timestamp
            
            # Add transaction hash if available
            for hash_field in ["txHash", "signature", "tx_hash", "id"]:
                if hash_field in txn and txn[hash_field]:
                    tx_details["txHash"] = txn[hash_field]
                    break
            
            # Add fee if available
            if "fee" in txn:
                try:
                    tx_details["fee"] = float(txn["fee"]) / 1e9  # Convert lamports to SOL
                except (ValueError, TypeError):
                    pass
            
            # Add status if available
            if "status" in txn:
                tx_details["status"] = "success" if txn["status"] else "failed"
            
            return tx_details
        except Exception as e:
            self.logger.error(f"Error extracting transaction details: {e}")
            return None

        
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
    
        # Try to get X username from different possible field names
        x_username = fields.get("xUsername", fields.get("X", ""))
    
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
            self.logger.info(f"Using X username: {x_username}")
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

def generate_kol_image(kol_data: Dict[str, Any], output_dir: str = "public/kol_images") -> Optional[str]:
    """
    Generate a 3:4 image for a KOL with all the specified elements
    
    Args:
        kol_data: Dictionary containing KOL data
        output_dir: Directory to save the generated image
        
    Returns:
        Path to the generated image or None if generation failed
    """
    try:
        # Create output directory if it doesn't exist
        os.makedirs(output_dir, exist_ok=True)
        
        # Extract KOL data
        name = kol_data.get("name", "Unknown KOL")
        x_username = kol_data.get("xUsername", "").replace("@", "")
        profile_pic_url = kol_data.get("profilePicture", "")
        influence_score = kol_data.get("influenceScore", 0)
        profile_type = kol_data.get("profile", "Unknown")
        analysis = kol_data.get("analysis", "No analysis available")
        insights = kol_data.get("insights", "")
        
        # Extract insights as a list
        if isinstance(insights, str):
            # Split by newlines or bullet points
            insights_list = [line.strip().lstrip('•').strip() for line in insights.split('\n') if line.strip()]
        elif isinstance(insights, list):
            insights_list = insights
        else:
            insights_list = ["No insights available"]
        
        # Get top 3 insights
        top_insights = insights_list[:3]
        
        # Extract holdings data for pie chart
        holdings = kol_data.get("holdings", [])
        
        # Create a 3:4 aspect ratio image (width:height)
        width, height = 1200, 1600
        img = Image.new('RGB', (width, height), color=(13, 13, 13))  # Dark background
        draw = ImageDraw.Draw(img)
        
        # Load fonts
        try:
            # Try to load custom fonts
            title_font = ImageFont.truetype("arial.ttf", 60)
            subtitle_font = ImageFont.truetype("arial.ttf", 40)
            body_font = ImageFont.truetype("arial.ttf", 30)
            small_font = ImageFont.truetype("arial.ttf", 24)
        except IOError:
            # Fallback to default font
            title_font = ImageFont.load_default()
            subtitle_font = ImageFont.load_default()
            body_font = ImageFont.load_default()
            small_font = ImageFont.load_default()
        
        # Load Kinkong's head
        try:
            kong_img = Image.open("public/copilot.png").convert("RGBA")
            # Resize to appropriate size
            kong_size = (200, 200)
            kong_img = kong_img.resize(kong_size, Image.LANCZOS)
            
            # Create a circular mask
            mask = Image.new('L', kong_size, 0)
            mask_draw = ImageDraw.Draw(mask)
            mask_draw.ellipse((0, 0, kong_size[0], kong_size[1]), fill=255)
            
            # Apply mask to create circular image
            kong_circular = Image.new('RGBA', kong_size, (0, 0, 0, 0))
            kong_circular.paste(kong_img, (0, 0), mask)
            
            # Paste Kong's head in top right corner
            img.paste(kong_circular, (width - 220, 20), kong_circular)
        except Exception as e:
            logger.error(f"Error loading Kong image: {e}")
        
        # Try to load profile picture if available
        profile_pic = None
        if profile_pic_url:
            try:
                response = requests.get(profile_pic_url)
                if response.status_code == 200:
                    profile_pic = Image.open(io.BytesIO(response.content)).convert("RGBA")
                    
                    # Resize to appropriate size
                    pic_size = (150, 150)
                    profile_pic = profile_pic.resize(pic_size, Image.LANCZOS)
                    
                    # Create a circular mask
                    mask = Image.new('L', pic_size, 0)
                    mask_draw = ImageDraw.Draw(mask)
                    mask_draw.ellipse((0, 0, pic_size[0], pic_size[1]), fill=255)
                    
                    # Apply mask to create circular image
                    profile_circular = Image.new('RGBA', pic_size, (0, 0, 0, 0))
                    profile_circular.paste(profile_pic, (0, 0), mask)
                    
                    # Paste profile picture
                    img.paste(profile_circular, (width - 400, 40), profile_circular)
            except Exception as e:
                logger.error(f"Error loading profile picture: {e}")
        
        # Draw name in top left
        draw.text((40, 40), name, fill=(255, 215, 0), font=title_font)  # Gold color
        
        # Draw X handle
        if x_username:
            draw.text((40, 110), f"@{x_username}", fill=(120, 120, 120), font=subtitle_font)
        
        # Draw influence score
        score_color = (0, 255, 0) if influence_score >= 70 else (255, 165, 0) if influence_score >= 40 else (255, 0, 0)
        draw.text((width - 220, 230), f"Influence: {influence_score}", fill=score_color, font=subtitle_font)
        
        # Draw profile type
        draw.text((40, 180), f"Profile: {profile_type}", fill=(255, 255, 255), font=subtitle_font)
        
        # Draw horizontal line
        draw.line([(40, 250), (width - 40, 250)], fill=(255, 215, 0), width=2)
        
        # Draw analysis summary
        # Wrap text to fit width
        max_width = width - 80
        lines = []
        words = analysis.split()
        current_line = words[0]
        
        for word in words[1:]:
            test_line = current_line + " " + word
            # Estimate text width (this is approximate)
            if len(test_line) * 15 < max_width:  # Approximate character width
                current_line = test_line
            else:
                lines.append(current_line)
                current_line = word
        
        lines.append(current_line)
        
        # Draw wrapped text
        y_position = 280
        for line in lines[:6]:  # Limit to 6 lines
            draw.text((40, y_position), line, fill=(255, 255, 255), font=body_font)
            y_position += 40
        
        # Draw asset allocation pie chart
        if holdings:
            try:
                # Create a figure for the pie chart
                fig, ax = plt.subplots(figsize=(5, 5), facecolor='none')
                
                # Prepare data for pie chart
                labels = []
                sizes = []
                others_value = 0
                
                # Get top 5 holdings by value
                sorted_holdings = sorted(holdings, key=lambda x: x.get('value', 0), reverse=True)
                for i, holding in enumerate(sorted_holdings):
                    if i < 5:  # Top 5 holdings
                        labels.append(holding.get('symbol', 'Unknown'))
                        sizes.append(holding.get('value', 0))
                    else:  # Group the rest as "Others"
                        others_value += holding.get('value', 0)
                
                if others_value > 0:
                    labels.append('Others')
                    sizes.append(others_value)
                
                # Create pie chart
                ax.pie(sizes, labels=labels, autopct='%1.1f%%', startangle=90, 
                       textprops={'color': 'white', 'fontsize': 12})
                ax.axis('equal')  # Equal aspect ratio ensures that pie is drawn as a circle
                plt.title('Asset Allocation', color='white', fontsize=14)
                
                # Save pie chart to buffer
                buf = io.BytesIO()
                plt.savefig(buf, format='png', transparent=True, bbox_inches='tight')
                buf.seek(0)
                plt.close(fig)
                
                # Open the image from buffer
                pie_img = Image.open(buf).convert('RGBA')
                
                # Resize if needed
                pie_size = (500, 500)
                pie_img = pie_img.resize(pie_size, Image.LANCZOS)
                
                # Paste pie chart
                img.paste(pie_img, (width - 550, y_position), pie_img)
            except Exception as e:
                logger.error(f"Error creating pie chart: {e}")
        
        # Draw insights
        insights_y = y_position + 520
        draw.text((40, insights_y), "Key Insights:", fill=(255, 215, 0), font=subtitle_font)
        
        for i, insight in enumerate(top_insights):
            draw.text((60, insights_y + 60 + i*50), f"• {insight}", fill=(255, 255, 255), font=body_font)
        
        # Draw footer
        footer_y = height - 80
        draw.line([(40, footer_y), (width - 40, footer_y)], fill=(255, 215, 0), width=2)
        
        # Draw date
        current_date = datetime.now().strftime("%Y-%m-%d")
        draw.text((40, footer_y + 20), current_date, fill=(150, 150, 150), font=small_font)
        
        # Draw powered by text
        powered_by = "Powered by Kong.ai & $UBC • NFA"
        draw.text((width - 400, footer_y + 20), powered_by, fill=(150, 150, 150), font=small_font)
        
        # Save the image
        safe_name = "".join(c for c in name if c.isalnum() or c in (' ', '_')).replace(' ', '_')
        output_path = os.path.join(output_dir, f"{safe_name}.png")
        img.save(output_path)
        
        logger.info(f"Generated KOL image: {output_path}")
        return output_path
    
    except Exception as e:
        logger.error(f"Error generating KOL image: {e}")
        logger.exception("Exception details:")
        return None

def generate_all_kol_images():
    """Generate images for all KOLs in the database"""
    try:
        analyzer = KOLAnalyzer()
        kol_records = analyzer.get_all_kols()
        
        if not kol_records:
            logger.warning("No KOL records found")
            return
        
        logger.info(f"Generating images for {len(kol_records)} KOLs")
        
        for record in kol_records:
            try:
                # Extract fields from record
                fields = record['fields']
                
                # Create data dictionary for image generation
                kol_data = {
                    "name": fields.get("X", "Unknown KOL"),
                    "xUsername": fields.get("xUsername", ""),
                    "profilePicture": fields.get("profilePicture", ""),
                    "influenceScore": fields.get("influenceScore", 0),
                    "profile": fields.get("profile", "Unknown"),
                    "analysis": fields.get("analysis", "No analysis available"),
                    "insights": fields.get("insights", ""),
                    "holdings": []
                }
                
                # Parse holdings JSON if available
                if "holdingsJSON" in fields and fields["holdingsJSON"]:
                    try:
                        kol_data["holdings"] = json.loads(fields["holdingsJSON"])
                    except json.JSONDecodeError:
                        logger.warning(f"Invalid holdings JSON for {kol_data['name']}")
                
                # Generate image
                image_path = generate_kol_image(kol_data)
                
                if image_path:
                    logger.info(f"Generated image for {kol_data['name']}: {image_path}")
                else:
                    logger.warning(f"Failed to generate image for {kol_data['name']}")
            
            except Exception as e:
                logger.error(f"Error processing KOL record: {e}")
                continue
        
        logger.info("KOL image generation completed")
    
    except Exception as e:
        logger.error(f"Error in generate_all_kol_images: {e}")

def generate_kol_image_by_name(kol_name: str):
    """Generate image for a specific KOL by name"""
    try:
        analyzer = KOLAnalyzer()
        kol_records = analyzer.get_all_kols()
        
        if not kol_records:
            logger.warning("No KOL records found")
            return
        
        # Find the KOL by name
        matching_records = [r for r in kol_records if r['fields'].get('X', '').lower() == kol_name.lower()]
        
        if not matching_records:
            logger.warning(f"No KOL found with name: {kol_name}")
            return
        
        record = matching_records[0]
        fields = record['fields']
        
        # Create data dictionary for image generation
        kol_data = {
            "name": fields.get("X", "Unknown KOL"),
            "xUsername": fields.get("xUsername", ""),
            "profilePicture": fields.get("profilePicture", ""),
            "influenceScore": fields.get("influenceScore", 0),
            "profile": fields.get("profile", "Unknown"),
            "analysis": fields.get("analysis", "No analysis available"),
            "insights": fields.get("insights", ""),
            "holdings": []
        }
        
        # Parse holdings JSON if available
        if "holdingsJSON" in fields and fields["holdingsJSON"]:
            try:
                kol_data["holdings"] = json.loads(fields["holdingsJSON"])
            except json.JSONDecodeError:
                logger.warning(f"Invalid holdings JSON for {kol_data['name']}")
        
        # Generate image
        image_path = generate_kol_image(kol_data)
        
        if image_path:
            logger.info(f"Generated image for {kol_data['name']}: {image_path}")
            return image_path
        else:
            logger.warning(f"Failed to generate image for {kol_data['name']}")
            return None
    
    except Exception as e:
        logger.error(f"Error in generate_kol_image_by_name: {e}")
        return None

async def main():
    try:
        # Parse command line arguments
        parser = argparse.ArgumentParser(description='KOL Analyzer and Image Generator')
        parser.add_argument('--analyze', action='store_true', help='Analyze all KOLs')
        parser.add_argument('--generate-images', action='store_true', help='Generate images for all KOLs')
        parser.add_argument('--generate-image', type=str, help='Generate image for a specific KOL by name')
        parser.add_argument('--test-wallet', type=str, help='Test Birdeye API with a specific wallet')
        
        args = parser.parse_args()
        
        # Initialize analyzer
        analyzer = KOLAnalyzer()
        
        # Test Birdeye API with a specific wallet
        if args.test_wallet:
            analyzer.test_birdeye_api(args.test_wallet)
            return
        
        # Generate image for a specific KOL
        if args.generate_image:
            logger.info(f"Generating image for KOL: {args.generate_image}")
            generate_kol_image_by_name(args.generate_image)
            return
        
        # Generate images for all KOLs
        if args.generate_images:
            logger.info("Generating images for all KOLs")
            generate_all_kol_images()
            return
        
        # Default: analyze all KOLs
        if args.analyze or not any([args.generate_images, args.generate_image, args.test_wallet]):
            logger.info("Analyzing all KOLs")
            await analyzer.analyze_all_kols()
    
    except Exception as e:
        logging.error(f"Error in main execution: {e}")

if __name__ == "__main__":
    asyncio.run(main())
