from datetime import datetime, timezone, timedelta
from typing import Optional
import os
from airtable import Airtable
from dotenv import load_dotenv
from generate_chart import fetch_token_data
from analyze_charts import get_dexscreener_data

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

def get_portfolio_value() -> float:
    """Get total portfolio value in USD"""
    # TODO: Implement actual portfolio value calculation
    return 10000.0  # Temporary fixed value for testing

def calculate_position_size(signal_data: dict, market_data: dict) -> Optional[float]:
    """
    Calculate position size based on risk management rules
    
    Returns amount in tokens or None if calculation fails
    """
    try:
        # Get portfolio value
        portfolio_value = get_portfolio_value()
        
        # Risk per trade (from strategy: 2% max risk per trade)
        risk_percentage = 0.02
        max_risk_amount = portfolio_value * risk_percentage
        
        # Calculate stop loss distance
        entry_price = float(signal_data['entryPrice'])
        stop_loss = float(signal_data['stopLoss'])
        stop_distance = abs(entry_price - stop_loss)
        
        if stop_distance == 0:
            raise ValueError("Invalid stop loss distance")
            
        # Calculate position size based on risk
        position_size = max_risk_amount / stop_distance
        
        # Apply liquidity constraints (max 1% of token liquidity)
        max_liquidity_size = market_data['liquidity'] * 0.01
        position_size = min(position_size, max_liquidity_size)
        
        # Calculate USD value of position
        position_value = position_size * entry_price
        
        # Apply additional constraints
        if position_value < 10:  # Minimum trade size $10
            return None
            
        if position_value > portfolio_value * 0.2:  # Maximum 20% of portfolio
            position_size = (portfolio_value * 0.2) / entry_price
            
        return position_size
        
    except Exception as e:
        print(f"Failed to calculate position size: {e}")
        return None

def activate_signal(signal_id: str) -> bool:
    """
    Attempt to activate a PENDING signal with position sizing
    Returns True if successful, False otherwise
    """
    try:
        load_dotenv()
        base_id = os.getenv('KINKONG_AIRTABLE_BASE_ID')
        api_key = os.getenv('KINKONG_AIRTABLE_API_KEY')
        
        signals_table = Airtable(base_id, 'SIGNALS', api_key)
        signal = signals_table.get(signal_id)
        
        if not signal or signal['fields'].get('status') != 'PENDING':
            return False
            
        # Get current market data
        market_data = get_dexscreener_data(signal['fields'].get('token'))
        if not market_data:
            update_signal_status(signal_id, 'FAILED', 'Could not get market data')
            return False
            
        # Calculate position size
        position_size = calculate_position_size(signal['fields'], market_data)
        if not position_size:
            update_signal_status(signal_id, 'FAILED', 'Position size calculation failed')
            return False
            
        # Update signal with position size and activate it
        signals_table.update(signal_id, {
            'status': 'ACTIVE',
            'amount': position_size,
            'entryValue': position_size * float(signal['fields']['entryPrice']),
            'activationTime': datetime.now(timezone.utc).isoformat()
        })
        
        # Record status change
        update_signal_status(
            signal_id, 
            'ACTIVE', 
            f'Signal activated with position size: {position_size:.4f} tokens'
        )
        
        return True
        
    except Exception as e:
        print(f"Failed to activate signal: {e}")
        return False

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

def check_pending_signals():
    """Check and potentially activate pending signals"""
    try:
        load_dotenv()
        base_id = os.getenv('KINKONG_AIRTABLE_BASE_ID')
        api_key = os.getenv('KINKONG_AIRTABLE_API_KEY')
        
        signals_table = Airtable(base_id, 'SIGNALS', api_key)
        
        # Get all pending signals
        pending_signals = signals_table.get_all(
            formula="AND(status='PENDING', expiryDate>=TODAY())"
        )
        
        for signal in pending_signals:
            signal_id = signal['id']
            fields = signal['fields']
            
            # Get current price
            current_price = get_token_price(fields['token'])
            if not current_price:
                continue
                
            # Check if price is at entry level
            entry_price = float(fields['entryPrice'])
            price_threshold = 0.01  # 1% threshold
            
            if fields['type'] == 'BUY':
                if current_price <= entry_price * (1 + price_threshold):
                    activate_signal(signal_id)
            else:  # SELL
                if current_price >= entry_price * (1 - price_threshold):
                    activate_signal(signal_id)
                    
    except Exception as e:
        print(f"Failed to check pending signals: {e}")

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
    # Run both checks
    check_pending_signals()  # Check for signals to activate
    check_signal_conditions()  # Check active signals for completion
