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
            
        # Add ImgBB API key for image hosting
        self.imgbb_api_key = os.getenv('IMGBB_API_KEY')
        if not self.imgbb_api_key:
            raise ValueError("IMGBB_API_KEY not found in environment variables")
        
        self.client = RunwayML(api_key=self.api_key)

    def upload_image_to_imgbb(self, image_path: Path) -> Optional[str]:
        """Upload image to ImgBB and return HTTPS URL"""
        try:
            url = "https://api.imgbb.com/1/upload"
            
            # Read image file
            with open(image_path, "rb") as file:
                files = {"image": file}
                
                # Make upload request
                payload = {"key": self.imgbb_api_key}
                response = requests.post(url, files=files, data=payload)
                
                if response.status_code != 200:
                    logger.error(f"ImgBB upload failed: {response.status_code} - {response.text}")
                    return None
                    
                data = response.json()
                if not data.get("data", {}).get("url"):
                    logger.error("No URL in ImgBB response")
                    return None
                    
                return data["data"]["url"]
                
        except Exception as e:
            logger.error(f"Error uploading to ImgBB: {e}")
            return None

    def generate_video(
        self,
        image_path: str | Path,
        prompt: str,
        output_path: Optional[str | Path] = None,
        model: str = "gen3a_turbo"
    ) -> Optional[str]:
        """
        Generate a video from an image using RunwayML.
        
        Args:
            image_path: Path to the input image
            prompt: Text description for video generation
            output_path: Optional path for output video (default: same directory as input)
            model: RunwayML model to use (default: gen3a_turbo)
            
        Returns:
            Path to generated video if successful, None otherwise
        """
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
            
            # First upload image to get HTTPS URL
            logger.info(f"📤 Uploading image to ImgBB...")
            image_url = self.upload_image_to_imgbb(image_path)
            
            if not image_url:
                raise ValueError("Failed to get HTTPS URL for image")
            
            logger.info(f"✅ Image uploaded: {image_url}")
            
            # Generate video using HTTPS URL
            try:
                response = self.client.image_to_video.create(
                    model=model,
                    prompt_image=image_url,  # Use HTTPS URL instead of local path
                    prompt_text=prompt
                )
                
                # Download the video
                video_url = response.video_url
                if not video_url:
                    raise ValueError("No video URL in response")
                    
                # Save the video
                with open(output_path, 'wb') as f:
                    f.write(response.video_data)
                    
                logger.info(f"✅ Video saved to: {output_path}")
                return str(output_path)
                
            except Exception as e:
                logger.error(f"❌ Error during video generation: {e}")
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
