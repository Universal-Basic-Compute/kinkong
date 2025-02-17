from .config import CHART_CONFIGS
from .data_fetcher import fetch_ubc_sol_data
from .chart_generator import generate_chart
from .utils import calculate_support_levels

def generate_all_charts():
    print("Starting chart generation process...")
    
    for config in CHART_CONFIGS:
        try:
            print(f"\nProcessing {config['title']}...")
            
            df = fetch_ubc_sol_data(
                timeframe=config['timeframe'],
                hours=config['duration_hours']
            )
            
            if df is None or df.empty:
                print(f"No data available for {config['title']}")
                continue
                
            support_levels = calculate_support_levels(df)
            success = generate_chart(df, config, support_levels)
            
            if success:
                print(f"Successfully generated {config['filename']}")
            else:
                print(f"Failed to generate {config['filename']}")
                
        except Exception as e:
            print(f"Error processing {config['title']}: {str(e)}")
            continue
            
    print("\nChart generation process completed")

if __name__ == "__main__":
    try:
        generate_all_charts()
    except Exception as e:
        print(f"Fatal error in chart generation: {str(e)}")
