from dotenv import load_dotenv
import os
from datetime import datetime
import pandas as pd
import mplfinance as mpf

# Force reload environment variables at script start
load_dotenv(override=True)

# Debug print to verify environment loading
print("Environment check:")
print(f"ANTHROPIC_API_KEY present: {bool(os.getenv('ANTHROPIC_API_KEY'))}")
print(f"ANTHROPIC_API_KEY starts with: {os.getenv('ANTHROPIC_API_KEY', '')[:8]}...")
import requests
import numpy as np
import matplotlib.pyplot as plt
import matplotlib.ticker as ticker
import matplotlib.dates as mdates

# Force reload environment variables
load_dotenv(override=True)

# Debug print to verify environment loading
print("Environment check:")
print(f"ANTHROPIC_API_KEY present: {bool(os.getenv('ANTHROPIC_API_KEY'))}")
print(f"ANTHROPIC_API_KEY starts with: {os.getenv('ANTHROPIC_API_KEY', '')[:8]}...")

# Load environment variables
load_dotenv()

# Chart configurations
CHART_CONFIGS = [
    {
        'timeframe': '15m',
        'duration_hours': 34,
        'title': 'UBC/USD Short-term Analysis (34H)',
        'subtitle': '15-minute candles - Trading Setup View',
        'filename': 'ubc_34h_short_term_15m_candles_trading_view.png'
    },
    {
        'timeframe': '2H',
        'duration_hours': 270,
        'title': 'UBC/USD Medium-term Analysis (11D)',
        'subtitle': '2-hour candles - Swing Trading View',
        'filename': 'ubc_11d_medium_term_2h_candles_swing_view.png'
    },
    {
        'timeframe': '8H',
        'duration_hours': 1080,
        'title': 'UBC/USD Long-term Analysis (45D)',
        'subtitle': '8-hour candles - Trend Analysis View',
        'filename': 'ubc_45d_long_term_8h_candles_trend_view.png'
    }
]

def fetch_ubc_sol_data(timeframe='1h', hours=24):
    url = "https://public-api.birdeye.so/defi/ohlcv"
    headers = {
        "X-API-KEY": os.getenv('BIRDEYE_API_KEY'),
        "x-chain": "solana",
        "accept": "application/json"
    }
    
    now = int(datetime.now().timestamp())
    start_time = now - (hours * 60 * 60)
    
    params = {
        "address": "9psiRdn9cXYVps4F1kFuoNjd2EtmqNJXrCPmRppJpump",
        "type": timeframe,
        "currency": "usd",
        "time_from": start_time,
        "time_to": now
    }
    
    try:
        print("Requesting URL:", url)
        print("With params:", params)
        
        response = requests.get(url, headers=headers, params=params)
        print("Response status:", response.status_code)
        
        response.raise_for_status()
        data = response.json()
        
        if not data.get('success'):
            raise ValueError(f"API request failed: {data.get('message')}")

        items = data.get('data', {}).get('items', [])
        if not items:
            raise ValueError("No data items returned from Birdeye API")

        df_data = []
        for item in items:
            date = pd.to_datetime(item['unixTime'], unit='s')
            df_data.append({
                'Date': date,
                'Open': float(item['o']),
                'High': float(item['h']),
                'Low': float(item['l']),
                'Close': float(item['c']),
                'Volume': float(item['v'])
            })
        
        df = pd.DataFrame(df_data)
        df.set_index('Date', inplace=True)
        
        for col in ['Open', 'High', 'Low', 'Close', 'Volume']:
            df[col] = df[col].astype(float)
        
        df = df.sort_index()
        df = df[~df.index.duplicated(keep='first')]
        
        print(f"\nFetched {len(df)} candles for UBC/SOL")
        return df
        
    except Exception as e:
        print(f"Error fetching UBC/SOL data: {e}")
        if 'response' in locals():
            print("API Response:", response.text)
        return None

