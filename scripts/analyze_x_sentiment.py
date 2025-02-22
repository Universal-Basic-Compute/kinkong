import sys
from pathlib import Path
import os
import requests
from datetime import datetime, timezone
import json
from dotenv import load_dotenv
from airtable import Airtable

# Get absolute path to project root and .env file
project_root = Path(__file__).parent.parent.absolute()
env_path = project_root / '.env'

# Force reload environment variables from project root .env
load_dotenv(dotenv_path=env_path, override=True)

# Get API key after forcing env reload
api_key = os.getenv('ANTHROPIC_API_KEY')
if api_key:
    print(f"API key ends with: ...{api_key[-4:]}")  # Show last 4 chars for verification
else:
    print("Warning: ANTHROPIC_API_KEY not found in environment")

# Add project root to Python path if not already there
if str(project_root) not in sys.path:
    sys.path.append(str(project_root))

def get_x_sentiment_prompt():
    """Get the X sentiment prompt"""
    return """You are an expert crypto sentiment analyst specializing in Solana ecosystem analysis.

Analyze the provided X.com content and extract:
1. Mentioned tokens and their sentiment
2. Domain-specific trends (DeFi, Gaming, AI, etc.)
3. Overall ecosystem sentiment

Format your response as JSON:
{
    "tokens": [
        {
            "token": "string",
            "sentiment": "BULLISH | BEARISH | NEUTRAL",
            "confidence": 0-100,
            "mentions": number,
            "key_topics": ["string"],
            "latest_news": ["string"]
        }
    ],
    "domains": [
        {
            "name": "string",
            "sentiment": "BULLISH | BEARISH | NEUTRAL",
            "confidence": 0-100,
            "trending_topics": ["string"],
            "key_developments": ["string"]
        }
    ],
    "ecosystem": {
        "sentiment": "BULLISH | BEARISH | NEUTRAL",
        "confidence": 0-100,
        "key_observations": ["string"],
        "emerging_trends": ["string"]
    }
}"""

def store_sentiment_analysis(analysis):
    """Store sentiment analysis results in Airtable"""
    try:
        base_id = os.getenv('KINKONG_AIRTABLE_BASE_ID')
        api_key = os.getenv('KINKONG_AIRTABLE_API_KEY')
        
        if not base_id or not api_key:
            raise ValueError("Missing Airtable configuration")
            
        sentiment_table = Airtable(base_id, 'SENTIMENT_ANALYSIS', api_key)
        
        # Store token sentiments
        if analysis.get('tokens'):
            for token in analysis['tokens']:
                record = {
                    'fields': {
                        'type': 'TOKEN',
                        'symbol': token['symbol'],
                        'sentiment': token['sentiment'],
                        'confidence': token['confidence'],
                        'mentions': token.get('mentions', 0),
                        'key_topics': ', '.join(token.get('key_topics', [])),
                        'latest_news': ', '.join(token.get('latest_news', [])),
                        'createdAt': datetime.now(timezone.utc).isoformat()
                    }
                }
                sentiment_table.insert(record['fields'])
                print(f"Created TOKEN sentiment record for {token['symbol']}")

        # Store domain sentiments
        if analysis.get('domains'):
            for domain in analysis['domains']:
                record = {
                    'fields': {
                        'type': 'DOMAIN',
                        'name': domain['name'],
                        'sentiment': domain['sentiment'],
                        'confidence': domain['confidence'],
                        'trending_topics': ', '.join(domain.get('trending_topics', [])),
                        'key_developments': ', '.join(domain.get('key_developments', [])),
                        'createdAt': datetime.now(timezone.utc).isoformat()
                    }
                }
                sentiment_table.insert(record['fields'])
                print(f"Created DOMAIN sentiment record for {domain['name']}")

        # Store ecosystem sentiment
        if analysis.get('ecosystem'):
            record = {
                'fields': {
                    'type': 'ECOSYSTEM',
                    'sentiment': analysis['ecosystem']['sentiment'],
                    'confidence': analysis['ecosystem']['confidence'],
                    'key_observations': ', '.join(analysis['ecosystem'].get('key_observations', [])),
                    'emerging_trends': ', '.join(analysis['ecosystem'].get('emerging_trends', [])),
                    'createdAt': datetime.now(timezone.utc).isoformat()
                }
            }
            sentiment_table.insert(record['fields'])
            print("Created ECOSYSTEM sentiment record")

        return True

    except Exception as e:
        print(f"Error storing sentiment analysis: {e}")
        return False

