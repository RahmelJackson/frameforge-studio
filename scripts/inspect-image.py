"""Validate actual image decoding before a reference enters the render queue."""
import json
import sys
import warnings
from PIL import Image, ImageOps

Image.MAX_IMAGE_PIXELS = 40_000_000
try:
    with warnings.catch_warnings():
        warnings.simplefilter('error', Image.DecompressionBombWarning)
        with Image.open(sys.argv[1]) as image:
            if image.format not in {'PNG', 'JPEG', 'WEBP'}:
                raise ValueError('Unsupported image format')
            if image.width * image.height > Image.MAX_IMAGE_PIXELS:
                raise ValueError('Image exceeds 40 megapixels')
            image.load()
            oriented = ImageOps.exif_transpose(image)
            result={'width': oriented.width, 'height': oriented.height, 'format': image.format}
            if '--mask' in sys.argv:
                extrema=oriented.convert('RGB').getchannel('R').getextrema()
                result['hasPaint']=extrema[1]>0;result['hasBackground']=extrema[0]==0
            print(json.dumps(result))
except Exception:
    print('The image could not be decoded. Choose a valid PNG, JPEG, or WebP up to 40 megapixels.', file=sys.stderr)
    sys.exit(2)
