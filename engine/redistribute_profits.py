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
        
    def get_active_subscriptions(self):
        """Get a mapping of wallet addresses with active subscriptions"""
        self.logger.info("Fetching active subscriptions")
        
        # Initialize subscriptions table
        subscriptions_table = Airtable(
            self.base_id,
            'SUBSCRIPTIONS',
            self.api_key
        )
        
        # Get current date in ISO format
        now = datetime.now(timezone.utc).isoformat()
        
        # Query for active subscriptions with endDate > now
        active_subscriptions = subscriptions_table.get_all(
            formula=f"AND(status='active', IS_AFTER({{endDate}}, '{now}'))"
        )
        
        # Create wallet to subscription mapping
        wallet_subscriptions = {}
        for sub in active_subscriptions:
            wallet = sub['fields'].get('wallet')
            if wallet:
                wallet_subscriptions[wallet] = True
        
        self.logger.info(f"Found {len(wallet_subscriptions)} wallets with active subscriptions")
        return wallet_subscriptions
        
    # Method removed as it's no longer needed
        
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
    
    # Method removed as it's no longer needed
            
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
    
    # Method removed as it's no longer needed
        
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
            
            # Get active subscriptions
            active_subscriptions = self.get_active_subscriptions()
            
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
            wallet_has_subscription = {}
            
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
                
                # Check if wallet has active subscription
                has_subscription = wallet in active_subscriptions
                wallet_has_subscription[wallet] = has_subscription
                
                # Apply different rate based on subscription status
                # For calculation purposes, we'll adjust the investment value
                # Non-subscribers get 50% instead of 75% (2/3 of the full rate)
                effective_value = wallet_value
                if not has_subscription:
                    # Apply 2/3 factor to represent 50% vs 75% rate
                    effective_value = wallet_value * (50/75)
                    self.logger.info(f"Wallet {wallet}: No active subscription, applying 50% rate (2/3 factor)")
                else:
                    self.logger.info(f"Wallet {wallet}: Has active subscription, applying full 75% rate")
                
                wallet_investment_values[wallet] = {
                    'actual_value': wallet_value,
                    'effective_value': effective_value,
                    'has_subscription': has_subscription
                }
                total_investment_value_usd += effective_value
                
            self.logger.info(f"Total effective investment value across all wallets: ${total_investment_value_usd:.2f}")
            
            # Calculate distribution for each wallet based on their percentage of total investment
            distributions = []
            
            for wallet, investment_data in wallet_investment_values.items():
                if total_investment_value_usd > 0:
                    actual_value = investment_data['actual_value']
                    effective_value = investment_data['effective_value']
                    has_subscription = investment_data['has_subscription']
                    
                    # Calculate percentage based on effective value
                    percentage = (effective_value / total_investment_value_usd) * 100
                    
                    # Calculate distribution amount
                    distribution_amount = (effective_value / total_investment_value_usd) * pool_75_amount
                    
                    # Calculate the effective rate (75% for subscribers, 50% for non-subscribers)
                    effective_rate = 75 if has_subscription else 50
                    
                    distributions.append({
                        'wallet': wallet,
                        'investment_value': actual_value,
                        'effective_value': effective_value,
                        'percentage': percentage,
                        'distribution_amount': distribution_amount,
                        'has_subscription': has_subscription,
                        'effective_rate': effective_rate
                    })
                    
                    self.logger.info(f"Wallet {wallet}: Investment ${actual_value:.2f}, Rate {effective_rate}% → Distribution ${distribution_amount:.2f}")
                
            # Sort distributions by amount (descending)
            distributions.sort(key=lambda x: x['distribution_amount'], reverse=True)
            
            return distributions
        
        except Exception as e:
            self.logger.error(f"Error calculating investor distributions: {e}")
            return []
            
    def send_telegram_notification(self, redistribution_id, investor_data):
        """Send a Telegram notification for an investor redistribution"""
        # Skip sending notifications as requested
        self.logger.info(f"Telegram notifications disabled - skipping notification for wallet: {investor_data['wallet']}")
        return True
            
    # Method removed as it's no longer needed
            
    def save_redistribution_to_airtable(self, ubc_amount, compute_amount, investor_distributions):
        """Save redistribution data to Airtable REDISTRIBUTIONS and INVESTOR_REDISTRIBUTIONS tables"""
        self.logger.info("Saving redistribution data to Airtable")
        
        try:
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
                'ubcAmount': ubc_amount,
                'computeAmount': compute_amount,
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
            
            for investor_data in investor_distributions:
                # Get all investments for this wallet and token
                wallet_investments = [
                    inv for inv in investments 
                    if inv['fields'].get('wallet') == investor_data['wallet'] and 
                       inv['fields'].get('token', '').upper() == investor_data['token']
                ]
                
                # If there are investments for this wallet and token, link the redistribution to them
                if wallet_investments:
                    # Sort investments by amount (descending) to match the largest investment first
                    wallet_investments.sort(key=lambda x: float(x['fields'].get('amount', 0)), reverse=True)
                    investment_id = wallet_investments[0]['id']  # Use the largest investment
                    
                    investor_record = {
                        'fields': {
                            'redistributionId': main_record_id,  # Link to the main redistribution record
                            'wallet': investor_data['wallet'],
                            'token': investor_data['token'],  # Add token field
                            'investmentId': investment_id,  # Add this field to link to specific investment
                            'percentage': investor_data['percentage'],
                            'amount': investor_data['amount'],
                            'hasSubscription': investor_data.get('has_subscription', False),
                            'effectiveRate': investor_data.get('effective_rate', 75),
                            'status': 'PENDING',  # Initial status
                            'createdAt': now
                        }
                    }
                else:
                    # If no investments found for this wallet and token, create record without investment ID
                    investor_record = {
                        'fields': {
                            'redistributionId': main_record_id,  # Link to the main redistribution record
                            'wallet': investor_data['wallet'],
                            'token': investor_data['token'],  # Add token field
                            'percentage': investor_data['percentage'],
                            'amount': investor_data['amount'],
                            'hasSubscription': investor_data.get('has_subscription', False),
                            'effectiveRate': investor_data.get('effective_rate', 75),
                            'status': 'PENDING',  # Initial status
                            'createdAt': now
                        }
                    }
                
                # Insert the record into Airtable
                investor_record_result = investor_redistributions_table.insert(investor_record['fields'])
                
                self.logger.info(f"Wallet {investor_data['wallet']}: {investor_data['amount']:.6f} {investor_data['token']}")
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
            'KINKONG_WALLET'
        ]
        
        missing = [var for var in required_vars if not os.getenv(var)]
        if missing:
            print(f"⚠️ Warning: Missing environment variables: {', '.join(missing)}")
        
        # Get UBC and COMPUTE amounts from command line arguments
        ubc_amount = 0
        compute_amount = 0
        
        if len(sys.argv) >= 3:
            try:
                ubc_amount = float(sys.argv[1])
                compute_amount = float(sys.argv[2])
            except ValueError:
                print("Error: UBC and COMPUTE amounts must be numbers")
                sys.exit(1)
        else:
            print("Usage: python redistribute_profits.py <ubc_amount> <compute_amount>")
            sys.exit(1)
        
        # Initialize and run profit redistribution
        redistributor = ProfitRedistributor()
        
        print("\n=== KinKong Profit Redistribution ===")
        print(f"UBC Amount to Distribute: {ubc_amount} UBC")
        print(f"COMPUTE Amount to Distribute: {compute_amount} COMPUTE")
        
        # Calculate and display investor distributions
        print("\n=== Investor Distributions ===")
        distributions = redistributor.calculate_investor_distributions(ubc_amount, compute_amount)
        
        if distributions:
            print(f"{'Wallet':<42} {'Token':<8} {'Share':<8} {'Distribution':<12}")
            print("-" * 80)
            
            # Group distributions by token
            ubc_distributions = [d for d in distributions if d['token'] == 'UBC']
            compute_distributions = [d for d in distributions if d['token'] == 'COMPUTE']
            
            # Print UBC distributions
            for dist in ubc_distributions:
                wallet = dist['wallet']
                # Truncate wallet address for display
                if len(wallet) > 38:
                    wallet_display = wallet[:18] + "..." + wallet[-17:]
                else:
                    wallet_display = wallet
                
                print(f"{wallet_display:<42} {dist['token']:<8} {dist['percentage']:<7.2f}% {dist['amount']:<11.6f}")
            
            # Print COMPUTE distributions
            for dist in compute_distributions:
                wallet = dist['wallet']
                # Truncate wallet address for display
                if len(wallet) > 38:
                    wallet_display = wallet[:18] + "..." + wallet[-17:]
                else:
                    wallet_display = wallet
                
                print(f"{wallet_display:<42} {dist['token']:<8} {dist['percentage']:<7.2f}% {dist['amount']:<11.6f}")
            
            # Verify total distribution matches input amounts
            total_ubc_distributed = sum(d['amount'] for d in distributions if d['token'] == 'UBC')
            total_compute_distributed = sum(d['amount'] for d in distributions if d['token'] == 'COMPUTE')
            
            print("-" * 80)
            print(f"Total UBC Distributed: {total_ubc_distributed:.6f} (should match input: {ubc_amount})")
            print(f"Total COMPUTE Distributed: {total_compute_distributed:.6f} (should match input: {compute_amount})")
            
            # Print subscription status summary
            subscribers = sum(1 for d in distributions if d.get('has_subscription', False))
            non_subscribers = len(set(d['wallet'] for d in distributions)) - subscribers
            print(f"\nSubscription Status: {subscribers} Premium (75%), {non_subscribers} Basic (50%)")
            
            # Check for rounding errors
            if abs(total_ubc_distributed - ubc_amount) > 0.000001:
                print(f"Warning: UBC distribution total differs from input amount by {abs(total_ubc_distributed - ubc_amount):.6f}")
            
            if abs(total_compute_distributed - compute_amount) > 0.000001:
                print(f"Warning: COMPUTE distribution total differs from input amount by {abs(total_compute_distributed - compute_amount):.6f}")
            
            # Save redistribution data to Airtable
            redistribution_id = redistributor.save_redistribution_to_airtable(ubc_amount, compute_amount, distributions)
            if redistribution_id:
                print(f"\n✅ Redistribution saved to Airtable with ID: {redistribution_id}")
            else:
                print("\n❌ Failed to save redistribution to Airtable")
        else:
            print("No investor distributions calculated")
        
    except Exception as e:
        print(f"\n❌ Script failed: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()
