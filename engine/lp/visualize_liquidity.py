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

def visualize_liquidity_distribution(data_file, output_file=None):
    """
    Visualize liquidity distribution from JSON data file with price labels on x-axis
    
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
        
        # Prepare data for plotting
        ids = []
        liquidity = []
        prices = []
        
        for id_str, info in distribution.items():
            ids.append(int(id_str))
            liquidity.append(info.get('relative_liquidity', 0))
            prices.append(info.get('price', 0))
        
        # Create figure with two subplots
        logger.info("Creating visualization plots")
        fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(14, 12))
        
        # Create a mapping between bin IDs and prices for the x-axis
        id_to_price = {id_val: price for id_val, price in zip(ids, prices)}
        
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
        
        # Set x-axis to show both bin IDs and prices
        ax1.set_xlabel(f"{id_label} (Price in SOL)")
        ax1.set_ylabel('Relative Liquidity')
        ax1.set_title(f'Liquidity Distribution for {data.get("token_x", "Unknown")}/{data.get("token_y", "Unknown")} Pool')
        
        # Create secondary x-axis for prices
        ax1_price = ax1.twiny()
        ax1_price.set_xlim(ax1.get_xlim())
        ax1_price.set_xticks(label_ids)
        ax1_price.set_xticklabels([f"{id_to_price[id_val]:.6f}" for id_val in label_ids], rotation=45)
        ax1_price.set_xlabel("Price (SOL)")
        
        ax1.legend()
        
        # Plot price vs bin/tick (bottom chart)
        ax2.plot(ids, prices, marker='o', linestyle='-', alpha=0.7)
        ax2.axvline(x=current_point, color='r', linestyle='--', label=f'Current {id_label}')
        ax2.axhline(y=current_price, color='g', linestyle='--', label=f'Current Price: {current_price:.6f}')
        ax2.set_xlabel(id_label)
        ax2.set_ylabel('Price (SOL)')
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
                
                # Add horizontal line on price plot
                label = f'Resistance: {point["price"]:.6f}' if not resistance_legend_added else None
                ax2.axhline(y=point['price'], color='orange', linestyle=':', 
                            alpha=0.5, label=label)
                
                # Add price annotation on liquidity plot
                ax1.annotate(f"{point['price']:.6f}", 
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
                
                # Add horizontal line on price plot
                label = f'Support: {point["price"]:.6f}' if not support_legend_added else None
                ax2.axhline(y=point['price'], color='green', linestyle=':', 
                            alpha=0.5, label=label)
                
                # Add price annotation on liquidity plot
                ax1.annotate(f"{point['price']:.6f}", 
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
