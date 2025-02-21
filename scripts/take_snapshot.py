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
            
        # Get active tokens
        tokens_table = Airtable(base_id, 'TOKENS', api_key)
        tokens = tokens_table.get_all(
            formula="{isActive}=1"
        )
        
        print(f"\nFound {len(tokens)} active tokens")
        
        # Current timestamp
        timestamp = datetime.now(timezone.utc).isoformat()
        
        # Process each token
        snapshots = []
        total_value = 0
        
        for token in tokens:
            try:
                fields = token['fields']
                symbol = fields.get('symbol')
                mint = fields.get('mint')
                
                print(f"\nProcessing {symbol}...")
                
                # Get current price
                price = get_token_price(mint)
                
                # Create snapshot
                snapshot = {
                    'token': symbol,
                    'mint': mint,
                    'timestamp': timestamp,
                    'price': price,
                    'isActive': True
                }
                
                snapshots.append(snapshot)
                print(f"Price: ${price:.4f}")
                
            except Exception as e:
                print(f"Error processing {fields.get('symbol')}: {e}")
                continue
        
        # Save snapshots to Airtable
        snapshots_table = Airtable(base_id, 'TOKEN_SNAPSHOTS', api_key)
        
        for snapshot in snapshots:
            try:
                snapshots_table.insert(snapshot)
                print(f"✅ Saved snapshot for {snapshot['token']}")
            except Exception as e:
                print(f"Failed to save snapshot for {snapshot['token']}: {e}")
        
        # Create portfolio snapshot
        portfolio_snapshots_table = Airtable(base_id, 'PORTFOLIO_SNAPSHOTS', api_key)
        
        portfolio_snapshot = {
            'timestamp': timestamp,
            'totalValue': total_value,
            'holdings': json.dumps(snapshots)
        }
        
        portfolio_snapshots_table.insert(portfolio_snapshot)
        print(f"\n✅ Portfolio snapshot recorded at {timestamp}")
        print(f"Total Value: ${total_value:,.2f}")
        print(f"Tokens: {len(snapshots)}")
        
        return {
            'totalValue': total_value,
            'snapshots': snapshots
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
