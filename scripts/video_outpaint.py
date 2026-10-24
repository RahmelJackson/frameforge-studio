"""Spatial VACE outpainting with exact resized source pixels restored in a master."""
import json,math
from pathlib import Path
import numpy as np
from PIL import Image
from video_media import digest,sample_images,decode_images,encode,audio_samples,inspect

SIZES={'landscape':(512,288),'portrait':(288,512),'square':(384,384)}
def placement(source_size,size,inset=0):
    if not 0<=inset<=.2:raise ValueError('Border padding must be between zero and twenty percent.')
    factor=min(size[0]/source_size[0],size[1]/source_size[1])*(1-inset)
    fitted=tuple(max(2,round(v*factor/2)*2) for v in source_size)
    return fitted,((size[0]-fitted[0])//2,(size[1]-fitted[1])//2)

def process(m,directory,phase):
    r=m['request'];s=m['source'];fps=16;start=r['start'];end=min(s['duration'],r['end'] if r['end'] is not None else s['duration'])
    if end-start>3.1:raise ValueError('Generated-edge previews are limited to 3.1 seconds.')
    count=1+4*math.floor((min(49,math.floor((end-start)*fps))-1)/4)
    if count<9:raise ValueError('Keep at least 0.6 seconds for temporal outpainting.')
    if digest(s['path'])!=s['sha256']:raise ValueError('Outpainting source changed.')
    size=SIZES[r['aspect']];fitted,offset=placement(s['size'],size,r.get('outpaintInset',0))
    if size[0]-fitted[0]<16 and size[1]-fitted[1]<16:raise ValueError('Choose a different aspect ratio to create missing edges.')
    bases=[im.resize(fitted,Image.Resampling.LANCZOS) for im in sample_images(s['path'],(start+i/fps for i in range(count)))]
    mask=Image.new('RGB',size,'white');mask.paste(Image.new('RGB',fitted,'black'),offset)
    guide=None;guide_binding=None
    if r.get('outpaintGuide'):
        if not r.get('reference'):raise ValueError('Select the expanded still guide first.')
        guide_path=Path(m['assets'])/r['reference'];guide=Image.open(guide_path).convert('RGB')
        if guide.size!=size:raise ValueError('Create the still guide for this source and format before propagating it.')
        x,y=offset;w,h=fitted
        if not np.array_equal(np.asarray(guide)[y:y+h,x:x+w],np.asarray(bases[0])):raise ValueError('The guide does not preserve this exact first fitted source frame. Recreate it for the current trim, format and padding.')
        guide_binding={'asset':r['reference'],'sha256':digest(guide_path)}
    if phase=='prepare':
        controls=[]
        for base in bases:
            image=Image.new('RGB',size,(127,127,127));image.paste(base,offset);controls.append(image)
        masks=[mask]*count
        if guide is not None:controls[0]=guide.copy();masks=[Image.new('RGB',size,'black')]+[mask]*(count-1)
        encode(controls,directory/'input.mp4',size,fps);encode(masks,directory/'mask.mp4',size,fps)
        p={'frames':count,'fps':fps,'size':list(size),'duration':count/fps,'hasMaskVideo':True,'inputSha256':digest(directory/'input.mp4'),'maskVideoSha256':digest(directory/'mask.mp4'),'sourceSha256':s['sha256'],'fittedSize':list(fitted),'offset':list(offset),'inset':r.get('outpaintInset',0),'guide':guide_binding}
        (directory/'prepared.json').write_text(json.dumps(p,indent=2),encoding='utf-8');return p
    p=json.loads((directory/'prepared.json').read_text(encoding='utf-8'))
    if digest(directory/'input.mp4')!=p['inputSha256'] or digest(directory/'mask.mp4')!=p['maskVideoSha256'] or p['sourceSha256']!=s['sha256']:raise ValueError('Outpainting inputs changed.')
    if p.get('guide')!=guide_binding:raise ValueError('The still guide changed after preparation.')
    info=inspect(directory/'raw.mp4');raw=list(decode_images(directory/'raw.mp4'))
    if info['frames']!=count or info['size']!=list(size) or abs(info['fps']-fps)>.01:raise ValueError('Outpainting output dimensions or timing differ.')
    for output,base in zip(raw,bases):output.paste(base,offset)
    boundary_matches=[]
    if r.get('outpaintMatch'):
        from match_outpaint_border import match_border
        for index in range(1 if guide is not None else 0,len(raw)):
            fixed=Image.new('RGB',size);fixed.paste(bases[index],offset)
            raw[index],detail=match_border(raw[index],fixed,mask.getchannel('R'));boundary_matches.append({'frame':index,**detail})
    if guide is not None:raw[0]=guide.copy()
    audio=audio_samples(s['path'],count/fps,s.get('startTime',0)+start)*r['volume'] if s.get('hasAudio') else None
    if audio is not None:audio*=min(1,.98/max(float(np.abs(audio).max()),1e-12))
    encode(raw,directory/'preserved.mkv',size,fps,audio,codec='ffv1');encode(raw,directory/'output.mp4',size,fps,audio)
    record={**p,'boundaryMatches':boundary_matches,'rawSha256':digest(directory/'raw.mp4'),'masterSha256':digest(directory/'preserved.mkv'),'note':'VACE generates only the missing borders in the viewing result. The entire source is resized to fit and restored exactly in the lossless master. Inspect seams and temporal stability.'}
    (directory/'outpainting.json').write_text(json.dumps(record,indent=2),encoding='utf-8')
    expected={'frames':count,'fps':fps,'size':list(size),'duration':count/fps,'hasAudio':audio is not None,'warnings':['Generated borders may contain seams, invented objects or flicker.'],'sourceSha256':s['sha256'],'sourceRange':[start,start+count/fps],'provenance':{},'outpainting':{'sha256':digest(directory/'outpainting.json'),'masterSha256':record['masterSha256']}}
    (directory/'expected.json').write_text(json.dumps(expected,indent=2),encoding='utf-8');(directory/'completed.json').write_text(json.dumps({'sha256':digest(directory/'output.mp4')}),encoding='utf-8');return expected
