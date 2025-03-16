import os
import json
from datetime import datetime, timezone, timedelta
import requests
from airtable import Airtable
from dotenv import load_dotenv
from typing import List, Dict, Any, Optional

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
            
    def get_current_token_prices(self):
        """
        Get current prices for tokens we're tracking
        Returns a dictionary of token symbol -> price in USD
        """
        token_prices = {}
        
        try:
            # Get token balances which include current prices
            token_balances = self.get_token_balances()
            
            # Extract prices for each token
            for balance in token_balances:
                if 'symbol' in balance and 'priceUsd' in balance:
                    symbol = balance['symbol']
                    price = float(balance['priceUsd'])
                    token_prices[symbol] = price
                    print(f"Current price for {symbol}: ${price}")
            
            # Special case for COMPUTE token if we got it from Meteora
            compute_mint = "B1N1HcMm4RysYz4smsXwmk2UnS8NziqKCM6Ho8i62vXo"
            compute_price = None
            
            # Try to get COMPUTE price from Meteora dynamic pool
            try:
                meteora_pool_id = "HN7ibjiyX399d1EfYXcWaSHZRSMfUmonYvXGFXG41Rr3"
                url = "https://public-api.birdeye.so/v1/pool/price"
                params = {"pool_address": meteora_pool_id}
                headers = {
                    "x-api-key": self.birdeye_api_key,
                    "x-chain": "solana",
                    "accept": "application/json"
                }
                
                response = requests.get(url, params=params, headers=headers)
                if response.content:
                    pool_data = response.json()
                    if pool_data.get('success'):
                        compute_price = float(pool_data.get('data', {}).get('price', 0))
                        token_prices['COMPUTE'] = compute_price
                        print(f"Got COMPUTE price from Meteora pool: ${compute_price:.6f}")
            except Exception as e:
                print(f"Error getting COMPUTE price from Meteora: {str(e)}")
            
            # If we don't have COMPUTE price yet, try Jupiter
            if 'COMPUTE' not in token_prices or token_prices['COMPUTE'] <= 0:
                try:
                    jupiter_url = "https://price.jup.ag/v4/price"
                    jupiter_params = {"ids": compute_mint}
                    
                    jupiter_response = requests.get(jupiter_url, params=jupiter_params)
                    jupiter_data = jupiter_response.json()
                    
                    if jupiter_data.get('data') and jupiter_data['data'].get(compute_mint):
                        compute_price = float(jupiter_data['data'][compute_mint].get('price', 0))
                        token_prices['COMPUTE'] = compute_price
                        print(f"Got COMPUTE price from Jupiter API: ${compute_price:.6f}")
                except Exception as e:
                    print(f"Error getting COMPUTE price from Jupiter: {str(e)}")
            
            # Add hardcoded fallback prices for common tokens if not found
            if 'USDC' not in token_prices or token_prices['USDC'] <= 0:
                token_prices['USDC'] = 1.0  # USDC is a stablecoin
                print("Using fallback price for USDC: $1.00")
            
            if 'UBC' not in token_prices or token_prices['UBC'] <= 0:
                # Use a reasonable fallback price for UBC if needed
                token_prices['UBC'] = 0.01  # Example fallback price
                print(f"Using fallback price for UBC: ${token_prices['UBC']}")
            
            if 'COMPUTE' not in token_prices or token_prices['COMPUTE'] <= 0:
                # Use a reasonable fallback price for COMPUTE if needed
                token_prices['COMPUTE'] = 0.0001  # Example fallback price
                print(f"Using fallback price for COMPUTE: ${token_prices['COMPUTE']}")
            
            return token_prices
            
        except Exception as e:
            print(f"❌ Error getting token prices: {str(e)}")
            # Return fallback prices
            return {
                'USDC': 1.0,
                'UBC': 0.01,
                'COMPUTE': 0.0001
            }

    def get_small_transactions_flow(self, start_date, end_date):
        """
        Calculate the flow of small transactions between two dates
        These are transactions too small to be considered formal investments
        Uses Birdeye API to get transaction history
        """
        try:
            print(f"Calculating small transactions flow between {start_date} and {end_date}")
            
            # Convert start_date and end_date to Unix timestamps if they're not already
            if isinstance(start_date, str):
                start_timestamp = int(datetime.fromisoformat(start_date.replace('Z', '+00:00')).timestamp())
            else:
                start_timestamp = int(start_date.timestamp())
                
            if isinstance(end_date, str):
                end_timestamp = int(datetime.fromisoformat(end_date.replace('Z', '+00:00')).timestamp())
            else:
                end_timestamp = int(datetime.now().timestamp())
            
            print(f"Date range: {datetime.fromtimestamp(start_timestamp)} to {datetime.fromtimestamp(end_timestamp)}")
            
            # Get current token prices for conversion
            token_prices = self.get_current_token_prices()
            
            # Initialize counters for inflows and outflows
            total_inflows = 0
            total_outflows = 0
            
            # Fetch transaction history from Birdeye API
            url = "https://public-api.birdeye.so/v1/wallet/tx_list"
            params = {
                "wallet": self.wallet,
                "limit": 1000  # Maximum allowed by API
            }
            headers = {
                "x-api-key": self.birdeye_api_key,
                "x-chain": "solana",
                "accept": "application/json"
            }
            
            print(f"Fetching transaction history from Birdeye API for wallet: {self.wallet}")
            response = requests.get(url, params=params, headers=headers)
            
            if not response.ok:
                print(f"❌ Error fetching transaction history: {response.status_code} {response.reason}")
                print(f"Response content: {response.text[:500]}...")  # Print first 500 chars of response
                return 0
                
            data = response.json()
            
            if not data.get('success'):
                print(f"❌ API returned success=false: {data.get('message', 'No error message')}")
                print(f"Response data: {json.dumps(data, indent=2)}")
                return 0
                
            transactions = data.get('data', {}).get('items', [])
            print(f"Found {len(transactions)} transactions in history")
            
            # Debug: Print a sample transaction to understand the structure
            if transactions:
                print(f"Sample transaction structure: {json.dumps(transactions[0], indent=2)}")
            
            # Track processed transactions for debugging
            processed_count = 0
            skipped_count = 0
            date_filtered_count = 0
            investment_filtered_count = 0
            
            # Process each transaction
            for tx in transactions:
                # Check if transaction is within our date range
                tx_timestamp = int(tx.get('blockTime', 0))
                tx_date = datetime.fromtimestamp(tx_timestamp).isoformat() if tx_timestamp else 'unknown'
                
                if not (start_timestamp <= tx_timestamp <= end_timestamp):
                    date_filtered_count += 1
                    continue
                    
                # Get transaction details
                tx_hash = tx.get('signature')
                tx_type = tx.get('txType', '').lower()
                
                print(f"Processing transaction {tx_hash} of type {tx_type} from {tx_date}")
                
                # Skip transactions that are already counted as investments
                # We'll check this by querying the INVESTMENTS table
                investments_table = Airtable(
                    os.getenv('KINKONG_AIRTABLE_BASE_ID'),
                    'INVESTMENTS',
                    os.getenv('KINKONG_AIRTABLE_API_KEY')
                )
                
                # Check if this transaction is already recorded as an investment
                investment_records = investments_table.get_all(
                    formula=f"{{transactionHash}}='{tx_hash}'"
                )
                
                if investment_records:
                    print(f"Skipping transaction {tx_hash} - already recorded as investment")
                    investment_filtered_count += 1
                    continue
                
                # Process transaction based on type
                if tx_type in ['swap', 'transfer', 'unknown']:  # Added 'unknown' to catch more transactions
                    # Get token transfers in this transaction
                    token_transfers = tx.get('tokenTransfers', [])
                    
                    if not token_transfers:
                        print(f"No token transfers found in transaction {tx_hash}")
                        skipped_count += 1
                        continue
                    
                    print(f"Found {len(token_transfers)} token transfers in transaction {tx_hash}")
                    
                    for i, transfer in enumerate(token_transfers):
                        # Check if our wallet is sender or receiver
                        is_sender = transfer.get('sender') == self.wallet
                        is_receiver = transfer.get('receiver') == self.wallet
                        
                        if not (is_sender or is_receiver):
                            print(f"  Transfer #{i}: Neither sender nor receiver matches our wallet")
                            continue
                            
                        # Get token details
                        token_symbol = transfer.get('symbol', 'Unknown')
                        token_amount = float(transfer.get('amount', 0))
                        token_price_usd = float(transfer.get('priceUsd', 0))
                        
                        print(f"  Transfer #{i}: {token_amount} {token_symbol} at ${token_price_usd} USD/token")
                        print(f"    Sender: {transfer.get('sender')}")
                        print(f"    Receiver: {transfer.get('receiver')}")
                        
                        # If no price in transaction, try to use current price
                        if token_price_usd <= 0 and token_symbol in token_prices:
                            token_price_usd = token_prices[token_symbol]
                            print(f"    Using current price for {token_symbol}: ${token_price_usd}")
                            
                        # Calculate USD value
                        usd_value = token_amount * token_price_usd
                        
                        # Skip very small transactions (less than $1)
                        if usd_value < 1:
                            print(f"    Skipping small transfer: ${usd_value:.2f} USD")
                            continue
                            
                        # Record inflow or outflow
                        if is_receiver:
                            total_inflows += usd_value
                            print(f"    ➕ Inflow: {token_amount} {token_symbol} = ${usd_value:.2f} USD")
                        elif is_sender:
                            total_outflows += usd_value
                            print(f"    ➖ Outflow: {token_amount} {token_symbol} = ${usd_value:.2f} USD")
                    
                    processed_count += 1
                else:
                    print(f"Skipping transaction {tx_hash} with unsupported type: {tx_type}")
                    skipped_count += 1
            
            # Calculate net flow
            net_flow = total_inflows - total_outflows
            
            print(f"\nSmall transactions flow between {start_date} and {end_date}:")
            print(f"  Total inflows: ${total_inflows:.2f}")
            print(f"  Total outflows: ${total_outflows:.2f}")
            print(f"  Net flow: ${net_flow:.2f}")
            print(f"  Transactions processed: {processed_count}")
            print(f"  Transactions skipped: {skipped_count}")
            print(f"  Transactions filtered by date: {date_filtered_count}")
            print(f"  Transactions filtered as investments: {investment_filtered_count}")
            
            return net_flow
            
        except Exception as e:
            print(f"❌ Error calculating small transactions flow: {str(e)}")
            import traceback
            traceback.print_exc()
            return 0
            
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
            
            # Get current token prices for conversion
            token_prices = self.get_current_token_prices()
            
            # Calculate total investments (positive flow) in USD
            total_investments = 0
            total_withdrawals = 0
            
            for record in records:
                fields = record.get('fields', {})
                is_withdrawal = fields.get('isWithdrawal', False)
                has_original_amount = 'originalAmount' in fields and fields['originalAmount'] is not None and float(fields.get('originalAmount', 0)) > 0
                
                # Consider it a withdrawal if either isWithdrawal is true OR originalAmount exists and is > 0
                if is_withdrawal or has_original_amount:
                    # This is a withdrawal
                    print(f"Processing withdrawal flow record: {fields.get('token')} {fields.get('amount')} (originalAmount: {fields.get('originalAmount')})")
                    
                    # For withdrawals, use originalAmountUsd (in USD) if available
                    if 'originalAmountUsd' in fields and fields['originalAmountUsd'] is not None:
                        usd_amount = float(fields['originalAmountUsd'])
                        total_withdrawals += usd_amount
                        print(f"Withdrawal flow: ${usd_amount:.2f} USD (from originalAmountUsd field)")
                    # Next try usdAmount
                    elif 'usdAmount' in fields and fields['usdAmount'] is not None:
                        usd_amount = float(fields['usdAmount'])
                        total_withdrawals += usd_amount
                        print(f"Withdrawal flow: ${usd_amount:.2f} USD (from usdAmount field)")
                    # If no USD amount, try to calculate from originalAmount and token price in record
                    elif 'tokenPrice' in fields and fields['tokenPrice'] is not None and fields.get('originalAmount') is not None:
                        amount = float(fields.get('originalAmount', 0))
                        token = fields.get('token', 'UBC')
                        token_price = float(fields.get('tokenPrice', 0))
                        
                        if token_price > 0:
                            usd_amount = amount * token_price
                            total_withdrawals += usd_amount
                            print(f"Withdrawal flow: {amount} {token} at ${token_price} = ${usd_amount:.2f} USD (calculated from record)")
                        else:
                            print(f"⚠️ Zero token price in record: {amount} {token}")
                    # If no price in record, use current token price with originalAmount
                    elif fields.get('originalAmount') is not None and fields.get('token') is not None:
                        amount = float(fields.get('originalAmount', 0))
                        token = fields.get('token', 'UBC')
                        
                        # Use current token price if available
                        if token in token_prices and token_prices[token] > 0:
                            current_price = token_prices[token]
                            usd_amount = amount * current_price
                            total_withdrawals += usd_amount
                            print(f"Withdrawal flow: {amount} {token} at current price ${current_price} = ${usd_amount:.2f} USD")
                        else:
                            print(f"⚠️ No price available for token: {amount} {token}")
                    else:
                        print(f"⚠️ Skipping withdrawal flow without amount or token: {fields}")
                else:
                    # This is a regular investment
                    if 'usdAmount' in fields and fields['usdAmount'] is not None:
                        usd_amount = float(fields['usdAmount'])
                        total_investments += usd_amount
                        print(f"Investment flow: ${usd_amount:.2f} USD (from usdAmount field)")
                    elif 'tokenPrice' in fields and fields['tokenPrice'] is not None and fields.get('amount') is not None:
                        amount = float(fields.get('amount', 0))
                        token = fields.get('token', 'UBC')
                        token_price = float(fields.get('tokenPrice', 0))
                        
                        if token_price > 0:
                            usd_amount = amount * token_price
                            total_investments += usd_amount
                            print(f"Investment flow: {amount} {token} at ${token_price} = ${usd_amount:.2f} USD")
                        else:
                            print(f"⚠️ Zero token price in record: {amount} {token}")
                    elif fields.get('amount') is not None and fields.get('token') is not None:
                        amount = float(fields.get('amount', 0))
                        token = fields.get('token', 'UBC')
                        
                        # Use current token price if available
                        if token in token_prices and token_prices[token] > 0:
                            current_price = token_prices[token]
                            usd_amount = amount * current_price
                            total_investments += usd_amount
                            print(f"Investment flow: {amount} {token} at current price ${current_price} = ${usd_amount:.2f} USD")
                        else:
                            print(f"⚠️ No price available for token: {amount} {token}")
                    else:
                        print(f"⚠️ Skipping investment flow without amount or token: {fields}")
            
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
            
            # Get current token prices for conversion
            token_prices = self.get_current_token_prices()
            
            # Calculate total investments (positive flow) in USD
            total_investments = 0
            total_withdrawals = 0
            
            for record in records:
                fields = record.get('fields', {})
                is_withdrawal = fields.get('isWithdrawal', False)
                has_original_amount = 'originalAmount' in fields and fields['originalAmount'] is not None and float(fields.get('originalAmount', 0)) > 0
                
                # Consider it a withdrawal if either isWithdrawal is true OR originalAmount exists and is > 0
                if is_withdrawal or has_original_amount:
                    # This is a withdrawal
                    print(f"Processing withdrawal record: {fields.get('token')} {fields.get('amount')} (originalAmount: {fields.get('originalAmount')})")
                    
                    # For withdrawals, use originalAmountUsd (in USD) if available
                    if 'originalAmountUsd' in fields and fields['originalAmountUsd'] is not None:
                        usd_amount = float(fields['originalAmountUsd'])
                        total_withdrawals += usd_amount
                        print(f"Withdrawal: ${usd_amount:.2f} USD (from originalAmountUsd field)")
                    # Next try usdAmount
                    elif 'usdAmount' in fields and fields['usdAmount'] is not None:
                        usd_amount = float(fields['usdAmount'])
                        total_withdrawals += usd_amount
                        print(f"Withdrawal: ${usd_amount:.2f} USD (from usdAmount field)")
                    # If no USD amount, try to calculate from originalAmount and token price in record
                    elif 'tokenPrice' in fields and fields['tokenPrice'] is not None and fields.get('originalAmount') is not None:
                        amount = float(fields.get('originalAmount', 0))
                        token = fields.get('token', 'UBC')
                        token_price = float(fields.get('tokenPrice', 0))
                        
                        if token_price > 0:
                            usd_amount = amount * token_price
                            total_withdrawals += usd_amount
                            print(f"Withdrawal: {amount} {token} at ${token_price} = ${usd_amount:.2f} USD (calculated from record)")
                        else:
                            print(f"⚠️ Zero token price in record: {amount} {token}")
                    # If no price in record, use current token price with originalAmount
                    elif fields.get('originalAmount') is not None and fields.get('token') is not None:
                        amount = float(fields.get('originalAmount', 0))
                        token = fields.get('token', 'UBC')
                        
                        # Use current token price if available
                        if token in token_prices and token_prices[token] > 0:
                            current_price = token_prices[token]
                            usd_amount = amount * current_price
                            total_withdrawals += usd_amount
                            print(f"Withdrawal: {amount} {token} at current price ${current_price} = ${usd_amount:.2f} USD")
                        else:
                            print(f"⚠️ No price available for token: {amount} {token}")
                    else:
                        print(f"⚠️ Skipping withdrawal without amount or token: {fields}")
                else:
                    # This is a regular investment
                    # Check if we have a usdAmount field (preferred)
                    if 'usdAmount' in fields and fields['usdAmount'] is not None:
                        usd_amount = float(fields['usdAmount'])
                        total_investments += usd_amount
                        print(f"Investment: ${usd_amount:.2f} USD (from usdAmount field)")
                    # If no usdAmount, try to calculate from amount and token price in record
                    elif 'tokenPrice' in fields and fields['tokenPrice'] is not None and fields.get('amount') is not None:
                        amount = float(fields.get('amount', 0))
                        token = fields.get('token', 'UBC')
                        token_price = float(fields.get('tokenPrice', 0))
                        
                        if token_price > 0:
                            usd_amount = amount * token_price
                            total_investments += usd_amount
                            print(f"Investment: {amount} {token} at ${token_price} = ${usd_amount:.2f} USD (calculated from record)")
                        else:
                            print(f"⚠️ Zero token price in record: {amount} {token}")
                    # If no price in record, use current token price
                    elif fields.get('amount') is not None and fields.get('token') is not None:
                        amount = float(fields.get('amount', 0))
                        token = fields.get('token', 'UBC')
                        
                        # Use current token price if available
                        if token in token_prices and token_prices[token] > 0:
                            current_price = token_prices[token]
                            usd_amount = amount * current_price
                            total_investments += usd_amount
                            print(f"Investment: {amount} {token} at current price ${current_price} = ${usd_amount:.2f} USD")
                        else:
                            print(f"⚠️ No price available for token: {amount} {token}")
                    else:
                        print(f"⚠️ Skipping investment without amount or token: {fields}")
            
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

    def get_lp_positions(self) -> List[Dict[str, Any]]:
        """
        Fetch LP positions from the LP_POSITIONS table in Airtable
        Returns a list of active LP positions with non-zero values
        """
        try:
            print("Fetching LP positions from Airtable...")
            
            # Initialize Airtable connection to LP_POSITIONS table
            lp_positions_table = Airtable(
                os.getenv('KINKONG_AIRTABLE_BASE_ID'),
                'LP_POSITIONS',
                os.getenv('KINKONG_AIRTABLE_API_KEY')
            )
            
            # Get all active LP positions using the correct field names 'token0Amount' and 'token1Amount'
            formula = "AND({isActive}=TRUE(), OR({token0Amount}>0, {token1Amount}>0))"
            print(f"Using filter formula: {formula}")
            
            records = lp_positions_table.get_all(
                formula=formula
            )
            
            print(f"Found {len(records)} LP position records")
            
            # Debug: Print the first record to see its structure
            if records:
                print(f"Sample LP position record: {json.dumps(records[0], indent=2)}")
            
            lp_positions = []
            
            for record in records:
                fields = record.get('fields', {})
                
                # Get token amounts using the updated field names
                amount0 = float(fields.get('token0Amount', 0) or 0)
                amount1 = float(fields.get('token1Amount', 0) or 0)
                
                print(f"Processing LP position: {fields.get('name', 'Unknown')} - token0Amount: {amount0}, token1Amount: {amount1}")
                
                # Try to get totalValueUsd (correct field name), or calculate it if missing
                value_usd = 0
                if 'totalValueUsd' in fields and fields['totalValueUsd']:
                    value_usd = float(fields['totalValueUsd'])
                    print(f"  totalValueUsd from record: {value_usd}")
                else:
                    # If totalValueUsd is missing but we have token amounts, use a placeholder value
                    if amount0 > 0 or amount1 > 0:
                        value_usd = 1.0  # Placeholder value
                        print(f"  Warning: No totalValueUsd for LP position {fields.get('name', 'Unknown')} - using placeholder")
                
                # Skip positions with no value
                if value_usd <= 0 and amount0 <= 0 and amount1 <= 0:
                    print(f"  Skipping LP position with no value: {fields.get('name', 'Unknown')}")
                    continue
                    
                position = {
                    'name': fields.get('name', 'Unknown LP'),
                    'token0': fields.get('token0', 'Unknown'),
                    'token1': fields.get('token1', 'Unknown'),
                    'amount0': amount0,  # Keep the same property names in the returned object
                    'amount1': amount1,  # Keep the same property names in the returned object
                    'valueUSD': value_usd,
                    'notes': fields.get('notes', '')
                }
                
                lp_positions.append(position)
                print(f"✓ Added LP Position: {position['name']} (${position['valueUSD']:.2f})")
                
            print(f"Total LP positions added: {len(lp_positions)}")
            return lp_positions
            
        except Exception as e:
            print(f"❌ Error fetching LP positions: {str(e)}")
            import traceback
            traceback.print_exc()
            return []
            
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
        
        # Get LP positions
        lp_positions = self.get_lp_positions()

        # Add LP positions to balances
        print(f"\nAdding {len(lp_positions)} LP positions to balances")
        for position in lp_positions:
            # Create a balance entry for each LP position
            # Format: "LP: token0/token1"
            lp_token_name = f"LP: {position['token0']}/{position['token1']}"
            
            # Add to balances list
            lp_balance = {
                'token': lp_token_name,
                'mint': 'LP_POSITION',  # Use a placeholder for mint
                'amount': 1,  # Use 1 as amount since we're tracking by position
                'price': position['valueUSD'],  # Price is the full value
                'value': position['valueUSD'],
                'isLpPosition': True,  # Flag to identify LP positions
                'lpDetails': position  # Store full LP details
            }
            balances.append(lp_balance)
            print(f"✓ Added to balances: {lp_balance['token']}: LP Position (${lp_balance['value']:.2f})")

        # Recalculate total value including LP positions
        total_value = sum(b['value'] for b in balances)
        print(f"\nRecalculated total value including LP positions: ${total_value:.2f}")
        
        # Get previous snapshot value (7 days ago)
        previous_value, previous_date = self.get_previous_snapshot(days=7)
        
        # Calculate total invested amount (all time)
        total_invested = self.get_total_invested_amount()
        
        # Simplified calculation: netResult = totalValue - investedAmount
        net_result = total_value - total_invested
        
        # Calculate PnL percentage based on invested amount
        pnl_percentage = 0
        if total_invested > 0:
            pnl_percentage = (net_result / total_invested) * 100
        
        # For backward compatibility, still calculate these values
        investor_7d_flow = 0
        small_transactions_flow = 0
        gross_result = net_result  # Same as net_result in simplified model
        
        if previous_date:
            # Get net investment flow between previous snapshot and now
            investor_7d_flow = self.get_investment_flow(previous_date, created_at)
            
            print(f"\n📊 Weekly Performance Calculation:")
            print(f"  Current value: ${total_value:.2f}")
            print(f"  Previous value (7 days ago): ${previous_value:.2f}")
            print(f"  Net investment flow: ${investor_7d_flow:.2f}")
        
        # Print summary of calculations
        print(f"\n📊 Performance Metrics:")
        print(f"  Current value: ${total_value:.2f}")
        print(f"  Total invested: ${total_invested:.2f}")
        print(f"  Net result (totalValue - investedAmount): ${net_result:.2f}")
        print(f"  PnL percentage: {pnl_percentage:.2f}%")
        
        # Record snapshot with metrics
        holdings_json = json.dumps([{
            'token': b['token'],
            'amount': b['amount'],
            'price': b['price'],
            'value': b['value'],
            'isLpPosition': b.get('isLpPosition', False),
            'lpDetails': b.get('lpDetails', {}) if b.get('isLpPosition', False) else None
        } for b in balances])

        print(f"\nHoldings JSON contains {len(balances)} items")
        print(f"LP positions in holdings JSON: {sum(1 for b in balances if b.get('isLpPosition', False))}")

        snapshot_data = {
            'createdAt': created_at,
            'totalValue': total_value,
            'investedAmount': total_invested,
            'investor7dFlow': investor_7d_flow,
            'smallTransactionsFlow': small_transactions_flow,
            'netResult': net_result,
            'grossResult': gross_result,
            'pnlPercentage': pnl_percentage,
            'holdings': holdings_json
        }
        
        self.snapshots_table.insert(snapshot_data)

        print(f"\n✅ Wallet snapshot recorded")
        print(f"Total Value: ${total_value:.2f}")
        print(f"Total Invested: ${total_invested:.2f}")
        print(f"Net Result (totalValue - investedAmount): ${net_result:.2f}")
        print(f"PnL Percentage: {pnl_percentage:.2f}%")
        print("\nHoldings:")
        for balance in balances:
            if balance.get('isLpPosition', False):
                print(f"• {balance['token']} (LP Position): ${balance['value']:.2f}")
            else:
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
