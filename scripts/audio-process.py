"""Bounded offline speech, ASR, translation/dubbing and lip-sync jobs."""
import json,os,sys,math,subprocess
from pathlib import Path
os.environ.update(HF_HUB_OFFLINE='1',TRANSFORMERS_OFFLINE='1',TOKENIZERS_PARALLELISM='false')
from fractions import Fraction
import numpy as np
import soundfile as sf
from scipy.signal import resample_poly
from video_media import digest,audio_samples,inspect,encode,sample_images
ROOT=Path(__file__).resolve().parents[1]
MODELS=ROOT/'runtime/audio-models'

def model_binding(prefix):
    records=json.loads((ROOT/'setup/audio-models.lock.json').read_text(encoding='utf-8'))['files'];result={}
    for record in records:
        if record['path'].startswith(prefix+'/'):
            if digest(MODELS/record['path'])!=record['sha256']:raise ValueError('Changed model: '+record['path'])
            result[record['path']]=record['sha256']
    if not result:raise ValueError('Missing pinned model family')
    return result

def read_audio(source,rate=24000):
    if digest(source['path'])!=source['sha256']:raise ValueError('Source changed after inspection.')
    if not 0<source['duration']<=60.001:raise ValueError('Audio is limited to 60 seconds.')
    samples=audio_samples(source['path'],source['duration'],source.get('startTime',0))
    if samples is None:raise ValueError('Source has no audio stream.')
    mono=samples.mean(axis=0);mono=resample_poly(mono,rate,48000)
    if not np.isfinite(mono).all() or float(np.sqrt(np.mean(mono**2)))<.001:raise ValueError('No audible speech signal. Choose a source with speech.')
    return mono.astype(np.float32)

class Speech:
    def __init__(self):
        import onnxruntime as ort
        from kokoro_onnx import Kokoro
        options=ort.SessionOptions();options.intra_op_num_threads=8;options.inter_op_num_threads=1
        session=ort.InferenceSession(str(MODELS/'kokoro/model.onnx'),sess_options=options,providers=['CPUExecutionProvider'])
        self.engine=Kokoro.from_session(session,str(MODELS/'kokoro/voices.bin'))
    def create(self,text,voice,speed):
        language='es' if voice.startswith('e') else 'en-gb' if voice.startswith('b') else 'en-us'
        audio,rate=self.engine.create(text,voice=voice,speed=speed,lang=language)
        if not 0<len(audio)/rate<=60:raise ValueError('Generated speech exceeds the 60-second limit. Shorten the script.')
        return np.asarray(audio,np.float32),rate

def stretch(audio,rate,count):
    """Pitch-preserving atempo; never silently cut a word to fit its slot."""
    import av
    ratio=len(audio)/count
    if ratio>1.35:raise ValueError(f'Translation is too long for its slot ({ratio:.2f}×). Shorten that translated line or choose a faster voice speed.')
    if ratio<.75:return np.pad(audio,(0,max(0,count-len(audio))))[:count],1.
    graph=av.filter.Graph();first=av.AudioFrame.from_ndarray(np.ascontiguousarray(audio[None,:]),format='fltp',layout='mono');first.sample_rate=rate;first.time_base=Fraction(1,rate);first.pts=0
    source=graph.add("abuffer",f"time_base=1/{rate}:sample_rate={rate}:sample_fmt=fltp:channel_layout=mono");tempo=graph.add('atempo',str(ratio));sink=graph.add('abuffersink');source.link_to(tempo);tempo.link_to(sink);graph.configure();parts=[]
    for start in range(0,len(audio),2048):
        frame=av.AudioFrame.from_ndarray(np.ascontiguousarray(audio[None,start:start+2048]),format='fltp',layout='mono');frame.sample_rate=rate;frame.time_base=Fraction(1,rate);frame.pts=start;source.push(frame)
        while True:
            try:parts.append(sink.pull().to_ndarray().ravel())
            except (av.error.BlockingIOError,av.error.EOFError):break
    source.push(None)
    while True:
        try:parts.append(sink.pull().to_ndarray().ravel())
        except (av.error.BlockingIOError,av.error.EOFError):break
    result=np.concatenate(parts) if parts else np.zeros(0,np.float32)
    return np.pad(result,(0,max(0,count-len(result))))[:count],ratio

def subtitle_time(seconds,vtt=False):
    ms=round(seconds*1000);hours,ms=divmod(ms,3600000);minutes,ms=divmod(ms,60000);secs,ms=divmod(ms,1000)
    return f'{hours:02}:{minutes:02}:{secs:02}{"." if vtt else ","}{ms:03}'

def save_transcript(directory,transcript):
    (directory/'transcript.json').write_text(json.dumps(transcript,indent=2,ensure_ascii=False),encoding='utf-8')
    for extension in ['srt','vtt']:
        vtt=extension=='vtt';lines=['WEBVTT\n'] if vtt else []
        for index,segment in enumerate(transcript['segments']):
            display=' '.join(segment['text'].split());lines.append(f'{index+1}\n{subtitle_time(segment["start"],vtt)} --> {subtitle_time(segment["end"],vtt)}\n{display}\n')
        (directory/('subtitles.'+extension)).write_text('\n'.join(lines),encoding='utf-8')

