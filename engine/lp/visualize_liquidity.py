"""
Liquidity Distribution Visualization

This script visualizes the liquidity distribution data from pool_mapping.py
to identify resistance points in liquidity pools.
"""

import sys
import os
from pathlib import Path
import json
import matplotlib.pyplot as plt
import numpy as np
import argparse
import logging
import aiohttp

# Get absolute path to project root
project_root = str(Path(__file__).parent.parent.parent.absolute())
# Add project root to Python path
if project_root not in sys.path:
    sys.path.insert(0, project_root)

# Configure logging
def setup_logging():
    """Set up logging configuration"""
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    return logging.getLogger(__name__)

logger = setup_logging()

async def get_sol_price_usd():
    """Fetch current SOL price in USD from CoinGecko API"""
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd') as response:
                if response.status == 200:
                    data = await response.json()
                    return data.get('solana', {}).get('usd', 150.0)
                else:
                    logger.warning(f"Failed to fetch SOL price: {response.status}")
                    return 150.0  # Default fallback price
    except Exception as e:
        logger.error(f"Error fetching SOL price: {e}")
        return 150.0  # Default fallback price

def visualize_liquidity_distribution(data_file, output_file=None):
    """
    Visualize liquidity distribution from JSON data file with price labels in USD
    
    Args:
        data_file: Path to JSON file with liquidity distribution data
        output_file: Path to save the visualization image (optional)
    """
    try:
        # Load the liquidity distribution data
        logger.info(f"Loading liquidity distribution data from {data_file}")
        with open(data_file, 'r') as f:
            data = json.load(f)
        
        # Check if data is valid
        if not data or (data.get('pool_type') != 'DLMM' and data.get('pool_type') != 'DYN'):
            logger.error("Invalid data format. Must contain pool_type (DLMM or DYN)")
            return False
        
        # Extract bin/tick data
        if data['pool_type'] == 'DLMM':
            distribution = data.get('bin_distribution', {})
            id_label = 'Bin ID'
            current_point = data.get('active_bin', 0)
            current_price = data.get('active_price', 0)
            title_prefix = 'Bin'
            point_id_key = 'bin_id'
        else:  # DYN
            distribution = data.get('tick_distribution', {})
            id_label = 'Tick ID'
            current_point = data.get('current_tick', 0)
            current_price = data.get('current_price', 0)
            title_prefix = 'Tick'
            point_id_key = 'tick_id'
        
        # Check if distribution data exists
        if not distribution:
            logger.error(f"No {id_label.lower()} distribution data found")
            return False
        
        # Get SOL price in USD (hardcoded for now, could be fetched from an API)
        # You can replace this with a real-time price fetch if needed
        sol_price_usd = 150.0  # Example SOL price in USD
        
        # Prepare data for plotting
        ids = []
        liquidity = []
        prices_sol = []
        prices_usd = []
        
        for id_str, info in distribution.items():
            ids.append(int(id_str))
            liquidity.append(info.get('relative_liquidity', 0))
            price_sol = info.get('price', 0)
            prices_sol.append(price_sol)
            # Convert SOL price to USD
            prices_usd.append(price_sol * sol_price_usd)
        
        # Create figure with two subplots
        logger.info("Creating visualization plots")
        fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(14, 12))
        
        # Create a mapping between bin IDs and prices for the x-axis
        id_to_price_sol = {id_val: price for id_val, price in zip(ids, prices_sol)}
        id_to_price_usd = {id_val: price for id_val, price in zip(ids, prices_usd)}
        
        # Create a new x-axis with prices
        unique_ids = sorted(list(set(ids)))
        
        # Select a subset of IDs for labels to avoid overcrowding
        # Choose approximately 10-15 points across the range
        num_labels = min(15, len(unique_ids))
        label_indices = np.linspace(0, len(unique_ids)-1, num_labels, dtype=int)
        label_ids = [unique_ids[i] for i in label_indices]
        
        # Plot liquidity distribution (top chart)
        bars = ax1.bar(ids, liquidity, alpha=0.7)
        ax1.axvline(x=current_point, color='r', linestyle='--', label=f'Current {id_label}')
        
        # Add grid to top chart
        ax1.grid(True, linestyle='--', alpha=0.7)
        
        # Set x-axis to show both bin IDs and prices
        ax1.set_xlabel(f"{id_label} (Price in USD)")
        ax1.set_ylabel('Relative Liquidity')
        ax1.set_title(f'Liquidity Distribution for {data.get("token_x", "Unknown")}/{data.get("token_y", "Unknown")} Pool')
        
        # Create secondary x-axis for prices in USD
        ax1_price = ax1.twiny()
        ax1_price.set_xlim(ax1.get_xlim())
        ax1_price.set_xticks(label_ids)
        # Format price labels with $ sign
        price_labels = []
        for id_val in label_ids:
            price = id_to_price_usd[id_val]
            if price >= 0.01:
                price_labels.append(f"${price:.2f}")
            else:
                price_labels.append(f"${price:.4f}")
        ax1_price.set_xticklabels(price_labels, rotation=45)
        ax1_price.set_xlabel("Price (USD)")
        
        ax1.legend()
        
        # Plot price vs bin/tick (bottom chart)
        ax2.plot(ids, prices_usd, marker='o', linestyle='-', alpha=0.7)
        ax2.axvline(x=current_point, color='r', linestyle='--', label=f'Current {id_label}')
        
        # Add grid to bottom chart
        ax2.grid(True, linestyle='--', alpha=0.7)
        
        # Format current price with $ sign
        current_price_usd = current_price * sol_price_usd
        if current_price_usd >= 0.01:
            price_label = f'Current Price: ${current_price_usd:.2f}'
        else:
            price_label = f'Current Price: ${current_price_usd:.4f}'
        ax2.axhline(y=current_price_usd, color='g', linestyle='--', label=price_label)
        ax2.set_xlabel(id_label)
        ax2.set_ylabel('Price (USD)')
        ax2.set_title(f'Price vs {id_label}')
        ax2.legend()
        
        # Highlight resistance and support points
        resistance_points = data.get('resistance_points', [])
        support_points = data.get('support_points', [])
        resistance_legend_added = False
        support_legend_added = False
        
        # Plot resistance points
        for point in resistance_points:
            if point_id_key in point:
                point_id = int(point[point_id_key])
                
                # Add marker on liquidity plot
                ax1.plot(point_id, point['relative_liquidity'], 'ro', markersize=10, alpha=0.5)
                
                # Convert resistance price to USD
                resistance_price_usd = point['price'] * sol_price_usd
                
                # Add horizontal line on price plot
                if resistance_price_usd >= 0.01:
                    label = f'Resistance: ${resistance_price_usd:.2f}' if not resistance_legend_added else None
                else:
                    label = f'Resistance: ${resistance_price_usd:.4f}' if not resistance_legend_added else None
                    
                ax2.axhline(y=resistance_price_usd, color='orange', linestyle=':', 
                            alpha=0.5, label=label)
                
                # Add price annotation on liquidity plot with $ sign
                if resistance_price_usd >= 0.01:
                    price_text = f"${resistance_price_usd:.2f}"
                else:
                    price_text = f"${resistance_price_usd:.4f}"
                    
                ax1.annotate(price_text, 
                            xy=(point_id, point['relative_liquidity']),
                            xytext=(10, 10),
                            textcoords='offset points',
                            color='red',
                            fontsize=8,
                            arrowprops=dict(arrowstyle='->', color='red', alpha=0.5))
                
                resistance_legend_added = True
        
        # Plot support points
        for point in support_points:
            if point_id_key in point:
                point_id = int(point[point_id_key])
                
                # Add marker on liquidity plot
                ax1.plot(point_id, point['relative_liquidity'], 'go', markersize=10, alpha=0.5)
                
                # Convert support price to USD
                support_price_usd = point['price'] * sol_price_usd
                
                # Add horizontal line on price plot
                if support_price_usd >= 0.01:
                    label = f'Support: ${support_price_usd:.2f}' if not support_legend_added else None
                else:
                    label = f'Support: ${support_price_usd:.4f}' if not support_legend_added else None
                    
                ax2.axhline(y=support_price_usd, color='green', linestyle=':', 
                            alpha=0.5, label=label)
                
                # Add price annotation on liquidity plot with $ sign
                if support_price_usd >= 0.01:
                    price_text = f"${support_price_usd:.2f}"
                else:
                    price_text = f"${support_price_usd:.4f}"
                    
                ax1.annotate(price_text, 
                            xy=(point_id, point['relative_liquidity']),
                            xytext=(10, -15),
                            textcoords='offset points',
                            color='green',
                            fontsize=8,
                            arrowprops=dict(arrowstyle='->', color='green', alpha=0.5))
                
                support_legend_added = True
        
        # Add legend if any resistance or support points exist
        if resistance_points or support_points:
            ax2.legend()
        
        plt.tight_layout()
        
        # Save or show the plot
        if output_file:
            plt.savefig(output_file)
            logger.info(f"Visualization saved to {output_file}")
        else:
            plt.show()
            
        return True
        
    except Exception as e:
        logger.error(f"Error visualizing liquidity distribution: {e}")
        return False

def main():
    """Main function to run the visualization"""
    parser = argparse.ArgumentParser(description='Visualize liquidity distribution data')
    parser.add_argument('data_file', help='JSON file with liquidity distribution data')
    parser.add_argument('--output', help='Output file path for visualization image')
    args = parser.parse_args()
    
    visualize_liquidity_distribution(args.data_file, args.output)

if __name__ == "__main__":
    main()
