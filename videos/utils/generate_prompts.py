import sys
from pathlib import Path

# Add project root to Python path
project_root = str(Path(__file__).parent.parent.parent.absolute())
if project_root not in sys.path:
    sys.path.insert(0, project_root)

# Now we can import backend modules
from backend.src.airtable.tables import getTable
import anthropic
import os
from datetime import datetime
from airtable import Airtable
import logging
from typing import Dict, Optional
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)

class PromptGenerator:
    def __init__(self):
        self.base_id = os.getenv('KINKONG_AIRTABLE_BASE_ID')
        self.api_key = os.getenv('KINKONG_AIRTABLE_API_KEY')
        self.signals_table = Airtable(self.base_id, 'SIGNALS', self.api_key)

    def get_latest_signal(self) -> Optional[Dict]:
        """Get the latest high-confidence BUY signal"""
        try:
            # Query for BUY signals with high confidence
            records = self.signals_table.get_all(
                formula="AND(" +
                    "{type}='BUY', " +           # Changed from 'signal' to 'type'
                    "{confidence}='HIGH', " +     # High confidence signals
                    "IS_AFTER({createdAt}, DATEADD(NOW(), -1, 'days'))" +  # Last 24 hours
                ")",
                sort=[('createdAt', 'desc')]  # Get most recent first
            )
            
            if not records:
                logger.warning("No recent high-confidence BUY signals found")
                return None
                
            # Get the most recent signal
            signal = records[0]['fields']
            logger.info(f"Found signal for {signal.get('token')} with {signal.get('confidence')} confidence")
            return signal
            
        except Exception as e:
            logger.error(f"Error fetching signals: {e}")
            return None

    async def generate_video_script(self, signal: Dict) -> Optional[str]:
        """Generate a video script using Claude 3.5 Sonnet"""
        try:
            # Get API key from environment
            api_key = os.getenv('ANTHROPIC_API_KEY')
            if not api_key:
                raise ValueError("ANTHROPIC_API_KEY not found")
            logger.info(f"API Key from .env: {api_key[:8]}...{api_key[-4:]}")
            
            # Create client with explicit API key
            client = anthropic.Client(api_key=api_key)
            
            message = client.messages.create(
                model="claude-3-5-sonnet-20241022",
                max_tokens=4096,
                messages=[{
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": f"""Create a short, engaging TikTok video script about this trading signal:

                            Token: {signal.get('token')}
                            Signal Type: {signal.get('type', 'BUY')}
                            Strategy: {signal.get('strategy')}
                            Timeframe: {signal.get('timeframe')}
                            Confidence: {signal.get('confidence')}
                            Support/Resistance: {signal.get('supportResistance', 'N/A')}
                            Analysis: {signal.get('analysis', 'N/A')}

                            Requirements:
                            1. Write a catchy intro (2-3 lines)
                            2. Follow with key analysis points (2-3 lines)
                            3. Keep it simple and direct
                            4. Use emojis sparingly but effectively
                            5. Total length should be 4-6 lines
                            6. Split the response into 2 parts with a blank line between them

                            Format your response as plain text with just the script."""
                        }
                    ]
                }]
            )
            
            if not message:
                logger.warning("No response from Claude")
                return None

            return message.content[0].text
            
        except Exception as e:
            logger.error(f"Error generating script: {e}")
            return None

async def main():
    try:
        # Verify environment variables
        required_vars = [
            'KINKONG_AIRTABLE_BASE_ID',
            'KINKONG_AIRTABLE_API_KEY',
            'ANTHROPIC_API_KEY'
        ]
        
        missing = [var for var in required_vars if not os.getenv(var)]
        if missing:
            raise ValueError(f"Missing environment variables: {', '.join(missing)}")

        # Generate script
        generator = PromptGenerator()
        signal = generator.get_latest_signal()
        
        if signal:
            script = await generator.generate_video_script(signal)
            if script:
                print("\nGenerated Video Script:")
                print("=====================")
                print(script)
                return script
            else:
                logger.error("Failed to generate script")
        else:
            logger.error("No suitable signal found")

    except Exception as e:
        logger.error(f"Fatal error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
