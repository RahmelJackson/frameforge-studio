"""Independent mask/provenance and lossless preview reconstruction checks."""
import json
from pathlib import Path
import numpy as np
from PIL import Image
from video_media import digest,decode_images,sample_images,crop_image

def check(directory,manifest,expected):
    meta=json.loads((directory/'segmentation.json').read_text());source=manifest['source'];r=manifest['request'];count=0;maximum=0;binary=True
    valid=digest(directory/'segmentation.json')==expected['segmentation']['sha256'] and meta['sourceSha256']==source['sha256'] and digest(source['path'])==source['sha256'] and digest(meta['model']['path'])==meta['model']['sha256']
    valid &= meta['model']==manifest['segmentationModel'] and meta['frames']==expected['frames'] and meta['size']==expected['size'] and abs(meta['fps']-expected['fps'])<.001 and meta['points']==r['segmentPoints']
    valid &= digest(directory/'input.mp4')==meta['inputSha256'] and digest(directory/'raw.mp4')==meta['rawSha256'] and meta['sourceRange']==expected['sourceRange'] and meta['crop']=={k:r[k] for k in ['cropX','cropY','cropEndX','cropEndY']}
    for i,(base,master) in enumerate(zip(sample_images(source['path'],(r['start']+i/expected['fps'] for i in range(expected['frames']))),decode_images(directory/'preserved.mkv'))):
        file=directory/'masks'/f'{i:04d}.png';valid &= digest(file)==meta['maskSha256'][i];values=np.asarray(Image.open(file).convert('L'));binary &= np.isin(values,[0,255]).all();t=i/max(1,expected['frames']-1)
        original=crop_image(base,tuple(expected['size']),r['cropX']+(r['cropEndX']-r['cropX'])*t,r['cropY']+(r['cropEndY']-r['cropY'])*t)
        alpha=values[:,:,None]/255*.35;reference=np.round(np.asarray(original)*(1-alpha)+np.array([180,240,70])*alpha).astype('uint8');maximum=max(maximum,int(np.abs(reference.astype(int)-np.asarray(master).astype(int)).max()));count+=1
    first=np.asarray(Image.open(directory/'masks/0000.png').convert('L'));h,w=first.shape
    for p in r['segmentPoints']:valid &= bool(first[round(p['y']*(h-1)),round(p['x']*(w-1))])==bool(p['label'])
    valid &= count==expected['frames'] and binary and maximum==0 and digest(directory/'preserved.mkv')==expected['segmentation']['masterSha256'] and meta['maskSha256']==expected['segmentation']['maskSha256']
    return {'valid':bool(valid),'frames':count,'maximumReconstructionRgbError':maximum,'binaryMasks':bool(binary),'emptyFrames':meta['emptyFrames'],'sha256':expected['segmentation']['sha256'],'method':meta['method'],'model':meta['model'],'master':'preserved.mkv','note':'File/point/overlay checks do not establish semantic selection or occlusion quality.'}

def check_reuse(directory,manifest,expected):
    from scipy.ndimage import distance_transform_edt
    binding=manifest['segmentation'];origin=Path(binding['directory']);track=json.loads((directory/'tracking.json').read_text());meta=json.loads((origin/'segmentation.json').read_text());count=0;maximum=0
    amount=track.get('feather',0);valid=digest(origin/'segmentation.json')==binding['metadataSha256']==track['metadataSha256'] and track['sourceSelection']==binding['jobId'] and meta['sourceSha256']==manifest['source']['sha256'] and meta['sourceRange']==expected['sourceRange']
    if track['method']=='native-sam3.1-checked-reuse-v2':valid &= amount==manifest['request']['feather'] and track['sourceMaskSha256']==meta['maskSha256']
    for i,checksum in enumerate(meta['maskSha256']):
        original=origin/'masks'/f'{i:04d}.png';actual=directory/'masks'/f'{i:04d}.png';binary=np.asarray(Image.open(original).convert('L'))>=128;reference=(np.minimum(1,distance_transform_edt(binary)/amount)*255).astype('uint8') if amount else binary.astype('uint8')*255
        valid &= digest(original)==checksum and digest(actual)==track['maskSha256'][i];maximum=max(maximum,int(np.abs(reference.astype(int)-np.asarray(Image.open(actual).convert('L')).astype(int)).max()));count+=1
    valid &= count==expected['frames'] and maximum==0
    return {'valid':bool(valid),'sourceSelection':binding['jobId'],'frames':count,'maximumMaskError':maximum,'feather':amount,'legacyUnfeathered':track['method']!='native-sam3.1-checked-reuse-v2','note':'Exact mask handoff; semantic boundaries and generated material still need visual review.'}
