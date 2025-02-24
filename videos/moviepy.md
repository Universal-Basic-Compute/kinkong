# MoviePy v2.0 Documentation Notes

> **Important**: MoviePy v2.0 introduced breaking changes from v1.X

## Key Changes in v2.0

- `set_duration()` is now `with_duration()`
- Text clip parameters have changed
- Some effects and transitions have been reorganized

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

## Common Methods

- `with_duration(seconds)`: Set clip duration
- `set_position(position)`: Set clip position ('center', (x,y), etc)
- `fadein(duration)`: Add fade in effect
- `fadeout(duration)`: Add fade out effect
- `set_start(t)`: Set when the clip starts

## Effects (fx)

Effects are now individual modules:
- `SlideIn`: Slide animation
- `fadein`: Fade in effect
- `fadeout`: Fade out effect

## Writing Output

```python
clip.write_videofile(
    "output.mp4",
    fps=30,
    codec='libx264',
    audio=False
)
```
