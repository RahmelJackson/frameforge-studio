"""Conventional high-quality resize; explicitly separate from neural detail synthesis."""
import json,math
import numpy as np
from PIL import Image
from video_media import digest,sample_images,encode,audio_samples
def render(m,directory):
    r=m['request'];s=m['source'];start=r['start'];end=min(s['duration'],r['end'] if r['end'] is not None else s['duration']);fps=min(30,s['fps'])
    if not .125<=end-start<=3.4:raise ValueError('Resize previews need 0.125-3.4 seconds.')
    if digest(s['path'])!=s['sha256']:raise ValueError('Resize source changed.')
    factor=min(1,math.sqrt(500000/(s['size'][0]*s['size'][1])));base=tuple(max(2,int(v*factor)//2*2) for v in s['size']);size=tuple(v*2 for v in base);count=round((end-start)*fps);duration=count/fps
    images=[im.resize(base,Image.Resampling.LANCZOS).resize(size,Image.Resampling.LANCZOS) for im in sample_images(s['path'],(start+i/fps for i in range(count)))]
    audio=audio_samples(s['path'],duration,s.get('startTime',0)+start)*r['volume'] if s.get('hasAudio') else None
    if audio is not None:audio*=min(1,.98/max(float(np.abs(audio).max()),1e-12))
    encode(images,directory/'preserved.mkv',size,fps,audio,codec='ffv1');encode(images,directory/'output.mp4',size,fps,audio)
    e={'frames':count,'fps':fps,'size':list(size),'duration':duration,'hasAudio':audio is not None,'warnings':['Conventional Lanczos resizing preserves the source appearance but cannot recover missing detail.'],'sourceSha256':s['sha256'],'sourceRange':[start,start+duration],'provenance':{},'faithfulResize':{'method':'lanczos','baseSize':list(base),'masterSha256':digest(directory/'preserved.mkv')}}
    (directory/'expected.json').write_text(json.dumps(e,indent=2),encoding='utf-8');(directory/'completed.json').write_text(json.dumps({'sha256':digest(directory/'output.mp4')}),encoding='utf-8');return e
