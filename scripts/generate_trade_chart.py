import os
import json
import logging
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
import matplotlib.ticker as ticker
from datetime import datetime, timedelta
from dotenv import load_dotenv
import requests
from pathlib import Path

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

# Load environment variables
load_dotenv()

def fetch_historical_prices(token_mint, start_time, end_time):
    """Fetch historical price data for a token between specified times"""
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
            'type': "1m",  # 1-minute candles for detailed view
            'time_from': int(start_time.timestamp()),
            'time_to': int(end_time.timestamp())
        }

        logger.info(f"Fetching price history for {token_mint}")
        logger.info(f"Time range: {start_time.isoformat()} to {end_time.isoformat()}")

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
                return None
            
            # Convert to DataFrame
            df_data = []
            for item in items:
                date = pd.to_datetime(item['unixTime'], unit='s')
                df_data.append({
                    'timestamp': date,
                    'price': float(item['value'])
                })
            
            df = pd.DataFrame(df_data)
            df.set_index('timestamp', inplace=True)
            df = df.sort_index()
            
            logger.info(f"✅ Retrieved {len(df)} price points")
            return df
        else:
            logger.error(f"❌ Birdeye API error: {response.status_code}")
            logger.error(f"Response: {response.text}")
            return None
    except Exception as error:
        logger.error(f"❌ Error fetching historical prices: {error}")
        return None

def get_token_mint(token_symbol):
    """Get token mint address from Airtable TOKENS table"""
    try:
        from pyairtable import Api, Base
        
        api_key = os.environ.get('KINKONG_AIRTABLE_API_KEY')
        base_id = os.environ.get('KINKONG_AIRTABLE_BASE_ID')
        
        if not api_key or not base_id:
            logger.error("Missing Airtable credentials")
            return None
        
        api = Api(api_key)
        base = Base(api, base_id)
        tokens_table = base.table('TOKENS')
        
        # Query for the token
        records = tokens_table.all(
            formula=f"{{token}}='{token_symbol}'"
        )
        
        if not records:
            logger.error(f"No token record found for {token_symbol}")
            return None
        
        mint_address = records[0]['fields'].get('mint')
        logger.info(f"Found mint address for {token_symbol}: {mint_address}")
        return mint_address
    
    except Exception as e:
        logger.error(f"Error getting token mint: {e}")
        return None

def get_signal_details(signal_id):
    """Get signal details from Airtable SIGNALS table"""
    try:
        from pyairtable import Api, Base
        
        api_key = os.environ.get('KINKONG_AIRTABLE_API_KEY')
        base_id = os.environ.get('KINKONG_AIRTABLE_BASE_ID')
        
        if not api_key or not base_id:
            logger.error("Missing Airtable credentials")
            return None
        
        api = Api(api_key)
        base = Base(api, base_id)
        signals_table = base.table('SIGNALS')
        
        # Get the signal record
        signal = signals_table.get(signal_id)
        if not signal:
            logger.error(f"Signal with ID {signal_id} not found")
            return None
        
        # Extract relevant fields
        fields = signal['fields']
        
        # Check if this is a closed signal (has actualReturn)
        if 'actualReturn' not in fields or fields.get('actualReturn') is None:
            logger.warning(f"Signal {signal_id} is not closed yet (no actualReturn)")
            return None
        
        # Format the signal data
        signal_data = {
            'id': signal_id,
            'token': fields.get('token'),
            'type': fields.get('type'),  # BUY or SELL
            'timeframe': fields.get('timeframe'),
            'entryPrice': fields.get('entryPrice'),
            'targetPrice': fields.get('targetPrice'),
            'stopLoss': fields.get('stopLoss'),
            'exitPrice': fields.get('exitPrice'),
            'actualReturn': fields.get('actualReturn'),
            'createdAt': fields.get('createdAt'),
            'expiryDate': fields.get('expiryDate'),
            'confidence': fields.get('confidence'),
            'reason': fields.get('reason')
        }
        
        logger.info(f"Retrieved signal details for {signal_id}: {signal_data['token']} {signal_data['type']}")
        return signal_data
    
    except Exception as e:
        logger.error(f"Error getting signal details: {e}")
        return None

