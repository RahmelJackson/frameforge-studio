"""A different English sentence order and overlap for the bounded actual UI test."""
from pathlib import Path
import json
import numpy as np,soundfile as sf
ROOT=Path(__file__).resolve().parents[1];folder=ROOT/'data/benchmarks/acceptance-round8';record=folder/'ui-source.json'
if record.exists():print('Preserved existing UI source.');raise SystemExit
jobdir=ROOT/'data/audio-jobs/98f2dc96-ad17-441f-95f0-0caf87518236';job=json.loads((jobdir/'job.json').read_text(encoding='utf-8'));voices=[];texts=[];rate=24000
for order in [[2,0],[3,1]]:
    clips=[]
    for index in order:
        values,sr=sf.read(jobdir/f'line-{index:03}.wav');assert sr==rate
        if clips:clips.append(np.zeros(round(rate*.2)))
        clips.append(values)
    voices.append(np.concatenate(clips));texts.append(' '.join(job['request']['lines'][i]['text'] for i in order))
offset=round(.5*rate);count=max(len(voices[0]),len(voices[1])+offset);truth=np.zeros((2,count));truth[0,:len(voices[0])]=voices[0];truth[1,offset:offset+len(voices[1])]=voices[1];gain=min(1,.95/max(abs(truth.sum(axis=0))));truth*=gain
sf.write(folder/'ui-overlap.wav',truth.sum(axis=0),rate,subtype='PCM_16')
for i,values in enumerate(truth):sf.write(folder/f'ui-truth-{i+1}.wav',values,rate,subtype='PCM_16')
record.write_text(json.dumps({'sourceJob':job['id'],'sourceLineOrder':[[2,0],[3,1]],'offsetSeconds':.5,'scripts':texts,'sharedGain':gain,'language':'en','limit':'Different sentence order and overlap; same original synthetic English preset voice pair.'},indent=2),encoding='utf-8');print('Saved independent English arrangement for actual UI creation.')
