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
                system="""You are a crypto trading expert creating engaging TikTok scripts for KinKong - represented by a cool gorilla trader with sunglasses. Break down the content into individual screens of 1-10 words each.

                Return your response as JSON with this structure:
                {
                    "screens": [
                        {
                            "text": "Yo! KinKong here 🦍",
                            "background": "Luxurious modern trading office, cool gorilla in designer suit and sunglasses sitting at a high-tech trading desk, multiple holographic screens, ambient blue lighting, crypto symbols floating, cinematic composition --ar 9:16"
                        },
                        {
                            "text": "Just spotted a MASSIVE $SOL setup 👀",
                            "background": "Close-up of gorilla trader's reflective sunglasses showing multiple Solana charts, neon blue highlights, dramatic lighting, ultra detailed, cinematic depth of field --ar 9:16"
                        },
                        {
                            "text": "Technical analysis is SCREAMING buy 📈",
                            "background": "Sleek dark trading room, giant holographic chart with glowing green support lines, gorilla pointing at key levels, dynamic composition, volumetric lighting --ar 9:16"
                        },
                        {
                            "text": "Target: $69 🎯",
                            "background": "Futuristic command center, giant price target hologram in center, gorilla trader analyzing multiple data feeds, cyber-punk aesthetic, dramatic side lighting --ar 9:16"
                        }
                    ]
                }

                Each background prompt should:
                1. Be detailed and specific
                2. Include --ar 9:16 for TikTok aspect ratio
                3. Match the mood and content of the text
                4. Create visual continuity between screens
                5. Maintain the KinKong character (cool gorilla trader) theme
                6. Use cinematic lighting and composition""",
                messages=[
                    {
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
                                1. Break the script into 4-6 screens
                                2. Each screen should have 1-10 words
                                3. Include relevant emojis
                                4. Create matching Midjourney prompts for backgrounds
                                5. Keep the energy high and engaging
                                6. Return as JSON with screens array

                                Format the response as JSON only, no additional text."""
                            }
                        ]
                    }]
            )
            
            if not message:
                logger.warning("No response from Claude")
                return None

            response_text = message.content[0].text
            
            # Find JSON boundaries
            start_idx = response_text.find('{')
            end_idx = response_text.rfind('}')
            
            if start_idx == -1 or end_idx == -1:
                logger.error("Could not find valid JSON markers in response")
                return None
                
            # Extract just the JSON portion
            json_text = response_text[start_idx:end_idx + 1]
            
            return json_text
            
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
