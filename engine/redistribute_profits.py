#!/usr/bin/env python3
import os
import json
import sys
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
        load_dotenv()
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
        
        # Get investment values
        current_investment_value = self.get_total_investments_value()
        past_investment_value = self.get_total_investments_value(seven_days_ago)
        
        # Calculate profit
        current_profit = current_wallet_value - current_investment_value
        past_profit = past_wallet_value - past_investment_value
        total_profit = current_profit - past_profit
        
        # Display the calculation details
        self.logger.info("\n=== Profit Calculation ===")
        self.logger.info(f"Current Wallet Value: ${current_wallet_value:.2f}")
        self.logger.info(f"Current Investment Value: ${current_investment_value:.2f}")
        self.logger.info(f"Current Profit: ${current_profit:.2f}")
        self.logger.info(f"Past Wallet Value (7 days ago): ${past_wallet_value:.2f}")
        self.logger.info(f"Past Investment Value (7 days ago): ${past_investment_value:.2f}")
        self.logger.info(f"Past Profit (7 days ago): ${past_profit:.2f}")
        self.logger.info(f"Total Profit (7 days): ${total_profit:.2f}")
        
        # Calculate distribution pools
        if total_profit <= 0:
            self.logger.warning("No profit to distribute")
            return {
                "total_profit": total_profit,
                "pool_1": 0,  # 25% pool
                "pool_2": 0   # 75% pool
            }
        
        pool_1 = total_profit * 0.25  # 25% pool
        pool_2 = total_profit * 0.75  # 75% pool
        
        self.logger.info("\n=== Profit Distribution ===")
        self.logger.info(f"Total Profit to Distribute: ${total_profit:.2f}")
        self.logger.info(f"Pool 1 (25%): ${pool_1:.2f}")
        self.logger.info(f"Pool 2 (75%): ${pool_2:.2f}")
        
        return {
            "total_profit": total_profit,
            "pool_1": pool_1,
            "pool_2": pool_2
        }

def main():
    try:
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
        
        # Initialize and run profit redistribution
        redistributor = ProfitRedistributor()
        result = redistributor.calculate_profit_distribution()
        
        if result:
            print("\n=== KinKong Profit Redistribution ===")
            print(f"Total Profit (7 days): ${result['total_profit']:.2f}")
            print(f"Pool 1 (25%): ${result['pool_1']:.2f}")
            print(f"Pool 2 (75%): ${result['pool_2']:.2f}")
        
    except Exception as e:
        print(f"\n❌ Script failed: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()
