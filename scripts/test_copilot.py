import requests
import json
from datetime import datetime

def test_copilot():
    try:
        url = 'http://localhost:3000/api/copilot'
        data = {
            'message': 'I am testing the copilot API',
            'body': 'Test page content from Python script',
            'wallet': 'TestWallet123'  # Optional test wallet
        }

        print('\n🚀 Testing Copilot API')
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
