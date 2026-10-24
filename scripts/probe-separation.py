"""One frozen overlap-separation experiment. Never silently reruns an existing attempt."""
import json,sys,importlib.util,itertools,datetime
from pathlib import Path
import numpy as np,soundfile as sf
from scipy.signal import resample_poly
from speech_separate import separate_samples
from video_media import digest
ROOT=Path(__file__).resolve().parents[1];folder=ROOT/'evidence/acceptance-round8/probe';folder.mkdir(exist_ok=True,parents=True)
if (folder/'started.json').exists():
    if '--resume' not in sys.argv:raise ValueError('Attempt already exists. Use --resume to inspect saved results, not regenerate.')
    print((folder/'probe.json').read_text(encoding='utf-8') if (folder/'probe.json').exists() else 'Incomplete saved attempt; inspect files before any retry.');raise SystemExit
if '--run' not in sys.argv:raise ValueError('Use --run for one bounded experiment.')
original=ROOT/'evidence/acceptance-round7/overlap.wav';samples,rate=sf.read(original,dtype='float32');input_samples=resample_poly(samples,8000,rate).astype(np.float32)
(folder/'started.json').write_text(json.dumps({'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'input':str(original),'sha256':digest(original),'budget':'One separation, two ASR checks; exact retained failed mixture.'},indent=2),encoding='utf-8')
output,details=separate_samples(input_samples)
spec=importlib.util.spec_from_file_location('studio_audio',ROOT/'scripts/audio-process.py');audio=importlib.util.module_from_spec(spec);spec.loader.exec_module(audio)
recognized=[]
for i,values in enumerate(output):
    file=folder/f'voice-{i+1}.wav';sf.write(file,values,8000,subtype='PCM_16');recognized.append(audio.transcribe({'path':str(file),'sha256':digest(file),'duration':len(values)/8000},'en'))
first,_=sf.read(ROOT/'data/audio-jobs/98f2dc96-ad17-441f-95f0-0caf87518236/line-000.wav');second,_=sf.read(ROOT/'data/audio-jobs/98f2dc96-ad17-441f-95f0-0caf87518236/line-001.wav');offset=round(rate*.6);count=max(len(first),len(second)+offset);truth=np.zeros((2,count));truth[0,:len(first)]=first;truth[1,offset:offset+len(second)]=second;gain=min(1,.95/np.abs(truth.sum(axis=0)).max());truth=np.stack([resample_poly(v*gain,8000,rate) for v in truth])[:,:len(input_samples)]
def sisdr(estimate,reference):
    estimate=estimate-estimate.mean();reference=reference-reference.mean();target=reference*np.dot(estimate,reference)/max(np.dot(reference,reference),1e-12);return float(10*np.log10(max(np.dot(target,target),1e-12)/max(np.dot(estimate-target,estimate-target),1e-12)))
permutation=max(itertools.permutations(range(2)),key=lambda p:sum(sisdr(output[p[i]],truth[i]) for i in range(2)));scores=[]
for i,j in enumerate(permutation):
    baseline=sisdr(input_samples,truth[i]);actual=sisdr(output[j],truth[i]);scores.append({'source':i,'outputTrack':j+1,'mixtureSiSdrDb':baseline,'separatedSiSdrDb':actual,'improvementDb':actual-baseline,'recognized':recognized[j]['text']})
report={'details':details,'scores':scores,'transcripts':recognized,'expected':['Welcome back. The garden opens at nine.','Great. I will bring the camera.'],'creativeApproval':'pending','limits':'Original synthetic two-speaker recording; not evidence for arbitrary voices, music or real-room overlap.'}
(folder/'probe.json').write_text(json.dumps(report,indent=2),encoding='utf-8');print(json.dumps({'scores':scores,'elapsed':details['elapsedSeconds']},indent=2))
