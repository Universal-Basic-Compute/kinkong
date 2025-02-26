import os
import json
import time
import logging
import requests
from datetime import datetime, timedelta
from dotenv import load_dotenv
from pyairtable import Api, Base, Table

# Setup logging
def setup_logging():
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            logging.StreamHandler()
        ]
    )
    return logging.getLogger(__name__)

logger = setup_logging()

# Add Telegram sending function
def send_telegram_message(message):
    bot_token = os.environ.get('TELEGRAM_BOT_TOKEN')
    chat_id = os.environ.get('TELEGRAM_CHAT_ID')

    if not bot_token or not chat_id:
        logger.warning('❌ Telegram configuration missing')
        return

    try:
        url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
        response = requests.post(
            url,
            json={
                'chat_id': chat_id,
                'text': message,
                'parse_mode': 'Markdown'
            }
        )

        if not response.ok:
            raise Exception(f"Telegram API error: {response.status_code}")
    except Exception as error:
        logger.error(f'❌ Failed to send Telegram message: {error}')

def get_historical_prices(token_mint, start_time, end_time):
    try:
        # Convert to offset-naive datetimes if they're offset-aware
        if start_time.tzinfo is not None:
            start_time = start_time.replace(tzinfo=None)
        if end_time.tzinfo is not None:
            end_time = end_time.replace(tzinfo=None)
            
        # Validate dates
        now = datetime.now()
        if start_time > now or end_time > now:
            logger.warning("⚠️ Warning: Future dates detected, adjusting to current time window")
            duration = end_time.timestamp() - start_time.timestamp()
            end_time = now
            start_time = datetime.fromtimestamp(end_time.timestamp() - duration)

        url = "https://public-api.birdeye.so/defi/history_price"
        params = {
            'address': token_mint,
            'address_type': "token",
            'type': "1m",
            'time_from': int(start_time.timestamp()),
            'time_to': int(end_time.timestamp())
        }

        logger.info(f"Fetching price history for {token_mint}")
        logger.info(f"Adjusted time range: {start_time.isoformat()} to {end_time.isoformat()}")

        headers = {
            'X-API-KEY': os.environ.get('BIRDEYE_API_KEY', ''),
            'x-chain': 'solana',
            'accept': 'application/json',
            'User-Agent': 'Mozilla/5.0'
        }

        response = requests.get(url, params=params, headers=headers)

        if response.ok:
            data = response.json()
            items = data.get('data', {}).get('items', [])
            if not items:
                logger.warning("⚠️ No price data returned from Birdeye")
                return []
            logger.info(f"✅ Retrieved {len(items)} price points")
            return items
        else:
            logger.error(f"❌ Birdeye API error: {response.status_code}")
            logger.error(f"Response: {response.text}")
            return []
    except Exception as error:
        logger.error(f"❌ Error fetching historical prices: {error}")
        return []

def simulate_trade(prices, signal_data):
    entry_price = signal_data.get('entryPrice')
    target_price = signal_data.get('targetPrice')
    stop_loss = signal_data.get('stopLoss')
    signal_type = signal_data.get('type')
    
    # Fee percentage (3% per side)
    fee_percentage = 0.03

    # Default to last price if no exit conditions met
    exit_price = prices[-1]['value'] if prices else entry_price
    exit_reason = 'EXPIRED'
    time_to_exit = len(prices)

    for i, price_data in enumerate(prices):
        price = price_data['value']

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

    # Calculate returns and success, accounting for fees
    if signal_type == 'BUY':
        # For BUY: We buy at entry_price + fee and sell at exit_price - fee
        # Entry cost including fee: entry_price * (1 + fee_percentage)
        # Exit value after fee: exit_price * (1 - fee_percentage)
        # Return = (Exit value - Entry cost) / Entry cost * 100
        entry_with_fee = entry_price * (1 + fee_percentage)
        exit_with_fee = exit_price * (1 - fee_percentage)
        actual_return = ((exit_with_fee - entry_with_fee) / entry_with_fee) * 100
        success = exit_with_fee > entry_with_fee
    else:  # SELL
        # For SELL: We sell at entry_price - fee and buy back at exit_price + fee
        # Entry value after fee: entry_price * (1 - fee_percentage)
        # Exit cost including fee: exit_price * (1 + fee_percentage)
        # Return = (Entry value - Exit cost) / Entry value * 100
        entry_with_fee = entry_price * (1 - fee_percentage)
        exit_with_fee = exit_price * (1 + fee_percentage)
        actual_return = ((entry_with_fee - exit_with_fee) / entry_with_fee) * 100
        success = exit_with_fee < entry_with_fee

    return {
        'exitPrice': exit_price,
        'exitReason': exit_reason,
        'timeToExit': time_to_exit,
        'actualReturn': actual_return,
        'success': success,
        'fees': fee_percentage * 100  # Store fee percentage for reference
    }

