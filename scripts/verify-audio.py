"""Independent output decoding, timing, provenance and protected-pixel checks."""
import json,sys,math,re
from pathlib import Path
import numpy as np
import soundfile as sf
import av
from PIL import Image
from video_media import digest,inspect,audio_samples,decode_images,sample_images
directory=Path(sys.argv[1]);expected=json.loads((directory/'expected.json').read_text(encoding='utf-8'));manifest=json.loads((directory/'manifest.json').read_text(encoding='utf-8'));checks=[];files={};media={}
def record(name,passed,detail):checks.append({'name':name,'pass':bool(passed),'detail':detail})
required={'separate':['voice-1.wav','voice-2.wav','separation.json'],'speech':['output.wav'],'dialogue':['output.wav','transcript.json','dialogue.json'],'transcribe':['transcript.json'],'dub':['output.wav','transcript.json'],'lipsync':['output.mp4','preserved.mkv','lipsync.json'],'convert':['output.wav','neural-speech.json'],'expressive':['output.wav','neural-speech.json','transcript.json'],'caption':['output.wav','output.mp4','preserved.mkv','transcript.json','caption.json']}[expected['tool']]
if not all((directory/name).is_file() for name in required):raise ValueError('A required saved output is missing; no verification pass was recorded.')
record('Saved settings unchanged',digest(directory/'manifest.json')==expected['manifestSha256'],'Settings bound before verification.')
if any(k.startswith('round12/') for k in expected['models']):
    from round12_models import bind
    family='speech/turbo' if manifest['request'].get('speechEngine')=='turbo' else 'speech/asr-large'
    pinned=bind(family);record('Pinned speech upgrade',all(expected['models'].get(k)==v for k,v in pinned.items()),'Selected speech engine and every pinned file are unchanged.')
if manifest.get('source'):record('Original source unchanged',digest(manifest['source']['path'])==expected['sourceSha256'],'Original media checksum matches.')
if manifest.get('audio'):record('Original speech unchanged',digest(manifest['audio']['path'])==manifest['audio']['sha256'],'Saved lip-sync speech matches its checked source.')
if expected['tool']=='separate':
    meta=json.loads((directory/'separation.json').read_text(encoding='utf-8'));tracks=[];valid=len(meta['tracks'])==2 and meta['sourceSha256']==manifest['source']['sha256']
    for i,item in enumerate(meta['tracks']):
        file=directory/f'voice-{i+1}.wav';values,rate=sf.read(file);peak=float(np.abs(values).max());rms=float(np.sqrt(np.mean(values**2)))
        valid &= item['file']==file.name and item['sha256']==digest(file) and item['track']==i+1 and item['samples']==len(values) and rate==8000 and values.ndim==1 and np.isfinite(values).all() and rms>.0001 and peak<.999 and abs(len(values)/rate-expected['duration'])<.001
        tracks.append(values);media.setdefault('separation',[]).append({'track':i+1,'file':file.name,'duration':len(values)/rate,'sampleRate':rate,'peak':peak,'rms':rms})
    if len(tracks[0])!=len(tracks[1]):raise ValueError('Separated track lengths differ.')
    difference=float(np.sqrt(np.mean((tracks[0]-tracks[1])**2)));record('Two finite audible synchronized voice tracks',valid and difference>.0001,{'tracks':media['separation'],'trackDifferenceRms':difference})
    lock=json.loads((Path(manifest['root'])/'setup/audio-separation.lock.json').read_text(encoding='utf-8'));model=Path(manifest['root'])/'runtime/audio-models'/lock['path'];record('Pinned separation model',meta['modelPath']==lock['path'] and expected['models'].get(lock['path'])==lock['sha256'] and digest(model)==lock['sha256']==meta['modelSha256'],'Offline model matches its pinned checksum.')
if (directory/'output.wav').exists():
    samples,rate=sf.read(directory/'output.wav');duration=len(samples)/rate;peak=float(np.max(np.abs(samples)));rms=float(np.sqrt(np.mean(samples**2)))
    record('Audio full decode',np.isfinite(samples).all() and len(samples)>0,{'samples':len(samples),'sampleRate':rate});record('Audio duration',abs(duration-expected['duration'])<.05 and duration<=60.001,duration);record('Audible without clipping',.001<rms and peak<.999,{'peak':peak,'rms':rms});media['audio']={'duration':duration,'sampleRate':rate,'peak':peak,'rms':rms}
