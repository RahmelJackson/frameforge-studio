"""VACE missing-frame conditioning and original-preserving continuation export."""
import json,math
import numpy as np
from PIL import Image
from video_media import digest,sample_images,decode_images,crop_image,encode,audio_samples,inspect
def process(m,directory,phase):
    r=m['request'];s=m['source'];fps=16;start=r['start'];end=min(s['duration'],r['end'] if r['end'] is not None else s['duration']);original_count=1+4*math.floor((min(33,math.floor((end-start)*fps))-1)/4);new_count=32;count=original_count+new_count;ratio=s['size'][0]/s['size'][1];size=(512,288) if ratio>1.3 else (288,512) if ratio<.77 else (384,384);back=r['extensionDirection']=='backward'
    if end-start>2.1:raise ValueError('Select at most 2.1 seconds of source context for this bounded continuation.')
    if original_count<9:raise ValueError('Keep at least 0.6 seconds of source for continuation.')
    if digest(s['path'])!=s['sha256']:raise ValueError('Continuation source changed.')
    bases=[crop_image(im,size) for im in sample_images(s['path'],(start+i/fps for i in range(original_count)))];empty=Image.new('RGB',size,(127,127,127));white=Image.new('RGB',size,'white');black=Image.new('RGB',size,'black')
    if phase=='prepare':
        controls=[empty]*new_count+bases if back else bases+[empty]*new_count;masks=[white]*new_count+[black]*original_count if back else [black]*original_count+[white]*new_count
        encode(controls,directory/'input.mp4',size,fps);encode(masks,directory/'mask.mp4',size,fps)
        prepared={'frames':count,'fps':fps,'size':list(size),'duration':count/fps,'hasMaskVideo':True,'inputSha256':digest(directory/'input.mp4'),'maskVideoSha256':digest(directory/'mask.mp4'),'originalFrames':original_count,'addedFrames':new_count,'direction':r['extensionDirection'],'sourceSha256':s['sha256']}
        (directory/'prepared.json').write_text(json.dumps(prepared,indent=2),encoding='utf-8');return prepared
    p=json.loads((directory/'prepared.json').read_text(encoding='utf-8'))
    if p['sourceSha256']!=s['sha256'] or digest(directory/'input.mp4')!=p['inputSha256'] or digest(directory/'mask.mp4')!=p['maskVideoSha256']:raise ValueError('Continuation prepared inputs changed.')
    info=inspect(directory/'raw.mp4');raw=list(decode_images(directory/'raw.mp4'))
    if info['frames']!=count or info['size']!=list(size) or abs(info['fps']-fps)>.01:raise ValueError('Continuation model output is truncated or has incorrect timing.')
    output=raw[:new_count]+bases if back else bases+raw[original_count:];audio=None
    if s.get('hasAudio'):
        audio=audio_samples(s['path'],original_count/fps,s.get('startTime',0)+start)*r['volume'];padding=np.zeros((2,new_count*3000),np.float32);audio=np.concatenate([padding,audio],axis=1) if back else np.concatenate([audio,padding],axis=1);audio*=min(1,.98/max(float(np.abs(audio).max()),1e-12))
    encode(output,directory/'preserved.mkv',size,fps,audio,codec='ffv1');encode(output,directory/'output.mp4',size,fps,audio)
    seam=new_count if back else original_count;a=np.asarray(output[seam-1],dtype=float);b=np.asarray(output[seam],dtype=float);change=float(np.abs(a-b).mean()/255)
    record={**p,'rawSha256':digest(directory/'raw.mp4'),'masterSha256':digest(directory/'preserved.mkv'),'seamMeanRgbDifference':change,'note':'Original frames restored exactly after documented sampling/crop. New frames come from VACE; continuity and natural motion need playback review. Original audio retained only under original frames; added section is silent.'};(directory/'extension.json').write_text(json.dumps(record,indent=2),encoding='utf-8')
    expected={'frames':count,'fps':fps,'size':list(size),'duration':count/fps,'hasAudio':audio is not None,'warnings':['Inspect the generated join for continuity. The added section has no generated audio.'],'sourceSha256':s['sha256'],'sourceRange':[start,start+original_count/fps],'provenance':{},'extension':{'sha256':digest(directory/'extension.json'),'masterSha256':record['masterSha256']}}
    (directory/'expected.json').write_text(json.dumps(expected,indent=2),encoding='utf-8');(directory/'completed.json').write_text(json.dumps({'sha256':digest(directory/'output.mp4')}),encoding='utf-8');return expected
