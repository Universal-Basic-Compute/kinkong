from datetime import datetime, timezone, timedelta
import os
from airtable import Airtable
from dotenv import load_dotenv
from typing import Dict

def calculate_returns(signal: Dict) -> Dict:
    """Calculate expected and actual returns for a signal"""
    try:
        fields = signal['fields']
        entry_price = float(fields.get('entryPrice', 0))
        target_price = float(fields.get('targetPrice', 0))
        exit_price = float(fields.get('exitPrice', 0)) if fields.get('exitPrice') else None
        signal_type = fields.get('type')
        
        # Calculate expected return
        if signal_type == 'BUY':
            expected_return = ((target_price - entry_price) / entry_price) * 100
            actual_return = ((exit_price - entry_price) / entry_price) * 100 if exit_price else None
        else:  # SELL
            expected_return = ((entry_price - target_price) / entry_price) * 100
            actual_return = ((entry_price - exit_price) / entry_price) * 100 if exit_price else None
            
        # Calculate risk ratio (reward:risk)
        stop_loss = float(fields.get('stopLoss', 0))
        if stop_loss:
            if signal_type == 'BUY':
                risk = abs(entry_price - stop_loss)
                reward = abs(target_price - entry_price)
            else:  # SELL
                risk = abs(stop_loss - entry_price)
                reward = abs(entry_price - target_price)
                
            risk_ratio = round(reward / risk, 2) if risk != 0 else None
        else:
            risk_ratio = None
            
        return {
            'expectedReturn': round(expected_return, 2) if expected_return else None,
            'actualReturn': round(actual_return, 2) if actual_return is not None else None,
            'riskRatio': risk_ratio
        }
        
    except Exception as e:
        print(f"Error calculating returns for signal {signal.get('id')}: {e}")
        return {}

def calculate_expiry_date(timestamp: str, timeframe: str) -> str:
    """Calculate expiry date based on signal timeframe"""
    try:
        creation_time = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
        
        # Define timeframe durations
        durations = {
            'SCALP': timedelta(hours=6),
            'INTRADAY': timedelta(days=1),
            'SWING': timedelta(days=7),
            'POSITION': timedelta(days=30)
        }
        
        expiry_date = creation_time + durations.get(timeframe, durations['INTRADAY'])
        return expiry_date.isoformat()
        
    except Exception as e:
        print(f"Error calculating expiry date: {e}")
        return None

def main():
    try:
        print("\n🔄 Starting signal recalculation...")
        
        # Initialize Airtable
        load_dotenv()
        base_id = os.getenv('KINKONG_AIRTABLE_BASE_ID')
        api_key = os.getenv('KINKONG_AIRTABLE_API_KEY')
        
        if not base_id or not api_key:
            raise ValueError("Missing Airtable configuration")
            
        signals_table = Airtable(base_id, 'SIGNALS', api_key)
        
        # Get all signals
        print("\nFetching signals from Airtable...")
        signals = signals_table.get_all()
        print(f"Found {len(signals)} signals to process")
        
        # Process each signal
        for signal in signals:
            try:
                signal_id = signal['id']
                fields = signal['fields']
                print(f"\nProcessing signal {signal_id} for {fields.get('token')}")
                
                updates = {}
                
                # Calculate expiry date if missing
                if fields.get('timestamp') and fields.get('timeframe'):
                    expiry_date = calculate_expiry_date(
                        fields['timestamp'],
                        fields['timeframe']
                    )
                    if expiry_date:
                        updates['expiryDate'] = expiry_date
                        print(f"Calculated expiry date: {expiry_date}")
                
                # Calculate returns and risk ratio
                calculations = calculate_returns(signal)
                if calculations:
                    updates.update(calculations)
                    print("Calculated metrics:")
                    print(f"Expected Return: {calculations.get('expectedReturn')}%")
                    print(f"Actual Return: {calculations.get('actualReturn')}%")
                    print(f"Risk Ratio: {calculations.get('riskRatio')}:1")
                
                # Update signal if we have any changes
                if updates:
                    signals_table.update(signal_id, updates)
                    print("✅ Signal updated successfully")
                else:
                    print("ℹ️ No updates needed")
                
            except Exception as e:
                print(f"❌ Error processing signal {signal_id}: {e}")
                continue
        
        print("\n✅ Signal recalculation completed")
        
    except Exception as e:
        print(f"\n❌ Fatal error: {e}")
        raise

if __name__ == "__main__":
    main()
