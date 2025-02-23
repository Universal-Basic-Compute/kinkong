import os
from pathlib import Path
import moviepy

# Print moviepy installation info
print(f"Moviepy installed at: {moviepy.__file__}")
print("\nListing moviepy directory contents:")
moviepy_dir = os.path.dirname(moviepy.__file__)
for root, dirs, files in os.walk(moviepy_dir):
    level = root.replace(moviepy_dir, '').count(os.sep)
    indent = ' ' * 4 * level
    print(f"{indent}{os.path.basename(root)}/")
    subindent = ' ' * 4 * (level + 1)
    for f in files:
        print(f"{subindent}{f}")

# Debug imports
try:
    import numpy as np
    print("✓ numpy imported")
    from moviepy.video.io.VideoFileClip import VideoFileClip
    from moviepy.video.VideoClip import TextClip, ColorClip
    print("✓ VideoClip imported")
    from moviepy.video.compositing.CompositeVideoClip import CompositeVideoClip
    print("✓ CompositeVideoClip imported")
    from moviepy.video.fx.SlideIn import SlideIn
    print("✓ fx imported")
except ImportError as e:
    print(f"Import error: {e}")
    print(f"Error occurred in module: {e.__class__.__module__}")
    raise

def create_tiktok_video():
    # Create dist/videos directory if it doesn't exist
    output_dir = Path('dist/videos')
    output_dir.mkdir(parents=True, exist_ok=True)

    # Video settings (TikTok format)
    width = 1080
    height = 1920
    duration = 10

    # Create a simpler solid color background first
    background = ColorClip(size=(width, height), color=[0, 0, 0.3])
    background = background.set_duration(duration)

    # Create text clips with animations
    text = "Hey traders,\nKinKong here.\n\nI've been analyzing\nthe UBC market data..."
    text_parts = text.split('\n\n')
    text_clips = []
    
    # First part appears with fade
    clip1 = TextClip(
        text_parts[0],
        font='Arial',
        color='white',
        size=(width-100, height//2),
        method='caption',
        align='center'
    ).set_duration(5)
    clip1 = clip1.set_position(('center', height//3))
    clip1 = clip1.fadein(1).fadeout(1)
    
    # Second part slides in from right
    clip2 = TextClip(
        text_parts[1],
        font='Arial',
        color='white',
        size=(width-100, height//2),
        method='caption',
        align='center'
    ).set_duration(5)
    clip2 = clip2.set_position(('center', 2*height//3))
    clip2 = clip2.set_start(5)  # Start after first clip
    clip2 = clip2.fx(SlideIn, duration=1, side='right')
    
    text_clips = [clip1, clip2]

    # Combine clips
    final_clip = CompositeVideoClip([background] + text_clips)

    # Write the result
    output_path = output_dir / 'market_analysis_intro.mp4'
    final_clip.write_videofile(
        str(output_path),
        fps=30,
        codec='libx264',
        audio=False
    )

    print(f"Video created at: {output_path}")

if __name__ == "__main__":
    create_tiktok_video()
