"""Held-out synthetic overlap and recoverable copies of the frozen probe."""
import json,shutil
from pathlib import Path
import soundfile as sf,numpy as np
ROOT=Path(__file__).resolve().parents[1];folder=ROOT/'data/benchmarks/acceptance-round8';folder.mkdir(exist_ok=True,parents=True);probe=ROOT/'evidence/acceptance-round8/probe'
for name in ['voice-1.wav','voice-2.wav','probe.json','started.json']:shutil.copyfile(probe/name,folder/('probe-'+name))
shutil.copyfile(ROOT/'evidence/acceptance-round7/overlap.wav',folder/'probe-input.wav')
if (folder/'heldout.json').exists():print('Held-out fixture already exists; preserved.');raise SystemExit
source=ROOT/'data/audio-jobs/dc15a255-ee07-440b-bad7-a31fb0a4d2b0';job=json.loads((source/'job.json').read_text(encoding='utf-8'));a,rate=sf.read(source/'line-000.wav');b,sr=sf.read(source/'line-001.wav');assert rate==sr;offset=round(.6*rate);count=max(len(a),len(b)+offset);truth=np.zeros((2,count));truth[0,:len(a)]=a;truth[1,offset:offset+len(b)]=b;gain=min(1,.95/np.abs(truth.sum(axis=0)).max());truth*=gain
sf.write(folder/'spanish-overlap.wav',truth.sum(axis=0),rate,subtype='PCM_16')
for i,track in enumerate(truth):sf.write(folder/f'spanish-truth-{i+1}.wav',track,rate,subtype='PCM_16')
record={'sourceJob':job['id'],'offsetSeconds':.6,'sharedGain':gain,'sampleRate':rate,'scripts':[l['text'] for l in job['request']['lines'][:2]],'language':'es','limit':'Original generated voices; held-out script/language, not a real-room recording.'};(folder/'heldout.json').write_text(json.dumps(record,indent=2,ensure_ascii=False),encoding='utf-8');print('Saved held-out Spanish mixture and original source tracks.')
