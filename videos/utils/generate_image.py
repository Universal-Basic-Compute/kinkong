import os
import sys
from pathlib import Path
import requests
import json
import logging
import difflib
import re
from PIL import Image
import pytesseract
from PIL import Image
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
        # Set Tesseract path for Windows
        pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'
        self.max_retries = 3  # Maximum number of regeneration attempts

    def verify_text_in_image(self, image_path: str, expected_text: str) -> bool:
        """
        Verify if the generated image contains the expected text
        Returns True if text matches within acceptable threshold
        """
        try:
            # Clean up expected text (remove emojis, extra spaces, make uppercase)
            expected_clean = re.sub(r'[^\w\s]', '', expected_text).upper().strip()
            
            # Open the image
            image = Image.open(image_path)
            
            # Perform OCR
            detected_text = pytesseract.image_to_string(image)
            
            # Clean up detected text
            detected_clean = re.sub(r'[^\w\s]', '', detected_text).strip()
            
            # Calculate similarity ratio
            similarity = difflib.SequenceMatcher(None, expected_clean, detected_clean).ratio()
            
            logger.info(f"Text verification - Expected: '{expected_clean}'")
            logger.info(f"Text verification - Detected: '{detected_clean}'")
            logger.info(f"Text verification - Similarity: {similarity:.2f}")
            
            # Accept if similarity is above threshold
            return similarity > 0.7  # Adjust threshold as needed
            
        except Exception as e:
            logger.error(f"Error in text verification: {e}")
            return False

    def generate_and_save_image(self, prompt: str, image_number: int, output_dir: Path, expected_text: str) -> Optional[str]:
        """Generate image from prompt and save it, with text verification"""
        attempts = 0
        
        while attempts < self.max_retries:
            attempts += 1
            try:
                logger.info(f"Generating image attempt {attempts}/{self.max_retries}")
                logger.info(f"Using prompt: {prompt}")

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
                    continue

                # Parse response
                result = response.json()
                
                if not result.get('data') or not result['data'][0].get('url'):
                    logger.error("No image URL in response")
                    continue

                image_url = result['data'][0]['url']
                
                # Download the image
                img_response = requests.get(image_url)
                if img_response.status_code != 200:
                    logger.error(f"Failed to download image: {img_response.status_code}")
                    continue
                    
                # Save the image
                with open(output_path, 'wb') as f:
                    f.write(img_response.content)
                
                logger.info(f"Image saved to {output_path}")

                # Verify text in image
                if expected_text and not self.verify_text_in_image(str(output_path), expected_text):
                    logger.warning(f"Text verification failed on attempt {attempts}")
                    if attempts < self.max_retries:
                        logger.info("Retrying image generation...")
                        continue
                else:
                    logger.info("Text verification passed!")
                    return str(output_path)

            except Exception as e:
                logger.error(f"Error in attempt {attempts}: {e}")
                if attempts >= self.max_retries:
                    return None
                
        logger.error(f"Failed to generate acceptable image after {self.max_retries} attempts")
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
            
        return generator.generate_and_save_image(modified_prompt, image_number, base_dir, text)
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
