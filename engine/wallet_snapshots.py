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

    def get_token_balance(self, token_mint: str) -> dict:
        """Get token balance from Birdeye API"""
        url = f"https://public-api.birdeye.so/v1/wallet/token_balance"
        params = {
            "wallet": self.wallet,
            "token_address": token_mint
        }
        headers = {
            "x-api-key": self.birdeye_api_key,
            "x-chain": "solana",
            "accept": "application/json"
        }

        response = requests.get(url, params=params, headers=headers)
        if not response.ok:
            raise Exception(f"Birdeye API error: {response.status_code}")
        
        return response.json()

    def take_snapshot(self):
        """Take a snapshot of wallet holdings"""
        print("📸 Taking snapshot of KinKong wallet...")

        # Get active tokens
        tokens = self.airtable.get_all(
            formula="{isActive} = 1",
            fields=['token', 'mint']
        )
        print(f"Found {len(tokens)} active tokens to check")

        # Get balance for each token
        balances = []
        created_at = datetime.now(timezone.utc).isoformat()

        for token in tokens:
            try:
                mint = token['fields']['mint']
                response = self.get_token_balance(mint)

                if response['success'] and response['data']:
                    balances.append({
                        'token': token['fields']['token'],
                        'mint': mint,
                        'amount': response['data']['tokenBalance'],
                        'price': response['data']['price'],
                        'value': response['data']['tokenValue']
                    })
                    print(f"✓ {token['fields']['token']}: {response['data']['tokenBalance']:.2f} tokens (${response['data']['tokenValue']:.2f})")
            except Exception as e:
                print(f"❌ Error getting balance for {token['fields']['token']}: {str(e)}")

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
