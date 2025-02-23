import os
from pathlib import Path

# Debug imports
try:
    import numpy as np
    print("✓ numpy imported")
    from moviepy.editor import TextClip
    print("✓ TextClip imported") 
    from moviepy.editor import ColorClip
    print("✓ ColorClip imported")
    from moviepy.editor import CompositeVideoClip
    print("✓ CompositeVideoClip imported")
    from moviepy.editor import vfx
    print("✓ vfx imported")
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

    # Create gradient background
    def make_gradient_background(t):
        """Create a moving gradient background"""
        gradient = np.zeros((height, width, 3))
        for y in range(height):
            color_value = (np.sin(y/100 + t) + 1) / 2
            gradient[y,:] = [0, 0, color_value * 0.3]  # Dark blue gradient
        return gradient

    background = ColorClip(make_gradient_background(0), duration=duration)
    background = background.fl(make_gradient_background)

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
    clip2 = clip2.fx(vfx.slide_in, duration=1, side='right')
    
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
