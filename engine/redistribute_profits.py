#!/usr/bin/env python3
import os
import json
import sys
import requests
from datetime import datetime, timezone, timedelta
from airtable import Airtable
from dotenv import load_dotenv

# Import the WalletSnapshotTaker class from wallet_snapshots.py
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from engine.wallet_snapshots import WalletSnapshotTaker

def setup_logging():
    """Set up basic logging configuration"""
    import logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[logging.StreamHandler()]
    )
    return logging.getLogger('redistribute_profits')

class ProfitRedistributor:
    def __init__(self):
        # Load environment variables from .env file
        load_dotenv(dotenv_path=os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env'))
        self.logger = setup_logging()
        
        # Initialize Airtable
        self.base_id = os.getenv('KINKONG_AIRTABLE_BASE_ID')
        self.api_key = os.getenv('KINKONG_AIRTABLE_API_KEY')
        
        if not self.base_id or not self.api_key:
            raise ValueError("Missing Airtable credentials in environment variables")
        
        # Initialize Airtable tables
        self.snapshots_table = Airtable(
            self.base_id,
            'WALLET_SNAPSHOTS',
            self.api_key
        )
        
        self.investments_table = Airtable(
            self.base_id,
            'INVESTMENTS',
            self.api_key
        )
        
        # Initialize WalletSnapshotTaker for taking a new snapshot if needed
        self.snapshot_taker = WalletSnapshotTaker()
        
    def get_compute_price_from_meteora(self):
        """Helper function to get COMPUTE price from Meteora pool"""
        self.logger.info("Fetching COMPUTE price from Meteora pool")
        compute_price = None
        
        try:
            meteora_pool_id = "HN7ibjiyX399d1EfYXcWaSHZRSMfUmonYvXGFXG41Rr3"
            
            # First try Birdeye API for Meteora pool
            birdeye_url = "https://public-api.birdeye.so/v1/pool/price"
            params = {
                "pool_address": meteora_pool_id
            }
            headers = {
                "x-api-key": os.getenv('BIRDEYE_API_KEY'),
                "x-chain": "solana",
                "accept": "application/json"
            }
            
            try:
                response = requests.get(birdeye_url, params=params, headers=headers)
                
                # Check if we have a valid response with content
                if response.status_code == 200 and response.content and len(response.content.strip()) > 0:
                    try:
                        pool_data = response.json()
                        
                        if pool_data.get('success'):
                            compute_price = float(pool_data.get('data', {}).get('price', 0))
                            self.logger.info(f"COMPUTE price from Birdeye: ${compute_price:.6f}")
                        else:
                            self.logger.warning(f"Failed to get COMPUTE price from Birdeye: {pool_data.get('message')}")
                    except json.JSONDecodeError as e:
                        self.logger.warning(f"Invalid JSON response from Birdeye: {e}")
                        self.logger.debug(f"Response content: {response.content[:100]}...")
                else:
                    self.logger.warning(f"Failed to get COMPUTE price from Birdeye: Status {response.status_code}, Content length: {len(response.content) if response.content else 0}")
            except requests.exceptions.RequestException as e:
                self.logger.warning(f"Request error from Birdeye: {e}")
                
            # If Birdeye fails, try DexScreener
            if not compute_price:
                try:
                    dexscreener_url = f"https://api.dexscreener.com/latest/dex/pools/solana/{meteora_pool_id}"
                    
                    response = requests.get(dexscreener_url, timeout=10)
                    
                    if response.status_code == 200 and response.content and len(response.content.strip()) > 0:
                        try:
                            data = response.json()
                            
                            if data.get('pairs') and len(data['pairs']) > 0:
                                compute_pair = data['pairs'][0]
                                
                                if compute_pair and compute_pair.get('priceUsd'):
                                    compute_price = float(compute_pair['priceUsd'])
                                    self.logger.info(f"COMPUTE price from DexScreener: ${compute_price:.6f}")
                            else:
                                self.logger.warning("No pairs found for COMPUTE token on DexScreener")
                        except json.JSONDecodeError as e:
                            self.logger.warning(f"Invalid JSON response from DexScreener: {e}")
                    else:
                        self.logger.warning(f"Failed to get COMPUTE price from DexScreener: Status {response.status_code}")
                except Exception as e:
                    self.logger.warning(f"Error fetching from DexScreener: {e}")
            
            # If both Birdeye and DexScreener fail, try Jupiter API
            if not compute_price:
                try:
                    compute_mint = "B1N1HcMm4RysYz4smsXwmk2UnS8NziqKCM6Ho8i62vXo"
                    jupiter_url = "https://price.jup.ag/v4/price"
                    jupiter_params = {
                        "ids": compute_mint
                    }
                    
                    jupiter_response = requests.get(jupiter_url, params=jupiter_params, timeout=10)
                    
                    if jupiter_response.status_code == 200 and jupiter_response.content and len(jupiter_response.content.strip()) > 0:
                        try:
                            jupiter_data = jupiter_response.json()
                            
                            if jupiter_data.get('data') and jupiter_data['data'].get(compute_mint):
                                compute_price = float(jupiter_data['data'][compute_mint].get('price', 0))
                                self.logger.info(f"COMPUTE price from Jupiter: ${compute_price:.6f}")
                        except json.JSONDecodeError as e:
                            self.logger.warning(f"Invalid JSON response from Jupiter: {e}")
                    else:
                        self.logger.warning(f"Failed to get COMPUTE price from Jupiter: Status {jupiter_response.status_code}")
                except Exception as e:
                    self.logger.warning(f"Error fetching from Jupiter: {e}")
            
            # If all methods fail, try to get price from wallet snapshot
            if not compute_price:
                try:
                    self.logger.info("Trying to get COMPUTE price from latest wallet snapshot")
                    latest_snapshot = self.get_snapshot_by_date(datetime.now(timezone.utc))
                    
                    if latest_snapshot and 'holdings' in latest_snapshot['fields']:
                        try:
                            holdings = json.loads(latest_snapshot['fields']['holdings'])
                            for holding in holdings:
                                if holding.get('token') == 'COMPUTE':
                                    compute_price = float(holding.get('price', 0))
                                    self.logger.info(f"COMPUTE price from wallet snapshot: ${compute_price:.6f}")
                                    break
                        except (json.JSONDecodeError, ValueError) as e:
                            self.logger.warning(f"Error parsing holdings from snapshot: {e}")
                except Exception as e:
                    self.logger.warning(f"Error getting price from wallet snapshot: {e}")
            
            # If still no price, try getting from the snapshot taker's token balances
            if not compute_price:
                try:
                    self.logger.info("Using snapshot taker to get COMPUTE price")
                    token_balances = self.snapshot_taker.get_token_balances()
                    
                    for balance in token_balances:
                        if balance.get('symbol') == 'COMPUTE':
                            compute_price = float(balance.get('priceUsd', 0))
                            self.logger.info(f"COMPUTE price from wallet balances: ${compute_price:.6f}")
                            break
                except Exception as e:
                    self.logger.warning(f"Error getting price from snapshot taker: {e}")
            
            return compute_price
        except Exception as e:
            self.logger.error(f"Error in get_compute_price_from_meteora: {e}")
            return None
        
    def get_snapshot_by_date(self, target_date):
        """Get the closest wallet snapshot to the target date"""
        self.logger.info(f"Finding snapshot closest to {target_date.isoformat()}")
        
        # Query snapshots sorted by createdAt
        snapshots = self.snapshots_table.get_all(
            sort=[('createdAt', 'asc')]
        )
        
        if not snapshots:
            self.logger.warning("No snapshots found in the database")
            return None
        
        # Convert target_date to timestamp for comparison
        target_timestamp = target_date.timestamp()
        
        # Find the closest snapshot to the target date
        closest_snapshot = None
        min_diff = float('inf')
        
        for snapshot in snapshots:
            created_at = snapshot['fields'].get('createdAt')
            if not created_at:
                continue
                
            # Parse the ISO timestamp
            try:
                snapshot_date = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
                diff = abs(snapshot_date.timestamp() - target_timestamp)
                
                if diff < min_diff:
                    min_diff = diff
                    closest_snapshot = snapshot
            except (ValueError, TypeError) as e:
                self.logger.warning(f"Error parsing date {created_at}: {e}")
                continue
        
        if closest_snapshot:
            snapshot_date = datetime.fromisoformat(
                closest_snapshot['fields']['createdAt'].replace('Z', '+00:00')
            )
            self.logger.info(f"Found closest snapshot from {snapshot_date.isoformat()}")
            return closest_snapshot
        
        return None
    
    def get_investment_change(self, start_date, end_date):
        """Get net investment change between two dates with proper token price conversion"""
        self.logger.info(f"Fetching investment changes between {start_date.isoformat()} and {end_date.isoformat()}")
        
        try:
            # Query for investments in the date range
            investments = self.investments_table.get_all(
                formula=f"AND(IS_AFTER({{createdAt}}, '{start_date.isoformat()}'), IS_BEFORE({{createdAt}}, '{end_date.isoformat()}'))"
            )
            
            net_change_usd = 0.0
            
            # Get current token prices
            token_prices = self.get_token_prices()
            
            # Log token prices for debugging
            for token, price in token_prices.items():
                self.logger.info(f"Using price for {token}: ${price:.6f}")
            
            for investment in investments:
                try:
                    amount = float(investment['fields'].get('amount', 0))
                    token_symbol = investment['fields'].get('token', 'USDC').upper()
                    
                    # Convert token amount to USD based on token type
                    if token_symbol == 'USDC' or token_symbol == 'USDT':
                        # Stablecoins are 1:1 with USD
                        amount_usd = amount
                    elif token_symbol in token_prices:
                        # Use fetched price for other tokens
                        amount_usd = amount * token_prices[token_symbol]
                        self.logger.info(f"Converting {amount} {token_symbol} at price ${token_prices[token_symbol]:.6f}")
                    else:
                        # Default to 0 if price not available
                        self.logger.warning(f"No price available for token {token_symbol}, using 0 USD value")
                        amount_usd = 0
                    
                    net_change_usd += amount_usd
                    self.logger.info(f"Found investment change: {amount} {token_symbol} = ${amount_usd:.2f}")
                except (ValueError, TypeError) as e:
                    self.logger.warning(f"Error processing investment {investment.get('id')}: {e}")
            
            self.logger.info(f"Total net investment change in USD: ${net_change_usd:.2f}")
            
            return net_change_usd
        except Exception as e:
            self.logger.error(f"Error fetching investment changes: {e}")
            # Return zero if we can't get the data
            return 0.0
    
    def get_token_prices(self):
        """Get current prices for relevant tokens"""
        self.logger.info("Fetching current token prices")
        
        token_prices = {
            'USDC': 1.0,  # Stablecoins are 1:1 with USD
            'USDT': 1.0
        }
        
        # Fetch UBC price from DexScreener
        try:
            ubc_mint = "9psiRdn9cXYVps4F1kFuoNjd2EtmqNJXrCPmRppJpump"
            dexscreener_url = f"https://api.dexscreener.com/latest/dex/tokens/{ubc_mint}"
            
            response = requests.get(dexscreener_url)
            response.raise_for_status()
            data = response.json()
            
            if data.get('pairs') and len(data['pairs']) > 0:
                # Get the first pair with USDC or USDT (stablecoin pair)
                ubc_pair = None
                for pair in data['pairs']:
                    # Look for USDC or USDT pair
                    if 'USDC' in pair.get('quoteToken', {}).get('symbol', '') or 'USDT' in pair.get('quoteToken', {}).get('symbol', ''):
                        ubc_pair = pair
                        break
                
                # If no USDC/USDT pair, just use the first pair
                if not ubc_pair and len(data['pairs']) > 0:
                    ubc_pair = data['pairs'][0]
                
                if ubc_pair and ubc_pair.get('priceUsd'):
                    token_prices['UBC'] = float(ubc_pair['priceUsd'])
                    self.logger.info(f"UBC price: ${token_prices['UBC']:.6f}")
            else:
                self.logger.warning("No pairs found for UBC token")
        except Exception as e:
            self.logger.error(f"Error fetching UBC price: {e}")
        
        # Fetch COMPUTE price using the helper function
        compute_price = self.get_compute_price_from_meteora()
        if compute_price:
            token_prices['COMPUTE'] = compute_price
            self.logger.info(f"COMPUTE price set: ${token_prices['COMPUTE']:.6f}")
        else:
            # If all methods fail, use a fallback price to avoid zero values
            # This is a last resort to prevent investments from being valued at $0
            fallback_price = 0.0001  # Very small fallback price
            token_prices['COMPUTE'] = fallback_price
            self.logger.warning(f"Using fallback price for COMPUTE: ${fallback_price}")
        
        # Log all token prices
        self.logger.info(f"Token prices: {token_prices}")
        
        return token_prices
            
    def get_total_investments_value(self, date=None):
        """Get the total value of all investments at a given date"""
        self.logger.info(f"Calculating total investments value {date and 'as of ' + date.isoformat() or 'current'}")
        
        # If no date is provided, get current investments
        if not date:
            investments = self.investments_table.get_all()
            total_value = sum(float(inv['fields'].get('amount', 0)) for inv in investments)
            self.logger.info(f"Current total investments value: ${total_value:.2f}")
            return total_value
        
        # For historical data, we would need a snapshot of investments
        # This is a simplified approach - in a real system, you might have investment snapshots
        # For now, we'll use the current investments as an approximation
        self.logger.warning("Historical investment data not available, using current as approximation")
        return self.get_total_investments_value()
    
    def calculate_profit_distribution(self):
        """Calculate profit over the last 7 days and distribute it"""
        self.logger.info("Calculating profit distribution for the last 7 days")
        
        # Take a new snapshot to ensure we have the latest data
        self.logger.info("Taking a new wallet snapshot")
        self.snapshot_taker.take_snapshot()
        
        # Get current date and date 7 days ago
        now = datetime.now(timezone.utc)
        seven_days_ago = now - timedelta(days=7)
        
        # Get snapshots closest to now and 7 days ago
        current_snapshot = self.get_snapshot_by_date(now)
        past_snapshot = self.get_snapshot_by_date(seven_days_ago)
        
        if not current_snapshot or not past_snapshot:
            self.logger.error("Could not find required snapshots")
            return None
        
        # Extract total values from snapshots
        current_wallet_value = float(current_snapshot['fields'].get('totalValue', 0))
        past_wallet_value = float(past_snapshot['fields'].get('totalValue', 0))
        
        # Get net investment change during this period
        net_investment_change = self.get_investment_change(seven_days_ago, now)
        
        # Calculate profit: (Current Value - Past Value - Net Investment Change)
        # If net_investment_change is positive (more money added), we subtract it to get true profit
        # If net_investment_change is negative (money withdrawn), adding it (subtracting a negative) accounts for value taken out
        total_profit = current_wallet_value - past_wallet_value - net_investment_change
        
        # Display the calculation details
        self.logger.info("\n=== Profit Calculation ===")
        self.logger.info(f"Current Wallet Value: ${current_wallet_value:.2f}")
        self.logger.info(f"Past Wallet Value (7 days ago): ${past_wallet_value:.2f}")
        self.logger.info(f"Net Investment Change: ${net_investment_change:.2f}")
        self.logger.info(f"Total Profit (7 days): ${total_profit:.2f}")
        
        # Calculate distribution pools
        if total_profit <= 0:
            self.logger.warning("No profit to distribute")
            return {
                "total_profit": total_profit,
                "pool_1": 0,  # 25% pool
                "pool_2": 0,   # 75% pool
                "fees": 0      # 3% fees
            }
    
        # Calculate 3% fee from total profit
        fees = total_profit * 0.03
    
        # Calculate remaining profit after fees
        profit_after_fees = total_profit - fees
    
        # Calculate distribution pools from remaining profit
        pool_1 = profit_after_fees * 0.25  # 25% pool
        pool_2 = profit_after_fees * 0.75  # 75% pool
    
        self.logger.info("\n=== Profit Distribution ===")
        self.logger.info(f"Total Profit (7 days): ${total_profit:.2f}")
        self.logger.info(f"Fees (3%): ${fees:.2f}")
        self.logger.info(f"Profit After Fees: ${profit_after_fees:.2f}")
        self.logger.info(f"Pool 1 (25%): ${pool_1:.2f}")
        self.logger.info(f"Pool 2 (75%): ${pool_2:.2f}")
    
        return {
            "total_profit": total_profit,
            "profit_after_fees": profit_after_fees,
            "fees": fees,
            "pool_1": pool_1,
            "pool_2": pool_2
        }
        
    def calculate_investor_distributions(self):
        """Calculate distribution amounts for each investor based on their current investment value"""
        self.logger.info("Calculating investor distributions from the 75% pool")
        
        try:
            # First calculate the total profit and pools
            profit_distribution = self.calculate_profit_distribution()
            
            if not profit_distribution or profit_distribution['total_profit'] <= 0:
                self.logger.warning("No profit to distribute to investors")
                return []
            
            # Get the 75% pool amount
            pool_75_amount = profit_distribution['pool_2']
            self.logger.info(f"75% Pool amount to distribute: ${pool_75_amount:.2f}")
            
            # Get all investors from the INVESTMENTS table
            investments = self.investments_table.get_all()
            
            # Group investments by wallet
            wallet_investments = {}
            for investment in investments:
                wallet = investment['fields'].get('wallet')
                if not wallet:
                    continue
                    
                amount = float(investment['fields'].get('amount', 0))
                token_symbol = investment['fields'].get('token', 'USDC').upper()
                
                if wallet not in wallet_investments:
                    wallet_investments[wallet] = []
                    
                wallet_investments[wallet].append({
                    'token': token_symbol,
                    'amount': amount,
                    'id': investment['id']
                })
            
            self.logger.info(f"Found {len(wallet_investments)} unique investors")
            
            # Get token prices for conversion to USD
            token_prices = self.get_token_prices()
            
            # Calculate total investment value across all wallets
            total_investment_value_usd = 0
            wallet_investment_values = {}
            
            for wallet, investments in wallet_investments.items():
                wallet_value = 0
                
                for investment in investments:
                    token = investment['token']
                    amount = investment['amount']
                    
                    # Convert token amount to USD
                    if token in token_prices:
                        value_usd = amount * token_prices[token]
                        wallet_value += value_usd
                        self.logger.info(f"Wallet {wallet}: {amount} {token} = ${value_usd:.2f}")
                    else:
                        self.logger.warning(f"No price available for {token}, skipping in calculation")
                
                wallet_investment_values[wallet] = wallet_value
                total_investment_value_usd += wallet_value
                
            self.logger.info(f"Total investment value across all wallets: ${total_investment_value_usd:.2f}")
            
            # Calculate distribution for each wallet based on their percentage of total investment
            distributions = []
            
            for wallet, investment_value in wallet_investment_values.items():
                if total_investment_value_usd > 0:
                    percentage = (investment_value / total_investment_value_usd) * 100
                    distribution_amount = (investment_value / total_investment_value_usd) * pool_75_amount
                    
                    distributions.append({
                        'wallet': wallet,
                        'investment_value': investment_value,
                        'percentage': percentage,
                        'distribution_amount': distribution_amount
                    })
                    
                    self.logger.info(f"Wallet {wallet}: Investment ${investment_value:.2f} ({percentage:.2f}%) → Distribution ${distribution_amount:.2f}")
                
            # Sort distributions by amount (descending)
            distributions.sort(key=lambda x: x['distribution_amount'], reverse=True)
            
            return distributions
        
        except Exception as e:
            self.logger.error(f"Error calculating investor distributions: {e}")
            return []
            
    def send_telegram_notification(self, redistribution_id, investor_data):
        """Send a Telegram notification for an investor redistribution"""
        try:
            self.logger.info(f"Sending Telegram notification for investor: {investor_data['wallet']}")
            
            # Get Telegram bot token and use the specified channel ID
            bot_token = os.getenv('TELEGRAM_BOT_TOKEN')
            chat_id = "-1001699255893"  # Use the specified channel ID
            
            if not bot_token:
                self.logger.warning("Telegram bot token not found in environment variables")
                return False
            
            # Format wallet address for display
            wallet = investor_data['wallet']
            if len(wallet) > 20:
                wallet_display = wallet[:10] + '...' + wallet[-10:]
            else:
                wallet_display = wallet
            
            # Create message text with reordered fields: investor -> UBC amount -> amount
            # Removed the percentage field
            message = f"""🎉 *KinKong Profit Redistribution*
            
📊 *Investor*: `{wallet_display}`
🪙 *UBC Amount*: {investor_data['ubcAmount']:.2f} UBC
💰 *Amount*: ${investor_data['distribution_amount']:.2f}

Status: Pending ⏳
"""
            
            # First send the image
            image_path = "public/copilot.png"
            
            # Check if image exists
            if os.path.exists(image_path):
                # Send photo with caption
                telegram_url = f"https://api.telegram.org/bot{bot_token}/sendPhoto"
                
                # Open and read the image file
                with open(image_path, 'rb') as photo:
                    files = {'photo': photo}
                    payload = {
                        "chat_id": chat_id,
                        "caption": message,
                        "parse_mode": "Markdown"
                    }
                    
                    response = requests.post(telegram_url, data=payload, files=files)
                    response.raise_for_status()
            else:
                # If image doesn't exist, just send the text message
                self.logger.warning(f"Image file not found at {image_path}, sending text-only message")
                telegram_url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
                payload = {
                    "chat_id": chat_id,
                    "text": message,
                    "parse_mode": "Markdown"
                }
                
                response = requests.post(telegram_url, json=payload)
                response.raise_for_status()
            
            self.logger.info(f"Telegram notification sent successfully for {wallet_display}")
            return True
        except Exception as e:
            self.logger.error(f"Error sending Telegram notification: {e}")
            return False
            
    def verify_ubc_balance(self, total_ubc_needed):
        """Verify that there's enough UBC in the wallet to cover the redistribution"""
        self.logger.info(f"Verifying UBC balance for redistribution (need {total_ubc_needed:.2f} UBC)")
        
        try:
            # Get the wallet address from environment variables
            wallet = os.getenv('KINKONG_WALLET')
            if not wallet:
                self.logger.error("KINKONG_WALLET not found in environment variables")
                return False
            
            # Get Birdeye API key
            birdeye_api_key = os.getenv('BIRDEYE_API_KEY')
            if not birdeye_api_key:
                self.logger.error("BIRDEYE_API_KEY not found in environment variables")
                return False
            
            # UBC token mint address
            ubc_mint = "9psiRdn9cXYVps4F1kFuoNjd2EtmqNJXrCPmRppJpump"
            
            # Call Birdeye API to get wallet token list
            url = "https://public-api.birdeye.so/v1/wallet/token_list"
            params = {
                "wallet": wallet
            }
            headers = {
                "x-api-key": birdeye_api_key,
                "x-chain": "solana",
                "accept": "application/json"
            }
            
            response = requests.get(url, params=params, headers=headers)
            response.raise_for_status()
            data = response.json()
            
            if not data.get('success'):
                self.logger.error(f"Birdeye API returned error: {data.get('message', 'Unknown error')}")
                return False
            
            # Find UBC token in the wallet
            ubc_balance = 0
            for token in data.get('data', {}).get('items', []):
                if token.get('address') == ubc_mint:
                    ubc_balance = float(token.get('uiAmount', 0))
                    self.logger.info(f"Found UBC in wallet: {ubc_balance:.2f} UBC")
                    break
            
            # If UBC not found in wallet
            if ubc_balance == 0:
                self.logger.warning("No UBC found in wallet")
                return False
            
            # Check if there's enough UBC
            if ubc_balance >= total_ubc_needed:
                self.logger.info(f"✅ Sufficient UBC balance: {ubc_balance:.2f} UBC (need {total_ubc_needed:.2f} UBC)")
                return True
            else:
                self.logger.warning(f"❌ Insufficient UBC balance: {ubc_balance:.2f} UBC (need {total_ubc_needed:.2f} UBC)")
                return False
            
        except Exception as e:
            self.logger.error(f"Error verifying UBC balance: {e}")
            return False
            
    def save_redistribution_to_airtable(self, profit_distribution, investor_distributions):
        """Save redistribution data to Airtable REDISTRIBUTIONS and INVESTOR_REDISTRIBUTIONS tables"""
        self.logger.info("Saving redistribution data to Airtable")
        
        try:
            # Get token prices to convert USD to UBC
            token_prices = self.get_token_prices()
            ubc_price = token_prices.get('UBC', 0.001)  # Default to 0.001 if UBC price not available
            self.logger.info(f"Using UBC price for conversion: ${ubc_price:.6f}")
            
            # Calculate total UBC needed for all redistributions
            total_ubc_needed = 0
            investor_data_with_ubc = []
            
            for dist in investor_distributions:
                # Convert USD amount to UBC tokens
                ubc_amount = 0
                if ubc_price > 0:
                    ubc_amount = dist['distribution_amount'] / ubc_price
                
                # Add to total UBC needed
                total_ubc_needed += ubc_amount
                
                # Store investor data with UBC amount for later use
                investor_data_with_ubc.append({
                    'wallet': dist['wallet'],
                    'investment_value': dist['investment_value'],
                    'percentage': dist['percentage'],
                    'distribution_amount': dist['distribution_amount'],
                    'ubcAmount': ubc_amount
                })
            
            self.logger.info(f"Total UBC needed for redistribution: {total_ubc_needed:.2f} UBC")
            
            # Verify that there's enough UBC in the wallet
            has_sufficient_ubc = self.verify_ubc_balance(total_ubc_needed)
            
            if not has_sufficient_ubc:
                self.logger.error("Cannot proceed with redistribution due to insufficient UBC balance")
                return None
            
            # Initialize Airtable table for redistributions
            redistributions_table = Airtable(
                self.base_id,
                'REDISTRIBUTIONS',  # Main redistributions table
                self.api_key
            )
            
            # Initialize Airtable table for investor redistributions
            investor_redistributions_table = Airtable(
                self.base_id,
                'INVESTOR_REDISTRIBUTIONS',  # Table for investor-specific redistributions
                self.api_key
            )
            
            # Create a record for the overall redistribution
            now = datetime.now(timezone.utc).isoformat()
            
            # Create the main redistribution record
            main_record = {
                'createdAt': now,
                'totalProfit': profit_distribution['total_profit'],
                'fees': profit_distribution['fees'],
                'profitAfterFees': profit_distribution['profit_after_fees'],
                'pool1Amount': profit_distribution['pool_1'],
                'pool2Amount': profit_distribution['pool_2'],
                'totalUbcAmount': total_ubc_needed,  # Add total UBC amount
                'ubcPrice': ubc_price,  # Add UBC price used for conversion
                'status': 'PENDING',  # Initial status
                'periodStart': (datetime.now(timezone.utc) - timedelta(days=7)).isoformat(),
                'periodEnd': now
            }
            
            # Create the main redistribution record
            main_record_result = redistributions_table.insert(main_record)
            main_record_id = main_record_result['id']
            
            self.logger.info(f"Created main redistribution record with ID: {main_record_id}")
            
            # Now create investor redistribution records
            investor_records = []
            
            # Get all investments for reference
            investments_table = Airtable(
                self.base_id,
                'INVESTMENTS',
                self.api_key
            )
            investments = investments_table.get_all()
            
            for investor_data in investor_data_with_ubc:
                # Get all investments for this wallet
                wallet_investments = [inv for inv in investments if inv['fields'].get('wallet') == investor_data['wallet']]
                
                # If there are investments for this wallet, link the redistribution to them
                if wallet_investments:
                    # Sort investments by amount (descending) to match the largest investment first
                    wallet_investments.sort(key=lambda x: float(x['fields'].get('amount', 0)), reverse=True)
                    investment_id = wallet_investments[0]['id']  # Use the largest investment
                    
                    investor_record = {
                        'fields': {
                            'redistributionId': main_record_id,  # Link to the main redistribution record
                            'wallet': investor_data['wallet'],
                            'investmentId': investment_id,  # Add this field to link to specific investment
                            'investmentValue': investor_data['investment_value'],
                            'percentage': investor_data['percentage'],
                            'amount': investor_data['distribution_amount'],
                            'ubcAmount': investor_data['ubcAmount'],  # Add UBC amount field
                            'status': 'PENDING',  # Initial status
                            'createdAt': now
                        }
                    }
                else:
                    # If no investments found for this wallet, create record without investment ID
                    investor_record = {
                        'fields': {
                            'redistributionId': main_record_id,  # Link to the main redistribution record
                            'wallet': investor_data['wallet'],
                            'investmentValue': investor_data['investment_value'],
                            'percentage': investor_data['percentage'],
                            'amount': investor_data['distribution_amount'],
                            'ubcAmount': investor_data['ubcAmount'],  # Add UBC amount field
                            'status': 'PENDING',  # Initial status
                            'createdAt': now
                        }
                    }
                
                # Insert the record into Airtable
                investor_record_result = investor_redistributions_table.insert(investor_record['fields'])
                
                # Send Telegram notification for this investor
                try:
                    self.send_telegram_notification(main_record_id, investor_data)
                except Exception as e:
                    self.logger.warning(f"Failed to send Telegram notification: {e}")
                
                self.logger.info(f"Wallet {investor_data['wallet']}: ${investor_data['distribution_amount']:.2f} = {investor_data['ubcAmount']:.2f} UBC")
                investor_records.append(investor_record_result)
            
            self.logger.info(f"Created {len(investor_records)} investor redistribution records")
            
            return main_record_id
        except Exception as e:
            self.logger.error(f"Error saving redistribution to Airtable: {e}")
            return None

def main():
    try:
        # Load environment variables from .env file
        load_dotenv(dotenv_path=os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env'))
        
        # Verify environment variables
        required_vars = [
            'KINKONG_AIRTABLE_BASE_ID',
            'KINKONG_AIRTABLE_API_KEY',
            'BIRDEYE_API_KEY',
            'KINKONG_WALLET',
            'TELEGRAM_BOT_TOKEN',
            'TELEGRAM_CHAT_ID'
        ]
        
        missing = [var for var in required_vars if not os.getenv(var)]
        if missing:
            print(f"⚠️ Warning: Missing environment variables: {', '.join(missing)}")
            print("Telegram notifications may not work without TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID")
        
        # Initialize and run profit redistribution
        redistributor = ProfitRedistributor()
        result = redistributor.calculate_profit_distribution()
        
        if result and result['total_profit'] > 0:
            print("\n=== KinKong Profit Redistribution ===")
            print(f"Total Profit (7 days): ${result['total_profit']:.2f}")
            print(f"Fees (3%): ${result['fees']:.2f}")
            print(f"Profit After Fees: ${result['profit_after_fees']:.2f}")
            print(f"Pool 1 (25%): ${result['pool_1']:.2f}")
            print(f"Pool 2 (75%): ${result['pool_2']:.2f}")
            
            # Calculate and display investor distributions
            print("\n=== Investor Distributions ===")
            distributions = redistributor.calculate_investor_distributions()
            
            if distributions:
                print(f"{'Wallet':<42} {'Investment':<12} {'Share':<8} {'Distribution':<12}")
                print("-" * 80)
                
                # Get UBC price for display
                token_prices = redistributor.get_token_prices()
                ubc_price = token_prices.get('UBC', 0.001)
                
                # Calculate total UBC needed
                total_ubc_needed = 0
                
                for dist in distributions:
                    wallet = dist['wallet']
                    # Truncate wallet address for display
                    if len(wallet) > 38:
                        wallet_display = wallet[:18] + "..." + wallet[-17:]
                    else:
                        wallet_display = wallet
                    
                    # Calculate UBC amount
                    ubc_amount = dist['distribution_amount'] / ubc_price if ubc_price > 0 else 0
                    total_ubc_needed += ubc_amount
                    
                    print(f"{wallet_display:<42} ${dist['investment_value']:<11.2f} {dist['percentage']:<7.2f}% ${dist['distribution_amount']:<11.2f}")
                
                # Verify total distribution matches pool amount
                total_distributed = sum(d['distribution_amount'] for d in distributions)
                print("-" * 80)
                print(f"Total Distributed: ${total_distributed:.2f} (should match Pool 2: ${result['pool_2']:.2f})")
                print(f"Total UBC Required: {total_ubc_needed:.2f} UBC (at price ${ubc_price:.6f})")
                
                # Check for rounding errors
                if abs(total_distributed - result['pool_2']) > 0.01:
                    print(f"Warning: Distribution total differs from Pool 2 amount by ${abs(total_distributed - result['pool_2']):.2f}")
                
                # Verify UBC balance
                has_sufficient_ubc = redistributor.verify_ubc_balance(total_ubc_needed)
                if has_sufficient_ubc:
                    print(f"\n✅ UBC Balance Verification: PASSED")
                    
                    # Save redistribution data to Airtable
                    redistribution_id = redistributor.save_redistribution_to_airtable(result, distributions)
                    if redistribution_id:
                        print(f"\n✅ Redistribution saved to Airtable with ID: {redistribution_id}")
                    else:
                        print("\n❌ Failed to save redistribution to Airtable")
                else:
                    print(f"\n❌ UBC Balance Verification: FAILED - Insufficient UBC in wallet")
                    print("Redistribution not saved to Airtable due to insufficient UBC balance")
            else:
                print("No investor distributions calculated")
        else:
            print("No profit to distribute")
        
    except Exception as e:
        print(f"\n❌ Script failed: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()
