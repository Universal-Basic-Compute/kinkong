import os
from pathlib import Path
import moviepy
from moviepy.video.fx.FadeIn import FadeIn
from moviepy.video.fx.FadeOut import FadeOut

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
    background = background.with_duration(duration)

    # Find a usable system font
    font_paths = [
        r"C:\Windows\Fonts\segoe.ttf",
        r"C:\Windows\Fonts\segoeui.ttf", 
        r"C:\Windows\Fonts\arial.ttf",
        r"C:\Windows\Fonts\calibri.ttf",
    ]
    
    font_path = None
    for path in font_paths:
        if os.path.exists(path):
            font_path = path
            print(f"Using font: {path}")
            break
    
    if not font_path:
        raise ValueError("No usable system font found!")

    # Create text clips with animations
    text = "Hey traders,\nKinKong here.\n\nI've been analyzing\nthe UBC market data..."
    text_parts = text.split('\n\n')
    
    # First part appears with fade
    clip1 = TextClip(
        text=text_parts[0],
        font=font_path,  # Use the found system font
        font_size=70,
        color='white',
        size=(width-100, height//2),
        method='caption',
        text_align='center',
        horizontal_align='center',
        vertical_align='center'
    ).with_duration(5)
    clip1 = clip1.with_position(('center', height//3))
    clip1 = clip1.with_effects([
        FadeIn(duration=1),
        FadeOut(duration=1, start_time=4)
    ])
    
    # Second part slides in from right
    clip2 = TextClip(
        text=text_parts[1],
        font=font_path,  # Use the same font
        font_size=70,
        color='white',
        size=(width-100, height//2),
        method='caption',
        text_align='center',
        horizontal_align='center',
        vertical_align='center'
    ).with_duration(5)
    clip2 = clip2.with_position(('center', 2*height//3))
    clip2 = clip2.with_start(5)  # Start after first clip
    clip2 = clip2.with_effects([
        SlideIn(duration=1, side='right')
    ])

    # Combine clips
    final_clip = CompositeVideoClip([background] + [clip1, clip2])

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
