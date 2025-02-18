from datetime import datetime, timezone
import os
from airtable import Airtable
from dotenv import load_dotenv
import sys
from pathlib import Path

# Add project root to Python path
project_root = str(Path(__file__).parent.parent.absolute())
if project_root not in sys.path:
    sys.path.insert(0, project_root)

def calculate_closed_signals():
    """Calculate metrics for all closed signals that haven't been evaluated yet"""
    try:
        load_dotenv()
        base_id = os.getenv('KINKONG_AIRTABLE_BASE_ID')
        api_key = os.getenv('KINKONG_AIRTABLE_API_KEY')
        
        if not base_id or not api_key:
            raise ValueError("Missing Airtable configuration")
            
        signals_table = Airtable(base_id, 'SIGNALS', api_key)
        
        # Get all signals that:
        # 1. Have expired (expiryDate < NOW)
        # 2. Don't have actualReturn calculated yet
        # 3. Have all required price data
        signals = signals_table.get_all(
            formula="AND("
                    "expiryDate<NOW(), "
                    "OR("
                        "actualReturn=BLANK(), "
                        "accuracy=BLANK()"
                    "), "
                    "entryPrice>0, "
                    "targetPrice>0"
                    ")"
        )
        
        print(f"\n🔍 Found {len(signals)} signals to evaluate")
        
        for signal in signals:
            try:
                fields = signal['fields']
                signal_id = signal['id']
                
                print(f"\nProcessing signal {signal_id} for {fields.get('token')}")
                
                # Get prices
                entry_price = float(fields.get('entryPrice', 0))
                exit_price = float(fields.get('exitPrice', 0))
                target_price = float(fields.get('targetPrice', 0))
                
                if not all([entry_price, exit_price, target_price]):
                    print(f"Missing price data for signal {signal_id}")
                    continue
                
                # Calculate returns
                if fields.get('type') == 'BUY':
                    actual_return = ((exit_price - entry_price) / entry_price) * 100
                    accuracy = 1 if exit_price > entry_price else 0
                else:  # SELL
                    actual_return = ((entry_price - exit_price) / entry_price) * 100
                    accuracy = 1 if exit_price < entry_price else 0
                
                # Update signal with metrics
                update_data = {
                    'actualReturn': round(actual_return, 2),
                    'accuracy': accuracy,
                    'lastUpdateTime': datetime.now(timezone.utc).isoformat()
                }
                
                signals_table.update(signal_id, update_data)
                
                print(f"✅ Updated signal {signal_id}:")
                print(f"Actual Return: {actual_return:.2f}%")
                print(f"Accuracy: {accuracy}")
                
            except Exception as e:
                print(f"❌ Error processing signal {signal_id}: {e}")
                continue
                
        print("\n✅ Finished processing signals")
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        raise

if __name__ == "__main__":
    print("\n🚀 Starting closed signals calculation...")
    calculate_closed_signals()
