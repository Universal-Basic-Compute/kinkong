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

async def get_token_prices():
    """Fetch current token prices in USD from CoinGecko API"""
    try:
        token_prices = {}
        
        # Define token IDs for CoinGecko
        token_ids = {
            "SOL": "solana",
            "UBC": "unbounded-finance",  # Use the correct CoinGecko ID for UBC
            "COMPUTE": "compute-finance"  # Use the correct CoinGecko ID for COMPUTE
        }
        
        async with aiohttp.ClientSession() as session:
            # Build the query string with all tokens
            ids_param = ",".join(token_ids.values())
            url = f'https://api.coingecko.com/api/v3/simple/price?ids={ids_param}&vs_currencies=usd'
            
            async with session.get(url) as response:
                if response.status == 200:
                    data = await response.json()
                    
                    # Extract prices for each token
                    for token, coingecko_id in token_ids.items():
                        if coingecko_id in data and 'usd' in data[coingecko_id]:
                            token_prices[token] = data[coingecko_id]['usd']
                        else:
                            # Use fallback prices if not found
                            if token == "SOL":
                                token_prices[token] = 150.0  # Fallback SOL price
                            elif token == "UBC":
                                token_prices[token] = 0.01  # Fallback UBC price
                            elif token == "COMPUTE":
                                token_prices[token] = 0.05  # Fallback COMPUTE price
                    
                    logger.info(f"Fetched token prices: {token_prices}")
                    return token_prices
                else:
                    logger.warning(f"Failed to fetch token prices: {response.status}")
                    # Return fallback prices
                    return {"SOL": 150.0, "UBC": 0.01, "COMPUTE": 0.05}
    except Exception as e:
        logger.error(f"Error fetching token prices: {e}")
        # Return fallback prices
        return {"SOL": 150.0, "UBC": 0.01, "COMPUTE": 0.05}

