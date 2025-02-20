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

from backend.src.airtable.tables import getTable
from backend.src.airtable.thoughts import createThought as create_thought

SYSTEM_PROMPT = """You are an expert crypto sentiment analyst specializing in Solana ecosystem analysis.

Analyze the provided X.com content and extract:
1. Mentioned tokens and their sentiment
2. Domain-specific trends (DeFi, Gaming, AI, etc.)
3. Overall ecosystem sentiment

Format your response as JSON:
{
    "tokens": [
        {
            "symbol": "string",
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

def analyze_x_sentiment(content: str):
    """Analyze X.com content for crypto sentiment"""
    try:
        # Load environment variables
        load_dotenv()
        
        # Get API key
        api_key = os.getenv('ANTHROPIC_API_KEY')
        if not api_key:
            raise ValueError("ANTHROPIC_API_KEY not found in environment variables")

        # Initialize Claude client
        client = anthropic.Client(api_key=api_key)

        # Create the message
        message = client.messages.create(
            model="claude-3-5-sonnet-20241022",
            max_tokens=4096,
            system=SYSTEM_PROMPT,
            messages=[{
                "role": "user",
                "content": f"Analyze this X.com content for crypto sentiment:\n\n{content}"
            }]
        )

        # Parse the response
        analysis = json.loads(message.content[0].text)
        
        # Save analysis as thought
        create_thought({
            'type': 'X_SENTIMENT',
            'content': json.dumps(analysis, indent=2),
            'context': {
                'source': 'x.com',
                'timestamp': datetime.now().isoformat()
            }
        })

        return analysis

    except Exception as e:
        print(f"Error analyzing X sentiment: {e}")
        return None

if __name__ == "__main__":
    # Test with sample content
    sample_content = """
    Sample X.com content here...
    """
    result = analyze_x_sentiment(sample_content)
    if result:
        print(json.dumps(result, indent=2))
