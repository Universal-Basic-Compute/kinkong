import sys
from pathlib import Path
import os
import anthropic
from datetime import datetime
import json
from dotenv import load_dotenv

# Add project root to Python path
project_root = str(Path(__file__).parent.parent.absolute())
if project_root not in sys.path:
    sys.path.append(project_root)

def get_x_sentiment_prompt():
    """Read the X sentiment prompt from file"""
    prompt_path = project_root / 'prompts' / 'x_sentiment.py'
    try:
        with open(prompt_path, 'r') as f:
            content = f.read()
            # Extract the prompt string from the file content
            prompt = content.split('X_SENTIMENT_PROMPT = """')[1].split('"""')[0]
            return prompt
    except Exception as e:
        print(f"Error reading prompt file: {e}")
        return None

def analyze_x_sentiment(content: str):
    """Analyze X.com content for crypto sentiment"""
    try:
        print("\n🔍 Starting X sentiment analysis...")
        
        # Get API key
        api_key = os.getenv('ANTHROPIC_API_KEY')
        print("API key present:", bool(api_key))
        
        if not api_key:
            raise ValueError("ANTHROPIC_API_KEY not found in environment variables")

        print("Getting prompt...")
        # Get the prompt
        system_prompt = get_x_sentiment_prompt()
        print("Prompt loaded:", bool(system_prompt))
        
        if not system_prompt:
            raise ValueError("Failed to load X sentiment prompt")

        # Debug the key
        print(f"API Key from .env: {api_key[:8]}...{api_key[-4:]}")
        
        # Create client with explicit API key
        client = anthropic.Client(
            api_key=api_key,
        )

        print("\n🤖 Sending content to Claude for analysis...")
        print("Content length:", len(content))
        print("\nContent sample:")
        print(content[:500] + "..." if len(content) > 500 else content)

        # Create the message
        message = client.messages.create(
            model="claude-3-5-sonnet-20241022",
            max_tokens=4096,
            system=system_prompt,
            messages=[{
                "role": "user",
                "content": f"Analyze this X.com content for crypto sentiment:\n\n{content}"
            }]
        )

        # Get the response text
        response_text = message.content[0].text
        
        # Clean the response text to ensure it's valid JSON
        # Remove any potential markdown code block indicators
        response_text = response_text.replace('```json', '').replace('```', '').strip()
        
        try:
            # Parse the response
            analysis = json.loads(response_text)
            
            print("\n📊 Sentiment Analysis Results:")
            print(json.dumps(analysis, indent=2))
            
            # Convert confidence values to integers if they're strings
            if analysis.get('ecosystem'):
                try:
                    analysis['ecosystem']['confidence'] = int(analysis['ecosystem']['confidence'])
                except (ValueError, TypeError):
                    analysis['ecosystem']['confidence'] = 0
                    
            if analysis.get('tokens'):
                for token in analysis['tokens']:
                    try:
                        token['confidence'] = int(token['confidence'])
                    except (ValueError, TypeError):
                        token['confidence'] = 0
                    try:
                        token['mentions'] = int(token['mentions'])
                    except (ValueError, TypeError):
                        token['mentions'] = 0
            
            # Log key metrics
            if analysis.get('ecosystem'):
                print("\n📈 Key Metrics:")
                print(f"Overall Sentiment: {analysis['ecosystem']['sentiment']}")
                print(f"Confidence: {analysis['ecosystem']['confidence']}%")
                
            if analysis.get('tokens'):
                print(f"\n💰 Analyzed Tokens: {len(analysis['tokens'])}")
                for token in analysis['tokens']:
                    print(f"- {token['symbol']}: {token['sentiment']} ({token['confidence']}% confidence)")

            return analysis

        except json.JSONDecodeError as e:
            print(f"\n❌ Error parsing JSON response: {e}")
            print("Raw response:", response_text)
            return None

    except Exception as e:
        print(f"\n❌ Error analyzing X sentiment: {e}")
        if 'message' in locals():
            print("Raw API response:", message.content[0].text)
        if 'client' in locals():
            print("Client initialized with key starting:", api_key[:8])
        return None

if __name__ == "__main__":
    # Test with sample content
    sample_content = """
    Sample X.com content here...
    """
    result = analyze_x_sentiment(sample_content)
    if result:
        print(json.dumps(result, indent=2))
