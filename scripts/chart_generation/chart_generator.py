import matplotlib.pyplot as plt
import mplfinance as mpf
import os
from datetime import datetime
from .utils import format_price, format_volume

def generate_chart(df, config, support_levels=None):
    try:
        print(f"Starting chart generation for {config['title']}")
        print(f"Data shape: {df.shape}")
        
        if df is None or df.empty:
            print("No data available for chart generation")
            return
        
        # Calculate statistics
        current_price = df['Close'].iloc[-1]
        ath = df['High'].max()
        atl = df['Low'].min()
        avg_price = df['Close'].mean()
        avg_volume = df['Volume'].mean()
        price_change = ((df['Close'].iloc[-1] - df['Close'].iloc[0]) / df['Close'].iloc[0]) * 100
        
        # Create figure
        fig, axes = mpf.plot(
            df,
            type='candle',
            style=mpf.make_mpf_style(
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
                )
            ),
            volume=True,
            figsize=(16, 10),
            panel_ratios=(3, 1),
            returnfig=True,
            title='\n\n\n',
            yscale='log'
        )
        
        # Add text elements
        fig.text(0.5, 0.97, config['title'],
                horizontalalignment='center',
                color='white',
                fontsize=14,
                fontweight='bold')
        
        stats_text = (
            f"Current: {format_price(current_price)} ({price_change:+.2f}%) | "
            f"ATH: {format_price(ath)} | ATL: {format_price(atl)} | "
            f"Avg: {format_price(avg_price)}"
        )
        
        fig.text(0.5, 0.94, stats_text,
                horizontalalignment='center',
                color='#ffd700',
                fontsize=11)
        
        # Save chart
        charts_dir = os.path.join('public', 'charts')
        os.makedirs(charts_dir, exist_ok=True)

        output_path = os.path.join(charts_dir, config['filename'])
        plt.savefig(
            output_path,
            dpi=150,
            bbox_inches='tight',
            facecolor='black',
            edgecolor='none'
        )
        
        plt.close(fig)
        print(f"Successfully saved chart to {output_path}")
        return True

    except Exception as e:
        print(f"Error generating chart: {str(e)}")
        if 'fig' in locals():
            plt.close(fig)
        return False