def analyze_x_sentiment(content: str):
    """Analyze X.com content for crypto sentiment"""
    try:
        print("\n🔍 Starting X sentiment analysis...")
        
        # Get API key
        api_key = os.getenv('ANTHROPIC_API_KEY')
        print("API key present:", bool(api_key))
        if api_key:
            print(f"API key ends with: ...{api_key[-4:]}")
        
        if not api_key:
            raise ValueError("ANTHROPIC_API_KEY not found in environment variables")

        print("Getting prompt...")
        # Get the prompt
        system_prompt = get_x_sentiment_prompt()
        print("Prompt loaded:", bool(system_prompt))

        print("\n🤖 Sending content to Claude for analysis...")
        print("Content length:", len(content))
        print("\nContent sample:")
        print(content[:500] + "..." if len(content) > 500 else content)

        # Make direct API call like in copilot route
        response = requests.post(
            'https://api.anthropic.com/v1/messages',
            headers={
                'x-api-key': api_key,
                'anthropic-version': '2023-06-01',
                'content-type': 'application/json'
            },
            json={
                'model': 'claude-3-5-sonnet-20241022',
                'max_tokens': 4096,
                'system': system_prompt,
                'messages': [{
                    'role': 'user',
                    'content': f"Analyze this X.com content for crypto sentiment:\n\n{content}"
                }]
            }
        )

        if not response.ok:
            print(f"API error: {response.status_code} - {response.text}")
            return None

        data = response.json()
        response_text = data['content'][0]['text']
        
        # Clean the response text to ensure it's valid JSON
        # Remove any potential markdown code block indicators
        response_text = response_text.replace('```json', '').replace('```', '').strip()
        
        try:
            # Parse the response
            analysis = json.loads(response_text)
            
            print("\n📊 Sentiment Analysis Results:")
            print(json.dumps(analysis, indent=2))
            
            # Convert confidence values to integers
            if analysis.get('ecosystem'):
                try:
                    analysis['ecosystem']['confidence'] = int(str(analysis['ecosystem']['confidence']).rstrip('%'))
                except (ValueError, TypeError):
                    analysis['ecosystem']['confidence'] = 0
                    
            if analysis.get('tokens'):
                for token in analysis['tokens']:
                    try:
                        token['confidence'] = int(str(token['confidence']).rstrip('%'))
                    except (ValueError, TypeError):
                        token['confidence'] = 0
                    try:
                        token['mentions'] = int(token.get('mentions', 0))
                    except (ValueError, TypeError):
                        token['mentions'] = 0
            
            if analysis.get('domains'):
                for domain in analysis['domains']:
                    try:
                        domain['confidence'] = int(str(domain['confidence']).rstrip('%'))
                    except (ValueError, TypeError):
                        domain['confidence'] = 0

            # Log key metrics
            if analysis.get('ecosystem'):
                print("\n📈 Key Metrics:")
                print(f"Overall Sentiment: {analysis['ecosystem']['sentiment']}")
                print(f"Confidence: {analysis['ecosystem']['confidence']}%")
                
            if analysis.get('tokens'):
                print(f"\n💰 Analyzed Tokens: {len(analysis['tokens'])}")
                for token in analysis['tokens']:
                    print(f"- {token['symbol']}: {token['sentiment']} ({token['confidence']}% confidence)")

            # Store results in Airtable
            store_success = store_sentiment_analysis(analysis)
            if store_success:
                print("\n✅ Stored sentiment analysis in Airtable")
            else:
                print("\n❌ Failed to store sentiment analysis")

            return analysis

        except json.JSONDecodeError as e:
            print(f"\n❌ Error parsing JSON response: {e}")
            print("Raw response:", response_text)
            return None

    except Exception as e:
        print(f"\n❌ Error analyzing X sentiment: {e}")
        if 'response' in locals():
            print("Raw API response:", response.text)
        return None

if __name__ == "__main__":
    # Test with sample content
    sample_content = """
    Sample X.com content here...
    """
    result = analyze_x_sentiment(sample_content)
    if result:
        print(json.dumps(result, indent=2))
