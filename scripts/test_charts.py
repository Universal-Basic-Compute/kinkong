import os
from datetime import datetime, timedelta
import pandas as pd
import mplfinance as mpf
from dotenv import load_dotenv
import requests

# Load environment variables
load_dotenv()

def test_fetch_data():
    """Test data fetching from Birdeye"""
    print("\n🔍 Testing data fetch...")
    
    url = "https://public-api.birdeye.so/defi/ohlcv"
    headers = {
        "X-API-KEY": os.getenv('BIRDEYE_API_KEY'),
        "x-chain": "solana",
        "accept": "application/json"
    }
    
    # Test parameters for 1-hour timeframe, last 24 hours
    now = int(datetime.now().timestamp())
    params = {
        "address": "9psiRdn9cXYVps4F1kFuoNjd2EtmqNJXrCPmRppJpump",  # UBC token
        "type": "1H",
        "currency": "usd",
        "time_from": now - (24 * 60 * 60),
        "time_to": now
    }
    
    try:
        print("API Request:")
        print(f"URL: {url}")
        print(f"Headers present: {bool(headers['X-API-KEY'])}")
        print(f"Params: {params}")
        
        response = requests.get(url, headers=headers, params=params)
        print(f"\nResponse Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            if data.get('success'):
                items = data.get('data', {}).get('items', [])
                print(f"✅ Successfully fetched {len(items)} candles")
                return True
            else:
                print(f"❌ API request failed: {data.get('message')}")
                return False
        else:
            print(f"❌ HTTP request failed: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Error during fetch: {str(e)}")
        return False

def test_chart_generation():
    """Test basic chart generation with sample data"""
    print("\n📊 Testing chart generation...")
    
    try:
        # Create sample data
        dates = pd.date_range(start='2024-01-01', periods=24, freq='H')
        data = {
            'Open': [1.0] * 24,
            'High': [1.1] * 24,
            'Low': [0.9] * 24,
            'Close': [1.05] * 24,
            'Volume': [1000] * 24
        }
        df = pd.DataFrame(data, index=dates)
        
        # Create charts directory
        os.makedirs('public/charts', exist_ok=True)
        
        # Try to generate a test chart
        print("Generating test chart...")
        
        # Basic chart configuration
        style = mpf.make_mpf_style(
            base_mpf_style='charles',
            gridstyle='',
            facecolor='black',
            edgecolor='white',
            figcolor='black'
        )
        
        fig, axes = mpf.plot(
            df,
            type='candle',
            style=style,
            volume=True,
            returnfig=True,
            title='Test Chart'
        )
        
        # Save test chart
        test_file = 'public/charts/test_chart.png'
        fig.savefig(test_file, dpi=100, bbox_inches='tight')
        print(f"✅ Successfully generated test chart: {test_file}")
        return True
        
    except Exception as e:
        print(f"❌ Error generating chart: {str(e)}")
        return False

def main():
    print("🚀 Starting chart generation tests...")
    
    # Test data fetching
    data_success = test_fetch_data()
    
    # Test chart generation
    chart_success = test_chart_generation()
    
    # Print summary
    print("\n📋 Test Summary:")
    print(f"Data Fetching: {'✅' if data_success else '❌'}")
    print(f"Chart Generation: {'✅' if chart_success else '❌'}")
    
    if data_success and chart_success:
        print("\n✨ All tests passed!")
    else:
        print("\n⚠️ Some tests failed")

if __name__ == "__main__":
    main()
