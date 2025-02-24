import os
import pandas as pd
from datetime import datetime
import requests
from dotenv import load_dotenv

load_dotenv()

def fetch_ubc_sol_data(timeframe='1H', hours=24, candles_target=60):
    url = "https://public-api.birdeye.so/defi/ohlcv"
    headers = {
        "X-API-KEY": os.getenv('BIRDEYE_API_KEY'),
        "x-chain": "solana",
        "accept": "application/json"
    }
    
    now = int(datetime.now().timestamp())
    
    # Calculate interval in seconds based on timeframe
    interval_seconds = {
        '15m': 15 * 60,
        '1H': 60 * 60,
        '4H': 4 * 60 * 60,
        '1D': 24 * 60 * 60
    }.get(timeframe, 60 * 60)
    
    # Calculate time range to get desired number of candles
    # Add 20% buffer to ensure we get enough data
    desired_candles = min(candles_target * 1.2, 1000)  # Cap at API limit
    time_range = int(desired_candles * interval_seconds)
    
    params = {
        "address": "9psiRdn9cXYVps4F1kFuoNjd2EtmqNJXrCPmRppJpump",
        "type": timeframe,
        "currency": "usd",
        "time_from": now - time_range,
        "time_to": now
    }
    
    try:
        print(f"\nFetching {timeframe} candles...")
        print("Time range:", datetime.fromtimestamp(params['time_from']), "to", datetime.fromtimestamp(params['time_to']))
        
        response = requests.get(url, headers=headers, params=params)
        print("Response status:", response.status_code)
        
        data = response.json()
        if not data.get('success'):
            print(f"API request failed: {data.get('message')}")
            return None

        items = data.get('data', {}).get('items', [])
        if not items:
            print("No data received from API")
            return None
            
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
        
        # Create DataFrame and sort by date
        df = pd.DataFrame(df_data)
        df.set_index('Date', inplace=True)
        df = df.sort_index()
        
        # Remove duplicates
        df = df[~df.index.duplicated(keep='first')]
        
        print(f"\nTotal candles fetched: {len(df)}")
        print("Date range:", df.index[0], "to", df.index[-1])
        
        return df
        
    except Exception as e:
        print(f"Error fetching UBC/SOL data: {e}")
        if 'response' in locals():
            print("API Response:", response.text)
        return None
