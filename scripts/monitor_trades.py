from datetime import datetime, timezone, timedelta
import os
from airtable import Airtable
from dotenv import load_dotenv
import time
import requests
from execute_trade import execute_trade_with_phantom
from manage_signals import get_token_price, update_signal_status, calculate_pnl

from ratelimit import limits, sleep_and_retry
from datetime import datetime, timezone
import asyncio
from collections import deque

# Rate limits and safety thresholds
PRICE_CHECK_LIMIT = 5      # Calls per second
TRADE_BATCH_SIZE = 10      # Max trades per batch
BATCH_INTERVAL = 300       # Seconds between batches (5 minutes)
MAX_RETRIES = 3           # Maximum retry attempts
PRICE_CHANGE_LIMIT = 0.10  # Maximum 10% price change for safety
ERROR_COOLDOWN = 60       # Seconds to wait after error

# Trade queues and state
entry_queue = deque()
exit_queue = deque()
last_batch_time = datetime.now()
execution_attempts = {}    # Track retry attempts
last_known_prices = {}    # Cache recent prices

@sleep_and_retry
@limits(calls=PRICE_CHECK_LIMIT, period=1)
def rate_limited_price_check(token_symbol, validate_change=True):
    """
    Rate limited price check with token lookup using DexScreener
    
    Args:
        token_symbol: Token symbol to check
        validate_change: Whether to validate price change vs last known price
    Returns:
        float: Current price if valid, None if error or invalid
    """
    try:
        # First get token mint from Airtable
        base_id = os.getenv('KINKONG_AIRTABLE_BASE_ID')
        api_key = os.getenv('KINKONG_AIRTABLE_API_KEY')
        tokens_table = Airtable(base_id, 'TOKENS', api_key)
        
        # Look up token by symbol
        token_records = tokens_table.get_all(
            formula=f"{{symbol}}='{token_symbol}'"
        )
        
        if not token_records:
            print(f"No token record found for symbol {token_symbol}")
            return None
            
        token_mint = token_records[0]['fields']['mint']
        print(f"Found mint address for {token_symbol}: {token_mint}")
        
        # Use DexScreener API
        url = f"https://api.dexscreener.com/latest/dex/tokens/{token_mint}"
        headers = {
            'User-Agent': 'Mozilla/5.0',
            'Accept': 'application/json'
        }
        
        print(f"Requesting DexScreener data for {token_symbol} ({token_mint})")
        response = requests.get(url, headers=headers)
        
        if response.ok:
            data = response.json()
            
            if not data.get('pairs'):
                print(f"No pairs found for {token_symbol}")
                return None
                
            # Get the most liquid Solana pair
            sol_pairs = [p for p in data['pairs'] if p.get('chainId') == 'solana']
            if not sol_pairs:
                print(f"No Solana pairs found for {token_symbol}")
                return None
                
            main_pair = max(sol_pairs, key=lambda x: float(x.get('liquidity', {}).get('usd', 0)))
            price = float(main_pair.get('priceUsd', 0))
            
            # Validate price change if enabled
            if validate_change and token_symbol in last_known_prices:
                last_price = last_known_prices[token_symbol]
                price_change = abs(price - last_price) / last_price
                
                if price_change > PRICE_CHANGE_LIMIT:
                    print(f"⚠️ Suspicious price change for {token_symbol}: {price_change:.1%}")
                    return None
                    
            # Cache valid price
            last_known_prices[token_symbol] = price
            print(f"Got price for {token_symbol}: ${price}")
            return price
            
        else:
            print(f"DexScreener API request failed: {response.status_code} - {response.text}")
            return None
        
    except Exception as e:
        print(f"Error checking price for {token_symbol}: {e}")
        return None

