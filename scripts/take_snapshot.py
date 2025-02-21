import sys
from pathlib import Path
import os
from datetime import datetime, timezone, timedelta
from dotenv import load_dotenv
from airtable import Airtable
import requests
import json
import numpy as np
from typing import List, Optional, Dict

# Get the project root (parent of scripts directory)
project_root = Path(__file__).parent.parent
if str(project_root) not in sys.path:
    sys.path.append(str(project_root))

# Force load environment variables from project root .env
load_dotenv(dotenv_path=project_root / '.env', override=True)

def calculate_volatility(prices: List[float], window: int = 24) -> float:
    """Calculate price volatility as standard deviation of returns, filtering outliers"""
    if len(prices) < 2:
        return 0
    returns = []
    for i in range(1, len(prices)):
        if prices[i-1] > 0:  # Avoid division by zero
            ret = (prices[i] - prices[i-1])/prices[i-1]
            # Filter outliers
            if abs(ret) < 1.0:  # Max 100% change per period
                returns.append(ret)
    return (np.std(returns) * np.sqrt(252)) * 100 if returns else 0

def calculate_volume_growth(volumes: List[float]) -> float:
    """Calculate volume growth comparing recent vs old averages"""
    if len(volumes) < 2:
        return 0
    # Compare average of last 3 days vs first 3 days
    recent_avg = sum(volumes[:3]) / min(3, len(volumes))
    old_avg = sum(volumes[-3:]) / min(3, len(volumes))
    return (recent_avg - old_avg) / old_avg if old_avg > 0 else 0

def calculate_price_trend(prices: List[float]) -> float:
    """Calculate price trend using exponential moving average"""
    if len(prices) < 2:
        return 0
    # Use exponential moving average
    alpha = 0.2  # Smoothing factor
    ema = prices[0]
    for price in prices[1:]:
        ema = alpha * price + (1 - alpha) * ema
    return (ema - prices[-1]) / prices[-1] if prices[-1] > 0 else 0

def calculate_additional_metrics(snapshots_table: Airtable, token_symbol: str, days: int = 7) -> Optional[Dict]:
    """Calculate additional metrics from historical snapshots"""
    try:
        # Get recent snapshots for this token
        recent_snapshots = snapshots_table.get_all(
            filterByFormula=f"AND({{symbol}}='{token_symbol}', " +
                    f"IS_AFTER({{createdAt}}, DATEADD(NOW(), -{days}, 'days')))",
            sort=[{
                'field': 'createdAt',
                'direction': 'desc'
            }]
        )

        print(f"\nProcessing {token_symbol}:")

        if not recent_snapshots:
            print(f"No snapshots found for {token_symbol}")
            return None

        # Extract and validate data
        volumes = [float(snap['fields'].get('volume24h', 0)) for snap in recent_snapshots]
        prices = [float(snap['fields'].get('price', 0)) for snap in recent_snapshots]

        # Calculate metrics
        volume7d = sum(volumes)
        volume_growth = calculate_volume_growth(volumes)
        price7dAvg = sum(prices) / len(prices) if prices else 0
        price_trend = calculate_price_trend(prices)
        volatility = calculate_volatility(prices)

        # Get SOL comparison with same sort parameters
        sol_snapshots = snapshots_table.get_all(
            filterByFormula=f"AND({{symbol}}='SOL', " +
                    f"IS_AFTER({{createdAt}}, DATEADD(NOW(), -{days}, 'days')))",
            sort=[{
                'field': 'createdAt',
                'direction': 'desc'
            }]
        )
        
        sol_prices = [float(snap['fields'].get('price', 0)) for snap in sol_snapshots]
        sol_trend = calculate_price_trend(sol_prices) if sol_prices else 0
        vs_sol_performance = price_trend - sol_trend if price_trend is not None else 0

        return {
            'volume7d': volume7d,
            'volumeGrowth': volume_growth * 100,
            'price7dAvg': price7dAvg,
            'priceTrend': price_trend * 100,
            'vsSolPerformance': vs_sol_performance * 100,
            'priceVolatility': volatility
        }
    except Exception as e:
        print(f"Error calculating additional metrics for {token_symbol}: {e}")
        return None

def get_token_price(token_mint: str) -> dict:
    """Get current token metrics from DexScreener"""
    try:
        url = f"https://api.dexscreener.com/latest/dex/tokens/{token_mint}"
        response = requests.get(url, headers={
            'User-Agent': 'Mozilla/5.0',
            'Accept': 'application/json'
        })
        
        if response.ok:
            data = response.json()
            if data.get('pairs'):
                # Get most liquid Solana pair
                sol_pairs = [p for p in data['pairs'] if p.get('chainId') == 'solana']
                if sol_pairs:
                    main_pair = max(sol_pairs, key=lambda x: float(x.get('liquidity', {}).get('usd', 0)))
                    
                    # Calculate total volume and liquidity across all pairs
                    total_volume = sum(float(p.get('volume', {}).get('h24', 0)) for p in sol_pairs)
                    total_liquidity = sum(float(p.get('liquidity', {}).get('usd', 0)) for p in sol_pairs)
                    
                    return {
                        'price': float(main_pair.get('priceUsd', 0)),
                        'volume24h': total_volume,
                        'liquidity': total_liquidity,
                        'priceChange24h': float(main_pair.get('priceChange', {}).get('h24', 0))
                    }
        return {
            'price': 0,
            'volume24h': 0,
            'liquidity': 0,
            'priceChange24h': 0
        }
    except Exception as e:
        print(f"Error getting metrics for {token_mint}: {e}")
        return {
            'price': 0,
            'volume24h': 0,
            'liquidity': 0,
            'priceChange24h': 0
        }

