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
    
    # Fetch data in two parts
    # Part 1: Most recent 24 candles
    params_recent = {
        "address": "9psiRdn9cXYVps4F1kFuoNjd2EtmqNJXrCPmRppJpump",
        "type": timeframe,
        "currency": "usd",
        "time_from": now - (24 * interval_seconds),
        "time_to": now
    }
    
    # Part 2: Previous 24 candles
    params_previous = {
        "address": "9psiRdn9cXYVps4F1kFuoNjd2EtmqNJXrCPmRppJpump",
        "type": timeframe,
        "currency": "usd",
        "time_from": now - (48 * interval_seconds),
        "time_to": now - (24 * interval_seconds)
    }
    
    try:
        print(f"\nFetching recent {timeframe} candles...")
        response_recent = requests.get(url, headers=headers, params=params_recent)
        print("Recent response status:", response_recent.status_code)
        
        print(f"\nFetching previous {timeframe} candles...")
        response_previous = requests.get(url, headers=headers, params=params_previous)
        print("Previous response status:", response_previous.status_code)
        
        # Process both responses
        df_data = []
        
        for response in [response_previous, response_recent]:
            data = response.json()
            if not data.get('success'):
                print(f"API request failed: {data.get('message')}")
                continue

            items = data.get('data', {}).get('items', [])
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
        
        if not df_data:
            print("No data received from API")
            return None
            
        # Create DataFrame and sort by date
        df = pd.DataFrame(df_data)
        df.set_index('Date', inplace=True)
        df = df.sort_index()
        
        # Remove duplicates
        df = df[~df.index.duplicated(keep='first')]
        
        print(f"\nTotal candles after merge: {len(df)}")
        print("Date range:", df.index[0], "to", df.index[-1])
        
        return df
        
    except Exception as e:
        print(f"Error fetching UBC/SOL data: {e}")
        if 'response' in locals():
            print("API Response:", response.text)
        return None
