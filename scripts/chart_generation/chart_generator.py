import matplotlib.pyplot as plt
import mplfinance as mpf
import os
from datetime import datetime
from .utils import format_price, format_volume

def generate_chart(df, config, support_levels=None):
    try:
        print(f"Starting chart generation for {config['title']}")
        print(f"Data shape: {df.shape if df is not None else 'No data'}")
        
        # Early validation of dataframe
        if df is None or df.empty:
            print("No data available for chart generation")
            return False
            
        # Verify required columns exist
        required_columns = ['Open', 'High', 'Low', 'Close', 'Volume']
        missing_columns = [col for col in required_columns if col not in df.columns]
        if missing_columns:
            print(f"Missing required columns: {missing_columns}")
            return False

        # Calculate statistics with error handling
        try:
            current_price = df['Close'].iloc[-1]
            ath = df['High'].max()
            atl = df['Low'].min()
            avg_price = df['Close'].mean()
            avg_volume = df['Volume'].mean()
            price_change = ((df['Close'].iloc[-1] - df['Close'].iloc[0]) / df['Close'].iloc[0]) * 100
        except Exception as e:
            print(f"Error calculating statistics: {e}")
            return False
        
        # Create figure with error handling
        try:
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
        except Exception as e:
            print(f"Error creating chart figure: {e}")
            return False

        # Add text elements with error handling
        try:
            fig.text(0.5, 0.97, config.get('title', 'Chart'),
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
        except Exception as e:
            print(f"Error adding text elements: {e}")
            # Continue anyway as this is not critical

        # Save chart with error handling
        try:
            charts_dir = os.path.join('public', 'charts')
            os.makedirs(charts_dir, exist_ok=True)

            output_path = os.path.join(charts_dir, config.get('filename', 'chart.png'))
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
            print(f"Error saving chart: {e}")
            if 'fig' in locals():
                plt.close(fig)
            return False

    except Exception as e:
        print(f"Error generating chart: {str(e)}")
        if 'fig' in locals():
            plt.close(fig)
        return False
