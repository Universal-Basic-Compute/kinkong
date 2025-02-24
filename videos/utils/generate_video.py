import os
import sys
from pathlib import Path
import logging
from typing import Optional
import requests
from runwayml import RunwayML
from dotenv import load_dotenv

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)

class VideoGenerator:
    def __init__(self):
        load_dotenv()
        self.api_key = os.getenv('RUNWAYML_API_KEY')
        if not self.api_key:
            raise ValueError("RUNWAYML_API_KEY not found in environment variables")
            
        self.imgur_client_id = os.getenv('IMGUR_CLIENT_ID')
        if not self.imgur_client_id:
            raise ValueError("IMGUR_CLIENT_ID not found in environment variables")
        
        self.client = RunwayML(api_key=self.api_key)

    def upload_to_imgur(self, image_path: Path) -> Optional[str]:
        """Upload image to Imgur and return HTTPS URL"""
        try:
            url = "https://api.imgur.com/3/image"
            
            # Read image file
            with open(image_path, "rb") as file:
                # Convert image to base64
                import base64
                image_data = base64.b64encode(file.read())
                
            # Make upload request with client ID
            headers = {
                "Authorization": f"Client-ID {self.imgur_client_id}",
                "Content-Type": "application/x-www-form-urlencoded"
            }
            
            # Send as form data
            data = {
                'image': image_data,
                'type': 'base64'
            }
            
            logger.info(f"Sending request to Imgur...")
            response = requests.post(url, headers=headers, data=data)
            
            logger.info(f"Imgur response status: {response.status_code}")
            logger.debug(f"Imgur response headers: {response.headers}")
            logger.debug(f"Imgur response: {response.text[:500]}...")  # First 500 chars
            
            if response.status_code != 200:
                logger.error(f"Imgur upload failed: {response.status_code} - {response.text}")
                return None
                
            data = response.json()
            if not data.get("data", {}).get("link"):
                logger.error("No URL in Imgur response")
                logger.debug(f"Full response data: {data}")
                return None
                
            image_url = data["data"]["link"]
            logger.info(f"Successfully uploaded to Imgur: {image_url}")
            return image_url
                
        except Exception as e:
            logger.error(f"Error uploading to Imgur: {e}")
            logger.exception("Detailed error trace:")  # This will print the full stack trace
            return None

    def generate_video(
        self,
        image_path: str | Path,
        prompt: str,
        output_path: Optional[str | Path] = None,
        model: str = "gen3a_turbo"
    ) -> Optional[str]:
        try:
            # Convert paths to Path objects
            image_path = Path(image_path)
            
            # Validate input image
            if not image_path.exists():
                raise FileNotFoundError(f"Input image not found: {image_path}")
                
            # Determine output path if not provided
            if output_path is None:
                output_path = image_path.parent / f"{image_path.stem}_video.mp4"
            else:
                output_path = Path(output_path)
                
            # Ensure output directory exists
            output_path.parent.mkdir(parents=True, exist_ok=True)
            
            logger.info(f"🎬 Generating video from image: {image_path}")
            logger.info(f"Using prompt: {prompt}")
            
            # Upload to Imgur first
            logger.info(f"📤 Uploading image to Imgur...")
            image_url = self.upload_to_imgur(image_path)
            
            if not image_url:
                raise ValueError("Failed to get HTTPS URL for image")
            
            logger.info(f"✅ Image uploaded: {image_url}")
            
            # Generate video
            response = self.client.image_to_video.create(
                model=model,
                prompt_image=image_url,
                prompt_text=prompt
            )
            
            # Log the response structure to understand what we got
            logger.debug(f"API Response: {response}")
            
            # Try different ways to get the video URL
            video_url = None
            if hasattr(response, 'url'):
                video_url = response.url
            elif hasattr(response, 'output') and hasattr(response.output, 'url'):
                video_url = response.output.url
            elif isinstance(response, dict):
                video_url = response.get('url') or response.get('output', {}).get('url')
                
            if not video_url:
                logger.error("❌ No video URL in response")
                return None
                
            # Download the video
            logger.info(f"✅ Downloading video from: {video_url}")
            video_response = requests.get(video_url)
            if video_response.status_code == 200:
                with open(output_path, 'wb') as f:
                    f.write(video_response.content)
                logger.info(f"✅ Video saved to: {output_path}")
                return str(output_path)
            else:
                logger.error(f"❌ Failed to download video: {video_response.status_code}")
                return None
                
        except Exception as e:
            logger.error(f"❌ Error during video generation: {e}")
            logger.exception("Detailed error trace:")  # Add stack trace for debugging
            return None
                
        except Exception as e:
            logger.error(f"❌ Fatal error: {e}")
            return None

def generate_video(
    image_path: str | Path,
    prompt: str,
    output_path: Optional[str | Path] = None,
    model: str = "gen3a_turbo"
) -> Optional[str]:
    """
    Wrapper function to generate video from a single image
    """
    try:
        generator = VideoGenerator()
        return generator.generate_video(
            image_path=image_path,
            prompt=prompt,
            output_path=output_path,
            model=model
        )
    except Exception as e:
        logger.error(f"Error in generate_video: {e}")
        return None

def main():
    # Test video generation
    test_image = "path/to/test/image.png"
    test_prompt = "A smooth camera movement showing the details of the trading office"
    
    if not os.path.exists(test_image):
        logger.error(f"Test image not found: {test_image}")
        return
        
    result = generate_video(test_image, test_prompt)
    if result:
        logger.info(f"Success! Video saved to: {result}")
    else:
        logger.error("Failed to generate video")

if __name__ == "__main__":
    main()
