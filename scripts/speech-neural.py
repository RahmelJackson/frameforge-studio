"""Offline Chatterbox speech-to-speech and expressive English synthesis."""
import os,sys,json,time,random,subprocess,re
from pathlib import Path
os.environ.update(HF_HUB_OFFLINE='1',TRANSFORMERS_OFFLINE='1',TOKENIZERS_PARALLELISM='false')
import numpy as np
import soundfile as sf
from video_media import digest,audio_samples
ROOT=Path(__file__).resolve().parents[1]
def run(directory):
    import torch
    m=json.loads((directory/'manifest.json').read_text(encoding='utf-8'));r=m['request'];models={};start=time.monotonic()
    turbo=r.get('speechEngine')=='turbo'
    from round12_models import bind,MODEL_ROOT
    if turbo:models.update(bind('speech/turbo'))
    for item in ([] if turbo else json.loads((ROOT/'setup/speech-upgrades.lock.json').read_text(encoding='utf-8'))['files']):
        if item['path'].startswith('chatterbox/'):
            if digest(ROOT/'runtime/speech-models'/item['path'])!=item['sha256']:raise ValueError('Changed speech weights: '+item['path'])
            models['speech-models/'+item['path']]=item['sha256']
    for key in ['source','targetVoice']:
        if m.get(key) and digest(m[key]['path'])!=m[key]['sha256']:raise ValueError('Changed '+key)
    torch.set_num_threads(8);torch.manual_seed(r['seed']);random.seed(r['seed']);np.random.seed(r['seed']);torch.cuda.reset_peak_memory_stats()
    target=m.get('targetVoice');reference=None
    if target:
        data=audio_samples(target['path'],target['duration'],target.get('startTime',0));sf.write(directory/'target-reference.wav',data.mean(axis=0),48000,subtype='PCM_16');reference=str(directory/'target-reference.wav')
    if r['tool']=='dialogue':
        from chatterbox.tts import ChatterboxTTS
        from chatterbox.tts_turbo import ChatterboxTurboTTS
        import importlib.util
        spec=importlib.util.spec_from_file_location('studio_audio',ROOT/'scripts/audio-process.py');module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
        model=(ChatterboxTurboTTS.from_local(MODEL_ROOT/'speech/turbo','cuda') if turbo else ChatterboxTTS.from_local(ROOT/'runtime/speech-models/chatterbox','cuda'));rate=model.sr;parts=[];segments=[];records=[];position=0;references={}
        for speaker in r['speakers']:
            ref=m['speakerReferences'][speaker['id']]
            if digest(ref['path'])!=ref['sha256']:raise ValueError('Speaker reference changed.')
            file=directory/('speaker-'+speaker['id']+'.wav');data=audio_samples(ref['path'],ref['duration'],ref.get('startTime',0));sf.write(file,data.mean(axis=0),48000,subtype='PCM_16');references[speaker['id']]=str(file)
        for index,line in enumerate(r['lines']):
            speaker=next(s for s in r['speakers'] if s['id']==line['speaker'])
            torch.manual_seed((r['seed']+index)%(2**32));random.seed((r['seed']+index)%(2**32));np.random.seed((r['seed']+index)%(2**32))
            generated=model.generate(line['text'],audio_prompt_path=references[speaker['id']],exaggeration=0 if turbo else line['exaggeration'],cfg_weight=0 if turbo else line['cfgWeight'],temperature=.8)
            values=generated.detach().cpu().numpy().reshape(-1);pause=round(line['pauseBefore']*rate);parts.append(np.zeros(pause,np.float32));position+=pause;begin=position
            if (position+len(values))/rate>30:raise ValueError('Expressive dialogue exceeds 30 seconds. Shorten the scene.')
            file=f'line-{index:03}.wav';sf.write(directory/file,values,rate,subtype='PCM_16')
            # Assemble decoded PCM lines so the exported scene is independently reconstructible.
            values,_=sf.read(directory/file,dtype='float32');parts.append(values);position+=len(values)
            segments.append({'start':begin/rate,'end':position/rate,'text':re.sub(r'\[[^]]+\]','',line['text']).strip(),'speakerId':speaker['id'],'speakerName':speaker['name'],'voice':speaker['voice'],'language':'en'})
            records.append({'file':file,'sha256':digest(directory/file),'startSample':begin,'samples':len(values),'pauseSamples':pause,'speaker':speaker['id'],'voice':speaker['voice'],'speed':1,'exaggeration':line['exaggeration'],'cfgWeight':line['cfgWeight'],'targetVoiceSha256':m['speakerReferences'][speaker['id']]['sha256'],'seed':(r['seed']+index)%(2**32)})
        duration=position/rate;sf.write(directory/'output.wav',np.concatenate(parts),rate,subtype='PCM_16')
        details={'method':'chatterbox-turbo-dialogue' if turbo else 'chatterbox-expressive-dialogue','script':' '.join(s['text'] for s in segments),'controlScript':' '.join(l['text'] for l in r['lines']),'speakers':r['speakers'],'lines':records,'sampleRate':rate,'timing':'Measured generated lines with explicit pauses. Speaker assignment is supplied by the user.','watermark':'Upstream Perth watermark retained','elapsedSeconds':time.monotonic()-start,'peakCudaBytes':torch.cuda.max_memory_allocated()}
        module.save_transcript(directory,{'language':'en','duration':duration,'timing':'generated-lines','text':details['script'],'segments':segments})
        (directory/'dialogue.json').write_text(json.dumps(details,indent=2),encoding='utf-8')
        (directory/'expected.json').write_text(json.dumps({'tool':'dialogue','duration':duration,'sourceSha256':None,'models':models,'details':details,'manifestSha256':digest(directory/'manifest.json')},indent=2),encoding='utf-8')
        subprocess.run([str(ROOT/'runtime/audio-env/Scripts/python.exe'),str(ROOT/'scripts/verify-audio.py'),str(directory)],check=True);return
    if r['tool']=='convert':
        from chatterbox.vc import ChatterboxVC
        s=m['source'];data=audio_samples(s['path'],s['duration'],s.get('startTime',0));sf.write(directory/'source-speech.wav',data.mean(axis=0),48000,subtype='PCM_16')
        model=ChatterboxVC.from_local(ROOT/'runtime/speech-models/chatterbox','cuda');audio=model.generate(str(directory/'source-speech.wav'),target_voice_path=reference)
    else:
        from chatterbox.tts import ChatterboxTTS
        from chatterbox.tts_turbo import ChatterboxTurboTTS
        model=(ChatterboxTurboTTS.from_local(MODEL_ROOT/'speech/turbo','cuda') if turbo else ChatterboxTTS.from_local(ROOT/'runtime/speech-models/chatterbox','cuda'));audio=model.generate(r['text'],audio_prompt_path=reference,exaggeration=0 if turbo else r['exaggeration'],cfg_weight=0 if turbo else r['cfgWeight'],temperature=.8)
    samples=audio.detach().cpu().numpy().reshape(-1);duration=len(samples)/model.sr
    if not .1<duration<=30:raise ValueError('Speech result is outside the 30-second preview limit.')
    sf.write(directory/'output.wav',samples,model.sr,subtype='PCM_16')
    details={'method':'chatterbox-speech-to-speech' if r['tool']=='convert' else 'chatterbox-turbo-tts' if turbo else 'chatterbox-expressive-tts','language':r['language'],'script':re.sub(r'\[[^]]+\]','',r['text']).strip() if r['tool']=='expressive' else '', 'controlScript':r['text'] if r['tool']=='expressive' else '', 'seed':r['seed'],'targetVoiceSha256':target['sha256'] if target else None,'elapsedSeconds':time.monotonic()-start,'peakCudaBytes':torch.cuda.max_memory_allocated(),'watermark':'Upstream Perth watermark retained','exaggeration':0 if turbo else r.get('exaggeration'),'cfgWeight':0 if turbo else r.get('cfgWeight')}
    if r['tool']=='expressive':
        import importlib.util
        spec=importlib.util.spec_from_file_location('studio_audio',ROOT/'scripts/audio-process.py');module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
        module.save_transcript(directory,{'language':'en','duration':duration,'timing':'generated-line','text':details['script'],'segments':[{'start':0,'end':duration,'text':details['script']}]})
    (directory/'neural-speech.json').write_text(json.dumps(details,indent=2),encoding='utf-8')
    (directory/'expected.json').write_text(json.dumps({'tool':r['tool'],'duration':duration,'sourceSha256':m.get('source',{}).get('sha256'),'models':models,'details':details,'manifestSha256':digest(directory/'manifest.json')},indent=2),encoding='utf-8')
    subprocess.run([str(ROOT/'runtime/audio-env/Scripts/python.exe'),str(ROOT/'scripts/verify-audio.py'),str(directory)],check=True)
if __name__=='__main__':run(Path(sys.argv[1]))
