"""Assemble checked takes, synchronized audio and timed visual layers locally."""
import argparse
import hashlib
import json
import math
import subprocess
import numpy as np
from collections import deque
from pathlib import Path
import sys
sys.path.insert(0,str(Path(__file__).resolve().parent))
import av
from PIL import Image, ImageOps, ImageDraw, ImageFont
from studio_fonts import studio_font
from video_media import inspect, digest, sample_images, audio_samples, encode, SIZES, RATE


def number(value, name):
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
        raise ValueError(f'{name} must be a finite number.')
    return value


def plan(shots, fps):
    metadata = []
    elapsed = 0
    cursor = 0
    if not shots or len(shots) > 20:
        raise ValueError('Draft exports support 1â€“20 shots.')
    for index, shot in enumerate(shots):
        source_path = Path(shot['path'])
        if shot.get('sha256'):
            with source_path.open('rb') as handle:
                if hashlib.file_digest(handle, 'sha256').hexdigest() != shot['sha256']:
                    raise ValueError('A source clip changed since its media check.')
        info=inspect(source_path)
        source_fps,source_frames,duration=info['fps'],info['frames'],info['duration']
        start = number(shot.get('trimStart', 0), 'Start')
        end = duration if shot.get('trimEnd') is None else number(shot['trimEnd'], 'End')
        if not 0 <= start < end <= duration or end - start < 1 / fps:
            raise ValueError('Trim range must keep at least one frame within the source clip.')
        transition = shot.get('transition', 'cut')
        seconds = number(shot.get('transitionSeconds', .5), 'Crossfade length')
        if transition not in ('cut', 'crossfade') or not 1 / fps <= seconds <= 2:
            raise ValueError('Choose a cut or a crossfade of 0.042â€“2 seconds.')
        overlap = math.floor(seconds * fps + .5) if index and transition == 'crossfade' else 0
        elapsed += end - start
        boundary = math.floor(elapsed * fps + .5)
        frames = boundary - cursor
        cursor = boundary
        metadata.append({'path':str(source_path), 'jobId':shot['jobId'], 'sourceFrames':source_frames,
                         'sourceFps':source_fps, 'sourceDuration':duration, 'sourceStart':info['startTime'], 'sha256':info['sha256'], 'hasAudio':info['hasAudio'], 'volume':shot.get('volume',1), 'fadeIn':shot.get('fadeIn',0), 'fadeOut':shot.get('fadeOut',0), 'frames':frames, 'trimStart':start, 'trimEnd':end,
                         'transition':transition if index else 'cut', 'overlapFrames':overlap})
    timeline_cursor = 0
    for index, item in enumerate(metadata):
        outgoing = metadata[index+1]['overlapFrames'] if index+1 < len(metadata) else 0
        if item['overlapFrames'] + outgoing > item['frames']:
            raise ValueError('Crossfades overlap inside a shot. Shorten the fades or keep more of the shot.')
        timeline_cursor -= item['overlapFrames']
        item['timelineStartFrame'] = timeline_cursor
        timeline_cursor += item['frames']
        item['timelineEndFrame'] = timeline_cursor
    if timeline_cursor > 120 * fps:
        raise ValueError('Draft exports support up to two minutes.')
    return metadata, timeline_cursor


