"""Bounded local video decoding, timestamp sampling, audio mixing and encoding."""
from fractions import Fraction
import hashlib, math
from pathlib import Path
import av
import numpy as np
from PIL import Image, ImageEnhance, ImageDraw, ImageFont

RATE=48000
SIZES={'landscape':(768,432),'portrait':(432,768),'square':(576,576)}
def digest(file):
    with Path(file).open('rb') as stream:return hashlib.file_digest(stream,'sha256').hexdigest()

def inspect(file,poster=None):
    times=[]
    with av.open(str(file)) as media:
        if not media.streams.video:raise ValueError('Choose a file with a video stream.')
        stream=media.streams.video[0]
        if stream.width*stream.height>2_100_000:raise ValueError('Footage is limited to 1080p in this stage.')
        for frame in media.decode(stream):
            if frame.width*frame.height>2_100_000:raise ValueError('A video frame exceeds the 1080p input limit.')
            if frame.time is None:raise ValueError('Video frames need timestamps.')
            times.append(float(frame.time))
            if len(times)==1 and poster:frame.to_image().save(poster,quality=88)
            if len(times)>1800 or times[-1]-times[0]>60:raise ValueError('Footage is limited to 60 seconds and 1,800 frames.')
        if not times or any(b<=a for a,b in zip(times,times[1:])):raise ValueError('Video timestamps are empty or out of order.')
        step=float(np.median(np.diff(times))) if len(times)>1 else 1/float(stream.average_rate or 24)
        fps=1/step
        if not 1<=fps<=60.1:raise ValueError('Choose footage between 1 and 60 fps.')
        if times[-1]-times[0]+step>60.001:raise ValueError('Footage is limited to 60 seconds.')
        return {'size':[stream.width,stream.height],'frames':len(times),'fps':fps,'duration':times[-1]-times[0]+step,'startTime':times[0],'variableRate':bool(len(times)>2 and max(np.abs(np.diff(times)-step))>.005),'hasAudio':bool(media.streams.audio),'sha256':digest(file)}

def sample_images(file,timestamps):
    with av.open(str(file)) as media:
        decoder=iter(media.decode(video=0));current=next(decoder);origin=float(current.time or 0)
        following=next(decoder,None)
        for timestamp in timestamps:
            while following is not None and float(following.time or 0)-origin<=timestamp+1e-7:
                current=following;following=next(decoder,None)
            yield current.to_image().convert('RGB')

def decode_images(file):
    with av.open(str(file)) as media:
        for frame in media.decode(video=0):yield frame.to_image().convert('RGB')

def audio_samples(file,duration,origin=0):
    output=np.zeros((2,math.ceil(duration*RATE)),dtype=np.float32)
    with av.open(str(file)) as media:
        if not media.streams.audio:return None
        stream=media.streams.audio[0];resampler=av.AudioResampler(format='fltp',layout='stereo',rate=RATE);cursor=0
        for decoded in media.decode(stream):
            if decoded.time is not None and float(decoded.time)-origin>duration+1:break
            for frame in resampler.resample(decoded):
                data=frame.to_ndarray();start=round((float(frame.time)-origin)*RATE) if frame.time is not None else cursor;cursor=start+data.shape[1]
                a=max(0,start);b=min(output.shape[1],start+data.shape[1])
                if b>a:output[:,a:b]=data[:,a-start:b-start]
            if cursor>output.shape[1]+RATE:break
        for frame in resampler.resample(None):
            data=frame.to_ndarray();start=cursor;a=max(0,start);b=min(output.shape[1],start+data.shape[1])
            if b>a:output[:,a:b]=data[:,a-start:b-start]
            cursor+=data.shape[1]
    return output

def encode(images,output,size,fps,audio=None,codec='libx264'):
    output=Path(output);partial=output.with_name(output.stem+'.partial'+output.suffix);count=0
    frame_rate=Fraction(str(fps)).limit_denominator(1000000)
    try:
        with av.open(str(partial),'w') as movie:
            video=movie.add_stream(codec,rate=frame_rate);video.width,video.height=size;video.pix_fmt='bgr0' if codec=='ffv1' else 'yuv420p';video.options={} if codec=='ffv1' else {'crf':'18','preset':'fast'}
            sound=movie.add_stream('aac',rate=RATE) if audio is not None else None
            if sound:sound.layout='stereo'
            cursor=0
            def emit_audio(until):
                nonlocal cursor
                if sound is None:return
                until=min(audio.shape[1],until)
                while cursor+1024<=until:
                    data=np.ascontiguousarray(audio[:,cursor:cursor+1024]);frame=av.AudioFrame.from_ndarray(data,format='fltp',layout='stereo');frame.sample_rate=RATE;frame.pts=cursor;frame.time_base=Fraction(1,RATE)
                    for packet in sound.encode(frame):movie.mux(packet)
                    cursor+=data.shape[1]
            for image in images:
                frame=av.VideoFrame.from_image(image);frame.pts=count;frame.time_base=Fraction(1,1)/frame_rate
                for packet in video.encode(frame):movie.mux(packet)
                count+=1;emit_audio(round(count/fps*RATE))
            if sound is not None:
                end=min(audio.shape[1],round(count/fps*RATE));emit_audio(end)
                if cursor<end:
                    frame=av.AudioFrame.from_ndarray(np.ascontiguousarray(audio[:,cursor:end]),format='fltp',layout='stereo');frame.sample_rate=RATE;frame.pts=cursor;frame.time_base=Fraction(1,RATE)
                    for packet in sound.encode(frame):movie.mux(packet)
                for packet in sound.encode():movie.mux(packet)
            for packet in video.encode():movie.mux(packet)
        partial.replace(output)
    except Exception:
        raise
    return count

def crop_image(image,size,x=.5,y=.5):
    ratio=size[0]/size[1];width=min(image.width,image.height*ratio);height=width/ratio
    left=(image.width-width)*x;top=(image.height-height)*y
    return image.crop((round(left),round(top),round(left+width),round(top+height))).resize(size,Image.Resampling.LANCZOS)

def grade_image(image,grade,exposure=1,saturation=1):
    image=ImageEnhance.Brightness(image).enhance(exposure)
    if grade=='noir':return image.convert('L').convert('RGB')
    image=ImageEnhance.Color(image).enhance(saturation)
    if grade!='original':
        rgb=np.asarray(image,dtype=np.float32)/255
        if grade=='warm':rgb=rgb*np.array([1.08,1.01,.89])+np.array([.015,0,0])
        elif grade=='cool':rgb=rgb*np.array([.90,1.01,1.10])+np.array([0,0,.01])
        elif grade=='teal-orange':
            light=rgb.mean(axis=2,keepdims=True);rgb+=np.where(light>.5,np.array([.06,.01,-.04]),np.array([-.03,.025,.04]))
        image=Image.fromarray(np.clip(rgb*255,0,255).astype(np.uint8))
    return image

def caption_image(image,text):
    if not text:return image
    draw=ImageDraw.Draw(image);font=ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf',max(14,round(image.width/26)))
    lines=[];line=''
    for word in text.split():
        candidate=(line+' '+word).strip()
        if draw.textlength(candidate,font=font)>image.width*.86 and line:lines.append(line);line=word
        else:line=candidate
    if line:lines.append(line)
    lines=lines[:4];step=round(font.size*1.4);height=len(lines)*step+24;top=image.height-height-18
    draw.rounded_rectangle((image.width*.04,top,image.width*.96,image.height-18),radius=10,fill='#111318')
    for i,line in enumerate(lines):draw.text(((image.width-draw.textlength(line,font=font))/2,top+10+i*step),line,font=font,fill='white')
    return image
