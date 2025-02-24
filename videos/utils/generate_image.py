import os
import sys
from pathlib import Path
import aiohttp
import asyncio
import json
import logging
from typing import Optional
from dotenv import load_dotenv

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)

class ImageGenerator:
    def __init__(self):
        load_dotenv()
        self.api_key = os.getenv('IDEOGRAM_API_KEY')
        if not self.api_key:
            raise ValueError("IDEOGRAM_API_KEY not found in environment variables")
        
        self.base_url = "https://api.ideogram.ai/generate"
        self.headers = {
            "Api-Key": self.api_key,
            "Content-Type": "application/json"
        }

    async def generate_and_save_image(self, prompt: str, image_number: int) -> Optional[str]:
        """Generate image from prompt and save it"""
        try:
            # Prepare request payload
            payload = {
                "image_request": {
                    "prompt": prompt,
                    "aspect_ratio": "ASPECT_10_16",  # TikTok aspect ratio
                    "model": "V_2",
                    "magic_prompt_option": "AUTO"
                }
            }

            # Create images directory if it doesn't exist
            output_dir = Path('videos/images/video1')
            output_dir.mkdir(parents=True, exist_ok=True)
            
            output_path = output_dir / f"{image_number}.png"

            # Make API request
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    self.base_url,
                    headers=self.headers,
                    json=payload
                ) as response:
                    
                    if response.status != 200:
                        error_text = await response.text()
                        logger.error(f"API request failed: {response.status} - {error_text}")
                        return None

                    # Parse response
                    result = await response.json()
                    
                    if not result.get('data') or not result['data'][0].get('url'):
                        logger.error("No image URL in response")
                        return None

                    image_url = result['data'][0]['url']
                    
                    # Download the image
                    async with session.get(image_url) as img_response:
                        if img_response.status != 200:
                            logger.error(f"Failed to download image: {img_response.status}")
                            return None
                            
                        # Save the image
                        image_data = await img_response.read()
                        with open(output_path, 'wb') as f:
                            f.write(image_data)
                            
                        logger.info(f"Image saved to {output_path}")
                        return str(output_path)

        except Exception as e:
            logger.error(f"Error generating/saving image: {e}")
            return None

async def generate_image(prompt: str, image_number: int) -> Optional[str]:
    """Wrapper function to generate and save a single image"""
    try:
        generator = ImageGenerator()
        return await generator.generate_and_save_image(prompt, image_number)
    except Exception as e:
        logger.error(f"Error in generate_image: {e}")
        return None

async def main():
    # Test prompt
    test_prompt = "A futuristic trading office with a cool gorilla in sunglasses analyzing crypto charts"
    result = await generate_image(test_prompt, 1)
    if result:
        print(f"Success! Image saved to: {result}")
    else:
        print("Failed to generate image")

if __name__ == "__main__":
    asyncio.run(main())
