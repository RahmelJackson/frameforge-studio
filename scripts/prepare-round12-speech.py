"""Derive documented synthetic reference fixtures; never alter earlier evidence."""
import json,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
import numpy as np,soundfile as sf,requests
from video_media import digest
ROOT=Path(__file__).resolve().parents[1];folder=ROOT/'evidence/round12';file=folder/'speech-fixtures.json'
if file.exists():print(file.read_text());raise SystemExit()
folder.mkdir(exist_ok=True);refs={}
for name,source in [('host',ROOT/'data/audio-jobs/62fc9eee-7264-4ae0-ac29-6d9b4063444c/output.wav'),('guest',ROOT/'data/audio/5d65f6a3-5724-4535-a13b-ce0ae8f88d2e.wav')]:
    samples,rate=sf.read(source);copies=max(2,int(np.ceil(6/(len(samples)/rate))));values=np.concatenate([samples]*copies);target=folder/(name+'-reference.wav');sf.write(target,values,rate,subtype='PCM_16')
    response=requests.post('http://127.0.0.1:4317/api/audio-assets',data=target.read_bytes(),headers={'Content-Type':'audio/wav'},timeout=60);response.raise_for_status();asset=response.json()
    refs[name]={'source':str(source),'sourceSha256':digest(source),'method':'Repeat the same known synthetic single-speaker WAV without changing its pitch or speed. This is a voice fixture, not evidence of natural acted speech.','copies':copies,'path':str(target),'sha256':digest(target),'asset':asset}
file.write_text(json.dumps(refs,indent=2));print(json.dumps({k:v['asset'] for k,v in refs.items()}))
