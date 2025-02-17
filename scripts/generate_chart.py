import matplotlib.pyplot as plt
import mplfinance as mpf
import pandas as pd
from datetime import datetime, timedelta

# Create sample data
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
    # Get sample data
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
        title='UBC/USDC 24H Chart',
        ylabel='Price (USDC)',
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
