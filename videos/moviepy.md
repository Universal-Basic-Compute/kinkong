# MoviePy v2.0 Documentation Notes

> **Important**: MoviePy v2.0 introduced breaking changes from v1.X

## Module Structure

### Core Modules
- `moviepy.Clip`: Base clip functionality
- `moviepy.Effect`: Base effect class
- `moviepy.video`: Video processing
- `moviepy.audio`: Audio processing
- `moviepy.config`: Configuration
- `moviepy.tools`: Utility functions

### Video Components
- `moviepy.video.VideoClip`
  - `BitmapClip`
  - `ColorClip`
  - `DataVideoClip`
  - `ImageClip`
  - `TextClip`
  - `VideoClip`

### Video Effects
- `moviepy.video.fx`
  - `AccelDecel`
  - `BlackAndWhite`
  - `Blink`
  - `Crop`
  - `FadeIn/FadeOut`
  - `CrossFadeIn/CrossFadeOut`
  - `Resize`
  - `Rotate`
  - `SlideIn/SlideOut`
  - Many more...

### Audio Components
- `moviepy.audio.AudioClip`
  - `AudioArrayClip`
  - `AudioFileClip`
  - `CompositeAudioClip`

### Audio Effects
- `moviepy.audio.fx`
  - `AudioDelay`
  - `AudioFadeIn/AudioFadeOut`
  - `AudioLoop`
  - `AudioNormalize`
  - `MultiplyVolume`

## Core Concepts

### Clip Class
The base class for all clips (VideoClips and AudioClips). Key attributes:

- `start`: Time when clip starts in composition (seconds)
- `end`: Time when clip stops in composition (seconds)
- `duration`: Length of clip in seconds (None for infinite clips)

Common methods:
- `with_duration(duration, change_end=True)`: Set clip duration
- `with_start(t, change_end=True)`: Set start time
- `with_end(t)`: Set end time
- `with_speed_scaled(factor=None, final_duration=None)`: Change playback speed
- `with_effects(effects)`: Apply list of effects
- `subclipped(start_time=0, end_time=None)`: Extract portion of clip

## Common Imports

```python
from moviepy.video.VideoClip import TextClip, ColorClip
from moviepy.video.compositing.CompositeVideoClip import CompositeVideoClip
from moviepy.video.fx.SlideIn import SlideIn
```

## Video Components

### TextClip Parameters
Complete parameter list for TextClip:
```python
clip = TextClip(
    # Required parameters
    text="Hello World",      # The text to display
    
    # Font settings
    font='Arial',           # Path to OpenType font or system font name
    font_size=70,          # Font size in points
    
    # Color settings
    color='white',         # Text color (name, RGB tuple, or hex)
    bg_color=None,         # Background color (None for transparent)
    stroke_color=None,     # Text outline color (None for no stroke)
    stroke_width=0,        # Width of text outline in pixels
    
    # Size and layout
    size=(1000, 500),      # (width, height) in pixels
    margin=(None, None),   # Margins (horizontal, vertical) or (left, top, right, bottom)
    
    # Text alignment
    method='caption',      # 'label' (auto-size) or 'caption' (fixed size)
    text_align='center',   # 'left', 'center', or 'right'
    horizontal_align='center', # 'left', 'center', or 'right' (text block in image)
    vertical_align='center',   # 'top', 'center', or 'bottom' (text block in image)
    interline=4,          # Spacing between lines
    
    # Other options
    transparent=True,     # Whether to allow transparency
    duration=None        # Clip duration in seconds
)

# Common TextClip operations
clip = clip.with_duration(5)                    # Set duration
clip = clip.set_position(('center', 'center'))  # Position in composite
clip = clip.with_start(2)                       # Start time in composition
clip = clip.with_effects([                      # Apply effects
    FadeIn(duration=1),
    FadeOut(duration=1, start_time=4)
])
```

### TextClip Methods
- `with_duration(duration)`: Set clip duration
- `set_position(pos)`: Set position in composite clip
  - pos can be: (x,y), 'center', 'left', 'right', 'top', 'bottom'
- `with_start(t)`: Set start time in composition
- `with_effects(effects)`: Apply list of effects
- `resize(width=None, height=None)`: Resize the text clip
- `rotate(angle)`: Rotate the text
- `with_color(color)`: Change text color

### TextClip Best Practices
1. Font Selection:
   - Use common system fonts or provide full path to custom fonts
   - Test fallback fonts for cross-platform compatibility

2. Size Management:
   - Use 'label' method for auto-sized text
   - Use 'caption' method when you need fixed dimensions
   - Always provide size when using 'caption' method

3. Text Alignment:
   - `text_align`: Controls text alignment within text block
   - `horizontal_align`: Controls text block position in image
   - `vertical_align`: Controls text block position in image

4. Performance:
   - Create TextClips once and reuse when possible
   - Use appropriate font size to avoid scaling
   - Consider using ColorClip for solid backgrounds

### Common TextClip Examples
```python
# Centered title with background
title = TextClip(
    text="My Video Title",
    font='Arial',
    font_size=70,
    color='white',
    bg_color='black',
    size=(1920, 200),
    method='caption',
    text_align='center',
    horizontal_align='center',
    vertical_align='center'
).with_duration(5)

# Auto-sized label with stroke
label = TextClip(
    text="Important Label",
    font='Arial',
    font_size=40,
    color='white',
    stroke_color='black',
    stroke_width=2,
    method='label',
    text_align='left'
).with_duration(3)

# Multi-line caption with margin
caption = TextClip(
    text="First line\nSecond line",
    font='Arial',
    font_size=30,
    color='white',
    size=(400, None),  # Fixed width, auto height
    margin=(20, 10),   # Horizontal and vertical margins
    method='caption',
    text_align='center',
    interline=8
).with_duration(4)
```

### ColorClip Parameters
```python
background = ColorClip(
    size=(width, height),
    color=[0, 0, 0.3]
).with_duration(duration)
```

## Effects and Transitions

### Visual Effects
```python
clip = clip.with_effects([
    SlideIn(duration=1, side='right'),
    FadeIn(duration=1),
    Resize(width=480)
])
```

### Audio Effects
```python
audio = audio.with_effects([
    AudioFadeIn(duration=2),
    MultiplyVolume(0.8)
])
```

## IO Operations

### Video Output
```python
clip.write_videofile(
    "output.mp4",
    fps=30,
    codec='libx264',
    audio=False
)
```

### Image Sequence
```python
from moviepy.video.io.ImageSequenceClip import ImageSequenceClip
clip = ImageSequenceClip("path/to/images/*.jpg", fps=24)
```

## Advanced Features

### Frame Processing
```python
# Iterate through frames
for frame in clip.iter_frames(fps=30):
    # Process frame...

# Custom frame transformation
new_clip = clip.transform(lambda get_frame, t: process_frame(get_frame(t)))
```

### Time Transformations
```python
# Play clip twice as fast
fast_clip = clip.time_transform(lambda t: 2*t)

# Play clip backwards
reverse_clip = clip.time_transform(lambda t: clip.duration - t)
```
