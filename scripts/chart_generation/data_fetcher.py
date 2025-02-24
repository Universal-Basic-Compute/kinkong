import os
import pandas as pd
from datetime import datetime
import requests
from dotenv import load_dotenv

load_dotenv()

def fetch_ubc_sol_data(timeframe='1H', hours=24, token_address=None):
    """
    Fetch OHLCV data from Birdeye API with improved time range handling
    """
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
    
    # Calculate time ranges for multiple requests
    time_ranges = [
        {
            'time_from': now - (hours * 3600),
            'time_to': now
        },
        {
            'time_from': now - (2 * hours * 3600),
            'time_to': now - (hours * 3600)
        }
    ]
    
    all_items = []
    
    for time_range in time_ranges:
        params = {
            "address": token_address or "9psiRdn9cXYVps4F1kFuoNjd2EtmqNJXrCPmRppJpump",
            "type": timeframe,
            "currency": "usd",
            "time_from": time_range['time_from'],
            "time_to": time_range['time_to']
        }
        
        print("Requesting URL:", url)
        print("With params:", params)
        
        try:
            response = requests.get(url, headers=headers, params=params)
            print("Response status:", response.status_code)
            
            if response.status_code == 200:
                data = response.json()
                if data.get('success'):
                    items = data.get('data', {}).get('items', [])
                    all_items.extend(items)
                else:
                    print(f"API request failed: {data.get('message')}")
            else:
                print(f"Request failed with status {response.status_code}")
                
        except Exception as e:
            print(f"Error making request: {e}")
            continue
    
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
        
        # Remove duplicates and keep only the first occurrence
        df = df[~df.index.duplicated(keep='first')]
        
        print(f"\nFetched {len(df)} candles for token address: {token_address or 'UBC'}")
        return df
