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
```python
clip = TextClip(
    txt="Hello World",
    fontsize=70,
    color='white',
    size=(1000, 500),
    method='caption'
)
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
