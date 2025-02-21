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

def get_token_price(token_mint: str) -> float:
    """Get current token price from DexScreener"""
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
                    return float(main_pair.get('priceUsd', 0))
        return 0
    except Exception as e:
        print(f"Error getting price for {token_mint}: {e}")
        return 0

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
                
                # Get current price
                price = get_token_price(mint)
                
                # Create snapshot with only necessary fields
                snapshot = {
                    'symbol': symbol,
                    'price': price,
                    'createdAt': created_at,
                    'isActive': True
                }
                
                new_snapshots.append(snapshot)
                print(f"\nProcessed {symbol}: ${price:.4f}")
                
                # Add to total value if we have allocation data
                if 'allocation' in token['fields']:
                    total_value += price * float(token['fields']['allocation'])
                
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
