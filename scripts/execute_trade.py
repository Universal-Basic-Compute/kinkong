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
        
        if not signal or signal['fields'].get('status') != 'ACTIVE':
            print(f"Signal {signal_id} not found or not active")
            return False
            
        # Get token details
        tokens_table = Airtable(base_id, 'TOKENS', api_key)
        token_records = tokens_table.get_all(
            formula=f"{{symbol}}='{signal['fields']['token']}'"
        )
        
        if not token_records:
            print(f"Token {signal['fields']['token']} not found")
            return False
            
        token_mint = token_records[0]['fields']['mint']
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
            'signature': result['signature']
        })
        
        return True
        
    except Exception as e:
        print(f"Failed to execute trade: {e}")
        return False
