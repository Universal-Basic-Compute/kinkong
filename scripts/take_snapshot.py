import sys
from pathlib import Path
import os
from datetime import datetime, timezone
from dotenv import load_dotenv
from airtable import Airtable
import requests
import json

# Get the project root (parent of scripts directory)
project_root = Path(__file__).parent.parent
if str(project_root) not in sys.path:
    sys.path.append(str(project_root))

# Force load environment variables from project root .env
load_dotenv(dotenv_path=project_root / '.env', override=True)

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
                        'volume7d': total_volume * 7,  # Approximation
                        'liquidity': total_liquidity,
                        'priceChange24h': float(main_pair.get('priceChange', {}).get('h24', 0)),
                        'volumeGrowth': float(main_pair.get('volume', {}).get('h24', 0)) / float(main_pair.get('volume', {}).get('h6', 1)) - 1 if main_pair.get('volume', {}).get('h6') else 0,
                        'pricePerformance': float(main_pair.get('priceChange', {}).get('h24', 0))
                    }
        return {
            'price': 0,
            'volume24h': 0,
            'volume7d': 0,
            'liquidity': 0,
            'priceChange24h': 0,
            'volumeGrowth': 0,
            'pricePerformance': 0
        }
    except Exception as e:
        print(f"Error getting metrics for {token_mint}: {e}")
        return {
            'price': 0,
            'volume24h': 0,
            'volume7d': 0,
            'liquidity': 0,
            'priceChange24h': 0,
            'volumeGrowth': 0,
            'pricePerformance': 0
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
                
                # Create snapshot with all metrics
                snapshot = {
                    'symbol': symbol,
                    'price': metrics['price'],
                    'volume7d': metrics['volume7d'],
                    'liquidity': metrics['liquidity'],
                    'volumeGrowth': metrics['volumeGrowth'],
                    'pricePerformance': metrics['pricePerformance'],
                    'priceChange24h': metrics['priceChange24h'],
                    'createdAt': created_at,
                    'isActive': True
                }
                
                new_snapshots.append(snapshot)
                print(f"\nProcessed {symbol}:")
                print(f"Price: ${metrics['price']:.4f}")
                print(f"7d Volume: ${metrics['volume7d']:,.2f}")
                print(f"Liquidity: ${metrics['liquidity']:,.2f}")
                print(f"24h Change: {metrics['priceChange24h']:.2f}%")
                
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
