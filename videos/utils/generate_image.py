import os
import sys
from pathlib import Path
import requests
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

    def generate_and_save_image(self, prompt: str, image_number: int, output_dir: Path) -> Optional[str]:
        """Generate image from prompt and save it"""
        try:
            # Log the modified prompt
            logger.info(f"Generating image with prompt: {prompt}")

            # Prepare request payload
            payload = {
                "image_request": {
                    "prompt": prompt,
                    "aspect_ratio": "ASPECT_10_16",  # TikTok aspect ratio
                    "model": "V_2",
                    "magic_prompt_option": "AUTO"
                }
            }

            # Ensure output directory exists
            output_dir.mkdir(parents=True, exist_ok=True)
            output_path = output_dir / f"{image_number}.png"
            
            logger.debug(f"Will save image to: {output_path}")

            # Make API request
            response = requests.post(
                self.base_url,
                headers=self.headers,
                json=payload
            )
            
            if response.status_code != 200:
                logger.error(f"API request failed: {response.status_code} - {response.text}")
                return None

            # Parse response
            result = response.json()
            
            if not result.get('data') or not result['data'][0].get('url'):
                logger.error("No image URL in response")
                return None

            image_url = result['data'][0]['url']
            
            # Download the image
            img_response = requests.get(image_url)
            if img_response.status_code != 200:
                logger.error(f"Failed to download image: {img_response.status_code}")
                return None
                
            # Save the image
            with open(output_path, 'wb') as f:
                f.write(img_response.content)
                
            logger.info(f"Image saved to {output_path}")
            return str(output_path)

        except Exception as e:
            logger.error(f"Error generating/saving image: {e}")
            return None

def generate_image(prompt: str, image_number: int, base_dir: Optional[Path] = None) -> Optional[str]:
    """Wrapper function to generate and save a single image"""
    try:
        generator = ImageGenerator()
        if base_dir is None:
            # Find next available video number
            videos_dir = Path('videos/videos')
            video_num = 1
            while (videos_dir / f'video{video_num}/images').exists():
                video_num += 1
                
            base_dir = videos_dir / f'video{video_num}/images'
            base_dir.mkdir(parents=True, exist_ok=True)

        # Get the text from the screens data
        text = prompt.get('text', '') if isinstance(prompt, dict) else ''
        background = prompt.get('background', prompt) if isinstance(prompt, dict) else prompt

        # Combine text and background in the correct format
        modified_prompt = f'"{text}" in BIG bold BebasNeue letters, {background}'
            
        return generator.generate_and_save_image(modified_prompt, image_number, base_dir)
    except Exception as e:
        logger.error(f"Error in generate_image: {e}")
        return None

def main():
    # Test prompt
    test_prompt = "A futuristic trading office with a cool gorilla in sunglasses analyzing crypto charts"
    result = generate_image(test_prompt, 1)
    if result:
        print(f"Success! Image saved to: {result}")
    else:
        print("Failed to generate image")

if __name__ == "__main__":
    main()
