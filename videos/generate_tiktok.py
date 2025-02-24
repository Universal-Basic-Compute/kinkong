import os
from pathlib import Path
import json
import asyncio
import logging
from moviepy.video.fx.FadeIn import FadeIn
from moviepy.video.fx.FadeOut import FadeOut
from moviepy.video.VideoClip import TextClip, ColorClip, ImageClip
from moviepy.video.compositing.CompositeVideoClip import CompositeVideoClip
from moviepy.video.fx.SlideIn import SlideIn

from videos.utils.generate_text import create_text_clips
from videos.utils.generate_prompts import PromptGenerator
from videos.utils.generate_image import generate_image

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)

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
        
        logger.info(f"Creating video {video_num} in {video_dir}")

        # Generate script
        generator = PromptGenerator()
        signal = generator.get_latest_signal()
        
        if not signal:
            logger.error("No trading signal found")
            return
            
        script_json = await generator.generate_video_script(signal)
        if not script_json:
            logger.error("Failed to generate video script")
            return

        # Parse JSON response
        try:
            script = json.loads(script_json)
            screens = script.get('screens', [])
            
            if not screens:
                logger.error("No screens found in script")
                return

            # Generate images for each screen
            for i, screen in enumerate(screens, 1):
                background_prompt = screen.get('background')
                if not background_prompt:
                    logger.warning(f"No background prompt for screen {i}")
                    continue
                    
                logger.info(f"Generating image {i}/{len(screens)}")
                image_path = await generate_image(background_prompt, i)
                
                if not image_path:
                    logger.error(f"Failed to generate image {i}")
                    continue
                    
                logger.info(f"Generated image {i}: {image_path}")

            # Video settings (TikTok format)
            width = 1080
            height = 1920
            duration_per_screen = 2.5  # seconds per screen

            # Create clips for each screen
            clips = []
            for i, screen in enumerate(screens, 1):
                # Load background image
                img_path = image_dir / f"{i}.png"
                if not img_path.exists():
                    logger.error(f"Missing image for screen {i}")
                    continue
                
                # Create background clip
                bg_clip = ImageClip(str(img_path))
                bg_clip = bg_clip.resize(height=height)  # Maintain aspect ratio
                bg_clip = bg_clip.with_duration(duration_per_screen)
                
                # Create text clip
                text_clips, _ = create_text_clips(
                    screen['text'], 
                    width, 
                    height//3  # Text takes up top third
                )
                
                # Combine background and text
                screen_clip = CompositeVideoClip([bg_clip] + text_clips)
                screen_clip = screen_clip.with_effects([
                    FadeIn(duration=0.5),
                    FadeOut(duration=0.5)
                ])
                
                clips.append(screen_clip)

            # Combine all clips
            final_clip = CompositeVideoClip(clips)

            # Write the result
            output_path = Path('dist/videos') / f'tiktok_video_{video_num}.mp4'
            output_path.parent.mkdir(parents=True, exist_ok=True)
            
            final_clip.write_videofile(
                str(output_path),
                fps=30,
                codec='libx264',
                audio=False
            )

            logger.info(f"Video created at: {output_path}")

        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse script JSON: {e}")
            return
            
    except Exception as e:
        logger.error(f"Error creating video: {e}")
        return

if __name__ == "__main__":
    asyncio.run(create_tiktok_video())