def record_portfolio_snapshot():
    """Record current portfolio state to Airtable"""
    try:
        print("\n📸 Taking portfolio snapshot...")
        
        # Initialize Airtable
        base_id = os.getenv('KINKONG_AIRTABLE_BASE_ID')
        api_key = os.getenv('KINKONG_AIRTABLE_API_KEY')
        
        if not base_id or not api_key:
            raise ValueError("Missing Airtable configuration")
            
        # Get active tokens from TOKENS table first
        tokens_table = Airtable(base_id, 'TOKENS', api_key)
        active_tokens = tokens_table.get_all(
            formula="{isActive}=1"
        )
        
        print(f"\nFound {len(active_tokens)} active tokens")
        
        # Current timestamp
        created_at = datetime.now(timezone.utc).isoformat()
        
        # Create snapshots table connection
        snapshots_table = Airtable(base_id, 'TOKEN_SNAPSHOTS', api_key)
        
        # Create new snapshots
        new_snapshots = []
        total_value = 0
        
        for token in active_tokens:
            try:
                symbol = token['fields'].get('symbol')
                mint = token['fields'].get('mint')
                
                if not symbol or not mint:
                    continue
                
                # Get current metrics
                metrics = get_token_price(mint)
                
                # Calculate additional metrics
                additional_metrics = calculate_additional_metrics(snapshots_table, symbol)
                
                # Create snapshot with all metrics
                snapshot = {
                    'symbol': symbol,
                    'price': metrics['price'],
                    'volume24h': metrics['volume24h'],
                    'liquidity': metrics['liquidity'],
                    'priceChange24h': metrics['priceChange24h'],
                    'createdAt': created_at,
                    'isActive': True
                }
                
                # Add additional metrics if available
                if additional_metrics:
                    snapshot.update({
                        'volume7d': additional_metrics['volume7d'],
                        'volumeGrowth': additional_metrics['volumeGrowth'],
                        'price7dAvg': additional_metrics['price7dAvg'],
                        'priceTrend': additional_metrics['priceTrend'],
                        'vsSolPerformance': additional_metrics['vsSolPerformance'],
                        'priceVolatility': additional_metrics['priceVolatility']
                    })
                
                new_snapshots.append(snapshot)
                print(f"\nProcessed {symbol}:")
                print(f"Price: ${metrics['price']:.4f}")
                print(f"24h Volume: ${metrics['volume24h']:,.2f}")
                print(f"Liquidity: ${metrics['liquidity']:,.2f}")
                print(f"24h Change: {metrics['priceChange24h']:.2f}%")
                
                if additional_metrics:
                    print(f"7d Volume: ${additional_metrics['volume7d']:,.2f}")
                    print(f"Volume Growth: {additional_metrics['volumeGrowth']:.1f}%")
                    print(f"vs SOL: {additional_metrics['vsSolPerformance']:.1f}%")
                    print(f"Volatility: {additional_metrics['priceVolatility']:.1f}%")
                
                # Add to total value if we have allocation data
                if 'allocation' in token['fields']:
                    total_value += metrics['price'] * float(token['fields']['allocation'])
                
            except Exception as e:
                print(f"Error processing {symbol}: {e}")
                continue
        
        # Save new snapshots to Airtable
        for snapshot in new_snapshots:
            try:
                snapshots_table.insert(snapshot)
                print(f"✅ Saved snapshot for {snapshot['symbol']}")
            except Exception as e:
                print(f"Failed to save snapshot for {snapshot['symbol']}: {e}")
        
        # Create portfolio snapshot
        portfolio_snapshots_table = Airtable(base_id, 'PORTFOLIO_SNAPSHOTS', api_key)
        
        portfolio_snapshot = {
            'createdAt': created_at,
            'totalValue': total_value,
            'holdings': json.dumps(new_snapshots)
        }
        
        portfolio_snapshots_table.insert(portfolio_snapshot)
        print(f"\n✅ Portfolio snapshot recorded at {created_at}")
        print(f"Total Value: ${total_value:,.2f}")
        print(f"Tokens: {len(new_snapshots)}")
        
        return {
            'totalValue': total_value,
            'snapshots': new_snapshots
        }
        
    except Exception as e:
        print(f"\n❌ Error taking snapshot: {e}")
        raise

if __name__ == "__main__":
    try:
        record_portfolio_snapshot()
    except Exception as e:
        print(f"Fatal error: {e}")
        sys.exit(1)
