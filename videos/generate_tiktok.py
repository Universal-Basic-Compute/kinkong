import os
from pathlib import Path
import json
import asyncio
import logging
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Dict, List, Optional, Tuple

# Add project root to Python path
project_root = str(Path(__file__).parent.parent.absolute())
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from moviepy.video.fx.FadeIn import FadeIn
from moviepy.video.fx.FadeOut import FadeOut
from moviepy.video.VideoClip import TextClip, ColorClip, ImageClip
from moviepy.video.compositing.CompositeVideoClip import CompositeVideoClip
from moviepy.video.fx.SlideIn import SlideIn

from videos.utils.generate_text import create_text_clips
from videos.utils.generate_prompts import PromptGenerator
from videos.utils.generate_image import generate_image

# Configure logging with more detailed format
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - [%(filename)s:%(lineno)d] - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)

def generate_images_parallel(screens: List[Dict]) -> List[Tuple[int, Optional[str]]]:
    """
    Generate all images in parallel using a thread pool
    Returns list of tuples (screen_number, image_path)
    """
    logger.info(f"🎨 Starting parallel image generation for {len(screens)} screens...")
    
    # Create base directory for images
    base_dir = Path('videos/videos/video1/images').resolve()
    base_dir.mkdir(parents=True, exist_ok=True)
    logger.info(f"📁 Using image directory: {base_dir}")
    
    def generate_single(args: Tuple[int, Dict]) -> Tuple[int, Optional[str]]:
        """Worker function for each image generation task"""
        i, screen = args
        background_prompt = screen.get('background')
        if not background_prompt:
            logger.warning(f"⚠️ No background prompt for screen {i}")
            return i, None
            
        logger.info(f"🖼️ Generating image {i}/{len(screens)}")
        logger.debug(f"Prompt: {background_prompt[:100]}...")
        
        # Generate image with absolute path
        image_path = generate_image(background_prompt, i, base_dir)
        
        if not image_path:
            logger.error(f"❌ Failed to generate image {i}")
            return i, None
            
        logger.info(f"✅ Generated image {i}: {image_path}")
        return i, str(Path(image_path).resolve())  # Return absolute path

    # Create tasks for each screen
    tasks = list(enumerate(screens, 1))
    results = []

    # Use ThreadPoolExecutor to run tasks in parallel
    with ThreadPoolExecutor(max_workers=5) as executor:
        # Submit all tasks
        future_to_screen = {
            executor.submit(generate_single, task): task[0] 
            for task in tasks
        }
        
        # Collect results as they complete
        for future in as_completed(future_to_screen):
            screen_num = future_to_screen[future]
            try:
                result = future.result()
                results.append(result)
            except Exception as e:
                logger.error(f"❌ Error generating image {screen_num}: {e}")
                results.append((screen_num, None))

    # Sort results by screen number
    results.sort(key=lambda x: x[0])
    return results