def calculate_support_levels(df, window=20):
    """Calculate support and resistance levels using local min/max"""
    levels = []
    price_threshold = 0.02  # 2% minimum distance between levels
    
    for i in range(window, len(df) - window):
        # Check for support
        if all(df['Low'].iloc[i] <= df['Low'].iloc[i-window:i+window]):
            price = df['Low'].iloc[i]
            # Check if we already have a similar price level
            if not any(abs(price - existing_price) / price < price_threshold 
                      for _, existing_price in levels):
                levels.append(('support', price))
        
        # Check for resistance
        if all(df['High'].iloc[i] >= df['High'].iloc[i-window:i+window]):
            price = df['High'].iloc[i]
            # Check if we already have a similar price level
            if not any(abs(price - existing_price) / price < price_threshold 
                      for _, existing_price in levels):
                levels.append(('resistance', price))
    
    # Sort levels by price
    levels.sort(key=lambda x: x[1])
    
    # Limit to most significant levels (e.g., top 5 of each)
    support_levels = [l for l in levels if l[0] == 'support'][-5:]
    resistance_levels = [l for l in levels if l[0] == 'resistance'][:5]
    
    return support_levels + resistance_levels


def create_sample_data():
    # Create dates for the last 24 hours with hourly intervals
    base = datetime.now()
    dates = pd.date_range(end=base, periods=24, freq='h')
    
    # Sample OHLCV data
    data = {
        'Date': dates,
        'Open': [1.20, 1.22, 1.18, 1.23, 1.25, 1.24, 1.26, 1.28, 1.27, 1.29, 1.30, 1.28,
                1.27, 1.29, 1.31, 1.30, 1.32, 1.33, 1.31, 1.34, 1.35, 1.33, 1.36, 1.37],
        'High': [1.23, 1.24, 1.25, 1.26, 1.28, 1.27, 1.29, 1.31, 1.30, 1.32, 1.33, 1.31,
                1.30, 1.32, 1.34, 1.33, 1.35, 1.36, 1.34, 1.37, 1.38, 1.36, 1.39, 1.40],
        'Low':  [1.18, 1.19, 1.15, 1.20, 1.22, 1.21, 1.23, 1.25, 1.24, 1.26, 1.27, 1.25,
                1.24, 1.26, 1.28, 1.27, 1.29, 1.30, 1.28, 1.31, 1.32, 1.30, 1.33, 1.34],
        'Close':[1.22, 1.18, 1.23, 1.25, 1.24, 1.26, 1.28, 1.27, 1.29, 1.30, 1.28, 1.27,
                1.29, 1.31, 1.30, 1.32, 1.33, 1.31, 1.34, 1.35, 1.33, 1.36, 1.37, 1.35],
        'Volume':[100000, 120000, 98000, 110000, 125000, 115000, 130000, 135000, 125000,
                 140000, 145000, 135000, 130000, 140000, 150000, 140000, 155000, 160000,
                 150000, 165000, 170000, 160000, 175000, 180000]
    }
    
    # Create DataFrame
    df = pd.DataFrame(data)
    df.set_index('Date', inplace=True)
    
    return df

