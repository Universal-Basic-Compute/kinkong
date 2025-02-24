import logging
from pathlib import Path
from typing import List, Optional, Tuple
from emoji import replace_emoji
from moviepy.video.VideoClip import TextClip, ColorClip
from moviepy.video.fx.FadeIn import FadeIn
from moviepy.video.fx.FadeOut import FadeOut
from moviepy.video.fx.SlideIn import SlideIn
from moviepy.video.compositing.CompositeVideoClip import CompositeVideoClip

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)

def find_system_font() -> str:
    """Find an available system font."""
    font_paths = [
        # Custom downloaded fonts - check public directory first
        Path('public/BebasNeue-Regular.ttf'),
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
    
    raise ValueError("No usable font found! Please check font paths")

def create_text_clips(
    text: str,
    width: int,
    height: int,
    font_path: Optional[str] = None
) -> Tuple[List[TextClip], str]:
    """
    Create text clips with background box and animations.
    """
    if not font_path:
        font_path = find_system_font()

    # Remove emojis for now (we can add them back later with proper rendering)
    text = replace_emoji(text, replace='')

    # Convert text to uppercase and split into parts
    text_parts = [part.upper() for part in text.split('\n\n')]
    if len(text_parts) == 1:
        text_parts = [text_parts[0], text_parts[0]]
    
    clips = []
    text_box_margin = 20  # Margin around text in the box
    
    for i, text_part in enumerate(text_parts):
        # Create background box first
        box_width = width - 100  # Slightly smaller than video width
        box_height = height//4   # Adjust height as needed
        
        background_box = ColorClip(
            size=(box_width, box_height),
            color=[0.5, 0, 0]  # Dark red
        ).with_opacity(0.8)  # Slightly transparent
        
        # Create text clip
        text_clip = TextClip(
            text=text_part,
            font=font_path,
            font_size=80,  # Larger font size
            color='white',
            stroke_color='black',
            stroke_width=2,
            size=(box_width - 2*text_box_margin, box_height - 2*text_box_margin),
            method='caption',
            text_align='center',
            horizontal_align='center',
            vertical_align='center'
        )
        
        # Combine text and background
        composed_clip = CompositeVideoClip(
            [background_box, text_clip.with_position("center")],
            size=(box_width, box_height)
        )
        
        # Add animations based on position
        if i == 0:
            # First text slides in from left
            composed_clip = composed_clip.with_effects([
                SlideIn(duration=0.7, side="left"),
                FadeOut(duration=0.5)
            ])
            composed_clip = composed_clip.with_duration(5)
            composed_clip = composed_clip.with_position(('center', height//3))
        else:
            # Second text slides in from right
            composed_clip = composed_clip.with_effects([
                SlideIn(duration=0.7, side="right")
            ])
            composed_clip = composed_clip.with_duration(5)
            composed_clip = composed_clip.with_start(0.5)  # Start slightly after first clip
            composed_clip = composed_clip.with_position(('center', 2*height//3))
        
        clips.append(composed_clip)

    return clips, font_path
