from datetime import datetime, timezone, timedelta
import os
from airtable import Airtable
from dotenv import load_dotenv
import sys
from pathlib import Path
import requests

def get_historical_prices(token_mint: str, start_time: datetime, end_time: datetime) -> list:
    """Get historical minute-by-minute prices from Birdeye"""
    try:
        # Validate dates
        now = datetime.now(timezone.utc)
        if start_time > now or end_time > now:
            print("⚠️ Warning: Future dates detected, adjusting to current time window")
            duration = end_time - start_time
            end_time = now
            start_time = end_time - duration

        url = "https://public-api.birdeye.so/defi/history_price"
        params = {
            "address": token_mint,
            "address_type": "token",
            "type": "1m",  # 1-minute candles for most granular data
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
        print(f"Adjusted time range: {start_time.isoformat()} to {end_time.isoformat()}")
        
        response = requests.get(url, params=params, headers=headers)
        if response.ok:
            data = response.json()
            items = data.get('data', {}).get('items', [])
            if not items:
                print("⚠️ No price data returned from Birdeye")
                return []
            print(f"✅ Retrieved {len(items)} price points")
            return items
        else:
            print(f"❌ Birdeye API error: {response.status_code}")
            print(f"Response: {response.text}")
            return []
            
    except Exception as e:
        print(f"❌ Error fetching historical prices: {e}")
        return []

def simulate_trade(prices: list, signal_data: dict) -> dict:
    """Find actual exit price from historical data"""
    entry_price = float(signal_data.get('entryPrice', 0))
    target_price = float(signal_data.get('targetPrice', 0))
    stop_loss = float(signal_data.get('stopLoss', 0))
    signal_type = signal_data.get('type')
    
    # Default to last price if no exit conditions met
    exit_price = float(prices[-1]['value']) if prices else entry_price
    exit_reason = 'EXPIRED'
    time_to_exit = len(prices)  # Default to full duration
    
    for i, price_data in enumerate(prices):
        price = float(price_data['value'])
        
        if signal_type == 'BUY':
            if price >= target_price:
                exit_price = price
                exit_reason = 'COMPLETED'
                time_to_exit = i
                break
            elif price <= stop_loss:
                exit_price = price
                exit_reason = 'STOPPED'
                time_to_exit = i
                break
        else:  # SELL
            if price <= target_price:
                exit_price = price
                exit_reason = 'COMPLETED'
                time_to_exit = i
                break
            elif price >= stop_loss:
                exit_price = price
                exit_reason = 'STOPPED'
                time_to_exit = i
                break
    
    # Calculate returns and success
    if signal_type == 'BUY':
        actual_return = ((exit_price - entry_price) / entry_price) * 100
        success = exit_price > entry_price  # True if profitable
    else:  # SELL
        actual_return = ((entry_price - exit_price) / entry_price) * 100
        success = exit_price < entry_price  # True if profitable
    
    return {
        'exitPrice': exit_price,
        'exitReason': exit_reason,
        'timeToExit': time_to_exit,
        'actualReturn': actual_return,
        'success': success  # Changed from accuracy to boolean success
    }

# Add project root to Python path
project_root = str(Path(__file__).parent.parent.absolute())
if project_root not in sys.path:
    sys.path.insert(0, project_root)
    """Calculate metrics for all closed signals that haven't been evaluated yet"""
    try:
        load_dotenv()
        
        # Verify Birdeye API key
        birdeye_api_key = os.getenv('BIRDEYE_API_KEY')
        if not birdeye_api_key:
            raise ValueError("BIRDEYE_API_KEY not found in environment variables")
        
        base_id = os.getenv('KINKONG_AIRTABLE_BASE_ID')
        api_key = os.getenv('KINKONG_AIRTABLE_API_KEY')
        
        if not base_id or not api_key:
            raise ValueError("Missing Airtable configuration")
            
        signals_table = Airtable(base_id, 'SIGNALS', api_key)
        tokens_table = Airtable(base_id, 'TOKENS', api_key)
        
        print("\n📊 Checking Airtable for signals...")
        
        # First get all signals
        all_signals = signals_table.get_all()
        print(f"Total signals in database: {len(all_signals)}")
        
        # Get signals that need evaluation
        signals = signals_table.get_all(
            formula="AND("
                    "expiryDate<NOW(), "  # Expired signals
                    "OR("
                        "actualReturn=BLANK(), "  # Missing actual return
                        "success=BLANK()"        # Missing success flag
                    "), "
                    "entryPrice>0, "             # Has entry price
                    "targetPrice>0"              # Has target price
                    ")"
        )
        
        print("\n🔍 Signal Filter Results:")
        print(f"Found {len(signals)} signals to evaluate that match criteria:")
        print("- Past expiry date")
        print("- Missing actualReturn or accuracy")
        print("- Has valid entry and target prices")
        
        for signal in signals:
            try:
                fields = signal['fields']
                signal_id = signal['id']
                
                print(f"\n⚙️ Processing signal {signal_id}:")
                print(f"Token: {fields.get('token')}")
                print(f"Type: {fields.get('type', 'Unknown')}")
                print(f"Entry: ${float(fields.get('entryPrice', 0)):.4f}")
                
                # Get token mint address
                token_records = tokens_table.get_all(
                    formula=f"{{symbol}}='{fields['token']}'"
                )
                if not token_records:
                    print(f"❌ No token record found for {fields['token']}")
                    continue
                
                token_mint = token_records[0]['fields']['mint']
                print(f"Found mint address: {token_mint}")
                
                # Get historical prices
                activation_time = datetime.fromisoformat(fields['timestamp'].replace('Z', '+00:00'))
                expiry_time = datetime.fromisoformat(fields['expiryDate'].replace('Z', '+00:00'))
                
                prices = get_historical_prices(token_mint, activation_time, expiry_time)
                if not prices:
                    print(f"❌ No price data available for {fields['token']}")
                    continue
                
                print(f"\n💹 Simulating trade for {fields['token']}...")
                # Simulate trade with actual price data
                results = simulate_trade(prices, fields)
                
                print(f"\n📝 Trade simulation results:")
                print(f"Exit Price: ${results['exitPrice']:.4f}")
                print(f"Exit Reason: {results['exitReason']}")
                print(f"Time to Exit: {results['timeToExit']} minutes")
                print(f"Actual Return: {results['actualReturn']:.2f}%")
                print(f"Success: {'✅' if results['success'] else '❌'}")
                
                # Update signal with results
                update_data = {
                    'exitPrice': results['exitPrice'],
                    'actualReturn': round(results['actualReturn'], 2),
                    'success': results['success']
                }
                
                signals_table.update(signal_id, update_data)
                
                print(f"\n✅ Updated signal {signal_id} in Airtable")
                
            except Exception as e:
                print(f"❌ Error processing signal {signal_id}: {e}")
                continue
                
        print("\n✅ Finished processing signals")
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        raise

def get_historical_prices(token_mint: str, start_time: datetime, end_time: datetime) -> list:
    """Get historical minute-by-minute prices from Birdeye"""
    try:
        # Validate dates
        now = datetime.now(timezone.utc)
        if start_time > now or end_time > now:
            print("⚠️ Warning: Future dates detected, adjusting to current time window")
            duration = end_time - start_time
            end_time = now
            start_time = end_time - duration

        url = "https://public-api.birdeye.so/defi/history_price"
        params = {
            "address": token_mint,
            "address_type": "token",
            "type": "1m",  # 1-minute candles for most granular data
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
        print(f"Adjusted time range: {start_time.isoformat()} to {end_time.isoformat()}")
        
        response = requests.get(url, params=params, headers=headers)
        if response.ok:
            data = response.json()
            items = data.get('data', {}).get('items', [])
            if not items:
                print("⚠️ No price data returned from Birdeye")
                return []
            print(f"✅ Retrieved {len(items)} price points")
            return items
        else:
            print(f"❌ Birdeye API error: {response.status_code}")
            print(f"Response: {response.text}")
            return []
            
    except Exception as e:
        print(f"❌ Error fetching historical prices: {e}")
        return []

def simulate_trade(prices: list, signal_data: dict) -> dict:
    """Find actual exit price from historical data"""
    entry_price = float(signal_data.get('entryPrice', 0))
    target_price = float(signal_data.get('targetPrice', 0))
    stop_loss = float(signal_data.get('stopLoss', 0))
    signal_type = signal_data.get('type')
    
    # Default to last price if no exit conditions met
    exit_price = float(prices[-1]['value']) if prices else entry_price
    exit_reason = 'EXPIRED'
    time_to_exit = len(prices)  # Default to full duration
    
    for i, price_data in enumerate(prices):
        price = float(price_data['value'])
        
        if signal_type == 'BUY':
            if price >= target_price:
                exit_price = price
                exit_reason = 'COMPLETED'
                time_to_exit = i
                break
            elif price <= stop_loss:
                exit_price = price
                exit_reason = 'STOPPED'
                time_to_exit = i
                break
        else:  # SELL
            if price <= target_price:
                exit_price = price
                exit_reason = 'COMPLETED'
                time_to_exit = i
                break
            elif price >= stop_loss:
                exit_price = price
                exit_reason = 'STOPPED'
                time_to_exit = i
                break
    
    # Calculate returns and success
    if signal_type == 'BUY':
        actual_return = ((exit_price - entry_price) / entry_price) * 100
        success = exit_price > entry_price  # True if profitable
    else:  # SELL
        actual_return = ((entry_price - exit_price) / entry_price) * 100
        success = exit_price < entry_price  # True if profitable
    
    return {
        'exitPrice': exit_price,
        'exitReason': exit_reason,
        'timeToExit': time_to_exit,
        'actualReturn': actual_return,
        'success': success
    }

def calculate_closed_signals():
    """Calculate metrics for all closed signals that haven't been evaluated yet"""
    try:
        load_dotenv()
        
        # Verify Birdeye API key
        birdeye_api_key = os.getenv('BIRDEYE_API_KEY')
        if not birdeye_api_key:
            raise ValueError("BIRDEYE_API_KEY not found in environment variables")
        
        base_id = os.getenv('KINKONG_AIRTABLE_BASE_ID')
        api_key = os.getenv('KINKONG_AIRTABLE_API_KEY')
        
        if not base_id or not api_key:
            raise ValueError("Missing Airtable configuration")
            
        signals_table = Airtable(base_id, 'SIGNALS', api_key)
        tokens_table = Airtable(base_id, 'TOKENS', api_key)
        
        print("\n📊 Checking Airtable for signals...")
        
        # First get all signals
        all_signals = signals_table.get_all()
        print(f"Total signals in database: {len(all_signals)}")
        
        # Get signals that need evaluation
        signals = signals_table.get_all(
            formula="AND("
                    "expiryDate<NOW(), "  # Expired signals
                    "actualReturn=BLANK(), "  # Missing actual return
                    "entryPrice>0, "          # Has entry price
                    "targetPrice>0"           # Has target price
                    ")"
        )
        
        print("\n🔍 Signal Filter Results:")
        print(f"Found {len(signals)} signals to evaluate that match criteria:")
        print("- Past expiry date")
        print("- Missing actualReturn or accuracy")
        print("- Has valid entry and target prices")
        
        # Log details of found signals
        for signal in signals:
            fields = signal['fields']
            print(f"\n📝 Signal Details:")
            print(f"ID: {signal['id']}")
            print(f"Token: {fields.get('token')}")
            print(f"Type: {fields.get('type')}")
            print(f"Timeframe: {fields.get('timeframe')}")
            print(f"Entry Price: ${float(fields.get('entryPrice', 0)):.4f}")
            print(f"Target Price: ${float(fields.get('targetPrice', 0)):.4f}")
            print(f"Stop Loss: ${float(fields.get('stopLoss', 0)):.4f}")
            print(f"Created: {fields.get('timestamp')}")
            print(f"Expires: {fields.get('expiryDate')}")
        
        for signal in signals:
            try:
                fields = signal['fields']
                signal_id = signal['id']
                
                print(f"\n⚙️ Processing signal {signal_id}:")
                print(f"Token: {fields.get('token')}")
                print(f"Type: {fields.get('type', 'Unknown')}")
                print(f"Entry: ${float(fields.get('entryPrice', 0)):.4f}")
                
                # Get token mint address
                token_records = tokens_table.get_all(
                    formula=f"{{symbol}}='{fields['token']}'"
                )
                if not token_records:
                    print(f"❌ No token record found for {fields['token']}")
                    continue
                
                token_mint = token_records[0]['fields']['mint']
                print(f"Found mint address: {token_mint}")
                
                # Get historical prices
                activation_time = datetime.fromisoformat(fields['timestamp'].replace('Z', '+00:00'))
                expiry_time = datetime.fromisoformat(fields['expiryDate'].replace('Z', '+00:00'))
                
                prices = get_historical_prices(token_mint, activation_time, expiry_time)
                if not prices:
                    print(f"❌ No price data available for {fields['token']}")
                    continue
                
                # Simulate trade with actual price data
                results = simulate_trade(prices, fields)
                
                # Update signal with results - only fields in Signal interface
                update_data = {
                    'exitPrice': results['exitPrice'],
                    'actualReturn': round(results['actualReturn'], 2),
                    'success': results['success']
                }
                
                signals_table.update(signal_id, update_data)
                
                print(f"\n✅ Updated signal {signal_id}:")
                print(f"Exit Price: ${results['exitPrice']:.4f}")
                print(f"Actual Return: {results['actualReturn']:.2f}%")
                print(f"Success: {'✅' if results['success'] else '❌'}")  # Updated logging
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
