from datetime import datetime, timezone
import os
from airtable import Airtable
from dotenv import load_dotenv
import requests
import json

def execute_trade_with_phantom(signal_id: str) -> bool:
    """
    Execute a trade through Phantom wallet using Jupiter
    Returns True if successful, False otherwise
    """
    try:
        load_dotenv()
        base_id = os.getenv('KINKONG_AIRTABLE_BASE_ID')
        api_key = os.getenv('KINKONG_AIRTABLE_API_KEY')
        
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
        print(f"Accuracy: {results['accuracy']}")
        
        # Update signal with results
        update_data = {
            'exitPrice': results['exitPrice'],
            'actualReturn': round(results['actualReturn'], 2),
            'accuracy': results['accuracy']
        }
        
        signals_table.update(signal_id, update_data)
        
        print(f"\n✅ Updated signal {signal_id} in Airtable")
        usdc_mint = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"  # USDC mint address
        
        # Prepare trade parameters
        trade_params = {
            'inputToken': usdc_mint if signal['fields']['type'] == 'BUY' else token_mint,
            'outputToken': token_mint if signal['fields']['type'] == 'BUY' else usdc_mint,
            'amount': float(signal['fields']['amount']),
            'slippage': 0.01,  # 1% slippage tolerance
            'wallet': os.getenv('STRATEGY_WALLET')
        }
        
        # Call our API endpoint to execute trade
        api_url = f"{os.getenv('NEXT_PUBLIC_BASE_URL')}/api/execute-trade"
        response = requests.post(api_url, json=trade_params)
        
        if not response.ok:
            print(f"Trade execution failed: {response.text}")
            return False
            
        result = response.json()
        
        # Update signal with trade execution details
        signals_table.update(signal_id, {
            'executionPrice': result['price'],
            'executionTimestamp': datetime.now(timezone.utc).isoformat(),
            'transactionSignature': result['signature'],
            'lastUpdateTime': datetime.now(timezone.utc).isoformat()
        })
        
        # Record trade in history
        trades_table = Airtable(base_id, 'TRADES', api_key)
        trades_table.insert({
            'signalId': signal_id,
            'timestamp': datetime.now(timezone.utc).isoformat(),
            'token': signal['fields']['token'],
            'type': signal['fields']['type'],
            'amount': signal['fields']['amount'],
            'price': result['price'],
            'value': float(signal['fields']['amount']) * result['price'],
            'signature': result['signature'],
            'status': 'ACTIVE'  # Add initial trade status
        })
        
        return True
        
    except Exception as e:
        print(f"Failed to execute trade: {e}")
        return False