if (directory/'transcript.json').exists():
    t=json.loads((directory/'transcript.json').read_text(encoding='utf-8'));last=0;valid=bool(t['segments'])
    for segment in t['segments']:
        valid=valid and isinstance(segment['text'],str) and bool(segment['text'].strip()) and last<=segment['start']<segment['end']<=t['duration']+.05;last=segment['end']
        for word in segment.get('words',[]):valid=valid and segment['start']-.1<=word['start']<=word['end']<=segment['end']+.1
    record('Transcript timing and text',valid,{'segments':len(t['segments']),'language':t['language']})
    for ext,separator in [('srt',','),('vtt','.')]:
        file=directory/('subtitles.'+ext)
        if file.exists():
            blocks=[b for b in file.read_text(encoding='utf-8').strip().split('\n\n') if b.strip() and b.strip()!='WEBVTT'];valid=len(blocks)==len(t['segments'])
            def stamp(value):
                h,m,s,ms=re.split(r'[:,.]',value);return int(h)*3600+int(m)*60+int(s)+int(ms)/1000
            for block,segment in zip(blocks,t['segments']):
                rows=block.splitlines();times=rows[1].split(' --> ') if len(rows)>1 else []
                valid &= len(times)==2 and abs(stamp(times[0])-segment['start'])<=.0011 and abs(stamp(times[1])-segment['end'])<=.0011 and ' '.join(' '.join(rows[2:]).split())==' '.join(segment['text'].split())
            record('Subtitle text and timing: '+ext,valid,'Exported subtitle cues match the transcript, including Unicode text.')

