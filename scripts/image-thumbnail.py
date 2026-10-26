import argparse,json,os
from PIL import Image,ImageOps
p=argparse.ArgumentParser();p.add_argument('source');p.add_argument('output');args=p.parse_args()
with Image.open(args.source) as original:
 image=ImageOps.exif_transpose(original).convert('RGB');image.thumbnail((480,480))
 image.save(args.output+'.tmp',format='JPEG',quality=80,optimize=True)
 os.replace(args.output+'.tmp',args.output)
 print(json.dumps({'size':list(image.size)}))
