"""Bounded CPU finishing. No model downloads or inference. Inputs are server-resolved files."""
import json, sys, hashlib, math
from pathlib import Path
from fractions import Fraction
import av
import numpy as np
from PIL import Image, ImageFilter

directory=Path(sys.argv[1]); manifest=json.loads((directory/'creator-input.json').read_text())
recipe=manifest['recipe']; fps=12 if recipe=='loop' else 24; width=480 if recipe=='loop' else 640; sr=48000

def read_source(source, shape=None):
    if hashlib.sha256(Path(source['path']).read_bytes()).hexdigest()!=source['sha256']: raise ValueError('Source media changed; choose it again.')
    start,end=source['start'],source['end']; frames=[]; next_time=start
    with av.open(source['path']) as container:
        stream=container.streams.video[0]; stream.thread_type='AUTO'
        if start>1: container.seek(max(0,int((start-.5)*av.time_base)))
        for frame in container.decode(stream):
            t=float(frame.time or 0)
            if t+1e-5<start: continue
            if t>=end-1e-5: break
            if t+1e-5<next_time: continue
            if shape is None:
                w=width; h=max(2,round(frame.height/frame.width*w/2)*2)
                if h>854: h=854; w=max(2,round(frame.width/frame.height*h/2)*2)
                shape=(w,h)
            pic=Image.fromarray(frame.to_ndarray(format='rgb24'))
            # A contained frame retains the complete source. Letterbox only when two clips differ.
            from PIL import ImageOps
            pic=ImageOps.pad(pic,shape,method=Image.Resampling.LANCZOS,color=(12,16,14))
            while next_time<=t+1/fps and next_time<end-1e-5:
                frames.append(np.asarray(pic).copy());next_time+=1/fps
    if len(frames)<3: raise ValueError('Choose a range with at least three decoded frames.')
    frames=frames[:math.ceil((end-start)*fps)]
    audio=np.zeros((2,round(len(frames)/fps*sr)),dtype=np.float32); has_audio=False
    with av.open(source['path']) as container:
        if container.streams.audio:
            stream=container.streams.audio[0];resampler=av.AudioResampler(format='fltp',layout='stereo',rate=sr)
            for frame in container.decode(stream):
                if frame.time is not None and frame.time>end+.2: break
                for a in resampler.resample(frame):
                    pos=round((float(a.time or 0)-start)*sr);array=a.to_ndarray();lo=max(0,-pos);dest=max(0,pos);count=min(array.shape[1]-lo,audio.shape[1]-dest)
                    if count>0: audio[:,dest:dest+count]=array[:,lo:lo+count];has_audio=True
    return frames,audio,has_audio,shape

frames,audio,has_audio,shape=read_source(manifest['sources'][0]);note=[]
if recipe in ('warm','noir','dream'):
    out=[]
    for a in frames:
        f=a.astype(np.float32)
        if recipe=='warm': f=f*np.array([1.055,1.012,.94])+np.array([2,1,0])
        elif recipe=='noir':
            y=f@np.array([.2126,.7152,.0722]);f=np.repeat(np.clip(y*1.06+3,0,255)[:,:,None],3,axis=2)
        else:
            glow=np.asarray(Image.fromarray(a).filter(ImageFilter.GaussianBlur(8))).astype(np.float32);f=f*.9+glow*.1+np.maximum(glow-165,0)*.12
        out.append(np.clip(f,0,255).astype(np.uint8))
    frames=out
elif recipe in ('dissolve','dip-black','wipe'):
    second,b_audio,b_has,_=read_source(manifest['sources'][1],shape)
    count=round(manifest['transitionSeconds']*fps)
    if count<2 or count>=min(len(frames),len(second)):raise ValueError('Use a transition shorter than both selected clips.')
    blend=[]
    for i in range(count):
        t=(i+1)/(count+1);a=frames[-count+i].astype(np.float32);b=second[i].astype(np.float32)
        if recipe=='dissolve':c=a*(1-t)+b*t
        elif recipe=='dip-black':c=a*max(0,1-2*t)+b*max(0,2*t-1)
        else:
            edge=round(shape[0]*t);c=a.copy();c[:,:edge]=b[:,:edge]
        blend.append(np.clip(c,0,255).astype(np.uint8))
    frames=frames[:-count]+blend+second[count:]
    n=round(count/fps*sr);w=np.linspace(0,1,n,dtype=np.float32)[None,:]
    if recipe=='dip-black':mixed=audio[:,-n:]*np.maximum(0,1-2*w)+b_audio[:,:n]*np.maximum(0,2*w-1)
    else:mixed=audio[:,-n:]*(1-w)+b_audio[:,:n]*w
    audio=np.concatenate([audio[:,:-n],mixed,b_audio[:,n:]],axis=1);has_audio=has_audio or b_has
