import os
from pathlib import Path
import json
import asyncio
import logging
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Dict, List, Optional, Tuple

def generate_videos_parallel(image_results: List[Tuple[int, str]], screens: List[Dict], videos_dir: Path) -> List[Tuple[int, str]]:
    """
    Generate all videos in parallel using a thread pool
    Returns list of tuples (screen_number, video_path)
    """
    logger.info(f"🎥 Starting parallel video generation for {len(image_results)} images...")
    
    def generate_single(args: Tuple[int, str, Dict]) -> Tuple[int, Optional[str]]:
        """Worker function for each video generation task"""
        screen_num, image_path, screen = args
        if not image_path:
            logger.error(f"❌ No image path for screen {screen_num}")
            return screen_num, None
            
        # Get the corresponding screen data for the prompt
        prompt = f"Smooth camera movement exploring the scene. {screen.get('background', '')}"
        
        logger.info(f"🎬 Generating video {screen_num}/{len(image_results)}")
        
        # Generate video from image
        video_path = generate_video(
            image_path=image_path,
            prompt=prompt,
            output_path=videos_dir / f"{screen_num}.mp4"
        )
        
        if video_path:
            logger.info(f"✅ Generated video {screen_num}: {video_path}")
            return screen_num, str(video_path)
        else:
            logger.error(f"❌ Failed to generate video for screen {screen_num}")
            return screen_num, None

    # Create tasks list combining screen number, image path, and screen data
    tasks = [
        (screen_num, image_path, screens[i])
        for i, (screen_num, image_path) in enumerate(image_results)
    ]
    
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
                logger.info(f"✅ Completed video generation for screen {screen_num}")
            except Exception as e:
                logger.error(f"❌ Error generating video {screen_num}: {e}")
                logger.exception("Detailed error trace:")
                results.append((screen_num, None))

    # Sort results by screen number
    results.sort(key=lambda x: x[0])
    return results

# Add project root to Python path
project_root = str(Path(__file__).parent.parent.absolute())
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from videos.utils.assemble_video import assemble_final_video, write_final_video
from videos.utils.generate_prompts import PromptGenerator
from videos.utils.generate_image import generate_image
from videos.utils.generate_video import generate_video

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

            # Save script to JSON file
            script_path = video_dir / 'script.json'
            try:
                with open(script_path, 'w', encoding='utf-8') as f:
                    json.dump(script, f, indent=2, ensure_ascii=False)
                logger.info(f"📝 Saved script to: {script_path}")
            except Exception as e:
                logger.error(f"❌ Failed to save script: {e}")

            logger.info(f"✅ Successfully parsed script with {len(screens)} screens")

            # Generate all images in parallel
            image_results = generate_images_parallel(screens)

            # Check if we have all images
            failed_screens = [num for num, path in image_results if path is None]
            if failed_screens:
                logger.error(f"❌ Failed to generate images for screens: {failed_screens}")
                return

            logger.info("✅ All images generated successfully")

            # Generate animated videos from images in parallel
            logger.info("🎥 Generating animated videos from images...")
            videos_dir = video_dir / 'videos'
            videos_dir.mkdir(exist_ok=True)

            video_results = generate_videos_parallel(image_results, screens, videos_dir)
            
            # Filter out failed generations
            video_paths = [(num, path) for num, path in video_results if path is not None]
            
            if not video_paths:
                logger.error("❌ No videos were successfully generated")
                return

            # Video settings
            width = 1080
            height = 1920
            duration_per_screen = 2.5
            logger.info(f"📺 Video settings: {width}x{height}, {duration_per_screen}s per screen")

            # Assemble final video
            final_clip = assemble_final_video(
                video_paths=video_paths,
                screens=screens,
                width=width,
                height=height,
                duration_per_screen=duration_per_screen
            )

            if not final_clip:
                logger.error("❌ Failed to assemble final video")
                return

            # Write final video
            output_path = Path('dist/videos') / f'tiktok_video_{video_num}.mp4'
            success = write_final_video(final_clip, output_path)

            if not success:
                logger.error("❌ Failed to write final video")
                return

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
