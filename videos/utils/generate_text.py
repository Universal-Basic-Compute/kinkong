from pathlib import Path
from typing import List, Optional, Tuple
from moviepy.video.VideoClip import TextClip
from moviepy.video.fx.FadeIn import FadeIn
from moviepy.video.fx.FadeOut import FadeOut
from moviepy.video.fx.SlideIn import SlideIn

def find_system_font() -> str:
    """Find an available system font."""
    font_paths = [
        # Custom downloaded fonts
        Path('assets/fonts/BebasNeue-Regular.ttf'),  # You'll need to download this
        # System fonts in order of preference
        Path(r"C:\Windows\Fonts\impact.ttf"),
        Path(r"C:\Windows\Fonts\segoeui.ttf"), 
        Path(r"C:\Windows\Fonts\arial.ttf"),
        Path(r"C:\Windows\Fonts\calibri.ttf"),
    ]
    
    for path in font_paths:
        if path.exists():
            logger.info(f"Using font: {path}")
            return str(path)
    
    raise ValueError("No usable font found! Please download Bebas Neue")

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

    # Convert text to uppercase and split into parts
    text_parts = [part.upper() for part in text.split('\n\n')]
    if len(text_parts) == 1:
        text_parts = [text_parts[0], text_parts[0]]
    
    # First part appears with fade - bigger and bolder
    clip1 = TextClip(
        text=text_parts[0],
        font=font_path,
        font_size=140,  # Increased size
        color='white',
        stroke_color='black',
        stroke_width=4,  # Thicker outline
        size=(width-80, height//2),  # Slightly larger text area
        method='caption',
        text_align='center',
        horizontal_align='center',
        vertical_align='center'
    ).with_duration(5)
    clip1 = clip1.with_position(('center', height//3))
    clip1 = clip1.with_effects([
        FadeIn(duration=0.3),  # Faster fade for more impact
        FadeOut(duration=0.3)
    ])
    
    # Second part with different styling
    clip2 = TextClip(
        text=text_parts[-1],
        font=font_path,
        font_size=120,  # Slightly smaller than first
        color='#00ffff',  # Cyan color
        stroke_color='black',
        stroke_width=4,
        size=(width-80, height//2),
        method='caption',
        text_align='center',
        horizontal_align='center',
        vertical_align='center'
    ).with_duration(5)
    clip2 = clip2.with_position(('center', 2*height//3))
    clip2 = clip2.with_start(5)  # Start after first clip
    clip2 = clip2.with_effects([
        SlideIn(duration=0.5, side='right')  # Even faster slide
    ])

    return [clip1, clip2], font_path
