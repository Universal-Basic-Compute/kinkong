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
    
    # Make two requests with overlapping time ranges
    params1 = {
        "address": "9psiRdn9cXYVps4F1kFuoNjd2EtmqNJXrCPmRppJpump",
        "type": timeframe,
        "currency": "usd",
        "time_from": now - (2 * interval_seconds * 24),  # Get 48 intervals
        "time_to": now
    }
    
    params2 = {
        "address": "9psiRdn9cXYVps4F1kFuoNjd2EtmqNJXrCPmRppJpump",
        "type": timeframe,
        "currency": "usd",
        "time_from": now - (4 * interval_seconds * 24),  # Get previous 48 intervals
        "time_to": now - (2 * interval_seconds * 24)
    }
    
    try:
        # Make both requests
        response1 = requests.get(url, headers=headers, params=params1)
        response2 = requests.get(url, headers=headers, params=params2)
        
        all_items = []
        
        # Process first response
        data1 = response1.json()
        if data1.get('success'):
            all_items.extend(data1.get('data', {}).get('items', []))
            
        # Process second response
        data2 = response2.json()
        if data2.get('success'):
            all_items.extend(data2.get('data', {}).get('items', []))
            
        if not all_items:
            print("No data items in responses")
            return None
            
        # Convert to DataFrame
        df_data = []
        for item in all_items:
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
        
        print(f"\nFetched {len(df)} candles for timeframe {timeframe}")
        return df
        
    except Exception as e:
        print(f"\nError fetching data: {str(e)}")
        return None