def transcribe(source,language,asr_model='small'):
    from faster_whisper import WhisperModel
    from round12_models import MODEL_ROOT
    folder=MODEL_ROOT/'speech/asr-large' if asr_model=='turbo' else MODELS/'asr'
    samples=read_audio(source,16000);model=WhisperModel(str(folder),device='cpu',compute_type='int8',cpu_threads=8,local_files_only=True)
    segments,info=model.transcribe(samples,language=None if language=='auto' else language,beam_size=5,word_timestamps=True,vad_filter=True,condition_on_previous_text=False)
    result=[]
    for item in segments:
        if item.no_speech_prob>.8:continue
        result.append({'start':max(0,item.start),'end':min(source['duration'],item.end),'text':item.text.strip(),'words':[{'start':w.start,'end':min(source['duration'],w.end),'word':w.word,'probability':w.probability} for w in item.words or []]})
    if not result:raise ValueError('No speech was recognized; no invented transcript was saved.')
    return {'language':info.language,'languageProbability':info.language_probability,'duration':source['duration'],'segments':result,'text':' '.join(s['text'] for s in result)}

def run(directory):
    manifest=json.loads((directory/'manifest.json').read_text(encoding='utf-8'));r=manifest['request'];tool=r['tool'];models={};details={};source=manifest.get('source');duration=0
    if source and digest(source['path'])!=source['sha256']:raise ValueError('Original source changed.')
    if tool in ['speech','dialogue','dub']:models.update(model_binding('kokoro'));speech=Speech()
    if tool=='speech':
        audio,rate=speech.create(r['text'],r['voice'],r['speed']);sf.write(directory/'output.wav',audio,rate,subtype='PCM_16');duration=len(audio)/rate;details={'script':r['text'],'voice':r['voice'],'language':r['language'],'sampleRate':rate}
        save_transcript(directory,{'language':r['language'],'duration':duration,'timing':'generated-line','text':r['text'],'segments':[{'start':0,'end':duration,'text':r['text']}]})
    elif tool=='dialogue':
        parts=[];segments=[];position=0;rate=24000;lines=[]
        for index,line in enumerate(r['lines']):
            speaker=next(s for s in r['speakers'] if s['id']==line['speaker']);audio,voice_rate=speech.create(line['text'],speaker['voice'],line['speed'])
            if voice_rate!=rate:audio=resample_poly(audio,rate,voice_rate).astype(np.float32)
            pause=round(line['pauseBefore']*rate);parts.append(np.zeros(pause,np.float32));position+=pause;start=position
            if (position+len(audio))/rate>60:raise ValueError('Dialogue exceeds 60 seconds. Shorten the lines or pauses.')
            filename=f'line-{index:03d}.wav';sf.write(directory/filename,audio,rate,subtype='PCM_16');parts.append(audio);position+=len(audio)
            segments.append({'start':start/rate,'end':position/rate,'text':line['text'],'speakerName':speaker['name'],'speakerId':speaker['id'],'voice':speaker['voice'],'language':speaker['language']})
            lines.append({'file':filename,'sha256':digest(directory/filename),'startSample':start,'samples':len(audio),'pauseSamples':pause,'speaker':speaker['id'],'voice':speaker['voice'],'speed':line['speed']})
        audio=np.concatenate(parts);sf.write(directory/'output.wav',audio,rate,subtype='PCM_16');duration=len(audio)/rate
        language=r['speakers'][0]['language'] if len({s['language'] for s in r['speakers']})==1 else 'multi'
        save_transcript(directory,{'language':language,'duration':duration,'timing':'generated-lines','text':' '.join(s['text'] for s in segments),'segments':segments})
        details={'script':' '.join(s['text'] for s in segments),'speakers':r['speakers'],'lines':lines,'sampleRate':rate,'timing':'Measured generated lines and explicit pauses; no speaker detection or phoneme timestamps.'}
        (directory/'dialogue.json').write_text(json.dumps(details,indent=2),encoding='utf-8')
    elif tool=='caption':
        from caption_video import render_caption
        duration,details,cues=render_caption(directory,manifest);models.update(manifest.get('speechModels',{}))
        save_transcript(directory,{'language':json.loads(Path(manifest['captionTiming']['path']).read_text(encoding='utf-8'))['language'],'duration':duration,'timing':'edited-cues','text':' '.join(c['text'] for c in cues),'segments':cues})
    elif tool=='separate':
        from speech_separate import separate_samples
        outputs,details=separate_samples(read_audio(source,8000));duration=outputs.shape[1]/8000;tracks=[]
        for i,values in enumerate(outputs):
            file=f'voice-{i+1}.wav';sf.write(directory/file,values,8000,subtype='PCM_16');tracks.append({'track':i+1,'file':file,'sha256':digest(directory/file),'samples':len(values)})
        details.update(tracks=tracks,sourceSha256=source['sha256']);models[details['modelPath']]=details['modelSha256'];(directory/'separation.json').write_text(json.dumps(details,indent=2),encoding='utf-8')
    elif tool=='transcribe':
        from round12_models import bind
        selected=r.get('asrModel','small');models.update(bind('speech/asr-large') if selected=='turbo' else model_binding('asr'));transcript=transcribe(source,r['sourceLanguage'],selected);save_transcript(directory,transcript);duration=source['duration'];details={'language':transcript['language'],'segments':len(transcript['segments']),'asrModel':selected,'speakerDetection':False}
    elif tool=='dub':
        transcript=manifest['transcript'];duration=transcript['duration'];rate=24000;audio=np.zeros(round(duration*rate),np.float32);translated=[]
        original_language=transcript['language'];automatic=not r.get('translations')
        if automatic and original_language!=r['language']:
            route=(original_language,r['language'])
            if route not in [('en','es'),('es','en')]:raise ValueError('Automatic translation supports English/Spanish in both directions. Enter reviewed target lines for other voices.')
            import torch
            from transformers import MarianMTModel,MarianTokenizer
            if route==('en','es'):models.update(model_binding('translation'));translation_folder=MODELS/'translation'
            else:
                translation_folder=ROOT/'runtime/speech-models/translation-es-en'
                for item in json.loads((ROOT/'setup/speech-upgrades.lock.json').read_text(encoding='utf-8'))['files']:
                    if item['path'].startswith('translation-es-en/'):
                        if digest(ROOT/'runtime/speech-models'/item['path'])!=item['sha256']:raise ValueError('Changed translation model')
                        models['speech-models/'+item['path']]=item['sha256']
            torch.set_num_threads(8);tokenizer=MarianTokenizer.from_pretrained(translation_folder,local_files_only=True);translator=MarianMTModel.from_pretrained(translation_folder,local_files_only=True).eval()
        for index,segment in enumerate(transcript['segments']):
            text=r['translations'][index].strip() if r.get('translations') else segment['text']
            if automatic and original_language!=r['language']:
                with torch.inference_mode():tokens=translator.generate(**tokenizer(text,return_tensors='pt',truncation=False),max_new_tokens=256)
                text=tokenizer.decode(tokens[0],skip_special_tokens=True)
            if not text:raise ValueError('A translated line is empty.')
            assigned_voice=r['segmentVoices'][index] if r.get('segmentVoices') else r['voice'];speaker_name=r['speakerNames'][index].strip() if r.get('speakerNames') else ''
            voice,voice_rate=speech.create(text,assigned_voice,r['speed']);start=round(segment['start']*rate);end=round((transcript['segments'][index+1]['start'] if index+1<len(transcript['segments']) else duration)*rate)
            if end<=start:raise ValueError('Transcript slots overlap or have invalid timing.')
            voice,factor=stretch(voice,voice_rate,end-start);audio[start:end]=voice
            linefile=f'line-{index:03}.wav';sf.write(directory/linefile,voice,rate,subtype='PCM_16')
            translated.append({'start':start/rate,'end':end/rate,'text':text,'sourceText':segment['text'],'timeStretch':factor,'voice':assigned_voice,'speakerName':speaker_name,'speakerAssignment':'user' if speaker_name else 'unspecified','file':linefile,'sha256':digest(directory/linefile)})
        sf.write(directory/'output.wav',audio,rate,subtype='PCM_16');save_transcript(directory,{'language':r['language'],'duration':duration,'text':' '.join(s['text'] for s in translated),'segments':translated});details={'language':r['language'],'voice':r['voice'],'segments':translated,'automaticTranslation':automatic and original_language!=r['language'],'originalSound':'Replaced with synthesized speech; background stems are not separated.'}
        if source['kind']=='video':
            if r['lipSync']:
                from audio_lipsync import render_lipsync
                models.update(render_lipsync(directory,manifest,{'path':str(directory/'output.wav'),'sha256':digest(directory/'output.wav'),'duration':duration,'kind':'audio'}))
            else:
                if duration>30:raise ValueError('Dubbed video previews are limited to 30 seconds.')
                stereo=np.stack([resample_poly(audio,2,1)]*2);frames=round(duration*source['fps']);encode(sample_images(source['path'],(i/source['fps'] for i in range(frames))),directory/'output.mp4',source['size'],source['fps'],stereo)
    else:
        from audio_lipsync import render_lipsync
        models.update(render_lipsync(directory,manifest,manifest['audio']));duration=manifest['audio']['duration'];details={'lipSync':True,'loopVideo':r['loopVideo']}
    if source and digest(source['path'])!=source['sha256']:raise ValueError('Original source changed during processing.')
    (directory/'expected.json').write_text(json.dumps({'tool':tool,'duration':duration,'sourceSha256':source['sha256'] if source else None,'models':models,'details':details,'manifestSha256':digest(directory/'manifest.json')},indent=2),encoding='utf-8')
    result=subprocess.run([sys.executable,str(ROOT/'scripts/verify-audio.py'),str(directory)],capture_output=True,text=True,timeout=90)
    if result.returncode:raise ValueError(result.stderr[-1800:] or 'Audio verification failed.')

if __name__=='__main__':run(Path(sys.argv[1]))