elif recipe=='loop':
    has_audio=False
    if manifest.get('loopMode')=='blend':
        count=max(2,min(round(.5*fps),len(frames)//3));mixed=[]
        for i in range(count):
            t=(i+1)/(count+1);mixed.append(np.clip(frames[-count+i].astype(float)*(1-t)+frames[i].astype(float)*t,0,255).astype(np.uint8))
        frames=frames[count:-count]+mixed;note.append('The wrap is cross-blended. Check for ghosting on moving subjects.')
    else:frames=frames+frames[-2:0:-1];note.append('The motion reverses at the ends. This is a ping-pong loop, not a newly generated seamless action.')
else:raise ValueError('Unknown finishing recipe.')

out=directory/'output.mp4'
with av.open(str(out),'w',options={'movflags':'+faststart'}) as container:
    video=container.add_stream('libx264',rate=fps);video.width=shape[0];video.height=shape[1];video.pix_fmt='yuv420p';video.options={'crf':'20','preset':'fast','threads':'4'}
    sound=None
    if has_audio:
        sound=container.add_stream('aac',rate=sr);sound.layout='stereo';sound.bit_rate=160000
    for i,a in enumerate(frames):
        frame=av.VideoFrame.from_ndarray(a,format='rgb24');frame.pts=i;frame.time_base=Fraction(1,fps)
        for packet in video.encode(frame):container.mux(packet)
    for packet in video.encode():container.mux(packet)
    if has_audio:
        for i in range(0,audio.shape[1],1024):
            a=av.AudioFrame.from_ndarray(np.ascontiguousarray(audio[:,i:i+1024],dtype=np.float32),format='fltp',layout='stereo');a.sample_rate=sr;a.pts=i;a.time_base=Fraction(1,sr)
            for packet in sound.encode(a):container.mux(packet)
        for packet in sound.encode():container.mux(packet)
Image.fromarray(frames[len(frames)//2]).save(directory/'poster.jpg',quality=88)
gif=None
if recipe=='loop':
    gif='loop.gif';palette=Image.fromarray(frames[0]).quantize(colors=128);images=[Image.fromarray(a).quantize(palette=palette) for a in frames]
    delays=[round((i+1)*100/fps)*10-round(i*100/fps)*10 for i in range(len(images))]
    images[0].save(directory/gif,save_all=True,append_images=images[1:],duration=delays,loop=0,optimize=False,disposal=2)
    adj=[float(np.abs(frames[i].astype(float)-frames[i-1]).mean()) for i in range(1,len(frames))];wrap=float(np.abs(frames[0].astype(float)-frames[-1]).mean());seam={'wrapMeanRGBDifference':wrap,'medianAdjacentRGBDifference':float(np.median(adj)),'meaning':'Pixel difference at the wrap, not a creative-quality or seamlessness certification.'}
else:seam=None
with av.open(str(out)) as check:
    decoded=list(check.decode(video=0));actual=len(decoded)
    if actual!=len(frames):raise ValueError('The finished video did not decode completely.')
sha=hashlib.sha256(out.read_bytes()).hexdigest()
report={'technicalPass':True,'sha256':sha,'duration':len(frames)/fps,'frames':len(frames),'fps':fps,'size':list(shape),'audio':has_audio,'recipe':recipe,'gif':gif,'seam':seam,'warnings':note,'checks':[{'name':'Complete video decode','pass':True},{'name':'Expected frame count','pass':actual==len(frames)}]}
(directory/'report.json').write_text(json.dumps(report,indent=2));print(json.dumps({'frames':actual,'duration':report['duration']}))
