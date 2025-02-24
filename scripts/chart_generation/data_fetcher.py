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
    desired_candles = min(candles_target * 1.2, 1000)  # Cap at API limit
    time_range = int(desired_candles * interval_seconds)
    
    params = {
        "address": "9psiRdn9cXYVps4F1kFuoNjd2EtmqNJXrCPmRppJpump",
        "type": timeframe,
        "currency": "usd",
        "time_from": now - time_range,
        "time_to": now,
        "limit": int(desired_candles)  # Add explicit limit parameter
    }
    
    # Debug prints
    print("\nAPI Request Details:")
    print(f"URL: {url}")
    print(f"Headers: {headers}")
    print(f"Params: {params}")
    print(f"Timeframe: {timeframe}")
    print(f"Desired candles: {desired_candles}")
    print(f"Time range: {time_range} seconds")
    print(f"From: {datetime.fromtimestamp(params['time_from']).strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"To: {datetime.fromtimestamp(params['time_to']).strftime('%Y-%m-%d %H:%M:%S')}")
    
    try:
        response = requests.get(url, headers=headers, params=params)
        print("\nAPI Response:")
        print(f"Status Code: {response.status_code}")
        print(f"Response Headers: {dict(response.headers)}")
        
        data = response.json()
        print(f"Response Data Keys: {data.keys() if isinstance(data, dict) else 'Not a dict'}")
        
        if not data.get('success'):
            print(f"API Error: {data.get('message', 'No error message')}")
            return None

        items = data.get('data', {}).get('items', [])
        print(f"Number of items received: {len(items)}")
        
        if not items:
            print("No data items in response")
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
        
        df = pd.DataFrame(df_data)
        df.set_index('Date', inplace=True)
        df = df.sort_index()
        df = df[~df.index.duplicated(keep='first')]
        
        print("\nDataFrame Info:")
        print(f"Shape: {df.shape}")
        print(f"Date Range: {df.index[0]} to {df.index[-1]}")
        print(f"Number of candles: {len(df)}")
        
        return df
        
    except Exception as e:
        print(f"\nError fetching data: {str(e)}")
        if 'response' in locals():
            print(f"Raw Response: {response.text[:1000]}...")  # Print first 1000 chars of response
        return None