def generate_chart(df, config, support_levels=None):
    try:
        print(f"Starting chart generation for {config['title']}")
        
        if df is None or df.empty:
            print("No data available for chart generation")
            return False
            
        # Calculate statistics
        current_price = df['Close'].iloc[-1]
        ath = df['High'].max()
        atl = df['Low'].min()
        avg_price = df['Close'].mean()
        avg_volume = df['Volume'].mean()
        price_change = ((df['Close'].iloc[-1] - df['Close'].iloc[0]) / df['Close'].iloc[0]) * 100

        # Enhanced style with grid
        style = mpf.make_mpf_style(
            base_mpf_style='charles',
            gridstyle=':',
            gridcolor='#FFD70020',  # Hex with alpha
            facecolor='black',
            edgecolor='white',
            figcolor='black',
            marketcolors=mpf.make_marketcolors(
                up='#22c55e',
                down='#ef4444',
                edge='inherit',
                wick='inherit',
                volume='#808080'
            ),
            rc={
                'axes.labelcolor': 'white',
                'axes.edgecolor': 'white',
                'xtick.color': 'white',
                'ytick.color': 'white'
            }
        )

        # Calculate EMAs
        ema20 = df['Close'].ewm(span=20, adjust=False).mean()
        ema50 = df['Close'].ewm(span=50, adjust=False).mean()
        
        apds = [
            mpf.make_addplot(ema20, color='yellow', width=0.8, label='EMA20'),
            mpf.make_addplot(ema50, color='blue', width=0.8, label='EMA50')
        ]

        # Calculate candle width based on timeframe
        timeframe = config['timeframe']
        if timeframe == '15m':
            candle_width = 0.008  # Good for short term
        elif timeframe == '2H':
            candle_width = 0.04   # Increased from 0.03 for better medium term visibility
        elif timeframe == '8H':
            candle_width = 0.06   # Increased from 0.045 for better long term visibility
        else:
            candle_width = 0.02   # Default width
        
        # Create figure with timeframe-adjusted candle width
        fig, axes = mpf.plot(
            df,
            type='candle',
            volume=True,
            figsize=(16, 10),
            panel_ratios=(3, 1),
            addplot=apds,
            returnfig=True,
            title='\n\n\n\n',
            ylabel='Price (USD)',
            ylabel_lower='Volume',
            datetime_format='%Y-%m-%d %H:%M',
            xrotation=25,
            tight_layout=False,
            show_nontrading=True,
            style=style,
            update_width_config=dict(
                candle_linewidth=candle_width * 1.5,
                candle_width=candle_width,
                volume_width=candle_width,
                volume_linewidth=candle_width * 1.5
            )
        )

        # Get the main price axis and volume axis
        ax_main = axes[0]
        ax_volume = axes[2]

        # Set log scale for price axis
        ax_main.set_yscale('log')
        
        # Add minor grid lines for log scale
        ax_main.grid(which='minor', axis='y', color='#FFD70020', alpha=0.1, linestyle='--')
        ax_main.grid(which='major', axis='y', color='#FFD70020', alpha=0.2, linestyle='--')

        # Format price axis with log scale
        def price_formatter(x, p):
            if x > 0:
                return f'${x:,.4f}'
            return ''
        ax_main.yaxis.set_major_formatter(ticker.FuncFormatter(price_formatter))

        # Set axis labels
        ax_main.set_xlabel('Date', color='white', fontsize=12)
        ax_main.set_ylabel('Price (USD)', color='white', fontsize=12)
        ax_volume.set_ylabel('Volume', color='white', fontsize=12)

        # Format all axes
        for ax in [ax_main, ax_volume]:
            # Show frame
            ax.spines['top'].set_visible(True)
            ax.spines['right'].set_visible(True)
            ax.spines['bottom'].set_visible(True)
            ax.spines['left'].set_visible(True)
            
            # Set spine colors
            for spine in ax.spines.values():
                spine.set_color('white')
            
            # Format ticks
            ax.tick_params(axis='both', colors='white', labelsize=10)
            
            # Show grid with hex color
            ax.grid(True, linestyle=':', color='#FFD70020', alpha=0.3)
            ax.set_axisbelow(True)

        # Format price axis
        ax_main.yaxis.set_major_formatter(ticker.FuncFormatter(lambda x, p: f'${x:,.4f}'))
        
        # Format volume axis
        ax_volume.yaxis.set_major_formatter(ticker.FuncFormatter(lambda x, p: f'${x:,.0f}'))
        
        # Format date axis
        ax_main.xaxis.set_major_formatter(mdates.DateFormatter('%Y-%m-%d %H:%M'))
        ax_volume.xaxis.set_major_formatter(mdates.DateFormatter('%Y-%m-%d %H:%M'))

        # Explicitly set axes visibility
        for ax in [ax_main, ax_volume]:
            # Show all spines
            for spine in ax.spines.values():
                spine.set_visible(True)
                spine.set_color('white')
                spine.set_linewidth(1.0)
            
            # Show grid
            ax.grid(True, linestyle=':', color='#FFD70020', alpha=0.3)
            ax.set_axisbelow(True)

        # Price axis formatting (right side)
        ax_main.yaxis.set_major_formatter(ticker.FuncFormatter(lambda x, p: f'${x:,.4f}'))
        ax_main.yaxis.set_label_position('right')
        ax_main.yaxis.tick_right()
        ax_main.tick_params(axis='y', colors='white', labelsize=10, length=5)
        ax_main.set_ylabel('Price (USD)', color='white', fontsize=12)

        # Volume axis formatting (right side)
        ax_volume.yaxis.set_major_formatter(ticker.FuncFormatter(lambda x, p: f'${x:,.0f}'))
        ax_volume.yaxis.set_label_position('right')
        ax_volume.yaxis.tick_right()
        ax_volume.tick_params(axis='y', colors='white', labelsize=10, length=5)
        ax_volume.set_ylabel('Volume', color='white', fontsize=12)

        # Date axis formatting (bottom)
        for ax in [ax_main, ax_volume]:
            ax.tick_params(axis='x', colors='white', labelsize=10, rotation=25, length=5)
            ax.grid(axis='x', color='#FFD70020', linestyle=':')

        # Adjust layout to prevent label cutoff
        plt.subplots_adjust(
            top=0.90,    # Top margin
            right=0.95,  # Right margin
            left=0.10,   # Left margin
            bottom=0.15  # Bottom margin for date labels
        )

        # Main title
        fig.text(0.5, 0.96, config['title'],
                horizontalalignment='center',
                color='white',
                fontsize=14,
                fontweight='bold')

        # Price statistics - Remove the $ symbol from the string formatting
        stats_text = (
            f"Current: {current_price:.4f} ({price_change:+.2f}%) | "
            f"ATH: {ath:.4f} | ATL: {atl:.4f} | "
            f"Avg: {avg_price:.4f}"
        )
        fig.text(0.5, 0.93,
                stats_text,
                horizontalalignment='center',
                color='#ffd700',
                fontsize=11)

        # Volume statistics - Format the number without $ symbol
        volume_text = f"Avg Volume: {avg_volume:,.2f} | Candles: {len(df)}"
        fig.text(0.5, 0.90,
                volume_text,
                horizontalalignment='center',
                color='#c0c0c0',
                fontsize=10)

        # Timeframe info
        fig.text(0.5, 0.87,
                f"Period: {df.index[0].strftime('%Y-%m-%d %H:%M')} → "
                f"{df.index[-1].strftime('%Y-%m-%d %H:%M')} UTC",
                horizontalalignment='center',
                color='#808080',
                fontsize=9)

        # Add support/resistance levels if present
        if support_levels:
            support_text = "Support: " + " | ".join([f"{price:.4f}" for _, price in support_levels if _=='support'])
            resistance_text = "Resistance: " + " | ".join([f"{price:.4f}" for _, price in support_levels if _=='resistance'])
            
            fig.text(0.5, 0.84, support_text + "\n" + resistance_text,
                    horizontalalignment='center',
                    color='#a0a0a0',
                    fontsize=9)

        # Add legend
        ax_main.legend(loc='upper left', 
                      bbox_to_anchor=(0.05, 0.95),
                      facecolor='black',
                      edgecolor='white',
                      fontsize=10,
                      labelcolor='white')

        # Add timestamp
        fig.text(0.98, 0.02,
                f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M UTC')}",
                horizontalalignment='right',
                color='#808080',
                fontsize=8)

        # Save chart
        charts_dir = os.path.join('public', 'charts')
        os.makedirs(charts_dir, exist_ok=True)
        output_path = os.path.join(charts_dir, config['filename'])
        
        plt.savefig(
            output_path,
            dpi=150,
            bbox_inches='tight',
            facecolor='black',
            edgecolor='none'
        )
        
        plt.close(fig)
        print(f"Successfully saved chart to {output_path}")
        return True

    except Exception as e:
        print(f"Error generating chart: {str(e)}")
        if 'fig' in locals():
            plt.close(fig)
        return False
    ax_main.tick_params(axis='y', colors='white', labelsize=10)
    ax_main.set_yscale('log')  # Ensure log scale is applied
    
    # Add minor grid lines for log scale
    ax_main.grid(which='minor', axis='y', color='gray', alpha=0.1, linestyle='--')
    ax_main.grid(which='major', axis='y', color='gray', alpha=0.2, linestyle='--')
    
    # Calculate percentage changes for y-axis ticks
    min_price = df['Low'].min()
    max_price = df['High'].max()
    
    # Add percentage change markers on the right side
    price_levels = np.logspace(np.log10(min_price), np.log10(max_price), num=6)
    for price in price_levels:
        pct_change = ((price - min_price) / min_price) * 100
        ax_main.text(df.index[-1], price, f' +{pct_change:.1f}%', 
                    color='gray', va='center', fontsize=8)
    
    # Format volume axis
    ax_volume.yaxis.set_major_formatter(plt.FuncFormatter(lambda x, p: f'${x:,.0f}'))
    ax_volume.yaxis.label.set_color('white')
    ax_volume.yaxis.set_label_position('right')
    ax_volume.tick_params(axis='y', colors='white', labelsize=10)
    
    # Format date axis (x-axis)
    ax_main.tick_params(axis='x', colors='white', labelsize=10)
    ax_volume.tick_params(axis='x', colors='white', labelsize=10)
    
    # Add date grid lines
    ax_main.grid(axis='x', color='gray', alpha=0.2, linestyle='--')
    
    # Add price range label
    price_range = f"Range: ${df['Low'].min():.4f} - ${df['High'].max():.4f}"
    ax_main.text(0.02, 0.95, price_range,
                transform=ax_main.transAxes,
                color='white',
                fontsize=10)
    
    # Add volume range label
    volume_range = f"Vol Range: ${df['Volume'].min():,.0f} - ${df['Volume'].max():,.0f}"
    ax_volume.text(0.02, 0.95, volume_range,
                  transform=ax_volume.transAxes,
                  color='white',
                  fontsize=10)
    
    # Add timeframe info
    timeframe_info = (
        f"From: {df.index[0].strftime('%Y-%m-%d %H:%M')}\n"
        f"To: {df.index[-1].strftime('%Y-%m-%d %H:%M')}"
    )
    fig.text(0.02, 0.02, timeframe_info,
             color='gray',
             fontsize=10,
             va='bottom')
    
    # Add subtitle with timeframe info
    fig.text(0.5, 0.95, config['subtitle'], 
             horizontalalignment='center',
             color='white',
             fontsize=12)
    
    # Add legend for EMAs
    ax_main.legend(['EMA20', 'EMA50'], 
                  loc='upper left',
                  facecolor='black',
                  edgecolor='white',
                  fontsize=10)
    
    # Add timestamp
    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M UTC')
    fig.text(0.98, 0.02, f'Generated: {timestamp}',
             horizontalalignment='right',
             color='gray',
             fontsize=10)
    
    # Create public/charts directory if it doesn't exist
    charts_dir = os.path.join('public', 'charts')
    os.makedirs(charts_dir, exist_ok=True)

    # Update filename to save in public/charts
    output_path = os.path.join(charts_dir, config['filename'])
    
    # Create charts directory if it doesn't exist
    charts_dir = os.path.join('public', 'charts')
    os.makedirs(charts_dir, exist_ok=True)

    # Add support/resistance levels as horizontal lines
    if support_levels:
        # Sort levels by price
        support_prices = [price for level_type, price in support_levels if level_type == 'support']
        resistance_prices = [price for level_type, price in support_levels if level_type == 'resistance']
            
        # Plot support levels
        for price in support_prices:
            ax_main.axhline(
                y=price,
                color='#22c55e',  # Green color
                linestyle='--',
                alpha=0.3,
                linewidth=1
            )
            # Add price label
            ax_main.text(
                df.index[-1],
                price,
                f' S: ${price:.4f}',
                color='#22c55e',
                alpha=0.8,
                fontsize=8,
                va='center'
            )

        # Plot resistance levels
        for price in resistance_prices:
            ax_main.axhline(
                y=price,
                color='#ef4444',  # Red color
                linestyle='--',
                alpha=0.3,
                linewidth=1
            )
            # Add price label
            ax_main.text(
                df.index[-1],
                price,
                f' R: ${price:.4f}',
                color='#ef4444',
                alpha=0.8,
                fontsize=8,
                va='center'
            )

    # Save figure
    output_path = os.path.join(charts_dir, config['filename'])
    plt.savefig(
        output_path,
        dpi=150,
        bbox_inches='tight',
        facecolor='black',
        edgecolor='none'
    )
    
    # Explicitly close the figure
    plt.close(fig)
    
    print(f"Successfully saved chart to {output_path}")
    
    # Print statistics for verification
    print(f"\nChart Statistics for {config['title']}:")
    print(f"Current Price: ${current_price:.4f}")
    print(f"ATH: ${ath:.4f}")
    print(f"ATL: ${atl:.4f}")
    print(f"Average Price: ${avg_price:.4f}")
    print(f"Price Change: {price_change:+.2f}%")
    print(f"Average Volume: ${avg_volume:,.2f}")
    
    return True


def generate_all_charts():
    print("Starting chart generation process...")
    
    for config in CHART_CONFIGS:
        try:
            print(f"\nProcessing {config['title']}...")
            
            # Fetch data
            df = fetch_ubc_sol_data(
                timeframe=config['timeframe'],
                hours=config['duration_hours']
            )
            
            if df is None or df.empty:
                print(f"No data available for {config['title']}")
                continue
                
            # Calculate support levels
            support_levels = calculate_support_levels(df)
            
            # Generate chart
            success = generate_chart(df, config, support_levels)
            
            if success:
                print(f"Successfully generated {config['filename']}")
            else:
                print(f"Failed to generate {config['filename']}")
                
        except Exception as e:
            print(f"Error processing {config['title']}: {str(e)}")
            continue
            
    print("\nChart generation process completed")

if __name__ == "__main__":
    try:
        generate_all_charts()
    except Exception as e:
        print(f"Fatal error in chart generation: {str(e)}")
