# MoviePy v2.0 Documentation Notes

> **Important**: MoviePy v2.0 introduced breaking changes from v1.X

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
- `transform(func, apply_to=None, keep_duration=True)`: Apply custom transformation
- `time_transform(time_func, apply_to=None)`: Modify clip timeline

## Common Imports

```python
from moviepy.video.VideoClip import TextClip, ColorClip
from moviepy.video.compositing.CompositeVideoClip import CompositeVideoClip
from moviepy.video.fx.SlideIn import SlideIn
```

## TextClip Parameters

Current valid parameters:
- `txt`: The text to display (required)
- `fontsize`: Size of the font
- `color`: Text color
- `size`: (width, height) of the text box
- `method`: How to render the text ('caption', 'label')

Example:
```python
clip = TextClip(
    txt="Hello World",
    fontsize=70,
    color='white',
    size=(1000, 500),
    method='caption'
)
```

## Effects (fx)

Effects are now individual modules:
- `SlideIn`: Slide animation
- `fadein`: Fade in effect
- `fadeout`: Fade out effect

Example applying effects:
```python
clip = clip.with_effects([
    SlideIn(duration=1, side='right'),
    fadein(1),
    fadeout(1)
])
```

## Writing Output

```python
clip.write_videofile(
    "output.mp4",
    fps=30,
    codec='libx264',
    audio=False
)
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
