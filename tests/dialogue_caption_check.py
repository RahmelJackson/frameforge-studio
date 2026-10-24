"""Synthetic audio isolates assembly/verification; real voices have separate acceptance jobs."""
import json,sys,tempfile,subprocess,math
from pathlib import Path
import numpy as np
import soundfile as sf
from PIL import Image
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'scripts'))
from video_media import encode,inspect,digest,decode_images
from caption_video import render_caption,mix_sound,caption_tile
base=ROOT/'runtime/dialogue-tests';base.mkdir(exist_ok=True)
def check(d):
 r=subprocess.run([sys.executable,str(ROOT/'scripts/verify-audio.py'),str(d)],capture_output=True,text=True);assert r.returncode==0,r.stderr;return json.loads((d/'report.json').read_text())
with tempfile.TemporaryDirectory(dir=base) as tmp:
 d=Path(tmp);dialogue=d/'dialogue';dialogue.mkdir();rate=24000;a=np.sin(np.arange(6000)/rate*2*np.pi*440).astype(np.float32)*.15;b=np.sin(np.arange(7200)/rate*2*np.pi*660).astype(np.float32)*.15;pause=2400
 speakers=[{'id':'a','name':'Host','voice':'af_heart'},{'id':'b','name':'Guest','voice':'am_michael'}];lines=[{'speaker':'a','text':'Buenos d\u00edas.','speed':1,'pauseBefore':0},{'speaker':'b','text':'Welcome.','speed':1,'pauseBefore':.1}];records=[];segments=[];cursor=0
 for i,(samples,line) in enumerate(zip([a,b],lines)):
  gap=round(line['pauseBefore']*rate);cursor+=gap;name=f'line-{i:03}.wav';sf.write(dialogue/name,samples,rate,subtype='PCM_16');records.append({'file':name,'sha256':digest(dialogue/name),'startSample':cursor,'samples':len(samples),'pauseSamples':gap,'speaker':line['speaker'],'voice':speakers[i]['voice'],'speed':1});segments.append({'start':cursor/rate,'end':(cursor+len(samples))/rate,'text':line['text'],'voice':speakers[i]['voice'],'speakerName':speakers[i]['name']});cursor+=len(samples)
 full=np.concatenate([a,np.zeros(pause,np.float32),b]);sf.write(dialogue/'output.wav',full,rate,subtype='PCM_16');manifest={'request':{'tool':'dialogue','speakers':speakers,'lines':lines}};(dialogue/'manifest.json').write_text(json.dumps(manifest));(dialogue/'transcript.json').write_text(json.dumps({'language':'en','duration':len(full)/rate,'segments':segments}));details={'lines':records,'speakers':speakers};(dialogue/'dialogue.json').write_text(json.dumps(details));(dialogue/'expected.json').write_text(json.dumps({'tool':'dialogue','duration':len(full)/rate,'sourceSha256':None,'models':{},'details':details,'manifestSha256':digest(dialogue/'manifest.json')}));assert check(dialogue)['technicalPass']
 bad=full.copy();bad[len(a)+100]=.2;sf.write(dialogue/'output.wav',bad,rate,subtype='PCM_16');assert not check(dialogue)['technicalPass']
 (dialogue/'output.wav').unlink();missing=subprocess.run([sys.executable,str(ROOT/'scripts/verify-audio.py'),str(dialogue)],capture_output=True,text=True);assert missing.returncode!=0 and 'required saved output is missing' in missing.stderr
 folder=d/'caption';folder.mkdir();source=d/'source.mp4';narr=d/'voice.wav';timing=d/'timing.json';images=[Image.new('RGB',(320,180),(30+i*2,60,90)) for i in range(8)];tone=np.sin(np.arange(48000)/48000*2*np.pi*220).astype(np.float32)*.1;encode(images,source,(320,180),8,np.stack([tone,tone]));speech=np.sin(np.arange(32400)/24000*2*np.pi*440).astype(np.float32)*.15;sf.write(narr,speech,24000,subtype='PCM_16');timing.write_text('{}')
 request={'tool':'caption','captionMode':'narrate','captionCues':[{'start':0,'end':.45,'text':'Buenos d\u00edas.'},{'start':.7,'end':1.25,'text':'Welcome.'}],'loopVideo':True,'speakerLabels':False,'fontSize':14,'sourceVolume':.5,'speechVolume':1,'duckOriginal':True,'burnCaptions':True};m={'request':request,'source':{**inspect(source),'path':str(source)},'narration':{'path':str(narr),'sha256':digest(narr),'duration':1.35},'captionTiming':{'path':str(timing),'sha256':digest(timing)}}
 def export():
  duration,meta,cues=render_caption(folder,m);(folder/'manifest.json').write_text(json.dumps(m,ensure_ascii=False),encoding='utf-8');(folder/'transcript.json').write_text(json.dumps({'language':'en','duration':duration,'segments':cues},ensure_ascii=False),encoding='utf-8');(folder/'expected.json').write_text(json.dumps({'tool':'caption','duration':duration,'sourceSha256':m['source']['sha256'],'models':{},'details':meta,'manifestSha256':digest(folder/'manifest.json')}));return meta
 meta=export();assert check(folder)['technicalPass'];assert meta['mix']['minimumOriginalGain']<.3
 changed=list(decode_images(folder/'preserved.mkv'));changed[0].putpixel((0,0),(255,0,0));encode(changed,folder/'preserved.mkv',(320,180),8,codec='ffv1');assert not check(folder)['technicalPass']
 request['burnCaptions']=False;export();report=check(folder);assert report['technicalPass'] and report['media']['captions']['activeFrames']==0
 saved_narration=m.pop('narration');request['captionMode']='keep';request['sourceVolume']=1;request['captionCues'][1]['end']=.9;export();assert check(folder)['technicalPass']
 m['narration']=saved_narration;request['captionMode']='narrate';request['captionCues'][1]['end']=1.25;request['loopVideo']=False
 try:render_caption(folder,m)
 except ValueError as e:assert 'loop' in str(e).lower()
 else:raise AssertionError('Silently trimmed speech accepted')
 try:caption_tile((320,180),'too much caption text '*30,24)
 except ValueError:pass
 else:raise AssertionError('Overflowing caption accepted')
 timing.write_text('changed')
 try:render_caption(folder,m)
 except ValueError as e:assert 'changed' in str(e)
 else:raise AssertionError('Changed timing accepted')
 print('Dialogue reconstruction, caption pixels, explicit looping, overflow, source binding and ducking passed')
