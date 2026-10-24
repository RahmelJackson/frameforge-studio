import json,sys,tempfile
from pathlib import Path
import numpy as np
from PIL import Image
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'scripts'))
from video_media import encode,digest,decode_images
from selection_check import verify_selection
base=ROOT/'runtime/selection-tests';base.mkdir(exist_ok=True)
with tempfile.TemporaryDirectory(dir=base) as tmp:
 d=Path(tmp);(d/'masks').mkdir();(d/'selection').mkdir();image=Image.new('RGB',(32,32),(80,90,100));encode([image,image],d/'input.mp4',(32,32),8)
 r={'clothingPart':'upper','materialSeed':[.5,.5]};(d/'manifest.json').write_text(json.dumps({'request':r}));labels=np.full((32,32),4,dtype='uint8');labels[:8]=11;mask=np.zeros((32,32),dtype='uint8');mask[10:22,10:22]=255
 for i in range(2):Image.fromarray(mask).save(d/'masks'/f'{i:04d}.png');Image.fromarray(labels).save(d/'selection'/f'{i:04d}-labels.png');Image.new('L',(32,32),255).save(d/'selection'/f'{i:04d}-confidence.png')
 first=np.asarray(next(decode_images(d/'input.mp4')),dtype=float)/255;luma=float((first@np.array([.2126,.7152,.0722])).mean())
 report={'method':'segformer-clothing-per-frame-v2','classes':[4],'seed':r['materialSeed'],'seedLuma':luma,'threshold':.6,'appearanceLumaTolerance':.22,'inputSha256':digest(d/'input.mp4'),'models':[x for x in json.loads((ROOT/'setup/advanced-models.lock.json').read_text()) if x['group']=='clothing'],'frames':2,'trajectory':[{'coverage':.1}]*2,'maskSha256':[digest(d/'masks'/f'{i:04d}.png') for i in range(2)],'labelSha256':[digest(d/'selection'/f'{i:04d}-labels.png') for i in range(2)],'confidenceSha256':[digest(d/'selection'/f'{i:04d}-confidence.png') for i in range(2)]}
 def save():(d/'selection.json').write_text(json.dumps(report))
 save();assert verify_selection(d)['valid']
 r['isolateGarment']=False;(d/'manifest.json').write_text(json.dumps({'request':r}));report['appearanceLumaTolerance']=None;report['seedLuma']=0;save();assert verify_selection(d)['valid']
 r['isolateGarment']=True;(d/'manifest.json').write_text(json.dumps({'request':r}));report['appearanceLumaTolerance']=.22;report['seedLuma']=luma;save()
 mask[1,1]=255;Image.fromarray(mask).save(d/'masks/0000.png');report['maskSha256'][0]=digest(d/'masks/0000.png');save();assert not verify_selection(d)['valid'];mask[1,1]=0;Image.fromarray(mask).save(d/'masks/0000.png');report['maskSha256'][0]=digest(d/'masks/0000.png');save()
 labels[12,12]=11;Image.fromarray(labels).save(d/'selection/0000-labels.png');assert not verify_selection(d)['valid']
 labels[12,12]=4;Image.fromarray(labels).save(d/'selection/0000-labels.png');Image.new('L',(32,32),0).save(d/'selection/0000-confidence.png');assert not verify_selection(d)['valid']
print('Clothing protection, forbidden face pixels, changed labels and confidence controls passed')
