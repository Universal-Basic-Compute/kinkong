from datetime import datetime, timezone, timedelta
from typing import Optional
import os
from airtable import Airtable
from dotenv import load_dotenv
from generate_chart import fetch_token_data

def get_token_price(token: str) -> Optional[float]:
    """Get current token price from most recent candle"""
    try:
        df = fetch_token_data('1m', 1, token)
        if df is not None and not df.empty:
            return df.iloc[-1]['Close']
        return None
    except Exception as e:
        print(f"Error getting token price: {e}")
        return None

def update_signal_status(signal_id: str, new_status: str, reason: str = None):
    """Update the status of a signal and add a status change record"""
    try:
        load_dotenv()
        base_id = os.getenv('KINKONG_AIRTABLE_BASE_ID')
        api_key = os.getenv('KINKONG_AIRTABLE_API_KEY')
        
        signals_table = Airtable(base_id, 'SIGNALS', api_key)
        status_table = Airtable(base_id, 'SIGNAL_STATUS_HISTORY', api_key)
        
        # Update signal
        signals_table.update(signal_id, {
            'status': new_status,
            'lastUpdateTime': datetime.now(timezone.utc).isoformat()
        })
        
        # Record status change
        status_table.insert({
            'signalId': signal_id,
            'status': new_status,
            'timestamp': datetime.now(timezone.utc).isoformat(),
            'reason': reason or f"Status changed to {new_status}"
        })
        
    except Exception as e:
        print(f"Failed to update signal status: {e}")

def check_signal_conditions():
    """Check all active signals for status changes"""
    try:
        load_dotenv()
        base_id = os.getenv('KINKONG_AIRTABLE_BASE_ID')
        api_key = os.getenv('KINKONG_AIRTABLE_API_KEY')
        
        signals_table = Airtable(base_id, 'SIGNALS', api_key)
        
        # Get all active signals
        active_signals = signals_table.get_all(
            formula="AND(status='ACTIVE', expiryDate>=TODAY())"
        )
        
        for signal in active_signals:
            signal_id = signal['id']
            fields = signal['fields']
            
            current_price = get_token_price(fields['token'])
            if not current_price:
                continue
                
            # Check conditions
            if fields['type'] == 'BUY':
                if current_price >= float(fields['targetPrice']):
                    update_signal_status(signal_id, 'COMPLETED', 'Take profit reached')
                elif current_price <= float(fields['stopLoss']):
                    update_signal_status(signal_id, 'STOPPED', 'Stop loss hit')
            else:  # SELL
                if current_price <= float(fields['targetPrice']):
                    update_signal_status(signal_id, 'COMPLETED', 'Take profit reached')
                elif current_price >= float(fields['stopLoss']):
                    update_signal_status(signal_id, 'STOPPED', 'Stop loss hit')
        
        # Check for expired signals
        expired_signals = signals_table.get_all(
            formula="AND(status='ACTIVE', expiryDate<TODAY())"
        )
        
        for signal in expired_signals:
            update_signal_status(signal['id'], 'EXPIRED', 'Signal duration expired')
            
    except Exception as e:
        print(f"Failed to check signal conditions: {e}")

if __name__ == "__main__":
    check_signal_conditions()
