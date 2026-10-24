"""Create a source-preserving still canvas/mask; no model inference here."""
import json,sys,uuid
from pathlib import Path
from PIL import Image
from video_media import sample_images,inspect,digest
from video_outpaint import placement,SIZES
source=Path(sys.argv[1]);start=float(sys.argv[2]);aspect=sys.argv[3];inset=float(sys.argv[4]);assets=Path(sys.argv[5])
info=inspect(source)
if aspect not in SIZES or not 0<=start<info['duration']:raise ValueError('Choose a valid source time and format.')
size=SIZES[aspect];fitted,offset=placement(info['size'],size,inset)
if size[0]-fitted[0]<16 and size[1]-fitted[1]<16:raise ValueError('Choose a different shape or add at least ten percent padding.')
frame=next(sample_images(source,[start])).resize(fitted,Image.Resampling.LANCZOS)
canvas=Image.new('RGB',size,(127,127,127));canvas.paste(frame,offset);mask=Image.new('RGB',size,'white');mask.paste(Image.new('RGB',fitted,'black'),offset)
name=str(uuid.uuid4())+'.png';mask_name=str(uuid.uuid4())+'.png';canvas.save(assets/name);mask.save(assets/mask_name)
print(json.dumps({'asset':name,'mask':mask_name,'size':size,'fittedSize':fitted,'offset':offset,'sourceSha256':digest(source),'start':start,'inset':inset,'assetSha256':digest(assets/name),'maskSha256':digest(assets/mask_name)}))
