import os
import json
from datetime import datetime, timezone
import requests
from airtable import Airtable
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

class WalletSnapshotTaker:
    def __init__(self):
        self.airtable = Airtable(
            os.getenv('KINKONG_AIRTABLE_BASE_ID'),
            'TOKENS',
            os.getenv('KINKONG_AIRTABLE_API_KEY')
        )
        self.snapshots_table = Airtable(
            os.getenv('KINKONG_AIRTABLE_BASE_ID'),
            'WALLET_SNAPSHOTS',
            os.getenv('KINKONG_AIRTABLE_API_KEY')
        )
        self.birdeye_api_key = os.getenv('BIRDEYE_API_KEY')
        self.wallet = os.getenv('KINKONG_WALLET')

    def get_token_balances(self) -> dict:
        """Get all token balances from Birdeye API"""
        url = "https://public-api.birdeye.so/v1/wallet/token_list"
        params = {
            "wallet": self.wallet
        }
        headers = {
            "x-api-key": self.birdeye_api_key,
            "x-chain": "solana",
            "accept": "application/json"
        }

        try:
            response = requests.get(url, params=params, headers=headers)
            response.raise_for_status()
            data = response.json()
            
            # Debug logging
            print(f"Raw API response:", json.dumps(data, indent=2))
            
            if not data.get('success'):
                raise Exception(f"API returned success=false: {data.get('message', 'No error message')}")
                
            return data.get('data', {}).get('items', [])
            
        except requests.exceptions.RequestException as e:
            print(f"HTTP Request failed: {str(e)}")
            return []
        except Exception as e:
            print(f"Unexpected error: {str(e)}")
            return []

    def take_snapshot(self):
        """Take a snapshot of wallet holdings"""
        print("📸 Taking snapshot of KinKong wallet...")

        # Get all token balances at once
        token_balances = self.get_token_balances()
        
        # Process balances
        balances = []
        created_at = datetime.now(timezone.utc).isoformat()

        # Special case: Get COMPUTE price from Meteora dynamic pool
        compute_price = None
        compute_mint = "B1N1HcMm4RysYz4smsXwmk2UnS8NziqKCM6Ho8i62vXo"
        meteora_pool_id = "HN7ibjiyX399d1EfYXcWaSHZRSMfUmonYvXGFXG41Rr3"
        
        try:
            # Fetch price from Meteora dynamic pool
            url = "https://public-api.birdeye.so/v1/pool/price"
            params = {
                "pool_address": meteora_pool_id
            }
            headers = {
                "x-api-key": self.birdeye_api_key,
                "x-chain": "solana",
                "accept": "application/json"
            }
            
            response = requests.get(url, params=params, headers=headers)
            
            # Debug the response
            print(f"Meteora pool API response status: {response.status_code}")
            print(f"Meteora pool API response headers: {response.headers}")
            
            # Only try to parse JSON if we have content
            if response.content:
                pool_data = response.json()
                
                if pool_data.get('success'):
                    compute_price = float(pool_data.get('data', {}).get('price', 0))
                    print(f"✓ Got COMPUTE price from Meteora pool: ${compute_price:.6f}")
                else:
                    print(f"⚠️ Failed to get COMPUTE price from Meteora pool: {pool_data.get('message')}")
            else:
                print(f"⚠️ Empty response from Meteora pool API")
                
        except requests.exceptions.RequestException as e:
            print(f"❌ HTTP error fetching COMPUTE price from Meteora pool: {str(e)}")
        except json.JSONDecodeError as e:
            print(f"❌ JSON decode error from Meteora pool: {str(e)}")
            print(f"Response content: {response.content[:100]}...")  # Print first 100 chars of response
        except Exception as e:
            print(f"❌ Error fetching COMPUTE price from Meteora pool: {str(e)}")
            
        # If Meteora pool fails, try getting price from Jupiter API
        if compute_price is None:
            try:
                jupiter_url = "https://price.jup.ag/v4/price"
                jupiter_params = {
                    "ids": "B1N1HcMm4RysYz4smsXwmk2UnS8NziqKCM6Ho8i62vXo"
                }
                
                jupiter_response = requests.get(jupiter_url, params=jupiter_params)
                jupiter_response.raise_for_status()
                jupiter_data = jupiter_response.json()
                
                if jupiter_data.get('data') and jupiter_data['data'].get('B1N1HcMm4RysYz4smsXwmk2UnS8NziqKCM6Ho8i62vXo'):
                    compute_price = float(jupiter_data['data']['B1N1HcMm4RysYz4smsXwmk2UnS8NziqKCM6Ho8i62vXo'].get('price', 0))
                    print(f"✓ Got COMPUTE price from Jupiter API: ${compute_price:.6f}")
            except Exception as e:
                print(f"❌ Error fetching COMPUTE price from Jupiter API: {str(e)}")
                
        # If both Meteora and Jupiter fail, try getting price from DexScreener
        if compute_price is None:
            try:
                # DexScreener API for COMPUTE token
                dexscreener_url = "https://api.dexscreener.com/latest/dex/tokens/B1N1HcMm4RysYz4smsXwmk2UnS8NziqKCM6Ho8i62vXo"
                
                dexscreener_response = requests.get(dexscreener_url)
                dexscreener_response.raise_for_status()
                dexscreener_data = dexscreener_response.json()
                
                # DexScreener returns pairs that include this token
                if dexscreener_data.get('pairs') and len(dexscreener_data['pairs']) > 0:
                    # Get the first pair with USDC or USDT (stablecoin pair)
                    compute_pair = None
                    for pair in dexscreener_data['pairs']:
                        # Look for USDC or USDT pair
                        if 'USDC' in pair.get('quoteToken', {}).get('symbol', '') or 'USDT' in pair.get('quoteToken', {}).get('symbol', ''):
                            compute_pair = pair
                            break
                    
                    # If no USDC/USDT pair, just use the first pair
                    if not compute_pair and len(dexscreener_data['pairs']) > 0:
                        compute_pair = dexscreener_data['pairs'][0]
                    
                    if compute_pair and compute_pair.get('priceUsd'):
                        compute_price = float(compute_pair['priceUsd'])
                        print(f"✓ Got COMPUTE price from DexScreener: ${compute_price:.6f}")
            except Exception as e:
                print(f"❌ Error fetching COMPUTE price from DexScreener: {str(e)}")

        for balance_data in token_balances:
            try:
                # Override price for COMPUTE token if we got it from Meteora
                if balance_data['address'] == compute_mint and compute_price is not None:
                    balance_data['priceUsd'] = str(compute_price)
                    print(f"✓ Using Meteora pool price for COMPUTE: ${compute_price:.6f}")
                
                value = float(balance_data.get('valueUsd', 0))
                
                # If using Meteora price for COMPUTE, recalculate value
                if balance_data['address'] == compute_mint and compute_price is not None:
                    value = float(balance_data.get('uiAmount', 0)) * compute_price
                
                # Skip tokens with no value
                if value <= 0:
                    continue

                balance = {
                    'token': balance_data.get('symbol', 'Unknown'),
                    'mint': balance_data['address'],
                    'amount': float(balance_data.get('uiAmount', 0)),
                    'price': float(balance_data.get('priceUsd', 0)),
                    'value': value
                }
                balances.append(balance)
                print(f"✓ {balance['token']}: {balance['amount']:.2f} tokens (${balance['value']:.2f})")
            except Exception as e:
                print(f"❌ Error processing token {balance_data.get('symbol', 'Unknown')}: {str(e)}")

        # Calculate total value
        total_value = sum(b['value'] for b in balances)

        # Record snapshot
        self.snapshots_table.insert({
            'createdAt': created_at,
            'totalValue': total_value,
            'holdings': json.dumps([{
                'token': b['token'],
                'amount': b['amount'],
                'price': b['price'],
                'value': b['value']
            } for b in balances])
        })

        print(f"\n✅ Wallet snapshot recorded")
        print(f"Total Value: ${total_value:.2f}")
        print("\nHoldings:")
        for balance in balances:
            print(f"• {balance['token']}: {balance['amount']:.2f} (${balance['value']:.2f})")

def main():
    try:
        # Verify environment variables
        required_vars = [
            'KINKONG_AIRTABLE_BASE_ID',
            'KINKONG_AIRTABLE_API_KEY',
            'BIRDEYE_API_KEY',
            'KINKONG_WALLET'
        ]
        
        missing = [var for var in required_vars if not os.getenv(var)]
        if missing:
            raise Exception(f"Missing environment variables: {', '.join(missing)}")

        # Take snapshot
        snapshot_taker = WalletSnapshotTaker()
        snapshot_taker.take_snapshot()

    except Exception as e:
        print(f"\n❌ Script failed: {str(e)}")
        exit(1)

if __name__ == "__main__":
    main()
