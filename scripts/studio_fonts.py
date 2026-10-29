"""Use an available system font, with a portable Pillow fallback."""
import os
from pathlib import Path
from PIL import ImageFont

def studio_font(size):
    candidates = [os.environ.get('FRAMEFORGE_FONT'),
                  str(Path(os.environ.get('WINDIR', 'C:/Windows')) / 'Fonts/segoeui.ttf'),
                  '/System/Library/Fonts/Supplemental/Arial.ttf',
                  '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 'DejaVuSans.ttf']
    for candidate in candidates:
        if not candidate:
            continue
        try:
            return ImageFont.truetype(candidate, size)
        except OSError:
            pass
    return ImageFont.load_default(size=size)
