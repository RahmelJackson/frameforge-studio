"""Edit existing footage or prepare/finalize bounded native Comfy video graphs."""
import argparse, json, math, subprocess, sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageOps
from video_media import inspect, digest, sample_images, audio_samples, encode, crop_image, grade_image, caption_image, SIZES, RATE

def prepare_masks(manifest,directory):
    if manifest['request'].get('selectionMode')=='segment':
        from neural_masks import import_masks
        return import_masks(manifest,directory)
    automatic=manifest['request'].get('selectionMode')=='clothing'
    python=sys.executable if automatic else manifest['visionPython'];script='clothing_masks.py' if automatic else 'vision_tools.py';args=[str(directory)] if automatic else ['track',str(directory)]
    result=subprocess.run([python,str(Path(__file__).with_name(script)),*args],capture_output=True,text=True,encoding='utf-8',timeout=240)
    if result.returncode:raise ValueError(result.stderr[-1200:] or 'Mask preparation failed.')

def render(manifest,directory,phase='render'):
    if manifest['request']['tool']=='pose-guide':
        result=subprocess.run([manifest['visionPython'],str(Path(__file__).with_name('human_pose.py')),str(directory)],capture_output=True,text=True,encoding='utf-8',timeout=120)
        if result.returncode:raise ValueError(result.stderr[-1600:] or 'Body-pose detection failed.')
        return json.loads(result.stdout)
    if manifest['request']['tool']=='segment' and phase=='finalize':
        from neural_masks import finalize
        return finalize(manifest,directory)
    r=manifest['request'];tool=r['tool'];source=manifest.get('source');assets=Path(manifest['assets']);source_info=None
    if tool=='upscale' and r.get('upscaleMode')=='faithful':
        from video_upscale import render as resize
        return resize(manifest,directory)
    if tool=='reframe':
        result=subprocess.run([manifest['visionPython'],str(Path(__file__).with_name('video_reframe.py')),str(directory)],capture_output=True,text=True,encoding='utf-8',timeout=240)
        if result.returncode:raise ValueError(result.stderr[-1600:] or 'Subject crop failed.')
        return json.loads(result.stdout)
    if tool=='extend':
        from video_extend import process as extend
        return extend(manifest,directory,phase)
    if tool=='outpaint' and r.get('outpaintMode')=='track-still':
        from track_still_border import render as track_border
        return track_border(manifest,directory)
    if tool=='outpaint':
        from video_outpaint import process as outpaint
        return outpaint(manifest,directory,phase)
    inputs={name:assets/name for name in [r.get('reference'),r.get('overlay'),r.get('mask'),*[c['asset'] for c in r.get('cards',[])]] if name}
    if manifest.get('audioPath'):inputs['soundtrack']=Path(manifest['audioPath'])
    provenance={name:digest(file) for name,file in inputs.items()}
    if phase=='finalize':
        if manifest.get('lightingProposal') and digest(directory/'raw.mp4')!=manifest['lightingProposal']['sha256']:raise ValueError('The reused lighting proposal changed before finalization.')
        prepared=json.loads((directory/'prepared.json').read_text(encoding='utf-8'))
        if prepared.get('provenance',{})!=provenance:raise ValueError('An image or soundtrack changed after preparation.')
        if prepared.get('inputSha256') and digest(directory/'input.mp4')!=prepared['inputSha256']:raise ValueError('Prepared footage changed before finalization.')
        if prepared.get('maskVideoSha256') and digest(directory/'mask.mp4')!=prepared['maskVideoSha256']:raise ValueError('Prepared mask video changed before finalization.')
        raw_info=inspect(directory/'raw.mp4')
        raw_size=[v*2 for v in prepared['size']] if tool=='upscale' else prepared['size']
        expected_raw_frames=(prepared['frames']-1)*2+1 if tool=='interpolate' else prepared['frames'];expected_raw_fps=prepared['fps']*(2 if tool=='interpolate' else 1)
        if raw_info['frames']!=expected_raw_frames or raw_info['size']!=raw_size or abs(raw_info['fps']-expected_raw_fps)>.01:raise ValueError('The model output does not match the prepared frame count, dimensions or timing.')
    if source:
        if digest(source['path'])!=source['sha256']:raise ValueError('Source media changed since inspection.')
        source_info=source
    story=tool=='story';gpu=tool in ['upscale','restyle','relight','masked','interpolate','motion','segment']
    if story:
        fps=24;size=SIZES[r['aspect']];frames=sum(round(c['seconds']*fps) for c in r['cards']);start=0;duration=frames/fps
    else:
        start=r['start'];end=min(source['duration'],r['end'] if r['end'] is not None else source['duration'])
        if not 0<=start<end<=source['duration'] or end-start<.125:raise ValueError('Keep at least 0.125 seconds inside the source clip.')
        fps=source['fps'] if tool in ['interpolate','recolor'] else 16 if gpu and tool!='upscale' else 24
        duration=end-start;frames=max(1,round(duration*fps));size=SIZES[r['aspect']]
        if gpu:
            if tool in ['upscale','interpolate']:
                if duration>3.4:raise ValueError('Interpolation previews are limited to 3.4 seconds.' if tool=='interpolate' else 'AI upscale previews are limited to 3.4 seconds.')
                if tool=='interpolate' and (source.get('variableRate') or fps>30.01 or frames<2):raise ValueError('Interpolation needs at least two frames of constant-rate footage, up to 30 fps.')
                factor=min(1,math.sqrt(500000/(source['size'][0]*source['size'][1])));size=tuple(max(2,int(v*factor)//2*2) for v in source['size'])
            else:
                frames=1+4*math.floor((min(49,math.floor(duration*fps))-1)/4)
                if frames<9:raise ValueError('Temporal editing needs at least 0.6 seconds of footage.')
                ratio=source['size'][0]/source['size'][1];size=(512,288) if ratio>1.3 else (288,512) if ratio<.77 else (384,384)
            duration=frames/fps
        if duration>30:raise ValueError('Keep edits within 30 seconds.')
    warnings=[];audio=None
    if source and source.get('hasAudio'):
        original=audio_samples(source['path'],source['duration'],source.get('startTime',0));begin=round(start*RATE);audio=original[:,begin:begin+round(duration*RATE)]*r['volume']
    def add_audio(samples,volume):
        nonlocal audio
        if samples is None:return
        count=round(duration*RATE)
        if audio is None:audio=np.zeros((2,count),dtype=np.float32)
        if audio.shape[1]<count:audio=np.pad(audio,((0,0),(0,count-audio.shape[1])))
        end=min(count,samples.shape[1]);audio[:,:end]+=samples[:,:end]*volume
    if manifest.get('audioPath'):add_audio(audio_samples(manifest['audioPath'],60),r['audioVolume'])
    if r.get('narration'):
        speech=directory/'narration.wav'
        if not speech.exists():
            subprocess.run(['powershell.exe','-NoProfile','-File',str(Path(__file__).with_name('narration.ps1')),'-Manifest',str(directory/'manifest.json'),'-Output',str(speech)],check=True,capture_output=True,timeout=90)
        with __import__('av').open(str(speech)) as speech_file:
            speech_seconds=float(speech_file.duration or 0)/1000000
        if speech_seconds>duration+.05:warnings.append('Narration extends beyond the clip and was trimmed. Lengthen the scenes or shorten the script.')
        add_audio(audio_samples(speech,max(duration,speech_seconds)),1)
    if audio is not None:
        audio=np.pad(audio,((0,0),(0,max(0,round(duration*RATE)-audio.shape[1]))))[:,:round(duration*RATE)]
        peak=float(np.max(np.abs(audio)))
        if peak>.98:audio=audio*.98/peak;warnings.append('Audio mix was peak-limited to prevent clipping.')
    expected_audio=audio is not None and float(np.max(np.abs(audio)))>.0001
    if tool=='recolor' and phase=='render':
        if duration>10:raise ValueError('Tracked material previews are limited to 10 seconds.')
        factor=min(1,(500000/(source['size'][0]*source['size'][1]))**.5);size=tuple(max(2,int(v*factor)//2*2) for v in source['size'])
        bases=[crop_image(im,size,r['cropX'],r['cropY']) for im in sample_images(source['path'],(start+i/fps for i in range(frames)))]
        encode(bases,directory/'input.mp4',size,fps)
        tracking_data={'frames':frames,'fps':fps,'size':list(size),'provenance':provenance,'inputSha256':digest(directory/'input.mp4')}
        (directory/'prepared.json').write_text(json.dumps(tracking_data,indent=2),encoding='utf-8')
        prepare_masks(manifest,directory)
        from material_color import recolor
        masks=[Image.open(directory/'masks'/f'{i:04d}.png').convert('L') for i in range(frames)]
        final_images=[recolor(im,mask,r['materialColor'],r['materialStrength']) for im,mask in zip(bases,masks)]
        encode(final_images,directory/'preserved.mkv',size,fps,audio,codec='ffv1')
        material={'method':'linear-luminance-material-chroma-v1','color':r['materialColor'],'strength':r['materialStrength'],'maskSha256':json.loads((directory/'tracking.json').read_text())['maskSha256'],'note':'Conventional color replacement; the mask determines the material. Brightness and folds come from the source.'}
        (directory/'material.json').write_text(json.dumps(material,indent=2),encoding='utf-8')
    elif phase=='finalize':
        prepared=json.loads((directory/'prepared.json').read_text(encoding='utf-8'));fps=prepared['fps'];frames=prepared['frames'];size=tuple(v*2 for v in prepared['size']) if tool=='upscale' else tuple(prepared['size'])
        images=sample_images(directory/'raw.mp4',(i/fps for i in range(frames)))
        restrained=tool=='relight' and r.get('relightMode')=='preserve'
        if tool=='interpolate':
            from video_media import decode_images
            if digest(Path(__file__).resolve().parents[1]/manifest['interpolationModel']['path'])!=manifest['interpolationModel']['sha256']:raise ValueError('Interpolation model changed during processing.')
            original=[crop_image(im,size,r['cropX'],r['cropY']) for im in sample_images(source['path'],(start+i/fps for i in range(frames)))]
            candidates=list(decode_images(directory/'raw.mp4'));final_images=[];cuts=[];held=[];risks=None
            if r.get('motionSafety','off')!='off':
                risks=json.loads((directory/'motion-risks.json').read_text())
                if digest(directory/'motion-risks.json')!=prepared['motionAnalysisSha256'] or risks['inputSha256']!=prepared['inputSha256']:raise ValueError('Motion risk evidence changed.')
                if risks['uncertainPairs']:warnings.append(str(len(risks['uncertainPairs']))+' intervals have fast or inconsistent optical flow; inspect occlusion boundaries.')
            for i,base in enumerate(original):
                final_images.append(base)
                if i<frames-1:
                    difference=float(np.mean(np.abs(np.asarray(base).astype(float)-np.asarray(original[i+1]).astype(float)))/255)
                    if difference>.28:cuts.append(i);final_images.append(base.copy())
                    elif risks and r.get('motionSafety')=='hold' and i in risks['uncertainPairs']:held.append(i);final_images.append(base.copy())
                    else:final_images.append(candidates[2*i+1])
                else:final_images.append(base.copy())
            source_frames=frames;fps*=2;frames*=2
            interpolation={'method':'native-'+r.get('interpolationModel','film')+'-2x-v1','multiplier':2,'sourceFrames':source_frames,'sourceFps':fps/2,'model':manifest['interpolationModel'],'rawSha256':digest(directory/'raw.mp4'),'cutPairs':cuts,'cutThreshold':.28,'endpointHoldFrames':1,'note':'Original frames restored at even positions. One terminal hold frame preserves the source duration; detected hard cuts hold the earlier frame.'}
            interpolation.update({'heldPairs':held,'uncertainPairs':risks['uncertainPairs'] if risks else [],'motionSafety':r.get('motionSafety','off'),'motionAnalysisSha256':prepared.get('motionAnalysisSha256')})
            if held:warnings.append(str(len(held))+' uncertain intervals held the earlier source frame. This avoids interpolation artifacts at the cost of judder.')
            encode(final_images,directory/'preserved.mkv',size,fps,audio,codec='ffv1')
            (directory/'interpolation.json').write_text(json.dumps(interpolation,indent=2),encoding='utf-8')
        elif tool=='masked' or restrained:
            decoded=sample_images(source['path'],(start+i/fps for i in range(frames)))
            original=[]
            for i,image in enumerate(decoded):
                t=i/max(1,frames-1);original.append(crop_image(image,size,r['cropX']+(r['cropEndX']-r['cropX'])*t,r['cropY']+(r['cropEndY']-r['cropY'])*t))
            if restrained:
                from illumination import lighting_field,apply_field
                candidates=list(images)
                if len(candidates)!=frames or len(original)!=frames:raise ValueError('Lighting candidate is truncated.')
                fields=[];final_images=[];clipped=[];previous=None
                for base,candidate in zip(original,candidates):
                    field=lighting_field(base,candidate,r['relightStrength'],r['relightMaxEV'],previous,fps)
                    image,clip=apply_field(base,field);final_images.append(image);fields.append(field);clipped.append(clip);previous=field
                np.savez_compressed(directory/'relight-fields.npz',ev=np.stack(fields))
                lighting={'method':'bounded-smooth-neutral-luminance-v1','strength':r['relightStrength'],'maxEV':r['relightMaxEV'],'correctionRateEVPerSecond':.5,'candidateSha256':digest(directory/'raw.mp4'),'proposalJobId':r.get('lightingProposal'),'fieldsSha256':digest(directory/'relight-fields.npz'),'maximumClippedFraction':max(clipped),'note':'AI proposes lighting. Only its broad luminance field is transferred to original pixels; light direction and shadow realism need visual review.'}
                (directory/'relighting.json').write_text(json.dumps(lighting,indent=2),encoding='utf-8')
            elif prepared.get('hasMaskVideo'):
                tracking=json.loads((directory/'tracking.json').read_text(encoding='utf-8'))
                if len(tracking['maskSha256'])!=frames or any(digest(directory/'masks'/f'{i:04d}.png')!=value for i,value in enumerate(tracking['maskSha256'])):raise ValueError('A saved mask frame changed after preparation.')
                masks=[Image.open(directory/'masks'/f'{i:04d}.png').convert('L') for i in range(frames)]
            else:
                from PIL import ImageDraw
                mask=Image.new('L',size,0);x,y,w,h=r['region'];ImageDraw.Draw(mask).rectangle((round(x*size[0]),round(y*size[1]),round((x+w)*size[0])-1,round((y+h)*size[1])-1),fill=255);masks=[mask]*frames
            if not restrained:final_images=[Image.composite(changed,base,mask) for base,changed,mask in zip(original,images,masks)]
            if len(final_images)!=frames:raise ValueError('The masked candidate is truncated.')
            encode(final_images,directory/'preserved.mkv',size,fps,audio,codec='ffv1')
        else:final_images=images
    elif story:
        def story_images():
            for card in r['cards']:
                file=assets/card['asset'];image=ImageOps.exif_transpose(Image.open(file)).convert('RGB');count=round(card['seconds']*fps)
                for i in range(count):
                    zoom=1+.05*i/max(1,count-1);base=crop_image(image,size);w,h=int(size[0]*zoom),int(size[1]*zoom);base=base.resize((w,h),Image.Resampling.LANCZOS);base=base.crop(((w-size[0])//2,(h-size[1])//2,(w+size[0])//2,(h+size[1])//2));yield caption_image(base,card['caption'])
        final_images=story_images()
    else:
        raw=sample_images(source['path'],(start+i/fps for i in range(frames)))
        overlay=ImageOps.exif_transpose(Image.open(assets/r['overlay'])).convert('RGBA') if r.get('overlay') else None
        def finished_images():
            for i,image in enumerate(raw):
                t=i/max(1,frames-1);image=crop_image(image,size,r['cropX']+(r['cropEndX']-r['cropX'])*t,r['cropY']+(r['cropEndY']-r['cropY'])*t)
                if phase!='prepare':
                    image=grade_image(image,r['grade'],r['exposure'],r['saturation']);image=caption_image(image,r['caption'])
                    if overlay:
                        stamp=overlay.copy();stamp.thumbnail((size[0]//4,size[1]//4));image.paste(stamp,(size[0]-stamp.width-16,16),stamp)
                if phase=='prepare' and tool=='motion' and r.get('motionGuide','edges')=='edges':
                    from scipy.ndimage import sobel
                    gray=np.asarray(image.convert('L'),dtype=float);edge=(np.hypot(sobel(gray,axis=0),sobel(gray,axis=1))>100).astype(np.uint8)*255;image=Image.fromarray(np.repeat(edge[:,:,None],3,axis=2))
                yield image
        final_images=finished_images()
    destination=directory/('input.mp4' if phase=='prepare' else 'output.mp4')
    encoded=encode(final_images,destination,size,fps,audio)
    if encoded!=frames:raise ValueError('The renderer produced an unexpected frame count.')
    if source and digest(source['path'])!=source['sha256']:raise ValueError('Source changed during processing.')
    if manifest.get('editModel') and digest(manifest['editModel']['path'])!=manifest['editModel']['sha256']:raise ValueError('Video edit model changed during processing.')
    binding=r.get('keyframeBinding')
    if binding and digest(assets/r['reference'])!=binding['sha256']:raise ValueError('Appearance keyframe changed.')
    if any(digest(inputs[name])!=checksum for name,checksum in provenance.items()):raise ValueError('An image or soundtrack changed during processing.')
    data={'frames':frames,'fps':fps,'size':list(size),'duration':frames/fps,'hasAudio':expected_audio,'warnings':warnings,'sourceSha256':source.get('sha256') if source else None,'sourceRange':[start,start+duration] if source else None,'provenance':provenance}
    if phase=='prepare':data['inputSha256']=digest(destination)
    if phase=='prepare' and tool=='interpolate' and r.get('motionSafety','off')!='off':
        result=subprocess.run([manifest['visionPython'],str(Path(__file__).with_name('vision_tools.py')),'motion',str(directory)],capture_output=True,text=True,encoding='utf-8',timeout=90)
        if result.returncode:raise ValueError(result.stderr[-1200:] or 'Motion risk measurement failed.')
        data['motionAnalysisSha256']=digest(directory/'motion-risks.json')
    if phase=='prepare' and tool=='masked' and (r.get('mask') or r.get('trackMask') or r.get('feather') or r.get('selectionMode') in ['clothing','segment']):
        (directory/'prepared.json').write_text(json.dumps(data,indent=2),encoding='utf-8')
        prepare_masks(manifest,directory)
        data['hasMaskVideo']=True;data['maskVideoSha256']=digest(directory/'mask.mp4')
    if phase=='finalize' and (tool=='masked' or tool=='relight' and r.get('relightMode')=='preserve'):data['losslessSha256']=digest(directory/'preserved.mkv')
    if phase=='finalize' and tool=='relight' and r.get('relightMode')=='preserve':data['relighting']=lighting
    if tool=='recolor':data.update({'material':material,'losslessSha256':digest(directory/'preserved.mkv')})
    if phase=='finalize' and tool=='interpolate':data.update({'interpolation':interpolation,'losslessSha256':digest(directory/'preserved.mkv')})
    (directory/('prepared.json' if phase=='prepare' else 'expected.json')).write_text(json.dumps(data,indent=2),encoding='utf-8')
    if phase!='prepare':(directory/'completed.json').write_text(json.dumps({'sha256':digest(destination)}),encoding='utf-8')
    return data

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('directory');p.add_argument('--phase',choices=['render','prepare','finalize'],default='render');args=p.parse_args();directory=Path(args.directory)
    print(json.dumps(render(json.loads((directory/'manifest.json').read_text(encoding='utf-8')),directory,args.phase)))
