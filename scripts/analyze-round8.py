"""Measure frozen separation outputs; never invokes a model or grants approval."""
import hashlib,itertools,json,re,unicodedata
from pathlib import Path
import numpy as np
import soundfile as sf
from scipy.signal import resample_poly

ROOT=Path(__file__).resolve().parents[1]
FOLDER=ROOT/'evidence/acceptance-round8'
FIXTURES=ROOT/'data/benchmarks/acceptance-round8'
state=json.loads((FOLDER/'state.json').read_text(encoding='utf-8'))
def load(path):return json.loads(path.read_text(encoding='utf-8'))
def digest(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def samples(path):
    values,rate=sf.read(path,dtype='float64')
    if values.ndim!=1:raise ValueError('Expected mono test audio')
    return resample_poly(values,8000,rate) if rate!=8000 else values
def words(text):
    text=unicodedata.normalize('NFC',text).casefold()
    return ['nine' if v=='9' else v for v in re.findall(r'\w+',text)]
def sisdr(estimate,reference):
    estimate=estimate-estimate.mean();reference=reference-reference.mean()
    target=reference*np.dot(estimate,reference)/max(np.dot(reference,reference),1e-12)
    return float(10*np.log10(max(np.dot(target,target),1e-12)/max(np.dot(estimate-target,estimate-target),1e-12)))
lock=load(ROOT/'setup/audio-separation.lock.json')
assert digest(ROOT/'runtime/audio-models'/lock['path'])==lock['sha256'],'Separation model changed'
probe=load(FIXTURES/'probe-probe.json')
started=load(FIXTURES/'probe-started.json')
assert digest(FIXTURES/'probe-input.wav')==started['sha256'],'Frozen failed input changed'
original=ROOT/'evidence/acceptance-round7/overlap.wav'
if original.exists():assert digest(original)==started['sha256'],'Retained failure changed'
for track in [1,2]:
    original=FOLDER/f'probe/voice-{track}.wav'
    if original.exists():assert digest(FIXTURES/f'probe-voice-{track}.wav')==digest(original),'Probe output changed'
probe_words=[words(s['recognized'])==words(probe['expected'][s['source']]) for s in probe['scores']]
assert all(probe_words) and all(s['improvementDb']>9 for s in probe['scores']),'Original failed fixture was not repaired'
results={'probe':{'scores':probe['scores'],'allKnownWords':all(probe_words),'inputSha256':started['sha256']}}
for name,prefix,marker in [('heldout','spanish','heldout.json'),('ui-overlap','ui','ui-source.json')]:
    parent=ROOT/'data/audio-jobs'/state['jobs'][name]['id']
    truth=[samples(FIXTURES/f'{prefix}-truth-{i}.wav') for i in [1,2]]
    output=[samples(parent/f'voice-{i}.wav') for i in [1,2]]
    mixture=samples(FIXTURES/f'{prefix}-overlap.wav')
    assert len(set(map(len,[*truth,*output,mixture])))==1,'Test sample lengths differ'
    source_id=state['requests'][name]['request']['source']['id']
    assert digest(ROOT/'data/audio'/f'{source_id}.wav')==digest(FIXTURES/f'{prefix}-overlap.wav'),'App fixture changed'
    metadata=load(FIXTURES/marker)
    mapping=max(itertools.permutations(range(2)),key=lambda p:sum(sisdr(output[p[i]],truth[i]) for i in range(2)))
    scores=[]
    for i,j in enumerate(mapping):
        transcript=load(ROOT/'data/audio-jobs'/state['jobs'][f'{name}-{j+1}']['id']/'transcript.json')
        text=transcript.get('text') or ' '.join(s['text'] for s in transcript['segments'])
        baseline=sisdr(mixture,truth[i]);actual=sisdr(output[j],truth[i])
        scores.append({'source':i,'outputTrack':j+1,'mixtureSiSdrDb':baseline,'separatedSiSdrDb':actual,'improvementDb':actual-baseline,'expected':metadata['scripts'][i],'recognized':text,'allKnownWords':words(text)==words(metadata['scripts'][i]),'outputSha256':digest(parent/f'voice-{j+1}.wav')})
    results[name]={'scores':scores,'allKnownWords':all(s['allKnownWords'] for s in scores),'positiveImprovement':all(s['improvementDb']>0 for s in scores),'inputSha256':digest(FIXTURES/f'{prefix}-overlap.wav')}
assert results['ui-overlap']['allKnownWords'] and results['ui-overlap']['positiveImprovement'],'English UI fixture regressed'
assert not results['heldout']['allKnownWords'] and not results['heldout']['positiveImprovement'],'Inspect any changed Spanish failure evidence'
report={'results':results,'creativeApproval':'pending','scope':'Three synthetic fixtures, two preset voice pairs. English arrangement uses the original English pair. No evidence for real-room, arbitrary-speaker or multilingual reliability.','method':'Permutation-invariant zero-mean SI-SDR against known clean source waves; baseline is the mixture. Exact word tokens after Unicode/case/punctuation normalization and 9-to-nine conversion. No inference performed.'}
(FOLDER/'quality-measurements.json').write_text(json.dumps(report,indent=2,ensure_ascii=False),encoding='utf-8',newline='\n')
print(json.dumps({k:{'allKnownWords':v['allKnownWords'],'improvementDb':[round(s['improvementDb'],2) for s in v['scores']]} for k,v in results.items()}))