def calculate_closed_signals():
    try:
        # Load environment variables
        load_dotenv()
        
        # Verify environment variables
        if not os.environ.get('BIRDEYE_API_KEY'):
            raise Exception("BIRDEYE_API_KEY not found in environment variables")

        if not os.environ.get('KINKONG_AIRTABLE_API_KEY') or not os.environ.get('KINKONG_AIRTABLE_BASE_ID'):
            raise Exception("Missing Airtable configuration")

        calculated_signals = []

        # Initialize Airtable
        api = Api(os.environ.get('KINKONG_AIRTABLE_API_KEY'))
        base = Base(api, os.environ.get('KINKONG_AIRTABLE_BASE_ID'))
        signals_table = base.table('SIGNALS')
        tokens_table = base.table('TOKENS')

        logger.info("\n📊 Checking Airtable for signals...")

        # Get signals that need evaluation
        signals = signals_table.all(
            formula="AND(" +
            "expiryDate<NOW(), " +
            "actualReturn=BLANK(), " +
            "entryPrice>0, " +
            "targetPrice>0" +
            ")"
        )

        logger.info("\n🔍 Signal Filter Results:")
        logger.info(f"Found {len(signals)} signals to evaluate that match criteria:")
        logger.info("- Past expiry date")
        logger.info("- Missing actualReturn or accuracy")
        logger.info("- Has valid entry and target prices")

        for signal in signals:
            try:
                fields = signal['fields']
                signal_id = signal['id']

                logger.info(f"\n⚙️ Processing signal {signal_id}:")
                logger.info(f"Token: {fields.get('token')}")
                logger.info(f"Type: {fields.get('type')}")
                logger.info(f"Entry: ${fields.get('entryPrice', 0):.4f}")

                # Get token mint address
                token_records = tokens_table.all(
                    formula=f"{{token}}='{fields.get('token')}'"
                )

                if not token_records:
                    logger.info(f"❌ No token record found for {fields.get('token')}")
                    continue

                token_mint = token_records[0]['fields'].get('mint')
                logger.info(f"Found mint address: {token_mint}")

                # Get historical prices
                activation_time = datetime.fromisoformat(fields.get('createdAt').replace('Z', '+00:00'))
                expiry_time = datetime.fromisoformat(fields.get('expiryDate').replace('Z', '+00:00'))

                prices = get_historical_prices(token_mint, activation_time, expiry_time)
                if not prices:
                    logger.info(f"❌ No price data available for {fields.get('token')}")
                    continue

                # Simulate trade with actual price data
                results = simulate_trade(prices, fields)

                # Update signal with results
                signals_table.update(
                    signal_id,
                    {
                        'exitPrice': results['exitPrice'],
                        'actualReturn': round(results['actualReturn'] * 100) / 100
                    }
                )

                logger.info(f"\n✅ Updated signal {signal_id}:")
                logger.info(f"Exit Price: ${results['exitPrice']:.4f}")
                logger.info(f"Actual Return (after {results['fees']}% fees per side): {results['actualReturn']:.2f}%")
                logger.info(f"Success: {'✅' if results['success'] else '❌'}")
                logger.info(f"Time to Exit: {results['timeToExit']} minutes")

                # After successful update, add to calculated signals
                calculated_signals.append({
                    'token': fields.get('token'),
                    'type': fields.get('type'),
                    'actualReturn': results['actualReturn'],
                    'exitPrice': results['exitPrice'],
                    'success': results['success'],
                    'timeToExit': results['timeToExit'],
                    'fees': results['fees']
                })

            except Exception as error:
                logger.error(f"❌ Error processing signal {signal.get('id')}: {error}")
                continue

        # If any signals were calculated, send Telegram notification
        if calculated_signals:
            message = "🎯 *Signal Results Update*\n\n"
            for signal in calculated_signals:
                message += (
                    f"{signal['token']} {signal['type']}:\n"
                    f"• Return (after fees): {signal['actualReturn']:.2f}%\n"
                    f"• Exit: ${signal['exitPrice']:.4f}\n"
                    f"• Time: {signal['timeToExit']} minutes\n"
                    f"• Result: {'✅ Win' if signal['success'] else '❌ Loss'}\n\n"
                )
            message += "🔍 View all signals at [SwarmTrade](https://swarmtrade.ai/signals)"

            send_telegram_message(message)
            logger.info('📱 Telegram notification sent')

        logger.info("\n✅ Finished processing signals")

    except Exception as error:
        logger.error(f"\n❌ Error: {error}")
        raise error

def main():
    logger.info("\n🚀 Starting closed signals calculation...")
    calculate_closed_signals()

if __name__ == "__main__":
    main()