def generate_trade_chart(signal_id, output_dir=None):
    """Generate a trade chart for a closed signal"""
    try:
        # Get signal details
        signal = get_signal_details(signal_id)
        if not signal:
            logger.error(f"Could not get details for signal {signal_id}")
            return False
        
        # Get token mint address
        token_mint = get_token_mint(signal['token'])
        if not token_mint:
            logger.error(f"Could not get mint address for token {signal['token']}")
            return False
        
        # Parse dates
        created_at = datetime.fromisoformat(signal['createdAt'].replace('Z', '+00:00'))
        expiry_date = datetime.fromisoformat(signal['expiryDate'].replace('Z', '+00:00'))
        
        # Add some buffer before and after for better visualization
        buffer_hours = 2
        start_time = created_at - timedelta(hours=buffer_hours)
        end_time = expiry_date + timedelta(hours=buffer_hours)
        
        # Fetch historical prices
        price_data = fetch_historical_prices(token_mint, start_time, end_time)
        if price_data is None or len(price_data) == 0:
            logger.error(f"No price data available for {signal['token']}")
            return False
        
        # Create figure and axis
        fig, ax = plt.subplots(figsize=(16, 9))
        
        # Set background color
        fig.patch.set_facecolor('black')
        ax.set_facecolor('black')
        
        # Plot price data
        ax.plot(price_data.index, price_data['price'], color='white', linewidth=1.5, label='Price')
        
        # Determine y-axis limits with some padding
        min_price = min(price_data['price'].min(), signal['stopLoss'] * 0.95 if signal['stopLoss'] else price_data['price'].min() * 0.95)
        max_price = max(price_data['price'].max(), signal['targetPrice'] * 1.05 if signal['targetPrice'] else price_data['price'].max() * 1.05)
        price_range = max_price - min_price
        y_min = min_price - price_range * 0.05
        y_max = max_price + price_range * 0.05
        ax.set_ylim(y_min, y_max)
        
        # Add entry price line
        entry_time = created_at
        ax.axhline(y=signal['entryPrice'], color='#FFD700', linestyle='-', linewidth=1.5, alpha=0.7, label='Entry Price')
        ax.text(price_data.index[0], signal['entryPrice'], f" Entry: ${signal['entryPrice']:.4f}", 
                color='#FFD700', fontsize=10, verticalalignment='bottom')
        
        # Add target price line
        if signal['targetPrice']:
            ax.axhline(y=signal['targetPrice'], color='#4CAF50', linestyle='--', linewidth=1.5, alpha=0.7, label='Target Price')
            ax.text(price_data.index[0], signal['targetPrice'], f" Target: ${signal['targetPrice']:.4f}", 
                    color='#4CAF50', fontsize=10, verticalalignment='bottom')
        
        # Add stop loss line
        if signal['stopLoss']:
            ax.axhline(y=signal['stopLoss'], color='#F44336', linestyle='--', linewidth=1.5, alpha=0.7, label='Stop Loss')
            ax.text(price_data.index[0], signal['stopLoss'], f" Stop: ${signal['stopLoss']:.4f}", 
                    color='#F44336', fontsize=10, verticalalignment='top')
        
        # Add exit price marker
        if signal['exitPrice']:
            # Find the closest timestamp to when the exit price was hit
            exit_price = signal['exitPrice']
            price_diffs = abs(price_data['price'] - exit_price)
            closest_idx = price_diffs.idxmin()
            
            ax.scatter([closest_idx], [exit_price], color='#FF9800', s=100, zorder=5, label='Exit Price')
            ax.text(closest_idx, exit_price, f" Exit: ${exit_price:.4f}", 
                    color='#FF9800', fontsize=10, verticalalignment='bottom', horizontalalignment='left')
        
        # Add colored bands for profit/loss zones
        if signal['type'] == 'BUY':
            # For BUY signals: green above entry, red below stop loss
            if signal['targetPrice'] and signal['targetPrice'] > signal['entryPrice']:
                ax.axhspan(signal['entryPrice'], signal['targetPrice'], color='#4CAF50', alpha=0.1)
            if signal['stopLoss'] and signal['stopLoss'] < signal['entryPrice']:
                ax.axhspan(y_min, signal['stopLoss'], color='#F44336', alpha=0.1)
        else:  # SELL signal
            # For SELL signals: green below entry, red above stop loss
            if signal['targetPrice'] and signal['targetPrice'] < signal['entryPrice']:
                ax.axhspan(signal['targetPrice'], signal['entryPrice'], color='#4CAF50', alpha=0.1)
            if signal['stopLoss'] and signal['stopLoss'] > signal['entryPrice']:
                ax.axhspan(signal['stopLoss'], y_max, color='#F44336', alpha=0.1)
        
        # Format x-axis (dates)
        ax.xaxis.set_major_formatter(mdates.DateFormatter('%Y-%m-%d %H:%M'))
        plt.xticks(rotation=25)
        
        # Format y-axis (prices)
        ax.yaxis.set_major_formatter(ticker.FuncFormatter(lambda x, p: f'${x:.4f}'))
        
        # Add grid
        ax.grid(True, linestyle=':', color='#FFD70020', alpha=0.3)
        
        # Set labels and title
        ax.set_xlabel('Time', color='white', fontsize=12)
        ax.set_ylabel('Price (USD)', color='white', fontsize=12)
        
        # Create title with signal details
        title = f"{signal['token']}/USD {signal['type']} Signal ({signal['timeframe']})"
        subtitle = f"Entry: ${signal['entryPrice']:.4f} | Exit: ${signal['exitPrice']:.4f} | Return: {signal['actualReturn']:.2f}%"
        
        # Add title and subtitle
        fig.text(0.5, 0.97, title, fontsize=16, color='white', ha='center', weight='bold')
        fig.text(0.5, 0.94, subtitle, fontsize=12, color='#FFD700', ha='center')
        
        # Add signal details
        details_text = (
            f"Signal ID: {signal_id}\n"
            f"Created: {created_at.strftime('%Y-%m-%d %H:%M')}\n"
            f"Confidence: {signal['confidence']}\n"
            f"Trading Costs: 6%"
        )
        fig.text(0.02, 0.02, details_text, fontsize=10, color='#A0A0A0', va='bottom')
        
        # Add result badge
        result_color = '#4CAF50' if signal['actualReturn'] > 0 else '#F44336'
        result_text = 'SUCCESS' if signal['actualReturn'] > 0 else 'FAILURE'
        fig.text(0.98, 0.02, result_text, fontsize=12, color=result_color, 
                 va='bottom', ha='right', weight='bold',
                 bbox=dict(boxstyle="round,pad=0.3", fc='black', ec=result_color, alpha=0.7))
        
        # Add legend
        ax.legend(loc='upper left', facecolor='black', edgecolor='#FFD700', framealpha=0.7, fontsize=10)
        
        # Set tick colors
        ax.tick_params(axis='x', colors='white')
        ax.tick_params(axis='y', colors='white')
        
        # Set spine colors
        for spine in ax.spines.values():
            spine.set_color('#FFD700')
            spine.set_linewidth(0.5)
        
        # Adjust layout
        plt.tight_layout(rect=[0, 0.03, 1, 0.93])
        
        # Create output directory if it doesn't exist
        if output_dir is None:
            output_dir = os.path.join('public', 'signals', 'charts')  # Nouveau chemin
        os.makedirs(output_dir, exist_ok=True)
        
        # Save the chart
        output_path = os.path.join(output_dir, f"{signal['token']}_{signal_id}_{signal['type'].lower()}_trade.png")
        plt.savefig(output_path, dpi=150, facecolor='black')
        plt.close(fig)
        
        logger.info(f"✅ Trade chart saved to {output_path}")
        return True
        
    except Exception as e:
        logger.error(f"Error generating trade chart: {e}")
        if 'fig' in locals():
            plt.close(fig)
        return False

