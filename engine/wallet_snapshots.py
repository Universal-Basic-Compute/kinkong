import os
import json
from datetime import datetime, timezone, timedelta
import requests
from airtable import Airtable
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv(dotenv_path=os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env'))

class WalletSnapshotTaker:
    def __init__(self):
        self.airtable = Airtable(
            os.getenv('KINKONG_AIRTABLE_BASE_ID'),
            'TOKENS',
            os.getenv('KINKONG_AIRTABLE_API_KEY')
        )
        self.snapshots_table = Airtable(
            os.getenv('KINKONG_AIRTABLE_BASE_ID'),
            'WALLET_SNAPSHOTS',
            os.getenv('KINKONG_AIRTABLE_API_KEY')
        )
        self.birdeye_api_key = os.getenv('BIRDEYE_API_KEY')
        self.wallet = os.getenv('KINKONG_WALLET')

    def get_token_balances(self) -> dict:
        """Get all token balances from Birdeye API"""
        url = "https://public-api.birdeye.so/v1/wallet/token_list"
        params = {
            "wallet": self.wallet
        }
        headers = {
            "x-api-key": self.birdeye_api_key,
            "x-chain": "solana",
            "accept": "application/json"
        }

        try:
            response = requests.get(url, params=params, headers=headers)
            response.raise_for_status()
            data = response.json()
            
            # Debug logging
            print(f"Raw API response:", json.dumps(data, indent=2))
            
            if not data.get('success'):
                raise Exception(f"API returned success=false: {data.get('message', 'No error message')}")
                
            return data.get('data', {}).get('items', [])
            
        except requests.exceptions.RequestException as e:
            print(f"HTTP Request failed: {str(e)}")
            return []
        except Exception as e:
            print(f"Unexpected error: {str(e)}")
            return []

    def get_investment_flow(self, start_date, end_date):
        """
        Calculate the net investment flow between two dates
        Returns the difference between investments and withdrawals
        """
        try:
            # Initialize Airtable connection to INVESTMENTS table
            investments_table = Airtable(
                os.getenv('KINKONG_AIRTABLE_BASE_ID'),
                'INVESTMENTS',
                os.getenv('KINKONG_AIRTABLE_API_KEY')
            )
            
            # Get all investments between the two dates
            records = investments_table.get_all(
                formula=f"AND(IS_AFTER({{createdAt}}, '{start_date}'), IS_BEFORE({{createdAt}}, '{end_date}'))"
            )
            
            # Calculate total investments (positive flow)
            total_investments = sum(
                float(record.get('fields', {}).get('amount', 0)) 
                for record in records 
                if not record.get('fields', {}).get('isWithdrawal', False)
            )
            
            # Calculate total withdrawals (negative flow)
            total_withdrawals = sum(
                float(record.get('fields', {}).get('originalAmount', 0)) 
                for record in records 
                if record.get('fields', {}).get('isWithdrawal', False)
            )
            
            # Net flow = investments - withdrawals
            net_flow = total_investments - total_withdrawals
            
            print(f"Investment flow between {start_date} and {end_date}:")
            print(f"  Total investments: ${total_investments:.2f}")
            print(f"  Total withdrawals: ${total_withdrawals:.2f}")
            print(f"  Net flow: ${net_flow:.2f}")
            
            return net_flow
            
        except Exception as e:
            print(f"❌ Error calculating investment flow: {str(e)}")
            return 0
            
    def get_total_invested_amount(self):
        """
        Calculate the total amount invested to date (all time) in USD
        Returns the net of all investments and withdrawals in USD
        """
        try:
            # Initialize Airtable connection to INVESTMENTS table
            investments_table = Airtable(
                os.getenv('KINKONG_AIRTABLE_BASE_ID'),
                'INVESTMENTS',
                os.getenv('KINKONG_AIRTABLE_API_KEY')
            )
            
            # Get all investments
            records = investments_table.get_all()
            
            # Calculate total investments (positive flow) in USD
            total_investments = 0
            for record in records:
                fields = record.get('fields', {})
                is_withdrawal = fields.get('isWithdrawal', False)
                
                if not is_withdrawal:
                    # Check if we have a usdAmount field (preferred)
                    if 'usdAmount' in fields and fields['usdAmount'] is not None:
                        usd_amount = float(fields['usdAmount'])
                        total_investments += usd_amount
                        print(f"Investment: ${usd_amount:.2f} USD (from usdAmount field)")
                    else:
                        # If no usdAmount, try to calculate from amount and token price
                        amount = float(fields.get('amount', 0))
                        token = fields.get('token', 'UBC')
                        token_price = float(fields.get('tokenPrice', 0))
                        
                        if token_price > 0:
                            usd_amount = amount * token_price
                            total_investments += usd_amount
                            print(f"Investment: {amount} {token} at ${token_price} = ${usd_amount:.2f} USD (calculated)")
                        else:
                            # If no token price, just use amount as a fallback (not ideal)
                            total_investments += amount
                            print(f"Investment: {amount} {token} (no USD conversion available)")
            
            # Calculate total withdrawals (negative flow) in USD
            total_withdrawals = 0
            for record in records:
                fields = record.get('fields', {})
                is_withdrawal = fields.get('isWithdrawal', False)
                
                if is_withdrawal:
                    # For withdrawals, use originalAmount (in USD) if available
                    if 'originalAmountUsd' in fields and fields['originalAmountUsd'] is not None:
                        usd_amount = float(fields['originalAmountUsd'])
                        total_withdrawals += usd_amount
                        print(f"Withdrawal: ${usd_amount:.2f} USD (from originalAmountUsd field)")
                    elif 'usdAmount' in fields and fields['usdAmount'] is not None:
                        usd_amount = float(fields['usdAmount'])
                        total_withdrawals += usd_amount
                        print(f"Withdrawal: ${usd_amount:.2f} USD (from usdAmount field)")
                    else:
                        # If no USD amount, try to calculate from amount and token price
                        amount = float(fields.get('originalAmount', 0))
                        token = fields.get('token', 'UBC')
                        token_price = float(fields.get('tokenPrice', 0))
                        
                        if token_price > 0:
                            usd_amount = amount * token_price
                            total_withdrawals += usd_amount
                            print(f"Withdrawal: {amount} {token} at ${token_price} = ${usd_amount:.2f} USD (calculated)")
                        else:
                            # If no token price, just use amount as a fallback (not ideal)
                            total_withdrawals += amount
                            print(f"Withdrawal: {amount} {token} (no USD conversion available)")
            
            # Net invested amount = investments - withdrawals (in USD)
            net_invested = total_investments - total_withdrawals
            
            print(f"Total investment summary (USD):")
            print(f"  Total investments: ${total_investments:.2f}")
            print(f"  Total withdrawals: ${total_withdrawals:.2f}")
            print(f"  Net invested amount: ${net_invested:.2f}")
            
            return net_invested
            
        except Exception as e:
            print(f"❌ Error calculating total invested amount: {str(e)}")
            return 0

    def get_previous_snapshot(self, days=7):
        """
        Get the wallet snapshot from X days ago
        Returns the total value or 0 if no snapshot exists
        """
        try:
            # Calculate the date 7 days ago
            previous_date = (datetime.now() - timedelta(days=days)).strftime('%Y-%m-%d')
            
            # Query for snapshots on or before that date, sorted by date descending
            records = self.snapshots_table.get_all(
                formula=f"IS_BEFORE({{createdAt}}, '{previous_date}')",
                sort=[('createdAt', 'desc')]
            )
            
            # Get the most recent one before our target date
            if records:
                previous_value = float(records[0].get('fields', {}).get('totalValue', 0))
                previous_date = records[0].get('fields', {}).get('createdAt', 'unknown date')
                print(f"Found previous snapshot from {previous_date} with value: ${previous_value:.2f}")
                return previous_value, previous_date
            else:
                print(f"No previous snapshot found before {previous_date}")
                return 0, None
                
        except Exception as e:
            print(f"❌ Error fetching previous snapshot: {str(e)}")
            return 0, None

    def take_snapshot(self):
        """Take a snapshot of wallet holdings and calculate weekly PnL"""
        print("📸 Taking snapshot of KinKong wallet...")

        # Get all token balances at once
        token_balances = self.get_token_balances()
        
        # Process balances
        balances = []
        created_at = datetime.now(timezone.utc).isoformat()

        # Special case: Get COMPUTE price from Meteora dynamic pool
        compute_price = None
        compute_mint = "B1N1HcMm4RysYz4smsXwmk2UnS8NziqKCM6Ho8i62vXo"
        meteora_pool_id = "HN7ibjiyX399d1EfYXcWaSHZRSMfUmonYvXGFXG41Rr3"
        
        try:
            # Fetch price from Meteora dynamic pool
            url = "https://public-api.birdeye.so/v1/pool/price"
            params = {
                "pool_address": meteora_pool_id
            }
            headers = {
                "x-api-key": self.birdeye_api_key,
                "x-chain": "solana",
                "accept": "application/json"
            }
            
            response = requests.get(url, params=params, headers=headers)
            
            # Debug the response
            print(f"Meteora pool API response status: {response.status_code}")
            print(f"Meteora pool API response headers: {response.headers}")
            
            # Only try to parse JSON if we have content
            if response.content:
                pool_data = response.json()
                
                if pool_data.get('success'):
                    compute_price = float(pool_data.get('data', {}).get('price', 0))
                    print(f"✓ Got COMPUTE price from Meteora pool: ${compute_price:.6f}")
                else:
                    print(f"⚠️ Failed to get COMPUTE price from Meteora pool: {pool_data.get('message')}")
            else:
                print(f"⚠️ Empty response from Meteora pool API")
                
        except requests.exceptions.RequestException as e:
            print(f"❌ HTTP error fetching COMPUTE price from Meteora pool: {str(e)}")
        except json.JSONDecodeError as e:
            print(f"❌ JSON decode error from Meteora pool: {str(e)}")
            print(f"Response content: {response.content[:100]}...")  # Print first 100 chars of response
        except Exception as e:
            print(f"❌ Error fetching COMPUTE price from Meteora pool: {str(e)}")
            
        # If Meteora pool fails, try getting price from Jupiter API
        if compute_price is None:
            try:
                jupiter_url = "https://price.jup.ag/v4/price"
                jupiter_params = {
                    "ids": "B1N1HcMm4RysYz4smsXwmk2UnS8NziqKCM6Ho8i62vXo"
                }
                
                jupiter_response = requests.get(jupiter_url, params=jupiter_params)
                jupiter_response.raise_for_status()
                jupiter_data = jupiter_response.json()
                
                if jupiter_data.get('data') and jupiter_data['data'].get('B1N1HcMm4RysYz4smsXwmk2UnS8NziqKCM6Ho8i62vXo'):
                    compute_price = float(jupiter_data['data']['B1N1HcMm4RysYz4smsXwmk2UnS8NziqKCM6Ho8i62vXo'].get('price', 0))
                    print(f"✓ Got COMPUTE price from Jupiter API: ${compute_price:.6f}")
            except Exception as e:
                print(f"❌ Error fetching COMPUTE price from Jupiter API: {str(e)}")
                
        # If both Meteora and Jupiter fail, try getting price from DexScreener
        if compute_price is None:
            try:
                # DexScreener API for COMPUTE token
                dexscreener_url = "https://api.dexscreener.com/latest/dex/tokens/B1N1HcMm4RysYz4smsXwmk2UnS8NziqKCM6Ho8i62vXo"
                
                dexscreener_response = requests.get(dexscreener_url)
                dexscreener_response.raise_for_status()
                dexscreener_data = dexscreener_response.json()
                
                # DexScreener returns pairs that include this token
                if dexscreener_data.get('pairs') and len(dexscreener_data['pairs']) > 0:
                    # Get the first pair with USDC or USDT (stablecoin pair)
                    compute_pair = None
                    for pair in dexscreener_data['pairs']:
                        # Look for USDC or USDT pair
                        if 'USDC' in pair.get('quoteToken', {}).get('symbol', '') or 'USDT' in pair.get('quoteToken', {}).get('symbol', ''):
                            compute_pair = pair
                            break
                    
                    # If no USDC/USDT pair, just use the first pair
                    if not compute_pair and len(dexscreener_data['pairs']) > 0:
                        compute_pair = dexscreener_data['pairs'][0]
                    
                    if compute_pair and compute_pair.get('priceUsd'):
                        compute_price = float(compute_pair['priceUsd'])
                        print(f"✓ Got COMPUTE price from DexScreener: ${compute_price:.6f}")
            except Exception as e:
                print(f"❌ Error fetching COMPUTE price from DexScreener: {str(e)}")

        for balance_data in token_balances:
            try:
                # Override price for COMPUTE token if we got it from Meteora
                if balance_data['address'] == compute_mint and compute_price is not None:
                    balance_data['priceUsd'] = str(compute_price)
                    print(f"✓ Using Meteora pool price for COMPUTE: ${compute_price:.6f}")
                
                value = float(balance_data.get('valueUsd', 0))
                
                # If using Meteora price for COMPUTE, recalculate value
                if balance_data['address'] == compute_mint and compute_price is not None:
                    value = float(balance_data.get('uiAmount', 0)) * compute_price
                
                # Skip tokens with no value
                if value <= 0:
                    continue

                balance = {
                    'token': balance_data.get('symbol', 'Unknown'),
                    'mint': balance_data['address'],
                    'amount': float(balance_data.get('uiAmount', 0)),
                    'price': float(balance_data.get('priceUsd', 0)),
                    'value': value
                }
                balances.append(balance)
                print(f"✓ {balance['token']}: {balance['amount']:.2f} tokens (${balance['value']:.2f})")
            except Exception as e:
                print(f"❌ Error processing token {balance_data.get('symbol', 'Unknown')}: {str(e)}")

        # Calculate total value
        total_value = sum(b['value'] for b in balances)
        
        # Get previous snapshot value (7 days ago)
        previous_value, previous_date = self.get_previous_snapshot(days=7)
        
        # Calculate total invested amount (all time)
        total_invested = self.get_total_invested_amount()
        
        # Initialize metrics
        net_result = 0
        pnl_percentage = 0
        investor_7d_flow = 0
        
        if previous_date:
            # Get net investment flow between previous snapshot and now
            investor_7d_flow = self.get_investment_flow(previous_date, created_at)
            
            # Calculate net result (wallet variation with investor flow removed)
            net_result = total_value - previous_value - investor_7d_flow
            
            # Calculate PnL as a percentage
            if previous_value > 0:
                pnl_percentage = (net_result / previous_value) * 100
            
            print(f"\n📊 Weekly PnL Calculation:")
            print(f"  Current value: ${total_value:.2f}")
            print(f"  Previous value (7 days ago): ${previous_value:.2f}")
            print(f"  Net investment flow: ${investor_7d_flow:.2f}")
            print(f"  Net result (7d variation - flow): ${net_result:.2f}")
            print(f"  PnL percentage: {pnl_percentage:.2f}%")
        
        # Print summary of calculations
        print(f"\n📊 Performance Metrics:")
        print(f"  Current value: ${total_value:.2f}")
        print(f"  Total invested: ${total_invested:.2f}")
        print(f"  Net result (7d variation - flow): ${net_result:.2f}")
        print(f"  PnL percentage: {pnl_percentage:.2f}%")
        print(f"  7-day investment flow: ${investor_7d_flow:.2f}")
        
        # Record snapshot with metrics
        snapshot_data = {
            'createdAt': created_at,
            'totalValue': total_value,
            'investedAmount': total_invested,
            'investor7dFlow': investor_7d_flow,
            'netResult': net_result,
            'pnlPercentage': pnl_percentage,
            'holdings': json.dumps([{
                'token': b['token'],
                'amount': b['amount'],
                'price': b['price'],
                'value': b['value']
            } for b in balances])
        }
        
        self.snapshots_table.insert(snapshot_data)

        print(f"\n✅ Wallet snapshot recorded")
        print(f"Total Value: ${total_value:.2f}")
        print(f"Total Invested: ${total_invested:.2f}")
        print(f"Net Result (7d variation - flow): ${net_result:.2f}")
        print(f"PnL Percentage: {pnl_percentage:.2f}%")
        print(f"7-day Investment Flow: ${investor_7d_flow:.2f}")
        print("\nHoldings:")
        for balance in balances:
            print(f"• {balance['token']}: {balance['amount']:.2f} (${balance['value']:.2f})")

def main():
    try:
        # Load environment variables from .env file
        load_dotenv(dotenv_path=os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env'))
        
        # Verify environment variables
        required_vars = [
            'KINKONG_AIRTABLE_BASE_ID',
            'KINKONG_AIRTABLE_API_KEY',
            'BIRDEYE_API_KEY',
            'KINKONG_WALLET'
        ]
        
        missing = [var for var in required_vars if not os.getenv(var)]
        if missing:
            raise Exception(f"Missing environment variables: {', '.join(missing)}")

        # Take snapshot
        snapshot_taker = WalletSnapshotTaker()
        snapshot_taker.take_snapshot()

    except Exception as e:
        print(f"\n❌ Script failed: {str(e)}")
        exit(1)

if __name__ == "__main__":
    main()
