from pathlib import Path
from typing import List, Optional, Tuple
from moviepy.video.VideoClip import TextClip
from moviepy.video.fx.FadeIn import FadeIn
from moviepy.video.fx.FadeOut import FadeOut
from moviepy.video.fx.SlideIn import SlideIn

def find_system_font() -> str:
    """Find an available system font."""
    font_paths = [
        r"C:\Windows\Fonts\segoe.ttf",
        r"C:\Windows\Fonts\segoeui.ttf", 
        r"C:\Windows\Fonts\arial.ttf",
        r"C:\Windows\Fonts\calibri.ttf",
    ]
    
    for path in font_paths:
        if Path(path).exists():
            print(f"Using font: {path}")
            return path
    
    raise ValueError("No usable system font found!")

def create_text_clips(
    text: str,
    width: int,
    height: int,
    font_path: Optional[str] = None
) -> Tuple[List[TextClip], str]:
    """
    Create text clips for the video with punchy effects.
    
    Args:
        text: The text to display
        width: Video width
        height: Video height
        font_path: Optional path to font file
    
    Returns:
        Tuple of (list of text clips, font path used)
    """
    if not font_path:
        font_path = find_system_font()

    text_parts = text.split('\n\n')
    
    # First part appears with fade - bigger and bolder
    clip1 = TextClip(
        text=text_parts[0],
        font=font_path,
        font_size=120,  # Increased from 70
        color='white',
        stroke_color='black',  # Add outline
        stroke_width=2,        # Outline thickness
        size=(width-100, height//2),
        method='caption',
        text_align='center',
        horizontal_align='center',
        vertical_align='center'
    ).with_duration(5)
    clip1 = clip1.with_position(('center', height//3))
    clip1 = clip1.with_effects([
        FadeIn(duration=0.5),  # Faster fade for more punch
        FadeOut(duration=0.5)
    ])
    
    # Second part slides in from right - different style
    clip2 = TextClip(
        text=text_parts[1],
        font=font_path,
        font_size=100,  # Slightly smaller than first
        color='#00ffff',  # Cyan color for contrast
        stroke_color='black',
        stroke_width=2,
        size=(width-100, height//2),
        method='caption',
        text_align='center',
        horizontal_align='center',
        vertical_align='center'
    ).with_duration(5)
    clip2 = clip2.with_position(('center', 2*height//3))
    clip2 = clip2.with_start(5)  # Start after first clip
    clip2 = clip2.with_effects([
        SlideIn(duration=0.7, side='right')  # Faster slide
    ])

    return [clip1, clip2], font_path