def generate_recent_trade_charts(limit=10, output_dir=None):
    """Generate charts for the most recent closed signals"""
    try:
        from pyairtable import Api, Base
        
        api_key = os.environ.get('KINKONG_AIRTABLE_API_KEY')
        base_id = os.environ.get('KINKONG_AIRTABLE_BASE_ID')
        
        if not api_key or not base_id:
            logger.error("Missing Airtable credentials")
            return False
        
        api = Api(api_key)
        base = Base(api, base_id)
        signals_table = base.table('SIGNALS')
        
        # Get recent closed signals - Fix the sort parameter format
        signals = signals_table.all(
            formula="NOT({actualReturn} = '')",  # Use curly braces around field names
            sort=["-createdAt"],  # Changed format: use string with "-" prefix for descending
            max_records=limit
        )
        
        logger.info(f"Found {len(signals)} closed signals")
        
        success_count = 0
        for signal in signals:
            signal_id = signal['id']
            success = generate_trade_chart(signal_id, output_dir)
            if success:
                success_count += 1
        
        logger.info(f"Generated {success_count} trade charts out of {len(signals)} signals")
        return True
        
    except Exception as e:
        logger.error(f"Error generating recent trade charts: {e}")
        import traceback
        logger.error(traceback.format_exc())  # Add full traceback for better debugging
        return False

def main():
    """Main function to run the script"""
    logger.info("Starting trade chart generation...")
    
    # Définir le répertoire de sortie par défaut
    default_output_dir = os.path.join('public', 'signals', 'charts')
    
    # Check if a signal ID was provided as an argument
    import sys
    if len(sys.argv) > 1:
        signal_id = sys.argv[1]
        logger.info(f"Generating trade chart for signal {signal_id}")
        generate_trade_chart(signal_id, default_output_dir)
    else:
        # Generate charts for the 10 most recent closed signals
        logger.info("Generating trade charts for recent signals")
        generate_recent_trade_charts(limit=10, output_dir=default_output_dir)
    
    logger.info("Trade chart generation complete")

if __name__ == "__main__":
    main()
