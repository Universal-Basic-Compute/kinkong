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
    
    # Calculate required time range based on timeframe
    # Multiply the duration by a factor to get more candles
    timeframe_multipliers = {
        '15m': 3,    # Get 3x more 15m candles (72 candles for 6h)
        '1H': 2,     # Get 2x more 1h candles (48 candles for 24h)
        '4H': 1.5,   # Get 1.5x more 4h candles (63 candles for 7d)
        '1D': 1.2    # Get 1.2x more daily candles (36 candles for 30d)
    }
    
    # Calculate start time with multiplier
    multiplier = timeframe_multipliers.get(timeframe, 1)
    start_time = now - (int(hours * 3600 * multiplier))
    
    params = {
        "address": "9psiRdn9cXYVps4F1kFuoNjd2EtmqNJXrCPmRppJpump",
        "type": timeframe,
        "currency": "usd",
        "time_from": start_time,
        "time_to": now
    }
    
    try:
        print(f"Fetching {timeframe} candles with {multiplier}x duration multiplier")
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
        
        # Trim excess candles if we got too many
        target_counts = {
            '15m': 72,  # 6h = 24 candles * 3
            '1H': 48,   # 24h = 24 candles * 2
            '4H': 63,   # 7d = 42 candles * 1.5
            '1D': 36    # 30d = 30 candles * 1.2
        }
        
        target = target_counts.get(timeframe, candles_target)
        if len(df) > target:
            print(f"Trimming excess candles ({len(df)} -> {target})")
            df = df.iloc[-target:]
        
        print(f"Final candle count: {len(df)}")
        print(f"\nFetched {len(df)} candles for UBC/SOL")
        return df
        
    except Exception as e:
        print(f"Error fetching UBC/SOL data: {e}")
        if 'response' in locals():
            print("API Response:", response.text)
        return None
