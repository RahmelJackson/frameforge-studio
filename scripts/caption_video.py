"""Local timed captions and narration mix; source pictures are never regenerated."""
import json,math
from pathlib import Path
import numpy as np
import soundfile as sf
from scipy.ndimage import uniform_filter1d
from PIL import Image,ImageDraw,ImageFont
from studio_fonts import studio_font
from video_media import digest,audio_samples,sample_images,encode

def captions_at(cues,time):
    return next((c for c in cues if c['start']<=time<c['end']),None)

def caption_tile(size,text,font_size):
    width,height=size;band=math.floor(height*.65);font=studio_font(font_size);draw=ImageDraw.Draw(Image.new('RGB',size));lines=[];line=''
    for word in text.split():
        if draw.textlength(word,font=font)>width*.86:raise ValueError('A caption word is too wide. Shorten it or reduce the caption size.')
        candidate=(line+' '+word).strip()
        if line and draw.textlength(candidate,font=font)>width*.86:lines.append(line);line=word
        else:line=candidate
    if line:lines.append(line)
    step=round(font_size*1.35);box_height=len(lines)*step+18;margin=max(10,round(height*.04));top=height-margin-box_height
    if len(lines)>4 or top<band:raise ValueError('This caption is too long for the picture. Split or shorten it, or reduce its size.')
    tile=Image.new('RGBA',size);draw=ImageDraw.Draw(tile);draw.rounded_rectangle((round(width*.04),top,round(width*.96),height-margin),radius=8,fill=(16,18,20,242))
    for i,line in enumerate(lines):draw.text(((width-draw.textlength(line,font=font))/2,top+7+i*step),line,font=font,fill='white')
    return tile,band

def mix_sound(original,speech,count,source_volume,speech_volume,duck):
    original=np.zeros((2,count),np.float32) if original is None else np.pad(original,((0,0),(0,max(0,count-original.shape[1]))))[:,:count].copy()
    speech=np.zeros((2,count),np.float32) if speech is None else np.pad(speech,((0,0),(0,max(0,count-speech.shape[1]))))[:,:count]
    gain=np.ones(count,np.float32)
    if duck and np.any(speech):
        activity=uniform_filter1d(np.abs(speech).max(axis=0),size=960)>.004;gain=1-.75*uniform_filter1d(activity.astype(np.float32),size=4800)
    result=original*source_volume*gain+speech*speech_volume;peak=float(np.abs(result).max());limiter=min(1,.97/max(peak,1e-12));result*=limiter
    return result.astype(np.float32),{'originalVolume':source_volume,'speechVolume':speech_volume,'ducking':bool(duck and np.any(speech)),'minimumOriginalGain':float(gain.min()),'limiterGain':limiter}

def render_caption(directory,manifest):
    r=manifest['request'];source=manifest['source'];narration=manifest.get('narration');timing=manifest['captionTiming']
    for item in [source,timing,*([narration] if narration else [])]:
        if digest(item['path'])!=item['sha256']:raise ValueError('Caption source or timing changed.')
    length=narration['duration'] if narration else source['duration']
    if length>30.001:raise ValueError('Captioned video is limited to 30 seconds.')
    if narration and source['duration']+.001<length and not r['loopVideo']:raise ValueError('Enable looping or choose a longer video; speech is never silently trimmed.')
    fps=min(30,source['fps']);frames=math.ceil(length*fps-1e-7);duration=frames/fps;count=round(duration*48000);factor=min(1,math.sqrt(500000/(source['size'][0]*source['size'][1])));size=tuple(max(2,round(x*factor/2)*2) for x in source['size']);cues=r['captionCues']
    tiles=[];display=[];band=math.floor(size[1]*.65)
    for c in cues:
        text=(c['speaker']+': ' if r['speakerLabels'] and c.get('speaker') else '')+c['text'];tile,_=caption_tile(size,text,r['fontSize']) if r.get('burnCaptions',True) else (None,band);tiles.append(tile);display.append({**c,'text':text})
    original=audio_samples(source['path'],source['duration'],source.get('startTime',0)) if source.get('hasAudio') else None
    if original is not None and original.shape[1]<count:
        original=np.tile(original,(1,math.ceil(count/original.shape[1])))[:,:count] if r['loopVideo'] else np.pad(original,((0,0),(0,count-original.shape[1])))
    speech=audio_samples(narration['path'],narration['duration']) if narration else None
    mixed,mix=mix_sound(original,speech,count,r['sourceVolume'],r['speechVolume'] if narration else 0,r['duckOriginal'] and narration is not None);sf.write(directory/'output.wav',mixed.T,48000,subtype='PCM_16')
    loops=math.ceil(duration/source['duration']) if r['loopVideo'] else 1
    def pictures():
        index=0
        for cycle in range(loops):
            times=[];indices=[]
            while index<frames and (index/fps)//source['duration']==cycle:times.append(index/fps-cycle*source['duration']);indices.append(index);index+=1
            for i,image in zip(indices,sample_images(source['path'],times)):
                image=image.resize(size,Image.Resampling.LANCZOS);time=i/fps;cue_index=next((k for k,c in enumerate(cues) if c['start']<=time<c['end']),None)
                if cue_index is not None and r.get('burnCaptions',True):image=Image.alpha_composite(image.convert('RGBA'),tiles[cue_index]).convert('RGB')
                yield image
    encode(pictures(),directory/'preserved.mkv',size,fps,codec='ffv1');from video_media import decode_images
    encode(decode_images(directory/'preserved.mkv'),directory/'output.mp4',size,fps,mixed)
    meta={'method':'timed-captions-and-narration-v1','burnCaptions':r.get('burnCaptions',True),'frames':frames,'fps':fps,'duration':duration,'size':list(size),'protectedAboveY':band,'cues':display,'requestedCues':cues,'sourceSha256':source['sha256'],'timing':timing,'narrationSha256':narration['sha256'] if narration else None,'looped':bool(duration>source['duration']+.001),'mix':mix,'masterSha256':digest(directory/'preserved.mkv'),'audioSha256':digest(directory/'output.wav'),'note':'Captions and soundtrack only; no lip regeneration or invented video frames. Scripted dialogue has line timing, not phoneme alignment.'}
    (directory/'caption.json').write_text(json.dumps(meta,indent=2),encoding='utf-8')
    return duration,meta,display
