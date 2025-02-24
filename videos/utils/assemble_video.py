import json
import sys
import logging
from pathlib import Path
from typing import List, Dict, Tuple, Optional
from moviepy.video.io.VideoFileClip import VideoFileClip
from moviepy.video.VideoClip import TextClip, ColorClip
from moviepy.video.compositing.CompositeVideoClip import CompositeVideoClip
from moviepy.video.fx.FadeIn import FadeIn
from moviepy.video.fx.FadeOut import FadeOut
from moviepy.video.fx.Crop import Crop

# Monkey patch MoviePy's FFMPEG_VideoReader to prevent cleanup errors
from moviepy.video.io.ffmpeg_reader import FFMPEG_VideoReader
original_del = FFMPEG_VideoReader.__del__

def safe_del(self):
    """Safe cleanup that won't raise errors"""
    try:
        if hasattr(self, 'proc'):
            try:
                self.proc.terminate()
                self.proc.wait(timeout=1)
            except:
                pass
            self.proc = None
    except:
        pass

FFMPEG_VideoReader.__del__ = safe_del

# Add project root to Python path
project_root = str(Path(__file__).parent.parent.parent.absolute())
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from videos.utils.generate_text import create_text_clips

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)

# Add project root to Python path
project_root = str(Path(__file__).parent.parent.parent.absolute())
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from videos.utils.generate_text import create_text_clips

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
    video_clip = None
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
    finally:
        # Cleanup video clip
        if video_clip is not None:
            try:
                if hasattr(video_clip, 'reader') and video_clip.reader is not None:
                    try:
                        video_clip.reader.close()
                    except Exception:
                        pass
                    video_clip.reader = None
                video_clip.close()
            except Exception:
                pass

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
    Write the final video to disk with aggressive cleanup
    """
    try:
        # Determine output path
        if output_dir is None:
            output_dir = Path('dist/videos')
        
        output_path = output_dir / f'tiktok_video_{video_num}.mp4'
        logger.info(f"💾 Writing video {video_num} to: {output_path}")
        
        # Ensure output directory exists
        output_dir.mkdir(parents=True, exist_ok=True)
        
        try:
            # Write video file
            final_clip.write_videofile(
                str(output_path),
                fps=fps,
                codec='libx264',
                audio=False,
                logger=None
            )
            
            # Force cleanup of all clips
            for clip in final_clip.clips:
                try:
                    # Clean up reader
                    if hasattr(clip, 'reader') and clip.reader is not None:
                        try:
                            clip.reader.close()
                        except Exception:
                            pass
                        clip.reader = None
                    
                    # Clean up audio
                    if hasattr(clip, 'audio') and clip.audio is not None:
                        try:
                            clip.audio.close()
                        except Exception:
                            pass
                        clip.audio = None
                    
                    # Close clip
                    clip.close()
                except Exception:
                    pass
            
            # Clean up final clip
            if hasattr(final_clip, 'reader') and final_clip.reader is not None:
                try:
                    final_clip.reader.close()
                except Exception:
                    pass
                final_clip.reader = None
            
            if hasattr(final_clip, 'audio') and final_clip.audio is not None:
                try:
                    final_clip.audio.close()
                except Exception:
                    pass
                final_clip.audio = None
            
            final_clip.close()
            
            logger.info(f"✨ Video {video_num} creation completed successfully!")
            return True
            
        except Exception as e:
            logger.error(f"Error writing video file: {e}")
            return False
            
    except Exception as e:
        logger.error(f"Error in write_final_video: {e}")
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
        final_clip = None
        
        try:
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
            
        finally:
            # Cleanup if final_clip exists
            if final_clip:
                try:
                    final_clip.close()
                except Exception as e:
                    logger.debug(f"Non-critical error during final cleanup: {e}")
        
    except Exception as e:
        logger.error(f"Error in video assembly process for video {video_num}: {e}")
        logger.exception("Detailed error trace:")
        return False

def main():
    """
    Main entry point when script is run directly
    """
    try:
        logger.info(f"Command line arguments: {sys.argv}")
        
        if len(sys.argv) != 2:
            logger.error("Usage: python assemble_video.py <video_number>")
            sys.exit(1)
        
        try:
            # Convert video number to integer
            logger.info(f"Attempting to convert '{sys.argv[1]}' to integer")
            video_num = int(sys.argv[1])
            logger.info(f"Successfully converted to integer: {video_num}")
        except ValueError:
            logger.error(f"Video number must be an integer. Input was: '{sys.argv[1]}'")
            sys.exit(1)
            
        # Load video paths and screens from the video's directory
        video_dir = Path('videos/videos') / f'video{video_num}'
        if not video_dir.exists():
            logger.error(f"Video directory not found: {video_dir}")
            sys.exit(1)
            
        # Load script.json
        script_path = video_dir / 'script.json'
        if not script_path.exists():
            logger.error(f"Script file not found: {script_path}")
            sys.exit(1)
            
        # Open file with explicit UTF-8 encoding
        with open(script_path, 'r', encoding='utf-8') as f:
            try:
                script = json.load(f)
                screens = script.get('screens', [])
                logger.info(f"Successfully loaded script with {len(screens)} screens")
            except json.JSONDecodeError as je:
                logger.error(f"Failed to parse script.json: {je}")
                sys.exit(1)
            
        if not screens:
            logger.error("No screens found in script")
            sys.exit(1)
            
        # Get video paths
        videos_dir = video_dir / 'videos'
        video_paths = []
        for i in range(1, len(screens) + 1):
            video_path = videos_dir / f'{i}.mp4'
            if video_path.exists():
                video_paths.append((i, str(video_path)))
            else:
                logger.error(f"Video file not found: {video_path}")
                sys.exit(1)
                
        # Assemble the video
        success = assemble_video(
            video_paths=video_paths,
            screens=screens,
            video_num=video_num
        )
        
        if success:
            logger.info(f"✅ Successfully assembled video {video_num}")
        else:
            logger.error(f"❌ Failed to assemble video {video_num}")
            sys.exit(1)
            
    except Exception as e:
        logger.error(f"Error: {e}")
        logger.exception("Detailed error trace:")
        sys.exit(1)

if __name__ == "__main__":
    logger.info("Starting video assembly script")
    logger.info(f"Arguments received: {sys.argv}")
    main()
