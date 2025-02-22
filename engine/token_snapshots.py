import os
import json
from datetime import datetime, timezone
import requests
from airtable import Airtable
from dotenv import load_dotenv
from typing import List, Dict, Optional

# Load environment variables
load_dotenv()

class TokenSnapshotTaker:
    def __init__(self):
        self.tokens_table = Airtable(
            os.getenv('KINKONG_AIRTABLE_BASE_ID'),
            'TOKENS',
            os.getenv('KINKONG_AIRTABLE_API_KEY')
        )
        self.snapshots_table = Airtable(
            os.getenv('KINKONG_AIRTABLE_BASE_ID'),
            'TOKEN_SNAPSHOTS',
            os.getenv('KINKONG_AIRTABLE_API_KEY')
        )
        self.birdeye_api_key = os.getenv('BIRDEYE_API_KEY')

    def get_active_tokens(self) -> List[Dict]:
        """Get all active tokens from Airtable"""
        try:
            records = self.tokens_table.get_all(
                formula="{isActive}=1"
            )
            return records
        except Exception as e:
            print(f"Error fetching active tokens: {str(e)}")
            return []

    def get_token_price(self, token_mint: str) -> dict:
        """Get current token metrics from DexScreener"""
        try:
            url = f"https://api.dexscreener.com/latest/dex/tokens/{token_mint}"
            headers = {
                'User-Agent': 'Mozilla/5.0',
                'Accept': 'application/json'
            }
            
            print(f"\nFetching DexScreener data for {token_mint}")
            response = requests.get(url, headers=headers)
            
            if response.ok:
                data = response.json()
                
                if not data.get('pairs'):
                    print(f"No pairs found for token {token_mint}")
                    return {
                        'price': 0,
                        'volume24h': 0,
                        'liquidity': 0,
                        'priceChange24h': 0
                    }
                    
                # Get all Solana pairs
                sol_pairs = [p for p in data['pairs'] if p.get('chainId') == 'solana']
                if not sol_pairs:
                    print(f"No Solana pairs found for token {token_mint}")
                    return {
                        'price': 0,
                        'volume24h': 0,
                        'liquidity': 0,
                        'priceChange24h': 0
                    }
                
                # Get the most liquid pair
                main_pair = max(sol_pairs, key=lambda x: float(x.get('liquidity', {}).get('usd', 0) or 0))
                
                # Calculate totals across all pairs
                total_volume = sum(float(p.get('volume', {}).get('h24', 0) or 0) for p in sol_pairs)
                total_liquidity = sum(float(p.get('liquidity', {}).get('usd', 0) or 0) for p in sol_pairs)
                
                # Get price and change from main pair
                price = float(main_pair.get('priceUsd', 0) or 0)
                price_change = float(main_pair.get('priceChange', {}).get('h24', 0) or 0)
                
                print(f"Found {len(sol_pairs)} Solana pairs")
                print(f"Price: ${price:.4f}")
                print(f"24h Volume: ${total_volume:,.2f}")
                print(f"Liquidity: ${total_liquidity:,.2f}")
                print(f"24h Change: {price_change:.2f}%")
                
                return {
                    'price': price,
                    'volume24h': total_volume,
                    'liquidity': total_liquidity,
                    'priceChange24h': price_change
                }
                
            else:
                print(f"DexScreener API error: {response.status_code}")
                print(f"Response: {response.text}")
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

    def take_snapshot(self):
        """Take snapshots of all active tokens"""
        print("\n📸 Taking token snapshots...")
        
        # Get active tokens
        active_tokens = self.get_active_tokens()
        print(f"\nFound {len(active_tokens)} active tokens")
        
        # Current timestamp
        created_at = datetime.now(timezone.utc).isoformat()
        
        # Create snapshots for each token
        for token in active_tokens:
            try:
                token_name = token['fields'].get('token')
                mint = token['fields'].get('mint')
                
                if not token_name or not mint:
                    continue
                    
                print(f"\nProcessing {token_name}...")
                
                # Get current metrics
                metrics = self.get_token_price(mint)
                
                # Create snapshot
                snapshot = {
                    'token': token_name,
                    'price': metrics['price'],
                    'volume24h': metrics['volume24h'],
                    'liquidity': metrics['liquidity'],
                    'priceChange24h': metrics['priceChange24h'],
                    'createdAt': created_at,
                    'isActive': True
                }
                
                # Save snapshot
                self.snapshots_table.insert(snapshot)
                print(f"✅ Snapshot saved for {token_name}")
                
            except Exception as e:
                print(f"❌ Error processing {token_name}: {e}")
                continue
        
        print("\n✅ Token snapshots completed")

def main():
    try:
        # Verify environment variables
        required_vars = [
            'KINKONG_AIRTABLE_BASE_ID',
            'KINKONG_AIRTABLE_API_KEY'
        ]
        
        missing = [var for var in required_vars if not os.getenv(var)]
        if missing:
            raise Exception(f"Missing environment variables: {', '.join(missing)}")

        # Take snapshots
        snapshot_taker = TokenSnapshotTaker()
        snapshot_taker.take_snapshot()

    except Exception as e:
        print(f"\n❌ Script failed: {str(e)}")
        exit(1)

if __name__ == "__main__":
    main()
