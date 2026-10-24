import importlib.util,sys,json,tempfile
from pathlib import Path
import numpy as np
import soundfile as sf
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'scripts'))
spec=importlib.util.spec_from_file_location('process_audio',ROOT/'scripts/audio-process.py');module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
rate=24000;tone=np.sin(np.arange(rate*2)/rate*2*np.pi*440).astype(np.float32)*.2
result,ratio=module.stretch(tone,rate,40000);frequency=np.argmax(np.abs(np.fft.rfft(result)))*rate/len(result)
assert len(result)==40000 and abs(frequency-440)<2,(len(result),frequency)
try:module.stretch(tone,rate,10000)
except ValueError as error:assert 'too long' in str(error)
else:raise AssertionError('Dubbing silently cut words instead of rejecting excessive speed')
assert module.subtitle_time(59.9996)=='00:01:00,000'
assert module.subtitle_time(3600.001,True)=='01:00:00.001'
runtime=(ROOT/'runtime').resolve();directory=(ROOT/'runtime/audio-tests').resolve();assert directory.parent==runtime and directory.name=='audio-tests';directory.mkdir(parents=True,exist_ok=True)
with tempfile.TemporaryDirectory(dir=directory) as temp:
    from video_media import encode,inspect
    from PIL import Image
    movie=Path(temp)/'measured-rate.mp4'
    encode((Image.new('RGB',(160,96),(80,100,120)) for _ in range(10)),movie,(160,96),24.99999999999998)
    info=inspect(movie);assert info['frames']==10 and abs(info['fps']-25)<.001
    file=Path(temp)/'quiet.wav';sf.write(file,np.zeros(rate),rate)
    try:module.read_audio({'path':str(file),'sha256':module.digest(file),'duration':1})
    except ValueError as error:assert 'audible' in str(error)
    else:raise AssertionError('Silence passed the speech-source gate')
    try:module.read_audio({'path':str(file),'sha256':'changed','duration':1})
    except ValueError as error:assert 'changed' in str(error)
    else:raise AssertionError('Changed input passed provenance gate')
print('Dubbing retains pitch, rejects excessive compression, exports valid subtitle boundaries and rejects silent/changed sources.')
