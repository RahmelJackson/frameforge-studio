import sys,json,tempfile,subprocess
from pathlib import Path
import numpy as np,soundfile as sf
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'scripts'))
from video_media import digest
from speech_separate import separate_samples
# No model inference: known synthetic waveforms exercise decoding/provenance checks only.
for values,rate in [(np.zeros(8000,np.float32),8000),(np.ones(100,np.float32),8000),(np.ones(8000,np.float32),16000)]:
    try:separate_samples(values,rate);raise AssertionError('Invalid signal accepted')
    except ValueError:pass
with tempfile.TemporaryDirectory(prefix='frameforge-separation-check-') as tmp:
    folder=Path(tmp);rate=8000;t=np.arange(rate)/rate;a=np.sin(t*2*np.pi*220)*.1;b=np.sin(t*2*np.pi*440)*.08;source=folder/'source.wav';sf.write(source,a+b,rate,subtype='PCM_16');sf.write(folder/'voice-1.wav',a,rate,subtype='PCM_16');sf.write(folder/'voice-2.wav',b,rate,subtype='PCM_16')
    lock=json.loads((ROOT/'setup/audio-separation.lock.json').read_text());manifest={'root':str(ROOT),'source':{'path':str(source),'sha256':digest(source),'duration':1,'kind':'audio'},'request':{'tool':'separate'}};(folder/'manifest.json').write_text(json.dumps(manifest));meta={'sourceSha256':digest(source),'modelPath':lock['path'],'modelSha256':lock['sha256'],'tracks':[{'track':i,'file':f'voice-{i}.wav','sha256':digest(folder/f'voice-{i}.wav'),'samples':rate} for i in [1,2]]};expected={'tool':'separate','manifestSha256':digest(folder/'manifest.json'),'sourceSha256':digest(source),'duration':1,'models':{lock['path']:lock['sha256']},'details':{}};(folder/'expected.json').write_text(json.dumps(expected))
    def check():
        (folder/'separation.json').write_text(json.dumps(meta));r=subprocess.run([sys.executable,str(ROOT/'scripts/verify-audio.py'),str(folder)],capture_output=True,text=True);assert r.returncode==0,r.stderr;return json.loads((folder/'report.json').read_text())
    assert check()['technicalPass'];sf.write(folder/'voice-2.wav',a,rate,subtype='PCM_16');meta['tracks'][1]['sha256']=digest(folder/'voice-2.wav');assert not check()['technicalPass'];sf.write(folder/'voice-2.wav',b,rate,subtype='PCM_16');meta['tracks'][1]['sha256']=digest(folder/'voice-2.wav');meta['modelSha256']='0'*64;assert not check()['technicalPass']
print('Synthetic signal decoding, synchronized tracks, collapse refusal, model binding and input limits pass without inference.')
