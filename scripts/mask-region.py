"""Measure an editable region. The ComfyUI graph performs crop and compositing."""
import json,sys
from PIL import Image,ImageOps
with Image.open(sys.argv[1]) as im:
    source=ImageOps.exif_transpose(im); size=source.size
with Image.open(sys.argv[2]) as im:
    mask=ImageOps.exif_transpose(im).convert('RGB').getchannel('R')
    if mask.size!=size or size[0]*size[1]>4000000: raise ValueError('Mask must match a source up to four megapixels')
    low,high=mask.getextrema()
    if high==0 or low>0: raise ValueError('Select part of the picture and leave some pixels protected')
    box=mask.getbbox(); padding=32
    box=[max(0,box[0]-padding),max(0,box[1]-padding),min(size[0],box[2]+padding),min(size[1],box[3]+padding)]
    print(json.dumps({'box':box,'originalSize':list(size),'method':'mask-bounds-with-32px-context-v1'}))
