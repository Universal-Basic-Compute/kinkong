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
        'timeframe': '5m',
        'duration_hours': 24,
        'title': '24H Short-term View',
        'filename': 'ubc-chart-short.png'
    },
    {
        'timeframe': '1H',
        'duration_hours': 168,  # 7 days
        'title': '7D Medium-term View',
        'filename': 'ubc-chart-medium.png'
    },
    {
        'timeframe': '4H',
        'duration_hours': 720,  # 30 days
        'title': '30D Long-term View',
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

def generate_chart(df, title, filename, support_levels=None):
    
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
        ),
        rc={'axes.labelcolor': 'white',
            'axes.edgecolor': 'gray',
            'xtick.color': 'white',
            'ytick.color': 'white'}
    )
    
    # Create figure
    fig, axes = mpf.plot(
        df,
        type='candle',
        volume=True,
        style=style,
        title=title,
        ylabel='Price (SOL)',
        ylabel_lower='Volume',
        returnfig=True,
        figsize=(12, 8),
        panel_ratios=(3, 1),
        mav=(20, 50)  # Add 20 and 50 period moving averages
    )
    
    # Customize the figure
    fig.patch.set_facecolor('black')
    
    # Save the chart
    # Add support/resistance levels if provided
    if support_levels:
        ax = axes[0]
        for level_type, price in support_levels:
            color = '#22c55e' if level_type == 'support' else '#ef4444'
            ax.axhline(y=price, color=color, linestyle='--', alpha=0.5)
    
    plt.savefig(filename, 
                dpi=100, 
                bbox_inches='tight', 
                facecolor='black',
                edgecolor='none')
    plt.close()

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
                config['title'],
                config['filename'],
                support_levels
            )
            print(f"Generated {config['filename']}")
        else:
            print(f"Failed to generate {config['filename']}")

if __name__ == "__main__":
    generate_all_charts()
    print("Charts generated successfully")
