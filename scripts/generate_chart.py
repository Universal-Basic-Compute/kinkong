import matplotlib.pyplot as plt
import mplfinance as mpf
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import requests
from dotenv import load_dotenv
import os
import os

# Load environment variables
load_dotenv()

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

def calculate_support_levels(df, window=20):
    """Calculate support and resistance levels using local min/max"""
    levels = []
    
    # Find local minima and maxima
    for i in range(window, len(df) - window):
        if all(df['Low'].iloc[i] <= df['Low'].iloc[i-window:i+window]):
            levels.append(('support', df['Low'].iloc[i]))
        if all(df['High'].iloc[i] >= df['High'].iloc[i-window:i+window]):
            levels.append(('resistance', df['High'].iloc[i]))
    
    return levels

def fetch_ubc_sol_data(timeframe='1H', hours=24):
    url = "https://public-api.birdeye.so/defi/ohlcv"
    headers = {
        "X-API-KEY": os.getenv('BIRDEYE_API_KEY'),
        "x-chain": "solana",
        "accept": "application/json"
    }
    
    # Calculate time range
    now = int(datetime.now().timestamp())
    start_time = now - (hours * 60 * 60)
    
    params = {
        "address": "9psiRdn9cXYVps4F1kFuoNjd2EtmqNJXrCPmRppJpump",  # UBC token address
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

        # Convert API data to DataFrame
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
        
        # Create DataFrame and set index
        df = pd.DataFrame(df_data)
        df.set_index('Date', inplace=True)
        
        # Ensure all numeric columns are float type
        for col in ['Open', 'High', 'Low', 'Close', 'Volume']:
            df[col] = df[col].astype(float)
        
        # Sort index and remove any duplicates
        df = df.sort_index()
        df = df[~df.index.duplicated(keep='first')]
        
        print(f"\nFetched {len(df)} candles for UBC/SOL")
        print("\nDataFrame head:")
        print(df.head())
        
        return df
        
    except Exception as e:
        print(f"Error fetching UBC/SOL data: {e}")
        if 'response' in locals():
            print("API Response:", response.text)
        return None

def create_sample_data():
    # Create dates for the last 24 hours with hourly intervals
    base = datetime.now()
    dates = [base - timedelta(hours=x) for x in range(23, -1, -1)]
    
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
        print(f"Data shape: {df.shape}")
        
        if df is None or df.empty:
            print("No data available for chart generation")
            return
        
        # Calculate key statistics
        print("Calculating statistics...")
        current_price = df['Close'].iloc[-1]
        ath = df['High'].max()
        atl = df['Low'].min()
        avg_price = df['Close'].mean()
        avg_volume = df['Volume'].mean()
        price_change = ((df['Close'].iloc[-1] - df['Close'].iloc[0]) / df['Close'].iloc[0]) * 100

        # Create more detailed title components
        main_title = config['title']
        price_stats = (
            f"Current: {current_price:.4f} ({price_change:+.2f}%) | "
            f"ATH: {ath:.4f} | ATL: {atl:.4f} | "
            f"Avg: {avg_price:.4f}"
        )
        volume_stats = f"Avg Vol: {avg_volume:,.2f} | {len(df)} candles"
        
        # Enhanced subtitle with more technical info
        technical_info = (
            f"EMA(20) & EMA(50) | "
            f"Period: {df.index[0].strftime('%Y-%m-%d %H:%M')} → {df.index[-1].strftime('%Y-%m-%d %H:%M')} UTC"
        )

        # Style configuration
        style = mpf.make_mpf_style(
            base_mpf_style='charles',
            gridstyle='',
            facecolor='black',
            edgecolor='white',
            figcolor='black',
            marketcolors=mpf.make_marketcolors(
                up='#22c55e',
                down='#ef4444',
                edge='inherit',
                wick='inherit',
                volume='gray'
            )
        )
    
        # Prepare additional plots (moving averages)
        ema20 = df['Close'].ewm(span=20, adjust=False).mean()
        ema50 = df['Close'].ewm(span=50, adjust=False).mean()
        
        apds = [
            mpf.make_addplot(ema20, color='yellow', width=0.8, label='EMA20'),
            mpf.make_addplot(ema50, color='blue', width=0.8, label='EMA50')
        ]
        
        # Add support/resistance lines if provided
        if support_levels:
            for level_type, price in support_levels:
                color = '#22c55e' if level_type == 'support' else '#ef4444'
                apds.append(
                    mpf.make_addplot([price] * len(df), color=color, linestyle='--')
                )
            
        # Define formatters for currency and volume
        def currency_formatter(x, p):
            return f'${x:,.4f}'

        def volume_formatter(x, p):
            return f'${x:,.0f}'
        
        # Create figure with adjusted layout and log scale
        fig, axes = mpf.plot(
            df,
            type='candle',
            style=style,
            volume=True,
            figsize=(16, 10),
            panel_ratios=(3, 1),
            addplot=apds,
            returnfig=True,
            ylabel='Price (USD) - Log Scale',
        ylabel_lower='Volume (USD)',
        xrotation=25,
        datetime_format='%Y-%m-%d %H:%M',
        title='\n\n\n',  # Add space for custom title
        yscale='log',    # Add log scale
        volume_yscale='linear'  # Keep volume linear
    )
    
        # Adjust title spacing and add components
        # Format text without using $ signs directly
        def format_price(price):
            return f"{price:.4f}"

        def format_volume(vol):
            return f"{vol:,.2f}"

        # Create title components
        main_title = config['title']
        price_stats = (
            f"Current: {format_price(current_price)} ({price_change:+.2f}%) | "
            f"ATH: {format_price(ath)} | ATL: {format_price(atl)} | "
            f"Avg: {format_price(avg_price)}"
        )
        volume_stats = f"Avg Vol: {format_volume(avg_volume)} | {len(df)} candles"
    
    # Add text without math parameter
    fig.text(0.5, 0.97, main_title,
             horizontalalignment='center',
             color='white',
             fontsize=14,
             fontweight='bold')
    
    fig.text(0.5, 0.94, price_stats,
             horizontalalignment='center',
             color='#ffd700',
             fontsize=11)
    
    fig.text(0.5, 0.92, volume_stats,
             horizontalalignment='center',
             color='#c0c0c0',
             fontsize=10)

    # Update technical info
    technical_info = (
        f"EMA(20) & EMA(50) | "
        f"Period: {df.index[0].strftime('%Y-%m-%d %H:%M')} → {df.index[-1].strftime('%Y-%m-%d %H:%M')} UTC"
    )
    
    fig.text(0.5, 0.90, technical_info,
             horizontalalignment='center',
             color='#808080',
             fontsize=9)
    
    # Add support/resistance levels info if present
    if support_levels:
        support_text = "Support Levels: " + " | ".join([f"{format_price(price)}" for _, price in support_levels if _=='support'])
        resistance_text = "Resistance Levels: " + " | ".join([f"{format_price(price)}" for _, price in support_levels if _=='resistance'])
        
        fig.text(0.5, 0.88, support_text + "\n" + resistance_text,
                horizontalalignment='center',
                color='#a0a0a0',
                fontsize=9)

    # Adjust main chart position to account for title space
    plt.subplots_adjust(top=0.85)
    
    # Get the main price axis and volume axis
    ax_main = axes[0]
    ax_volume = axes[2]
    
    # Format price axis (y-axis) with log scale
    ax_main.yaxis.set_major_formatter(plt.FuncFormatter(currency_formatter))
    ax_main.yaxis.label.set_color('white')
    ax_main.yaxis.set_label_position('right')
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
    ax_volume.yaxis.set_major_formatter(plt.FuncFormatter(volume_formatter))
    ax_volume.yaxis.label.set_color('white')
    ax_volume.yaxis.set_label_position('right')
    ax_volume.tick_params(axis='y', colors='white', labelsize=10)
    
    # Format date axis (x-axis)
    ax_main.tick_params(axis='x', colors='white', labelsize=10)
    ax_volume.tick_params(axis='x', colors='white', labelsize=10)
    
    # Add date grid lines
    ax_main.grid(axis='x', color='gray', alpha=0.2, linestyle='--')
    
    # Add price range label
    price_range = f"Range: {format_price(df['Low'].min())} - {format_price(df['High'].max())}"
    ax_main.text(0.02, 0.95, price_range,
                transform=ax_main.transAxes,
                color='white',
                fontsize=10)
    
    # Add volume range label
    volume_range = f"Vol Range: {format_volume(df['Volume'].min())} - {format_volume(df['Volume'].max())}"
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

    except Exception as e:
        print(f"Error generating chart: {str(e)}")
        # Ensure figure is closed even if there's an error
        if 'fig' in locals():
            plt.close(fig)
        return False

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
