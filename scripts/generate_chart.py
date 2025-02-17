import matplotlib.pyplot as plt
import mplfinance as mpf
import pandas as pd
from datetime import datetime, timedelta
import requests
from dotenv import load_dotenv
import os

# Load environment variables
load_dotenv()

def fetch_ubc_sol_data():
    # Birdeye API endpoint for UBC/SOL pair
    url = "https://public-api.birdeye.so/defi/history_price"  # Updated endpoint
    headers = {
        "X-API-KEY": os.getenv('BIRDEYE_API_KEY'),
        "x-chain": "solana",
        "accept": "application/json"
    }
    params = {
        "address": "9psiRdn9cXYVps4F1kFuoNjd2EtmqNJXrCPmRppJpump",  # UBC token address
        "address_type": "token",  # Added required parameter
        "type": "1H",  # Back to 1H for hourly candles
        "time_from": int((datetime.now() - timedelta(days=1)).timestamp()),
        "time_to": int(datetime.now().timestamp())
    }
    
    try:
        if not os.getenv('BIRDEYE_API_KEY'):
            raise ValueError("BIRDEYE_API_KEY not found in environment variables")
            
        response = requests.get(url, headers=headers, params=params)
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
                'Open': float(item.get('price', 0)),
                'High': float(item.get('high', 0)),
                'Low': float(item.get('low', 0)),
                'Close': float(item.get('close', 0)),
                'Volume': float(item.get('volume', 0))
            })
        
        # Create DataFrame and set index
        df = pd.DataFrame(df_data)
        df.set_index('Date', inplace=True)
        
        # Sort index to ensure chronological order
        df = df.sort_index()
        
        print(f"Fetched {len(df)} candles for UBC/SOL")
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

def generate_chart():
    # Get UBC/SOL data
    df = fetch_ubc_sol_data()
    
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
        title='UBC/SOL 24H Chart',
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
    plt.savefig('ubc-chart.png', 
                dpi=100, 
                bbox_inches='tight', 
                facecolor='black',
                edgecolor='none')
    plt.close()

if __name__ == "__main__":
    generate_chart()
    print("Chart generated as ubc-chart.png")
