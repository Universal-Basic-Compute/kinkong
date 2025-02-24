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
    
    # Double the time ranges to get more candles
    timeframe_config = {
        '15m': {'minutes': 15, 'target': 48},   # 12 hours -> 48 candles
        '1H': {'minutes': 60, 'target': 48},    # 48 hours -> 48 candles
        '4H': {'minutes': 240, 'target': 48},   # 8 days -> 48 candles
        '1D': {'minutes': 1440, 'target': 48}   # 48 days -> 48 candles
    }
    
    config = timeframe_config.get(timeframe, {'minutes': 60, 'target': 48})
    minutes_per_candle = config['minutes']
    target_candles = config['target']
    
    # Calculate time range needed (doubled)
    total_minutes_needed = minutes_per_candle * target_candles * 2  # Double the time range
    start_time = now - int(total_minutes_needed * 60)
    
    params = {
        "address": "9psiRdn9cXYVps4F1kFuoNjd2EtmqNJXrCPmRppJpump",
        "type": timeframe,
        "currency": "usd",
        "time_from": start_time,
        "time_to": now
    }
    
    try:
        print(f"\nFetching {timeframe} candles...")
        print(f"Target candles: {candles_target}")
        print(f"Minutes per candle: {minutes_per_candle}")
        print(f"Total minutes needed: {total_minutes_needed}")
        print("Time range:", 
              datetime.fromtimestamp(start_time).strftime('%Y-%m-%d %H:%M'),
              "to",
              datetime.fromtimestamp(now).strftime('%Y-%m-%d %H:%M'))
        
        response = requests.get(url, headers=headers, params=params)
        print("Response status:", response.status_code)
        
        response.raise_for_status()
        data = response.json()
        
        if not data.get('success'):
            raise ValueError(f"API request failed: {data.get('message')}")

        items = data.get('data', {}).get('items', [])
        if not items:
            raise ValueError("No data items returned from Birdeye API")

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
        
        for col in ['Open', 'High', 'Low', 'Close', 'Volume']:
            df[col] = df[col].astype(float)
        
        df = df.sort_index()
        df = df[~df.index.duplicated(keep='first')]
        
        # Always trim to target number of candles
        if len(df) > candles_target:
            print(f"Trimming excess candles ({len(df)} -> {candles_target})")
            df = df.iloc[-candles_target:]
        else:
            print(f"Warning: Got fewer candles than target ({len(df)} < {candles_target})")
        
        print(f"Final candle count: {len(df)}")
        print(f"\nFetched {len(df)} candles for UBC/SOL")
        return df
        
    except Exception as e:
        print(f"Error fetching UBC/SOL data: {e}")
        if 'response' in locals():
            print("API Response:", response.text)
        return None