def shot_images(item, size, fps):
    for image in sample_images(item['path'],(min(item['trimEnd']-1e-9,item['trimStart']+i/fps) for i in range(item['frames']))):
        image=ImageOps.contain(image,size);canvas=Image.new('RGB',size,'black');canvas.paste(image,((size[0]-image.width)//2,(size[1]-image.height)//2));yield canvas


def envelope(samples,fade_in,fade_out):
    gain=np.ones(samples,dtype=np.float32)
    for seconds,reverse in [(fade_in,False),(fade_out,True)]:
        count=min(samples,round(seconds*RATE))
        if count:
            ramp=np.linspace(0,1,count,dtype=np.float32)
            if reverse:gain[-count:]*=ramp[::-1]
            else:gain[:count]*=ramp
    return gain


def mix_audio(metadata,tracks,total,fps,directory,warnings):
    mix=np.zeros((2,round(total/fps*RATE)),dtype=np.float32);sources=[]
    def add(samples,start,count,volume,fade_in=0,fade_out=0):
        if samples is None:return
        length=min(count,mix.shape[1]-start);data=np.zeros((2,length),dtype=np.float32);keep=min(length,samples.shape[1]);data[:,:keep]=samples[:,:keep];data*=envelope(length,fade_in,fade_out)*volume;mix[:,start:start+length]+=data
    for index,item in enumerate(metadata):
        if not item['hasAudio'] or not item['volume']:continue
        samples=audio_samples(item['path'],item['sourceDuration'],item['sourceStart']);begin=round(item['trimStart']*RATE);count=round(item['frames']/fps*RATE);samples=samples[:,begin:begin+count]
        samples=samples*envelope(samples.shape[1],item['fadeIn'],item['fadeOut'])
        outgoing=metadata[index+1]['overlapFrames']/fps if index+1<len(metadata) else 0
        add(samples,round(item['timelineStartFrame']/fps*RATE),count,item['volume'],item['overlapFrames']/fps,outgoing)
        sources.append({'kind':'source','jobId':item['jobId'],'start':item['timelineStartFrame']/fps,'end':item['timelineEndFrame']/fps,'sourceStart':item['trimStart'],'volume':item['volume']})
    for track in tracks:
        filename=Path(track.get('path',''))
        if track['type']=='narration':
            manifest=directory/('speech-'+track['id']+'.json');manifest.write_text(json.dumps({'request':{'narration':track['narration'],'voice':track['voice']}}),encoding='utf-8');filename=manifest.with_suffix('.wav')
            subprocess.run(['powershell.exe','-NoProfile','-File',str(Path(__file__).with_name('narration.ps1')),'-Manifest',str(manifest),'-Output',str(filename)],check=True,capture_output=True,timeout=90)
        with av.open(str(filename)) as media:
            duration=float(media.duration or 0)/1000000
        if duration<=0 or duration>180:raise ValueError('Audio duration is unsupported.')
        before=digest(filename);samples=audio_samples(filename,duration);begin=round(track['trimStart']*RATE);samples=samples[:,begin:]
        if not samples.shape[1]:raise ValueError('Audio source trim starts beyond the recording.')
        count=round((track['end']-track['start'])*RATE)
        if track['loop']:samples=np.tile(samples,(1,math.ceil(count/samples.shape[1])))
        elif samples.shape[1]>count+RATE*.05:warnings.append(track['label']+': audio is trimmed at the track end.')
        elif samples.shape[1]<count- RATE*.05:warnings.append(track['label']+': recording ends before its track; the remainder is silent.')
        add(samples,round(track['start']*RATE),count,track['volume'],track['fadeIn'],track['fadeOut'])
        if digest(filename)!=before:raise ValueError('Audio changed during the export.')
        sources.append({'kind':track['type'],'id':track['id'],'sha256':before,'start':track['start'],'end':track['end'],'volume':track['volume'],'loop':track['loop']})
    peak=float(np.max(np.abs(mix)))
    if peak>.98:mix*=.98/peak;warnings.append('Audio mix peak-limited to prevent clipping.')
    return (mix if peak>.0001 else None),sources


def text_layer(image,layer):
    draw=ImageDraw.Draw(image);font=studio_font(int(layer['fontSize']));lines=[];line=''
    for character in layer['text']:
        if character=='\n' or (line and draw.textlength(line+character,font=font)>image.width*.88):lines.append(line);line='' if character=='\n' else character
        else:line+=character
    if line:lines.append(line)
    step=round(font.size*1.35);height=len(lines)*step+16
    if height>image.height*.8:raise ValueError('Text does not fit this format. Shorten it or reduce its font size.')
    y=16 if layer['position']=='top' else (image.height-height)//2 if layer['position']=='center' else image.height-height-16
    draw.rounded_rectangle((image.width*.03,y,image.width*.97,y+height),radius=8,fill='#111318')
    for index,line in enumerate(lines):draw.text(((image.width-draw.textlength(line,font=font))/2,y+6+index*step),line,font=font,fill='white')
    return image


def render(shots, output, size=(768,432), fps=24, film=None):
    output=Path(output);output.parent.mkdir(parents=True,exist_ok=True);film=film or {'tracks':[],'texts':[],'overlays':[]}
    if 'aspect' in film:size=SIZES[film['aspect']]
    metadata,total=plan(shots,fps);duration=total/fps;warnings=[]
    for layer in film.get('tracks',[])+film.get('texts',[])+film.get('overlays',[]):
        if not 0<=layer['start']<layer['end']<=duration+.001:raise ValueError('A timed layer extends beyond the film. Adjust its start or end.')
    overlays=[];provenance={}
    for layer in film.get('overlays',[]):
        filename=Path(layer['path']);provenance[str(filename)]=digest(filename);stamp=ImageOps.exif_transpose(Image.open(filename)).convert('RGBA');width=round(size[0]*layer['width']);height=round(stamp.height*width/stamp.width)
        if round(size[1]*layer['y'])+height>size[1]:raise ValueError('Overlay extends below the frame. Reduce its size or Y position.')
        stamp=stamp.resize((width,height),Image.Resampling.LANCZOS);stamp.putalpha(stamp.getchannel('A').point(lambda a:round(a*layer['opacity'])));overlays.append((layer,stamp))
    audio,audio_sources=mix_audio(metadata,film.get('tracks',[]),total,fps,output.parent,warnings)
    def base_images():
        tail=deque()
        for index,item in enumerate(metadata):
            images=iter(shot_images(item,size,fps));overlap=item['overlapFrames'];assert len(tail)==overlap
            for fade_index in range(overlap):yield Image.blend(tail.popleft(),next(images),(fade_index+1)/(overlap+1))
            outgoing=metadata[index+1]['overlapFrames'] if index+1<len(metadata) else 0
            for image in images:
                tail.append(image)
                if len(tail)>outgoing:yield tail.popleft()
        assert not tail
    def layered_images():
        for index,image in enumerate(base_images()):
            time=index/fps
            for layer,stamp in overlays:
                if layer['start']<=time<layer['end']:image.paste(stamp,(round(layer['x']*size[0]),round(layer['y']*size[1])),stamp)
            for layer in film.get('texts',[]):
                if layer['start']<=time<layer['end']:image=text_layer(image,layer)
            yield image
    encoded=encode(layered_images(),output,size,fps,audio)
    if encoded!=total:raise ValueError('Unexpected assembled frame count.')
    if any(digest(item['path'])!=item['sha256'] for item in metadata):raise ValueError('A source changed during export.')
    if any(digest(file)!=checksum for file,checksum in provenance.items()):raise ValueError('An overlay changed during export.')
    def stamp(seconds):
        ms=round(seconds*1000);return f'{ms//3600000:02}:{ms//60000%60:02}:{ms//1000%60:02},{ms%1000:03}'
    subtitles=sorted((t for t in film.get('texts',[]) if t['position']=='bottom'),key=lambda t:t['start'])
    output.with_name('subtitles.srt').write_text('\n\n'.join(str(i+1)+'\n'+stamp(t['start'])+' --> '+stamp(t['end'])+'\n'+t['text'] for i,t in enumerate(subtitles)),encoding='utf-8')
    return {'frames':total,'size':list(size),'fps':fps,'duration':duration,'shots':[{k:v for k,v in item.items() if k!='path'} for item in metadata],'audio':audio is not None,'hasAudio':audio is not None,'audioSources':audio_sources,'warnings':warnings,'provenance':provenance,'texts':film.get('texts',[]),'overlays':[{k:v for k,v in layer.items() if k!='path'} for layer in film.get('overlays',[])],'transition':'cuts and crossfades','creativeReview':'pending'}


if __name__ == '__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('manifest', type=Path)
    parser.add_argument('output', type=Path)
    args=parser.parse_args()
    manifest=json.loads(args.manifest.read_text(encoding='utf-8'))
    result=render(manifest if isinstance(manifest,list) else manifest['shots'],args.output,film=None if isinstance(manifest,list) else manifest.get('film'))
    args.output.with_name('assembly.json').write_text(json.dumps(result, indent=2), encoding='utf-8')
    print(json.dumps(result))
