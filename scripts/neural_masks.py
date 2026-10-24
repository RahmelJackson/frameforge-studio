"""Inspected native SAM masks and strict, checksum-bound reuse in video editing."""
import json
from pathlib import Path
import numpy as np
from PIL import Image
from video_media import digest,inspect,decode_images,sample_images,crop_image,encode,audio_samples

def masks_record(directory,metadata):
    folder=directory/'masks';folder.mkdir(exist_ok=True)
    values=[digest(folder/f'{i:04d}.png') for i in range(metadata['frames'])]
    return {'method':'native-sam3.1-explicit-points-v1','frames':metadata['frames'],'maskSha256':values,'trajectory':[{'frame':i,'confidence':None} for i in range(metadata['frames'])],'note':'No calibrated per-frame confidence is exposed by this native tracker. Inspect the masks.'}

def inward_feather(image,amount):
    from scipy.ndimage import distance_transform_edt
    values=np.asarray(image.convert('L'))>=128
    return Image.fromarray((np.minimum(1,distance_transform_edt(values)/amount)*255).astype('uint8')) if amount else image.convert('L')

def project_first_mask(image,size,metadata,feather):
    w,h=size;mw,mh=metadata['size'];width=min(w,h*mw/mh);height=width*mh/mw;crop=metadata['crop'];left=round((w-width)*crop['cropX']);top=round((h-height)*crop['cropY']);right=round((w-width)*crop['cropX']+width);bottom=round((h-height)*crop['cropY']+height)
    scaled=image.convert('L').resize((right-left,bottom-top),Image.Resampling.NEAREST);scaled=inward_feather(scaled,feather*(right-left)/mw);result=Image.new('L',size);result.paste(scaled,(left,top));return result,{'sourceCrop':[left,top,right,bottom],'maskSize':[mw,mh],'sourceSize':[w,h],'nativeFeather':feather,'sourceFeather':feather*(right-left)/mw,'policy':'Nearest-neighbor projection of the checked first mask into the exact original crop; inward feather only.'}

def import_masks(manifest,directory):
    bound=manifest.get('segmentation');prepared=json.loads((directory/'prepared.json').read_text())
    if not bound:raise ValueError('Choose a checked neural mask preview.')
    origin=Path(bound['directory']);file=origin/'segmentation.json'
    if digest(file)!=bound['metadataSha256']:raise ValueError('Neural selection metadata changed.')
    meta=json.loads(file.read_text());request=manifest['request']
    if meta['sourceSha256']!=manifest['source']['sha256'] or meta['frames']!=prepared['frames'] or meta['size']!=prepared['size'] or abs(meta['fps']-prepared['fps'])>.001:raise ValueError('Neural selection must match the same source, frame count, size and rate.')
    if any(abs(a-b)>.0001 for a,b in zip(meta['sourceRange'],prepared['sourceRange'])):raise ValueError('Neural selection must cover exactly the same source range.')
    for key in ['cropX','cropY','cropEndX','cropEndY']:
        if abs(request[key]-meta['crop'][key])>.0001:raise ValueError('Keep the crop unchanged when reusing a neural selection.')
    folder=directory/'masks';folder.mkdir(exist_ok=True)
    if len(meta['maskSha256'])!=prepared['frames']:raise ValueError('Neural selection is incomplete.')
    masks=[]
    for i,checksum in enumerate(meta['maskSha256']):
        source=origin/'masks'/f'{i:04d}.png'
        if digest(source)!=checksum:raise ValueError('A neural mask changed after verification.')
        mask=inward_feather(Image.open(source),request.get('feather',0));mask.save(folder/source.name);masks.append(mask.convert('RGB'))
    encode(masks,directory/'mask.mp4',tuple(prepared['size']),prepared['fps'])
    record=masks_record(directory,meta);record.update({'method':'native-sam3.1-checked-reuse-v2','sourceSelection':bound['jobId'],'metadataSha256':bound['metadataSha256'],'feather':request.get('feather',0),'sourceMaskSha256':meta['maskSha256'],'edgePolicy':'Inward feather only; every originally unselected pixel remains protected.'})
    (directory/'tracking.json').write_text(json.dumps(record,indent=2))

