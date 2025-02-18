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
        
        # Get signal details from Airtable
        signals_table = Airtable(base_id, 'SIGNALS', api_key)
        signal = signals_table.get(signal_id)
        
        if not signal:
            print(f"Signal {signal_id} not found")
            return False
            
        fields = signal['fields']
        
        print(f"\n⚙️ Processing signal {signal_id}:")
        print(f"Token: {fields.get('token')}")
        print(f"Type: {fields.get('type', 'Unknown')}")
        print(f"Entry: ${float(fields.get('entryPrice', 0)):.4f}")
        
        # Get token mint address
        tokens_table = Airtable(base_id, 'TOKENS', api_key)
        token_records = tokens_table.get_all(
            formula=f"{{symbol}}='{fields['token']}'"
        )
        if not token_records:
            print(f"❌ No token record found for {fields['token']}")
            return False
        
        token_mint = token_records[0]['fields']['mint']
        print(f"Found mint address: {token_mint}")
        
        # Prepare for trade execution
        usdc_mint = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"  # USDC mint address
        
        # Prepare trade parameters
        trade_params = {
            'inputToken': usdc_mint if fields['type'] == 'BUY' else token_mint,
            'outputToken': token_mint if fields['type'] == 'BUY' else usdc_mint,
            'amount': float(fields['amount']),
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
            'token': fields['token'],
            'type': fields['type'],
            'amount': fields['amount'],
            'price': result['price'],
            'value': float(fields['amount']) * result['price'],
            'signature': result['signature'],
            'status': 'ACTIVE'  # Add initial trade status
        })
        
        return True
        
    except Exception as e:
        print(f"Failed to execute trade: {e}")
        return False