def monitor_active_trades():
    """Monitor active trades and queue exits when conditions are met"""
    try:
        load_dotenv()
        base_id = os.getenv('KINKONG_AIRTABLE_BASE_ID')
        api_key = os.getenv('KINKONG_AIRTABLE_API_KEY')
        
        trades_table = Airtable(base_id, 'TRADES', api_key)
        
        # Define timeframe monitoring frequencies
        timeframe_check_intervals = {
            'SCALP': timedelta(minutes=5),      # Check every 5 minutes
            'INTRADAY': timedelta(minutes=15),  # Check every 15 minutes
            'SWING': timedelta(hours=1),        # Check every hour
            'POSITION': timedelta(hours=4)      # Check every 4 hours
        }
        
        print("\n🔍 Checking for trades to monitor...")
        
        # First check pending trades
        pending_trades = trades_table.get_all(
            formula="AND(status='PENDING', expiryDate>=TODAY())"
        )
        print(f"Found {len(pending_trades)} pending trades")
        
        for trade in pending_trades:
            try:
                token = trade['fields'].get('token')
                timeframe = trade['fields'].get('timeframe')  # Should be SCALP, INTRADAY, etc.
                
                # Skip if not due for check based on timeframe
                last_check = datetime.fromisoformat(trade['fields'].get('createdAt', '').replace('Z', '+00:00'))
                check_interval = timeframe_check_intervals.get(timeframe, timedelta(minutes=15))
                if datetime.now(timezone.utc) - last_check < check_interval:
                    print(f"Skipping {token} check - Not due yet for {timeframe} timeframe")
                    continue
                    
                print(f"\n📊 Checking pending trade for {token}")
                current_price = rate_limited_price_check(token)
                if current_price is None:
                    print(f"❌ Could not get current price for {token}, skipping...")
                    continue
                
                # Check if price is at entry level
                entry_price = float(trade['fields'].get('entryPrice', 0))
                price_diff_pct = abs(current_price - entry_price) / entry_price
                
                print(f"Entry price: ${entry_price:.4f}")
                print(f"Current price: ${current_price:.4f}")
                print(f"Price difference: {price_diff_pct:.2%}")
                
                if price_diff_pct <= 0.01:  # Within 1%
                    print(f"✅ Price at entry level for {token}, queueing for execution")
                    entry_queue.append(trade)
                else:
                    print(f"⏳ Waiting for better entry price for {token}")
                    
            except Exception as e:
                print(f"❌ Error checking pending trade: {e}")
                continue
        
        # Then check active trades
        active_trades = trades_table.get_all(
            formula="AND(status='ACTIVE', expiryDate>=TODAY())"
        )
        print(f"\n👀 Monitoring {len(active_trades)} active trades...")
        
        for trade in active_trades:
            try:
                trade_id = trade['id']
                fields = trade['fields']
                token = fields.get('token')
                
                print(f"\n🔄 Checking {token} trade:")
                current_price = rate_limited_price_check(token)
                
                if current_price is None:
                    print(f"❌ Could not get current price for {token}, skipping...")
                    continue
                
                print(f"Current price: ${current_price:.4f}")
                print(f"Target: ${float(fields['targetPrice']):.4f}")
                print(f"Stop: ${float(fields['stopLoss']):.4f}")
                
                # Check exit conditions
                if fields['type'] == 'BUY':
                    if current_price >= float(fields['targetPrice']):
                        print(f"🎯 Take profit hit for {token}")
                        exit_queue.append({
                            'trade_id': trade_id,
                            'type': 'COMPLETED',
                            'reason': f'Take profit reached at ${current_price:.4f}',
                            'price': current_price
                        })
                    elif current_price <= float(fields['stopLoss']):
                        print(f"🛑 Stop loss hit for {token}")
                        exit_queue.append({
                            'trade_id': trade_id,
                            'type': 'STOPPED',
                            'reason': f'Stop loss hit at ${current_price:.4f}',
                            'price': current_price
                        })
                else:  # SELL trades
                    if current_price <= float(fields['targetPrice']):
                        print(f"🎯 Take profit hit for {token}")
                        exit_queue.append({
                            'trade_id': trade_id,
                            'type': 'COMPLETED',
                            'reason': f'Take profit reached at ${current_price:.4f}',
                            'price': current_price
                        })
                    elif current_price >= float(fields['stopLoss']):
                        print(f"🛑 Stop loss hit for {token}")
                        exit_queue.append({
                            'trade_id': trade_id,
                            'type': 'STOPPED',
                            'reason': f'Stop loss hit at ${current_price:.4f}',
                            'price': current_price
                        })
                
                # Check expiry
                try:
                    expiry_date = datetime.fromisoformat(fields['expiryDate'].replace('Z', '+00:00'))
                    if datetime.now(timezone.utc) >= expiry_date:
                        print(f"⏰ Trade expired for {token}")
                        exit_queue.append({
                            'trade_id': trade_id,
                            'type': 'EXPIRED',
                            'reason': f'Position expired at ${current_price:.4f}',
                            'price': current_price,
                            'exitTime': datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')
                        })
                except (ValueError, KeyError) as e:
                    print(f"❌ Error parsing expiry date: {e}")
                    continue
                
            except Exception as e:
                print(f"❌ Error processing trade {trade_id}: {e}")
                continue
                
        # Print queue status
        print(f"\n📋 Status:")
        print(f"Entry queue: {len(entry_queue)} trades")
        print(f"Exit queue: {len(exit_queue)} trades")
        
    except Exception as e:
        print(f"❌ Error monitoring trades: {e}")

async def process_trade_batches():
    """Process queued trades in batches"""
    global last_batch_time
    
    # Initialize Airtable connection
    base_id = os.getenv('KINKONG_AIRTABLE_BASE_ID')
    api_key = os.getenv('KINKONG_AIRTABLE_API_KEY')
    trades_table = Airtable(base_id, 'TRADES', api_key)
    
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
                        trade_id = trade['id']
                        attempts = execution_attempts.get(trade_id, 0)
                    
                        if attempts >= MAX_RETRIES:
                            print(f"❌ Max retries exceeded for trade {trade_id}")
                            continue
                        
                        success = execute_trade_with_phantom(trade_id)
                        if success:
                            # Update trade status
                            trades_table.update(trade_id, {
                                'status': 'ACTIVE',
                                'lastUpdateTime': datetime.now(timezone.utc).isoformat(),
                                'executionPrice': get_token_price(trade['fields']['token']),
                                'executionAttempts': attempts + 1
                            })
                            # Clear retry counter on success
                            execution_attempts.pop(trade_id, None)
                        else:
                            # Increment retry counter
                            execution_attempts[trade_id] = attempts + 1
                            entry_queue.append(trade)  # Requeue for retry
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
