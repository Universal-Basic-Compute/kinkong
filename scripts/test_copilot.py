import requests
import json
from datetime import datetime

def test_copilot():
    try:
        url = 'http://localhost:3000/api/copilot'
        
        # Sample X.com content
        x_content = """
        Recent X.com Posts:

        @elonmusk: You can now download Grok as its own dedicated app

        @phantom: Monad Testnet is here! Starting today, you can access the @monad_xyz testnet with Phantom to:
        🟣 Claim testnet MON
        🟣 Swap Monad testnet tokens
        🟣 Discover Monad apps

        @Mylovanov: Putin says Trump must go harder on Europe and Ukraine; must move faster; he promised 24 hours; won't meet with Trump until Trump is ready for serious results; the cause of the war is NATO
        Putin: I'm surprised by Trump's restraint toward allies who behaved rudely

        @realtombibiyan: Can't believe we let these gays ruin crypto.

        @stygianbroker: Fk it, dropping the list of the KOLS you should block if you are new in CT.
        These KOLs will use you as exit liquidity and if you don't understand what's happening you will get rekt.
        Don't come to me saying otherwise—I watched it happen over the last six months.
        """

        data = {
            'message': 'Analyze these X posts for market sentiment and trends',
            'body': x_content,
            'wallet': 'TestWallet123',  # Optional test wallet
            'url': 'x.com'  # Indicate content is from X
        }

        print('\n🚀 Testing Copilot API with X.com content')
        print(f'Time: {datetime.now().isoformat()}')
        print('\n📤 Request:')
        print(f'URL: {url}')
        print('Data:', json.dumps(data, indent=2))

        response = requests.post(
            url,
            json=data,
            headers={'Content-Type': 'application/json'},
            stream=True  # Handle streaming response
        )

        print(f'\n📥 Response Status: {response.status_code}')
        
        if response.ok:
            print('\n💬 Response Content:')
            # Read the streaming response
            for chunk in response.iter_content(chunk_size=None, decode_unicode=True):
                if chunk:
                    print(chunk, end='', flush=True)
            print('\n')  # Add newline after response
        else:
            print('❌ Error Response:', response.text)

    except Exception as e:
        print('\n❌ Error:', str(e))
        print('Type:', type(e).__name__)

if __name__ == '__main__':
    test_copilot()
