"""Original deterministic procedural starter cues, no recordings or AI weights."""
import json,sys,wave,hashlib
from pathlib import Path
import numpy as np
from scipy.signal import butter,sosfilt
directory=Path(sys.argv[1]);directory.mkdir(parents=True,exist_ok=True);rate=48000;rng=np.random.default_rng(20261019);records=[]
def save(name,category,notes,signal):
    signal=np.asarray(signal,dtype=np.float64);signal*=.45/max(.45,float(np.max(np.abs(signal))));pcm=np.rint(signal*32767).astype('<i2');file=directory/(name+'.wav')
    with wave.open(str(file),'wb') as wav:wav.setnchannels(2);wav.setsampwidth(2);wav.setframerate(rate);wav.writeframes(np.stack([pcm,pcm],axis=1).tobytes())
    records.append({'name':name.replace('-',' ').title(),'category':category,'notes':notes+' Original procedural synthesis, seed 20261019; not a neural generation.','file':str(file),'sha256':hashlib.sha256(file.read_bytes()).hexdigest(),'duration':len(pcm)/rate,'peak':float(np.abs(signal).max()),'rms':float(np.sqrt(np.mean(signal**2)))})
t=np.arange(rate*2)/rate;envelope=np.sin(np.pi*t/2)**2;noise=sosfilt(butter(2,[500,5000],btype='bandpass',fs=rate,output='sos'),rng.standard_normal(t.size));save('soft-transition-whoosh','effect','Two-second airy transition.',noise*envelope*.12)
t=np.arange(round(rate*2.5))/rate;chime=sum(np.sin(2*np.pi*f*t)*np.exp(-t*(2+i*.7))/(i+1) for i,f in enumerate([659.255,1318.51,1977.765]));chime*=np.minimum(t/.012,1)*np.minimum((2.5-t)/.1,1);save('gentle-bell','effect','Gentle bell with a fading tail.',chime*.18)
t=np.arange(rate*8)/rate;air=sosfilt(butter(2,1400,fs=rate,output='sos'),rng.standard_normal(t.size));fade=np.minimum(t/.7,1)*np.minimum((8-t)/.7,1);save('soft-air-bed','ambience','Eight-second soft air bed; not a field recording.',air*(.8+.2*np.sin(2*np.pi*.3*t))*.13*fade)
(directory/'manifest.json').write_text(json.dumps(records,indent=2),encoding='utf-8');print(json.dumps(records,indent=2))