async def create_tiktok_video():
    try:
        # Find next available video number
        base_dir = Path('videos/videos')
        video_num = 1
        
        while (base_dir / f'video{video_num}/images').exists():
            video_num += 1
            
        # Create directory structure
        video_dir = base_dir / f'video{video_num}'
        image_dir = video_dir / 'images'
        image_dir.mkdir(parents=True, exist_ok=True)
        
        logger.info(f"📁 Created directory structure for video {video_num}")
        logger.debug(f"Video directory: {video_dir}")
        logger.debug(f"Images directory: {image_dir}")

        # Generate script
        logger.info("📝 Generating video script from latest signal...")
        generator = PromptGenerator()
        signal = generator.get_latest_signal()
        
        if not signal:
            logger.error("❌ No trading signal found")
            return
            
        logger.info(f"📊 Found signal for token: {signal.get('token')}")
        
        script_json = await generator.generate_video_script(signal)
        if not script_json:
            logger.error("❌ Failed to generate video script")
            return

        # Parse JSON response
        try:
            script = json.loads(script_json)
            screens = script.get('screens', [])
            
            if not screens:
                logger.error("❌ No screens found in script")
                return

            logger.info(f"✅ Successfully parsed script with {len(screens)} screens")

            # Generate all images in parallel
            image_results = generate_images_parallel(screens)

            # Check if we have all images
            failed_screens = [num for num, path in image_results if path is None]
            if failed_screens:
                logger.error(f"❌ Failed to generate images for screens: {failed_screens}")
                return

            logger.info("✅ All images generated successfully")

            # Video settings (TikTok format)
            width = 1080
            height = 1920
            duration_per_screen = 2.5  # seconds per screen
            logger.info(f"📺 Video settings: {width}x{height}, {duration_per_screen}s per screen")

            # Create clips for each screen
            logger.info("🎞️ Creating video clips...")
            clips = []
            for i, (screen_num, image_path) in enumerate(image_results):
                logger.info(f"Processing screen {screen_num}/{len(screens)}")
                
                # Skip if no image path
                if not image_path:
                    logger.error(f"❌ No image path for screen {screen_num}")
                    continue
                    
                # Convert to Path object
                img_path = Path(image_path)
                
                # Check if file exists
                if not img_path.exists():
                    logger.error(f"❌ Missing image file: {img_path}")
                    continue
                
                logger.debug(f"Loading image: {img_path}")
                
                try:
                    # Create background clip
                    bg_clip = ImageClip(str(img_path))
                    bg_clip = bg_clip.resize(height=height)  # Maintain aspect ratio
                    bg_clip = bg_clip.with_duration(duration_per_screen)
                    
                    # Create text clip
                    screen = screens[i]  # Get corresponding screen data
                    logger.debug(f"Creating text clip: {screen['text']}")
                    text_clips, _ = create_text_clips(
                        screen['text'], 
                        width, 
                        height//3  # Text takes up top third
                    )
                    
                    # Combine background and text
                    logger.debug("Combining clips and adding effects")
                    screen_clip = CompositeVideoClip([bg_clip] + text_clips)
                    screen_clip = screen_clip.with_effects([
                        FadeIn(duration=0.5),
                        FadeOut(duration=0.5)
                    ])
                    
                    clips.append(screen_clip)
                    logger.info(f"✅ Completed screen {screen_num}")
                except Exception as e:
                    logger.error(f"❌ Error processing screen {screen_num}: {e}")
                    continue

            # Check if we have any clips before proceeding
            if not clips:
                logger.error("❌ No valid clips generated, cannot create video")
                return

            # Combine all clips
            logger.info("🎬 Combining all clips into final video...")
            final_clip = CompositeVideoClip(clips)

            # Write the result
            output_path = Path('dist/videos') / f'tiktok_video_{video_num}.mp4'
            output_path.parent.mkdir(parents=True, exist_ok=True)
            
            logger.info(f"💾 Writing final video to: {output_path}")
            final_clip.write_videofile(
                str(output_path),
                fps=30,
                codec='libx264',
                audio=False,
                logger=None  # Suppress MoviePy's internal logging
            )

            logger.info(f"✨ Video creation completed successfully!")
            logger.info(f"📍 Final video saved at: {output_path}")

        except json.JSONDecodeError as e:
            logger.error(f"❌ Failed to parse script JSON: {e}")
            return
            
    except Exception as e:
        logger.error(f"❌ Fatal error during video creation: {e}")
        logger.exception("Detailed error trace:")
        return

if __name__ == "__main__":
    logger.info("🚀 Starting TikTok video generator")
    try:
        # Set event loop policy for Windows
        if sys.platform == 'win32':
            asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
            
        asyncio.run(create_tiktok_video())
        logger.info("✅ Process completed")
    except KeyboardInterrupt:
        logger.info("⚠️ Process interrupted by user")
    except Exception as e:
        logger.error(f"❌ Unexpected error: {e}")
        logger.exception("Detailed error trace:")
