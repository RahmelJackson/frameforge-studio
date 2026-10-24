"""Decode the source frame for drawing a mask at an exact trim start."""
import sys
from uuid import uuid4
from pathlib import Path
from video_media import sample_images

source, time, output = sys.argv[1:]
frame = next(sample_images(Path(source), [float(time)]))
lossless=Path(output).suffix.lower()=='.png'
temporary = Path(output).with_suffix('.'+str(uuid4())+('.pending.png' if lossless else '.pending.jpg'))
frame.save(temporary, **({} if lossless else {'quality':95}))
temporary.replace(output)
