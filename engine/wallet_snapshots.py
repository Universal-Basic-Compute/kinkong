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

        for balance_data in token_balances:
            try:
                value = float(balance_data.get('valueUsd', 0))
                
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