async def visualize_liquidity_distribution(data_file, output_file=None):
    """
    Visualize liquidity distribution from JSON data file with accurate price labels in USD
    
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
        
        # Get token names from the data
        token_x = data.get("token_x", "Unknown")
        token_y = data.get("token_y", "Unknown")
        
        # Fetch current token prices
        token_prices = await get_token_prices()
        
        # Get the price of the quote token (usually SOL)
        quote_token_price = token_prices.get(token_y, 150.0)  # Default to 150 if not found
        
        # Get the price of the base token (usually UBC or COMPUTE)
        base_token_price = token_prices.get(token_x, 0.01)  # Default to 0.01 if not found
        
        logger.info(f"Using token prices: {token_x}=${base_token_price}, {token_y}=${quote_token_price}")
        
        # Calculate the actual market price ratio for validation
        actual_market_ratio = base_token_price / quote_token_price
        logger.info(f"Actual market price ratio ({token_x}/{token_y}): {actual_market_ratio}")
        
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
        prices_sol = []
        prices_usd = []
        
        for id_str, info in distribution.items():
            ids.append(int(id_str))
            liquidity.append(info.get('relative_liquidity', 0))
            price_sol = info.get('price', 0)
            prices_sol.append(price_sol)
            
            # Convert SOL price to USD using the actual token price
            if token_y == "SOL":
                prices_usd.append(price_sol * quote_token_price)
            else:
                # For other quote tokens, convert accordingly
                prices_usd.append(price_sol * quote_token_price)
        
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
        
        # Get the actual price at the current bin/tick
        current_bin_price = None
        for id_str, info in distribution.items():
            if int(id_str) == current_point:
                current_bin_price = info.get('price', 0) * quote_token_price
                logger.info(f"Found price for current bin {current_point}: {current_bin_price}")
                break

        # If we couldn't find the exact bin, use the calculated price
        if current_bin_price is None:
            current_bin_price = current_price * quote_token_price
            logger.info(f"Using calculated price for current bin: {current_bin_price}")
            
        # Validate and adjust current price if needed
        logger.info(f"Calculated current price: ${current_bin_price:.6f}")
        logger.info(f"Expected price based on market: ${base_token_price:.6f}")
        
        # If the calculated price is significantly different from the market price,
        # we might need to apply a correction factor
        if abs(current_bin_price - base_token_price) / base_token_price > 0.3:  # 30% difference
            correction_factor = base_token_price / current_bin_price
            logger.warning(f"Price discrepancy detected. Applying correction factor: {correction_factor:.4f}")
            logger.warning(f"Calculated: ${current_bin_price:.6f}, Market: ${base_token_price:.6f}")
            current_bin_price = base_token_price
            
            # Also correct all other prices
            prices_usd = [p * correction_factor for p in prices_usd]

        # Format current price with $ sign
        if current_bin_price >= 0.01:
            price_label = f'Current Price: ${current_bin_price:.2f}'
        else:
            price_label = f'Current Price: ${current_bin_price:.4f}'
            
        # Draw the current price line at the actual price
        ax2.axhline(y=current_bin_price, color='g', linestyle='--', label=price_label)
        ax2.set_xlabel(id_label)
        ax2.set_ylabel('Price (USD)')
        ax2.set_title(f'Price vs {id_label}')
        ax2.legend()
        
        # Highlight resistance and support points
        resistance_points = data.get('resistance_points', [])
        support_points = data.get('support_points', [])
        resistance_legend_added = False
        support_legend_added = False
        
        # Plot resistance points on the liquidity chart (top)
        for point in resistance_points:
            if point_id_key in point:
                point_id = int(point[point_id_key])
                
                # Add marker on liquidity plot
                ax1.plot(point_id, point['relative_liquidity'], 'ro', markersize=10, alpha=0.5)
                
                # Add price annotation on liquidity plot with $ sign
                resistance_price_usd = point['price'] * quote_token_price
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
        
        # Plot support points on the liquidity chart (top)
        for point in support_points:
            if point_id_key in point:
                point_id = int(point[point_id_key])
                
                # Add marker on liquidity plot
                ax1.plot(point_id, point['relative_liquidity'], 'go', markersize=10, alpha=0.5)
                
                # Add price annotation on liquidity plot with $ sign
                support_price_usd = point['price'] * quote_token_price
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
        
        # Clear previous resistance/support lines (if any)
        for line in ax2.get_lines():
            if line.get_label() and ('Resistance:' in line.get_label() or 'Support:' in line.get_label()):
                line.remove()

        # Plot resistance points as solid bands on price chart (bottom)
        for i, point in enumerate(resistance_points):
            if point_id_key in point:
                # Calculate opacity based on relative liquidity (0.2 to 0.8 range)
                opacity = 0.2 + min(0.6, point['relative_liquidity'])
                
                # Add horizontal band on price plot
                resistance_price_usd = point['price'] * quote_token_price
                
                # Format label
                if resistance_price_usd >= 0.01:
                    label = f'Resistance: ${resistance_price_usd:.2f}' if i == 0 else None
                else:
                    label = f'Resistance: ${resistance_price_usd:.4f}' if i == 0 else None
                
                # Add a solid band instead of a line
                ax2.axhspan(
                    resistance_price_usd * 0.98,  # Slightly below the price
                    resistance_price_usd * 1.02,  # Slightly above the price
                    color='red',
                    alpha=min(0.15, opacity/2),  # Reduce opacity significantly
                    label=label
                )
                
                # Add text annotation for the price
                if resistance_price_usd >= 0.01:
                    price_text = f"${resistance_price_usd:.2f}"
                else:
                    price_text = f"${resistance_price_usd:.4f}"
                    
                # Add text at the right edge of the plot
                ax2.text(
                    ax2.get_xlim()[1] * 1.01,  # Just outside the right edge
                    resistance_price_usd,
                    price_text,
                    verticalalignment='center',
                    horizontalalignment='left',
                    color='red',
                    fontweight='bold',
                    fontsize=9
                )
                
                resistance_legend_added = True

        # Plot support points as solid bands on price chart (bottom)
        for i, point in enumerate(support_points):
            if point_id_key in point:
                # Calculate opacity based on relative liquidity (0.2 to 0.8 range)
                opacity = 0.2 + min(0.6, point['relative_liquidity'])
                
                # Add horizontal band on price plot
                support_price_usd = point['price'] * quote_token_price
                
                # Format label
                if support_price_usd >= 0.01:
                    label = f'Support: ${support_price_usd:.2f}' if i == 0 else None
                else:
                    label = f'Support: ${support_price_usd:.4f}' if i == 0 else None
                
                # Add a solid band instead of a line
                ax2.axhspan(
                    support_price_usd * 0.98,  # Slightly below the price
                    support_price_usd * 1.02,  # Slightly above the price
                    color='green',
                    alpha=min(0.15, opacity/2),  # Reduce opacity significantly
                    label=label
                )
                
                # Add text annotation for the price
                if support_price_usd >= 0.01:
                    price_text = f"${support_price_usd:.2f}"
                else:
                    price_text = f"${support_price_usd:.4f}"
                    
                # Add text at the right edge of the plot
                ax2.text(
                    ax2.get_xlim()[1] * 1.01,  # Just outside the right edge
                    support_price_usd,
                    price_text,
                    verticalalignment='center',
                    horizontalalignment='left',
                    color='green',
                    fontweight='bold',
                    fontsize=9
                )
                
                support_legend_added = True
                
        # Adjust the x-axis limits to make room for the price labels
        ax2.set_xlim(right=ax2.get_xlim()[1] * 1.15)
        
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

async def async_main():
    """Async main function to run the visualization"""
    parser = argparse.ArgumentParser(description='Visualize liquidity distribution data')
    parser.add_argument('data_file', help='JSON file with liquidity distribution data')
    parser.add_argument('--output', help='Output file path for visualization image')
    args = parser.parse_args()
    
    await visualize_liquidity_distribution(args.data_file, args.output)

def main():
    """Main function to run the visualization"""
    import asyncio
    
    # Handle different event loop policies for Windows
    if os.name == 'nt':  # Windows
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    
    asyncio.run(async_main())

if __name__ == "__main__":
    main()
