import matplotlib.pyplot as plt
import mplfinance as mpf
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import requests
from dotenv import load_dotenv
import os

# Load environment variables
load_dotenv()

CHART_CONFIGS = [
    {
        'timeframe': '15m',  # Changed from 5m to 15m
        'duration_hours': 34,  # ~136 candles (34 hours * 4 candles per hour)
        'title': 'UBC/USD Short-term Analysis (34H)',
        'subtitle': '15-minute candles - Trading Setup View',
        'filename': 'ubc-chart-short.png'
    },
    {
        'timeframe': '2H',   # Changed from 1H to 2H
        'duration_hours': 270,  # ~135 candles (270 hours / 2 hours per candle)
        'title': 'UBC/USD Medium-term Analysis (11D)',
        'subtitle': '2-hour candles - Swing Trading View',
        'filename': 'ubc-chart-medium.png'
    },
    {
        'timeframe': '8H',   # Changed from 4H to 8H
        'duration_hours': 1080,  # ~135 candles (1080 hours / 8 hours per candle)
        'title': 'UBC/USD Long-term Analysis (45D)',
        'subtitle': '8-hour candles - Trend Analysis View',
        'filename': 'ubc-chart-long.png'
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
        df = df.sort_index()
        
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
    if df is None:
        print("Using sample data as fallback...")
        df = create_sample_data()
    
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
    
    # Create figure with extra space for title
    fig = mpf.figure(
        figsize=(12, 8),
        facecolor='black',
        style=style
    )
    
    # Add title axes
    title_ax = fig.add_axes([0.1, 0.95, 0.8, 0.04])
    title_ax.set_axis_off()
    title_ax.text(0.5, 0.5, config['title'],
                 color='white',
                 fontsize=14,
                 fontweight='bold',
                 ha='center',
                 va='center')
    
    # Add subtitle
    subtitle_ax = fig.add_axes([0.1, 0.92, 0.8, 0.03])
    subtitle_ax.set_axis_off()
    subtitle_ax.text(0.5, 0.5, config['subtitle'],
                    color='white',
                    alpha=0.8,
                    fontsize=10,
                    ha='center',
                    va='center')
    
    # Main chart
    ax1 = fig.add_axes([0.1, 0.25, 0.8, 0.65])
    ax2 = fig.add_axes([0.1, 0.1, 0.8, 0.15])
    
    # Plot candlestick chart
    mpf.plot(
        df,
        type='candle',
        style=style,
        volume=True,
        ax=ax1,
        volume_panel=ax2,
        mav=(20, 50),  # Add 20 and 50 period moving averages
        show_nontrading=False
    )
    
    # Add support/resistance levels if provided
    if support_levels:
        for level_type, price in support_levels:
            color = '#22c55e' if level_type == 'support' else '#ef4444'
            ax1.axhline(y=price, color=color, linestyle='--', alpha=0.5)
            
            # Add price label
            ax1.text(df.index[-1], price, 
                    f'{level_type.title()}: ${price:.4f}',
                    color=color, alpha=0.8, 
                    va='center', ha='left')
    
    # Add timestamp
    timestamp_ax = fig.add_axes([0.1, 0.02, 0.8, 0.03])
    timestamp_ax.set_axis_off()
    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M UTC')
    timestamp_ax.text(1.0, 0.5, f'Generated: {timestamp}',
                     color='gray',
                     fontsize=8,
                     ha='right',
                     va='center')
    
    # Customize axes colors
    for ax in [ax1, ax2]:
        ax.tick_params(colors='white')
        ax.spines['bottom'].set_color('gray')
        ax.spines['top'].set_color('gray')
        ax.spines['left'].set_color('gray')
        ax.spines['right'].set_color('gray')
    
    # Save the chart
    plt.savefig(
        config['filename'],
        dpi=100,
        bbox_inches='tight',
        facecolor='black',
        edgecolor='none'
    )
    plt.close(fig)

def generate_all_charts():
    for config in CHART_CONFIGS:
        print(f"\nGenerating {config['title']}...")
        df = fetch_ubc_sol_data(
            timeframe=config['timeframe'],
            hours=config['duration_hours']
        )
        
        if df is not None:
            support_levels = calculate_support_levels(df)
            generate_chart(
                df,
                config,
                support_levels
            )
            print(f"Generated {config['filename']}")
        else:
            print(f"Failed to generate {config['filename']}")

if __name__ == "__main__":
    generate_all_charts()
    print("Charts generated successfully")
