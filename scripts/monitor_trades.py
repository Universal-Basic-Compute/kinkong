from datetime import datetime, timezone
import os
from airtable import Airtable
from dotenv import load_dotenv
import time
from execute_trade import execute_trade_with_phantom
from manage_signals import get_token_price, update_signal_status, calculate_pnl

def monitor_active_trades():
    """
    Monitor active trades and execute exits when conditions are met
    """
    try:
        load_dotenv()
        base_id = os.getenv('KINKONG_AIRTABLE_BASE_ID')
        api_key = os.getenv('KINKONG_AIRTABLE_API_KEY')
        
        signals_table = Airtable(base_id, 'SIGNALS', api_key)
        
        # Get all active trades
        active_trades = signals_table.get_all(
            formula="AND(status='ACTIVE', expiryDate>=TODAY())"
        )
        
        print(f"Monitoring {len(active_trades)} active trades...")
        
        for trade in active_trades:
            try:
                trade_id = trade['id']
                fields = trade['fields']
                
                # Get current market price
                current_price = get_token_price(fields['token'])
                if not current_price:
                    print(f"Could not get price for {fields['token']}, skipping...")
                    continue
                
                print(f"\nChecking {fields['token']} trade:")
                print(f"Current price: {current_price}")
                print(f"Target: {fields['targetPrice']}")
                print(f"Stop: {fields['stopLoss']}")
                
                # Update unrealized P&L
                pnl = calculate_pnl(fields, current_price)
                signals_table.update(trade_id, {
                    'unrealizedPnl': pnl['unrealized_pnl'],
                    'roi': pnl['roi'],
                    'lastUpdateTime': datetime.now(timezone.utc).isoformat()
                })
                
                # Check exit conditions
                if fields['type'] == 'BUY':
                    # Check take profit
                    if current_price >= float(fields['targetPrice']):
                        print(f"🎯 Take profit hit for {fields['token']}")
                        success = execute_trade_with_phantom(trade_id)
                        if success:
                            update_signal_status(
                                trade_id,
                                'COMPLETED',
                                f'Take profit reached at {current_price}',
                                current_price
                            )
                            print(f"✅ Closed {fields['token']} trade at take profit")
                        else:
                            print(f"❌ Failed to execute take profit for {fields['token']}")
                    
                    # Check stop loss
                    elif current_price <= float(fields['stopLoss']):
                        print(f"🛑 Stop loss hit for {fields['token']}")
                        success = execute_trade_with_phantom(trade_id)
                        if success:
                            update_signal_status(
                                trade_id,
                                'STOPPED',
                                f'Stop loss hit at {current_price}',
                                current_price
                            )
                            print(f"✅ Closed {fields['token']} trade at stop loss")
                        else:
                            print(f"❌ Failed to execute stop loss for {fields['token']}")
                
                else:  # SELL trades
                    # Check take profit
                    if current_price <= float(fields['targetPrice']):
                        print(f"🎯 Take profit hit for {fields['token']}")
                        success = execute_trade_with_phantom(trade_id)
                        if success:
                            update_signal_status(
                                trade_id,
                                'COMPLETED',
                                f'Take profit reached at {current_price}',
                                current_price
                            )
                            print(f"✅ Closed {fields['token']} trade at take profit")
                        else:
                            print(f"❌ Failed to execute take profit for {fields['token']}")
                    
                    # Check stop loss
                    elif current_price >= float(fields['stopLoss']):
                        print(f"🛑 Stop loss hit for {fields['token']}")
                        success = execute_trade_with_phantom(trade_id)
                        if success:
                            update_signal_status(
                                trade_id,
                                'STOPPED',
                                f'Stop loss hit at {current_price}',
                                current_price
                            )
                            print(f"✅ Closed {fields['token']} trade at stop loss")
                        else:
                            print(f"❌ Failed to execute stop loss for {fields['token']}")
                
                # Check expiry
                expiry_date = datetime.fromisoformat(fields['expiryDate'].replace('Z', '+00:00'))
                if datetime.now(timezone.utc) >= expiry_date:
                    print(f"⏰ Trade expired for {fields['token']}")
                    success = execute_trade_with_phantom(trade_id)
                    if success:
                        update_signal_status(
                            trade_id,
                            'EXPIRED',
                            f'Position expired at {current_price}',
                            current_price
                        )
                        print(f"✅ Closed expired {fields['token']} trade")
                    else:
                        print(f"❌ Failed to close expired trade for {fields['token']}")
                
            except Exception as trade_error:
                print(f"Error processing trade {trade_id}: {trade_error}")
                continue
        
    except Exception as e:
        print(f"Error monitoring trades: {e}")

def run_trade_monitor(interval_seconds=60):
    """
    Run the trade monitor continuously with specified interval
    """
    print("Starting trade monitor...")
    print(f"Checking trades every {interval_seconds} seconds")
    
    while True:
        try:
            monitor_active_trades()
            time.sleep(interval_seconds)
        except KeyboardInterrupt:
            print("\nTrade monitor stopped by user")
            break
        except Exception as e:
            print(f"Error in monitor loop: {e}")
            print("Retrying in 60 seconds...")
            time.sleep(60)

if __name__ == "__main__":
    run_trade_monitor()