def finalize(manifest,directory):
    prepared=json.loads((directory/'prepared.json').read_text());r=manifest['request'];source=manifest['source'];size=tuple(prepared['size']);frames=prepared['frames'];fps=prepared['fps']
    if digest(source['path'])!=source['sha256'] or digest(directory/'input.mp4')!=prepared['inputSha256']:raise ValueError('Segmentation source changed.')
    model=manifest['segmentationModel']
    if digest(model['path'])!=model['sha256']:raise ValueError('Segmentation weights changed.')
    info=inspect(directory/'raw.mp4')
    if info['frames']!=frames or info['size']!=list(size) or abs(info['fps']-fps)>.01:raise ValueError('Neural masks do not match prepared video timing/size.')
    masks=[];areas=[];folder=directory/'masks';folder.mkdir(exist_ok=True)
    for i,image in enumerate(decode_images(directory/'raw.mp4')):
        values=np.asarray(image.convert('L'))>=128;areas.append(float(values.mean()));mask=Image.fromarray((values*255).astype('uint8'));mask.save(folder/f'{i:04d}.png');masks.append(mask)
    if not .0001<areas[0]<.95:raise ValueError('The initial neural selection is empty or covers nearly the whole picture. Change the points.')
    first=np.asarray(masks[0]);positive=[];negative=[]
    for point in r['segmentPoints']:
        selected=bool(first[round(point['y']*(size[1]-1)),round(point['x']*(size[0]-1))]);(positive if point['label'] else negative).append(selected)
    if not all(positive) or any(negative):raise ValueError('The initial mask does not respect the keep/exclude points. Inspect and correct the selection.')
    original=[]
    for i,image in enumerate(sample_images(source['path'],(r['start']+i/fps for i in range(frames)))):
        t=i/max(1,frames-1);original.append(crop_image(image,size,r['cropX']+(r['cropEndX']-r['cropX'])*t,r['cropY']+(r['cropEndY']-r['cropY'])*t))
    preview=[]
    for base,mask in zip(original,masks):
        alpha=np.asarray(mask,dtype=float)[:,:,None]/255*.35;preview.append(Image.fromarray(np.round(np.asarray(base)*(1-alpha)+np.array([180,240,70])*alpha).astype('uint8')))
    audio=None
    if source.get('hasAudio'):
        audio=audio_samples(source['path'],prepared['duration'],source.get('startTime',0)+r['start'])*r['volume']
    encode(preview,directory/'preserved.mkv',size,fps,audio,codec='ffv1');encode(preview,directory/'output.mp4',size,fps,audio);encode([m.convert('RGB') for m in masks],directory/'mask.mp4',size,fps)
    record=masks_record(directory,prepared)
    meta={**record,'sourceSha256':source['sha256'],'sourceRange':prepared['sourceRange'],'size':list(size),'fps':fps,'inputSha256':prepared['inputSha256'],'rawSha256':digest(directory/'raw.mp4'),'model':model,'points':r['segmentPoints'],'crop':{k:r[k] for k in ['cropX','cropY','cropEndX','cropEndY']},'emptyFrames':[i for i,a in enumerate(areas) if a==0],'areaFractions':areas,'initialPointsRespected':True}
    (directory/'segmentation.json').write_text(json.dumps(meta,indent=2));binding={'sha256':digest(directory/'segmentation.json'),'masterSha256':digest(directory/'preserved.mkv'),'maskSha256':record['maskSha256'],'method':record['method']}
    expected={**prepared,'hasAudio':audio is not None,'segmentation':binding,'warnings':['Neural selection preview; inspect cuffs, occlusion and object changes. Empty frames: '+str(len(meta['emptyFrames']))]}
    (directory/'expected.json').write_text(json.dumps(expected,indent=2));(directory/'completed.json').write_text(json.dumps({'sha256':digest(directory/'output.mp4')}));return expected
