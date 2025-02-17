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
    if df is None or df.empty:
        print("No data available for chart generation")
        return
    
    # Calculate key statistics
    current_price = df['Close'].iloc[-1]
    ath = df['High'].max()
    atl = df['Low'].min()
    avg_price = df['Close'].mean()
    avg_volume = df['Volume'].mean()
    price_change = ((df['Close'].iloc[-1] - df['Close'].iloc[0]) / df['Close'].iloc[0]) * 100
    
    # Create statistics text
    stats_text = (
        f"Current: ${current_price:.4f} | "
        f"ATH: ${ath:.4f} | "
        f"ATL: ${atl:.4f} | "
        f"Avg: ${avg_price:.4f} | "
        f"Change: {price_change:+.2f}%"
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
    
    # Create figure and axes
    fig, axes = mpf.plot(
        df,
        type='candle',
        style=style,
        title=f'{config["title"]}\n{stats_text}',
        volume=True,
        figsize=(12, 8),
        panel_ratios=(2, 1),  # Ratio between price and volume panels
        addplot=apds,
        returnfig=True  # Return figure and axes
    )
    
    # Add subtitle with timeframe info
    fig.text(0.5, 0.95, config['subtitle'], 
             horizontalalignment='center',
             color='white',
             fontsize=10)
    
    # Add volume statistics
    volume_stats = f"Avg Volume: ${avg_volume:,.0f}"
    axes[2].text(0.02, 0.95, volume_stats,
                 transform=axes[2].transAxes,
                 color='white',
                 fontsize=8)
    
    # Add legend for EMAs
    axes[0].legend(['EMA20', 'EMA50'], 
                  loc='upper left',
                  facecolor='black',
                  edgecolor='white',
                  fontsize=8)
    
    # Add timestamp
    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M UTC')
    fig.text(0.98, 0.02, f'Generated: {timestamp}',
             horizontalalignment='right',
             color='gray',
             fontsize=8)
    
    # Save the chart
    plt.savefig(
        config['filename'],
        dpi=100,
        bbox_inches='tight',
        facecolor='black',
        edgecolor='none'
    )
    
    # Close any open figures to free memory
    plt.close(fig)
    
    # Print statistics for verification
    print(f"\nChart Statistics for {config['title']}:")
    print(f"Current Price: ${current_price:.4f}")
    print(f"ATH: ${ath:.4f}")
    print(f"ATL: ${atl:.4f}")
    print(f"Average Price: ${avg_price:.4f}")
    print(f"Price Change: {price_change:+.2f}%")
    print(f"Average Volume: ${avg_volume:,.2f}")

def generate_all_charts():
    for config in CHART_CONFIGS:
        print(f"\nGenerating {config['title']}...")
        df = fetch_ubc_sol_data(
            timeframe=config['timeframe'],
            hours=config['duration_hours']
        )
        
        if df is not None and not df.empty:
            print("Data shape:", df.shape)
            print("Columns:", df.columns)
            print("Data types:", df.dtypes)
            print("Sample data:")
            print(df.head())
            
            support_levels = calculate_support_levels(df)
            generate_chart(
                df,
                config,
                support_levels
            )
            print(f"Generated {config['filename']}")
        else:
            print(f"Failed to generate {config['filename']} - no data available")

if __name__ == "__main__":
    generate_all_charts()
    print("Charts generated successfully")