if (directory/'output.mp4').exists():
    info=inspect(directory/'output.mp4',directory/'poster.jpg');samples=audio_samples(directory/'output.mp4',info['duration']);record('Video/audio full decode',samples is not None and np.isfinite(samples).all() and float(np.sqrt(np.mean(samples**2)))>.001,info);record('Video duration matches speech',abs(info['duration']-expected['duration'])<.08,info['duration']);media['video']=info
    with av.open(str(directory/'output.mp4')) as container:
        times=[(float(frame.time),float(frame.time)+frame.samples/frame.sample_rate) for frame in container.decode(audio=0) if frame.time is not None]
    audio_start=min(v[0] for v in times);audio_end=max(v[1] for v in times)
    record('Audio/video timeline alignment',abs(audio_start)<.06 and abs(audio_end-info['duration'])<.08,{'audioStart':audio_start,'audioEnd':audio_end,'videoEnd':info['duration']})
    selected=np.linspace(0,info['frames']-1,6).round().astype(int);wanted=set(selected);pictures={i:image for i,image in enumerate(decode_images(directory/'output.mp4')) if i in wanted};sheet=Image.new('RGB',(768,576))
    from PIL import ImageOps
    for index,frame in enumerate(selected):sheet.paste(ImageOps.contain(pictures[frame],(256,288)),((index%3)*256,(index//3)*288))
    sheet.save(directory/'contact-sheet.jpg',quality=88)
if (directory/'lipsync.json').exists():
    track=json.loads((directory/'lipsync.json').read_text(encoding='utf-8'));maximum=0;inside=0;count=0;held_count=0;held_error=0;holds_valid=True
    if manifest['request'].get('lipEngine')=='latentsync':
        lock=json.loads((Path(manifest['root'])/'setup/latentsync.lock.json').read_text())
        valid=track['method']=='latentsync-1.6-mediapipe-mouth-mask-v1' and track['sourceRevision']==lock['source']['revision'] and track['steps']==20 and track['guidance']==1.5 and track['resolution']==512 and track['seed']==manifest['request']['seed']
        valid &= all(expected['models'].get('latentsync-models/'+item['path'])==item['sha256'] for item in lock['files'])
        record('LatentSync method, seed and pinned model bindings',valid,'Adapted 512-pixel method with fixed 20 steps / guidance 1.5; quality remains experimental.')
    original_frames=[];source=manifest['source']
    while len(original_frames)<track['frames']:
        needed=min(track['frames']-len(original_frames),math.ceil(source['duration']*25));original_frames.extend(sample_images(source['path'],(i/25 for i in range(needed))))
    for index,frame in enumerate(decode_images(directory/'preserved.mkv')):
        item=track['trajectory'][index];original=directory/'lip-frames'/f'{index:04}.png';mask=directory/'lip-frames'/f'{index:04}-mask.png'
        if digest(original)!=item['originalSha256'] or digest(mask)!=item['maskSha256']:raise ValueError('Changed face-preparation artifact.')
        values=np.asarray(Image.open(mask));delta=np.abs(np.asarray(frame).astype(int)-np.asarray(original_frames[index]).astype(int));maximum=max(maximum,int(delta[values==0].max()));inside+=int(np.any(delta[values>0]>0));count+=1
        marked=any(h['start']<=index/25<h['end'] for h in manifest['request'].get('lipHolds',[]));holds_valid &= item.get('originalHold',False)==marked
        if marked:held_count+=1;held_error=max(held_error,int(delta.max()));holds_valid &= not np.any(values)
    record('Protected face/video pixels',count==track['frames'] and maximum==0,{'frames':count,'maximumOutsideRgb':maximum});record('Mouth-region changes',inside==count-held_count and inside>0,{'changedFrames':inside,'originalHoldFrames':held_count});media['lipSync']={'outsideMaxRgb':maximum,'changedFrames':inside,'originalHoldFrames':held_count,'method':track['method']}
    if manifest['request'].get('lipHolds'):record('Marked covered-mouth frames retain the entire original picture',holds_valid and held_error==0 and held_count>0,{'heldFrames':held_count,'maximumHeldFrameRgb':held_error,'source':'User-marked ranges; no automatic hand/object detection claim.'})
if expected['tool'] in ['convert','expressive']:
    if manifest.get('targetVoice'):record('Target voice unchanged',digest(manifest['targetVoice']['path'])==manifest['targetVoice']['sha256'],'Original reference retained.')
    if expected['tool']=='convert':record('Voice conversion duration',abs(media['audio']['duration']-manifest['source']['duration'])<.25,{'sourceSeconds':manifest['source']['duration'],'outputSeconds':media['audio']['duration']})
if expected['tool']=='dialogue':
    detail=expected['details'];samples,rate=sf.read(directory/'output.wav');maximum=0;cursor=0;valid=rate==24000 and len(detail['lines'])==len(manifest['request']['lines'])
    transcript=json.loads((directory/'transcript.json').read_text(encoding='utf-8'))
    for index,(item,line) in enumerate(zip(detail['lines'],manifest['request']['lines'])):
        audio,line_rate=sf.read(directory/item['file']);speaker=next(s for s in manifest['request']['speakers'] if s['id']==line['speaker']);pause=round(line['pauseBefore']*rate);start=cursor+pause;end=start+len(audio);segment=transcript['segments'][index]
        valid &= item['sha256']==digest(directory/item['file']) and item['voice']==speaker['voice'] and item['speaker']==speaker['id'] and item['speed']==line['speed'] and line_rate==rate and item['startSample']==start and item['samples']==len(audio) and item['pauseSamples']==pause
        spoken=re.sub(r'\[[^]]+\]','',line['text']).strip() if manifest['request'].get('speechEngine')=='turbo' else line['text']
        valid &= segment['text']==spoken and segment['voice']==speaker['voice'] and segment['speakerName']==speaker['name'] and abs(segment['start']-start/rate)<1e-8 and abs(segment['end']-end/rate)<1e-8
        if pause:valid &= bool(np.max(np.abs(samples[cursor:start]))==0)
        maximum=max(maximum,float(np.max(np.abs(samples[start:end]-audio))));cursor=end
    record('Dialogue voice, order, pauses and exact line timing',valid and cursor==len(samples) and maximum<=1/32768,{'lines':len(detail['lines']),'speakers':len(detail['speakers']),'maximumReconstructionError':maximum});media['dialogue']={'lines':len(detail['lines']),'speakers':detail['speakers'],'maximumReconstructionError':maximum}
    if manifest['request'].get('dialogueEngine')=='expressive':
        valid=duration<=30.001
        for item,line in zip(detail['lines'],manifest['request']['lines']):
            ref=manifest['speakerReferences'][line['speaker']]
            valid &= digest(ref['path'])==ref['sha256']==item['targetVoiceSha256'] and item['exaggeration']==line['exaggeration'] and item['cfgWeight']==line['cfgWeight']
        record('Per-speaker references and line delivery',valid,'Each expressive line is bound to its reference, expression and pacing guidance.')
if expected['tool']=='dub' and manifest['request'].get('segmentVoices'):
    samples,rate=sf.read(directory/'output.wav');t=json.loads((directory/'transcript.json').read_text(encoding='utf-8'));valid=True;maximum=0
    for i,segment in enumerate(t['segments']):
        values,line_rate=sf.read(directory/segment['file']);start=round(segment['start']*rate);end=round(segment['end']*rate)
        valid &= segment['voice']==manifest['request']['segmentVoices'][i] and digest(directory/segment['file'])==segment['sha256'] and rate==line_rate and len(values)==end-start
        if manifest['request'].get('speakerNames'):valid &= segment['speakerName']==manifest['request']['speakerNames'][i].strip()
        maximum=max(maximum,float(np.max(np.abs(samples[start:end]-values))))
    record('Assigned dubbing voices and exact line placement',valid and maximum<=1/32768,{'segments':len(t['segments']),'maximumPcmDifference':maximum,'speakerAssignment':'user'})
if expected['tool']=='caption':
    caption=json.loads((directory/'caption.json').read_text(encoding='utf-8'));source=manifest['source'];r=manifest['request'];timing=manifest['captionTiming'];maximum=0;inactive_error=0;changed_active=0;active=0;observed=0
    record('Checked caption timing binding',digest(timing['path'])==timing['sha256'] and caption['timing']==timing,'Original checked transcript is retained.')
    if manifest.get('narration'):record('Narration source binding',digest(manifest['narration']['path'])==manifest['narration']['sha256'],'Narration is bound to the checked WAV.')
    transcript=json.loads((directory/'transcript.json').read_text(encoding='utf-8'));valid=caption['requestedCues']==r['captionCues'] and len(transcript['segments'])==len(r['captionCues'])
    for cue,saved in zip(r['captionCues'],transcript['segments']):valid &= saved['start']==cue['start'] and saved['end']==cue['end'] and saved['text']==(cue.get('speaker','')+': ' if r['speakerLabels'] and cue.get('speaker') else '')+cue['text']
    record('Edited caption text and timing',valid,'Saved subtitles match the frozen caption request.')
    size=tuple(caption['size']);fps=caption['fps'];frames=caption['frames'];reference=[]
    # Decode each documented source cycle independently; never trust a saved base frame.
    for cycle in range(math.ceil(caption['duration']/source['duration'])):
        indices=[i for i in range(frames) if int((i/fps)//source['duration'])==cycle]
        reference.extend(sample_images(source['path'],(i/fps-cycle*source['duration'] for i in indices)))
    for i,(original,frame) in enumerate(zip(reference,decode_images(directory/'preserved.mkv'))):
        a=np.asarray(original.resize(size,Image.Resampling.LANCZOS)).astype(int);b=np.asarray(frame).astype(int);delta=np.abs(a-b);maximum=max(maximum,int(delta[:caption['protectedAboveY']].max()));cue=next((c for c in r['captionCues'] if c['start']<=i/fps<c['end']),None)
        if cue and r.get('burnCaptions',True):active+=1;changed_active+=int(np.any(delta>0))
        else:inactive_error=max(inactive_error,int(delta.max()))
        observed+=1
    valid=observed==frames and maximum==0 and inactive_error==0 and (active>0 if r.get('burnCaptions',True) else True) and changed_active==active and caption.get('burnCaptions',True)==r.get('burnCaptions',True) and digest(directory/'preserved.mkv')==caption['masterSha256'] and info['frames']==frames and info['size']==list(size)
    record('Caption picture preservation and visibility',valid,{'frames':observed,'maximumProtectedRgb':maximum,'inactiveCaptionMaximumRgb':inactive_error,'activeFrames':active,'changedActiveFrames':changed_active});media['captions']={'protectedMaxRgb':maximum,'inactiveMaxRgb':inactive_error,'activeFrames':active,'looped':caption['looped'],'mix':caption['mix']}
    if r['captionMode']=='keep' or r['sourceVolume']==0:
        bound=source if r['captionMode']=='keep' else manifest['narration'];reference_audio=audio_samples(bound['path'],bound['duration'],bound.get('startTime',0));saved,rate=sf.read(directory/'output.wav');count=len(saved);gain=r['sourceVolume'] if r['captionMode']=='keep' else r['speechVolume'];reference_audio=np.pad(reference_audio,((0,0),(0,max(0,count-reference_audio.shape[1]))))[:,:count]*gain
        limiter=min(1,.97/max(float(np.abs(reference_audio).max()),1e-12));error=float(np.abs(saved.T-reference_audio*limiter).max())
        record('Selected speech soundtrack and gain',rate==48000 and error<=1/32768+1e-6,{'maximumPcmDifference':error,'gain':gain,'limiterGain':limiter,'mode':r['captionMode']})
for name in ['voice-1.wav','voice-2.wav','separation.json','output.wav','output.mp4','preserved.mkv','transcript.json','subtitles.srt','subtitles.vtt','lipsync.json','dialogue.json','caption.json','neural-speech.json','poster.jpg','contact-sheet.jpg',*[p.name for p in sorted(directory.glob('line-*.wav'))]]:
    if (directory/name).exists():files[name]=digest(directory/name)
report={'technicalPass':all(c['pass'] for c in checks),'checks':checks,'files':files,'media':media,'models':expected['models'],'details':expected['details'],'sourceSha256':expected['sourceSha256'],'creativeApproval':'pending','limitations':['Technical checks do not establish pronunciation, transcription accuracy, translation quality or phoneme alignment.']}
(directory/'report.json').write_text(json.dumps(report,indent=2,ensure_ascii=False),encoding='utf-8');print(json.dumps({'technicalPass':report['technicalPass'],'files':list(files)}))
