from datetime import datetime, timezone
import os
from airtable import Airtable
from dotenv import load_dotenv
import time
from execute_trade import execute_trade_with_phantom
from manage_signals import get_token_price, update_signal_status, calculate_pnl

from ratelimit import limits, sleep_and_retry
from datetime import datetime, timezone
import asyncio
from collections import deque

# Rate limits
PRICE_CHECK_LIMIT = 5  # Calls per second
TRADE_BATCH_SIZE = 10  # Max trades per batch
BATCH_INTERVAL = 300   # Seconds between batches (5 minutes)

# Trade queues
entry_queue = deque()
exit_queue = deque()
last_batch_time = datetime.now()

@sleep_and_retry
@limits(calls=PRICE_CHECK_LIMIT, period=1)
def rate_limited_price_check(token):
    """Rate limited price check"""
    return get_token_price(token)

def monitor_active_trades():
    """
    Monitor active trades and queue exits when conditions are met
    """
    try:
        load_dotenv()
        base_id = os.getenv('KINKONG_AIRTABLE_BASE_ID')
        api_key = os.getenv('KINKONG_AIRTABLE_API_KEY')
        
        trades_table = Airtable(base_id, 'TRADES', api_key)
        
        # First check pending trades
        pending_trades = trades_table.get_all(
            formula="AND(status='PENDING', expiryDate>=TODAY())"
        )
        
        for trade in pending_trades:
            try:
                current_price = rate_limited_price_check(trade['fields']['token'])
                if current_price:
                    # Check if price is at entry level
                    entry_price = float(trade['fields']['entryPrice'])
                    if abs(current_price - entry_price) / entry_price <= 0.01:
                        entry_queue.append(trade)
                        print(f"Queued {trade['fields']['token']} for entry")
            except Exception as e:
                print(f"Error checking pending trade: {e}")
                continue
        
        # Then check active trades
        active_trades = trades_table.get_all(
            formula="AND(status='ACTIVE', expiryDate>=TODAY())"
        )
        
        print(f"Monitoring {len(active_trades)} active trades...")
        
        for trade in active_trades:
            try:
                trade_id = trade['id']
                fields = trade['fields']
                
                # Rate limited price check
                current_price = rate_limited_price_check(fields['token'])
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
                
                # Check exit conditions and queue if needed
                if fields['type'] == 'BUY':
                    # Check take profit
                    if current_price >= float(fields['targetPrice']):
                        print(f"🎯 Take profit hit for {fields['token']}")
                        exit_queue.append({
                            'trade_id': trade_id,
                            'type': 'COMPLETED',
                            'reason': f'Take profit reached at {current_price}',
                            'price': current_price
                        })
                    
                    # Check stop loss
                    elif current_price <= float(fields['stopLoss']):
                        print(f"🛑 Stop loss hit for {fields['token']}")
                        exit_queue.append({
                            'trade_id': trade_id,
                            'type': 'STOPPED',
                            'reason': f'Stop loss hit at {current_price}',
                            'price': current_price
                        })
                
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

async def process_trade_batches():
    """Process queued trades in batches"""
    global last_batch_time
    
    while True:
        try:
            current_time = datetime.now()
            if (current_time - last_batch_time).total_seconds() >= BATCH_INTERVAL:
                # Process entry queue
                entry_batch = []
                while entry_queue and len(entry_batch) < TRADE_BATCH_SIZE:
                    entry_batch.append(entry_queue.popleft())
                
                for trade in entry_batch:
                    try:
                        success = execute_trade_with_phantom(trade['id'])
                        if success:
                            update_signal_status(
                                trade['id'],
                                'ACTIVE',
                                'Trade executed in batch',
                                trade['fields'].get('entryPrice')
                            )
                    except Exception as e:
                        print(f"Failed to execute entry trade: {e}")
                        entry_queue.append(trade)  # Put back in queue
                
                # Process exit queue
                exit_batch = []
                while exit_queue and len(exit_batch) < TRADE_BATCH_SIZE:
                    exit_batch.append(exit_queue.popleft())
                
                for exit in exit_batch:
                    try:
                        success = execute_trade_with_phantom(exit['trade_id'])
                        if success:
                            update_signal_status(
                                exit['trade_id'],
                                exit['type'],
                                exit['reason'],
                                exit['price']
                            )
                    except Exception as e:
                        print(f"Failed to execute exit trade: {e}")
                        exit_queue.append(exit)  # Put back in queue
                
                last_batch_time = current_time
            
            await asyncio.sleep(1)  # Check every second
            
        except Exception as e:
            print(f"Error in batch processing: {e}")
            await asyncio.sleep(60)

async def run_trade_monitor(interval_seconds=60):
    """
    Run the trade monitor continuously with specified interval
    """
    print("Starting trade monitor...")
    print(f"Checking trades every {interval_seconds} seconds")
    print(f"Processing trade batches every {BATCH_INTERVAL} seconds")
    
    # Start batch processor
    batch_processor = asyncio.create_task(process_trade_batches())
    
    while True:
        try:
            monitor_active_trades()
            await asyncio.sleep(interval_seconds)
        except KeyboardInterrupt:
            print("\nTrade monitor stopped by user")
            batch_processor.cancel()
            break
        except Exception as e:
            print(f"Error in monitor loop: {e}")
            print("Retrying in 60 seconds...")
            await asyncio.sleep(60)

if __name__ == "__main__":
    try:
        print("\n🔄 Starting trade monitor...")
        # Run the async function with asyncio
        asyncio.run(run_trade_monitor())
    except KeyboardInterrupt:
        print("\n👋 Trade monitor stopped by user")
    except Exception as e:
        print(f"\n❌ Error in main loop: {e}")
