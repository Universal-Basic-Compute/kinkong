import logging
from pathlib import Path
from typing import List, Dict, Tuple, Optional
from moviepy.video.VideoClip import VideoFileClip, TextClip, ColorClip
from moviepy.video.compositing.CompositeVideoClip import CompositeVideoClip
from moviepy.video.fx.FadeIn import FadeIn
from moviepy.video.fx.FadeOut import FadeOut
from moviepy.video.fx.Crop import Crop

from .generate_text import create_text_clips

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)

def process_video_clip(
    video_path: str | Path,
    screen: Dict,
    target_width: int,
    target_height: int,
    duration: float,
    video_num: int
) -> Optional[CompositeVideoClip]:
    """
    Process a single video clip: resize, crop, add text and effects
    """
    try:
        logger.info(f"Processing clip for video {video_num}")
        # Load video clip
        video_clip = VideoFileClip(str(video_path))
        
        # Resize maintaining aspect ratio
        aspect_ratio = video_clip.size[0] / video_clip.size[1]
        new_width = int(target_height * aspect_ratio)
        video_clip = video_clip.resized(height=target_height)
        
        # Center crop if needed using the Crop effect
        if new_width > target_width:
            x_offset = (new_width - target_width) // 2
            video_clip = video_clip.with_effects([
                Crop(x1=x_offset, width=target_width)
            ])
        
        # Set duration
        video_clip = video_clip.with_duration(duration)
        
        # Create text clips
        text_clips, _ = create_text_clips(
            screen['text'], 
            target_width, 
            target_height//3
        )
        
        # Combine video and text
        screen_clip = CompositeVideoClip(
            [video_clip] + text_clips,
            size=(target_width, target_height)
        )
        
        # Add fade effects
        screen_clip = screen_clip.with_effects([
            FadeIn(duration=0.5),
            FadeOut(duration=0.5)
        ])
        
        return screen_clip
        
    except Exception as e:
        logger.error(f"Error processing video clip: {e}")
        logger.exception("Detailed error trace:")
        return None

def assemble_final_video(
    video_paths: List[Tuple[int, str]],
    screens: List[Dict],
    video_num: int,
    width: int = 1080,
    height: int = 1920,
    duration_per_screen: float = 2.5
) -> Optional[CompositeVideoClip]:
    """
    Assemble all video clips into final video
    """
    try:
        logger.info(f"🎞️ Creating video clips for video {video_num}...")
        clips = []
        
        for i, (screen_num, video_path) in enumerate(video_paths):
            logger.info(f"Processing screen {screen_num}/{len(screens)} for video {video_num}")
            
            screen_clip = process_video_clip(
                video_path=video_path,
                screen=screens[i],
                target_width=width,
                target_height=height,
                duration=duration_per_screen,
                video_num=video_num
            )
            
            if screen_clip:
                clips.append(screen_clip)
                logger.info(f"✅ Completed screen {screen_num} for video {video_num}")
            else:
                logger.error(f"❌ Failed to process screen {screen_num} for video {video_num}")
        
        # Check if we have any clips before proceeding
        if not clips:
            logger.error("❌ No valid clips generated, cannot create video")
            return None
            
        # Combine all clips
        logger.info("🎬 Combining all clips into final video...")
        final_clip = CompositeVideoClip(clips)
        
        return final_clip
        
    except Exception as e:
        logger.error(f"Error assembling final video: {e}")
        logger.exception("Detailed error trace:")
        return None

def write_final_video(
    final_clip: CompositeVideoClip,
    video_num: int,
    output_dir: Optional[Path] = None,
    fps: int = 30
) -> bool:
    """
    Write the final video to disk
    """
    try:
        # Determine output path
        if output_dir is None:
            output_dir = Path('dist/videos')
        
        output_path = output_dir / f'tiktok_video_{video_num}.mp4'
        logger.info(f"💾 Writing video {video_num} to: {output_path}")
        
        # Ensure output directory exists
        output_dir.mkdir(parents=True, exist_ok=True)
        
        final_clip.write_videofile(
            str(output_path),
            fps=fps,
            codec='libx264',
            audio=False,
            logger=None  # Suppress MoviePy's internal logging
        )
        
        logger.info(f"✨ Video {video_num} creation completed successfully!")
        return True
        
    except Exception as e:
        logger.error(f"Error writing final video: {e}")
        logger.exception("Detailed error trace:")
        return False
def assemble_video(
    video_paths: List[Tuple[int, str]],
    screens: List[Dict],
    video_num: int,
    width: int = 1080,
    height: int = 1920,
    duration_per_screen: float = 2.5,
    output_dir: Optional[Path] = None
) -> bool:
    """
    Main entry point for video assembly process
    """
    try:
        logger.info(f"🎥 Starting video assembly for video {video_num}")
        
        # Assemble the video
        final_clip = assemble_final_video(
            video_paths=video_paths,
            screens=screens,
            video_num=video_num,
            width=width,
            height=height,
            duration_per_screen=duration_per_screen
        )
        
        if not final_clip:
            logger.error(f"❌ Failed to assemble video {video_num}")
            return False
            
        # Write the video
        success = write_final_video(
            final_clip=final_clip,
            video_num=video_num,
            output_dir=output_dir,
            fps=30
        )
        
        return success
        
    except Exception as e:
        logger.error(f"Error in video assembly process for video {video_num}: {e}")
        logger.exception("Detailed error trace:")
        return False
