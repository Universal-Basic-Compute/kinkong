from datetime import datetime, timezone
import os
from airtable import Airtable
from dotenv import load_dotenv
import sys
from pathlib import Path
import requests

# Add project root to Python path
project_root = str(Path(__file__).parent.parent.absolute())
if project_root not in sys.path:
    sys.path.insert(0, project_root)

def get_historical_prices(token_mint: str, start_time: datetime, end_time: datetime) -> list:
    """Get historical minute-by-minute prices from Birdeye"""
    try:
        url = "https://public-api.birdeye.so/defi/history_price"
        params = {
            "address": token_mint,
            "address_type": "token",
            "type": "1m",  # 1-minute candles
            "time_from": int(start_time.timestamp()),
            "time_to": int(end_time.timestamp())
        }
        headers = {
            "X-API-KEY": os.getenv('BIRDEYE_API_KEY'),
            "x-chain": "solana",
            'accept': 'application/json',
            'User-Agent': 'Mozilla/5.0'
        }
        
        print(f"Fetching price history for {token_mint}")
        print(f"Time range: {start_time.isoformat()} to {end_time.isoformat()}")
        
        response = requests.get(url, params=params, headers=headers)
        if response.ok:
            data = response.json()
            return data.get('data', {}).get('items', [])
        else:
            print(f"Birdeye API error: {response.status_code}")
            print(f"Response: {response.text}")
            return []
            
    except Exception as e:
        print(f"Error fetching historical prices: {e}")
        return []

def simulate_trade(prices: list, signal_data: dict) -> dict:
    """Simulate trade execution and return results"""
    entry_price = float(signal_data.get('entryPrice', 0))
    target_price = float(signal_data.get('targetPrice', 0))
    stop_loss = float(signal_data.get('stopLoss', 0))
    signal_type = signal_data.get('type')
    
    exit_price = entry_price  # Default to entry if no conditions met
    exit_reason = 'EXPIRED'
    time_to_exit = len(prices)  # Default to full duration
    
    for i, price_data in enumerate(prices):
        price = float(price_data['value'])
        
        if signal_type == 'BUY':
            if price >= target_price:
                exit_price = target_price
                exit_reason = 'COMPLETED'
                time_to_exit = i
                break
            elif price <= stop_loss:
                exit_price = stop_loss
                exit_reason = 'STOPPED'
                time_to_exit = i
                break
        else:  # SELL
            if price <= target_price:
                exit_price = target_price
                exit_reason = 'COMPLETED'
                time_to_exit = i
                break
            elif price >= stop_loss:
                exit_price = stop_loss
                exit_reason = 'STOPPED'
                time_to_exit = i
                break
    
    # Calculate returns
    if signal_type == 'BUY':
        actual_return = ((exit_price - entry_price) / entry_price) * 100
        accuracy = 1 if exit_price > entry_price else 0
    else:  # SELL
        actual_return = ((entry_price - exit_price) / entry_price) * 100
        accuracy = 1 if exit_price < entry_price else 0
    
    return {
        'exitPrice': exit_price,
        'exitReason': exit_reason,
        'timeToExit': time_to_exit,
        'actualReturn': actual_return,
        'accuracy': accuracy
    }

def calculate_closed_signals():
    """Calculate metrics for all closed signals that haven't been evaluated yet"""
    try:
        load_dotenv()
        base_id = os.getenv('KINKONG_AIRTABLE_BASE_ID')
        api_key = os.getenv('KINKONG_AIRTABLE_API_KEY')
        
        if not base_id or not api_key:
            raise ValueError("Missing Airtable configuration")
            
        signals_table = Airtable(base_id, 'SIGNALS', api_key)
        tokens_table = Airtable(base_id, 'TOKENS', api_key)
        
        # Get all signals that need evaluation
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
                
                # Get token mint address
                token_records = tokens_table.get_all(
                    formula=f"{{symbol}}='{fields['token']}'"
                )
                if not token_records:
                    print(f"No token record found for {fields['token']}")
                    continue
                
                token_mint = token_records[0]['fields']['mint']
                
                # Get historical prices
                activation_time = datetime.fromisoformat(fields['timestamp'].replace('Z', '+00:00'))
                expiry_time = datetime.fromisoformat(fields['expiryDate'].replace('Z', '+00:00'))
                
                prices = get_historical_prices(token_mint, activation_time, expiry_time)
                if not prices:
                    print(f"No price data available for {fields['token']}")
                    continue
                
                # Simulate trade
                results = simulate_trade(prices, fields)
                
                # Update signal with results
                update_data = {
                    'exitPrice': results['exitPrice'],
                    'actualReturn': round(results['actualReturn'], 2),
                    'accuracy': results['accuracy'],
                    'timeToExit': results['timeToExit'],
                    'lastUpdateTime': datetime.now(timezone.utc).isoformat()
                }
                
                signals_table.update(signal_id, update_data)
                
                print(f"✅ Updated signal {signal_id}:")
                print(f"Exit Price: ${results['exitPrice']:.4f}")
                print(f"Actual Return: {results['actualReturn']:.2f}%")
                print(f"Accuracy: {results['accuracy']}")
                print(f"Time to Exit: {results['timeToExit']} minutes")
                
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
