"""Offline two-speaker waveform separation using pinned official Conv-TasNet."""
import json,time
from pathlib import Path
import numpy as np
from video_media import digest
ROOT=Path(__file__).resolve().parents[1]

def separate_samples(samples,rate=8000):
    import torch
    from torchaudio.models import conv_tasnet_base
    if rate!=8000 or samples.ndim!=1 or not 4000<=len(samples)<=12*rate or not np.isfinite(samples).all():raise ValueError('Use 0.5-12 seconds of finite mono speech at 8 kHz.')
    if float(np.sqrt(np.mean(samples**2)))<.001:raise ValueError('No audible speech signal.')
    lock=json.loads((ROOT/'setup/audio-separation.lock.json').read_text(encoding='utf-8'));weights=ROOT/'runtime/audio-models'/lock['path']
    if digest(weights)!=lock['sha256']:raise ValueError('Separation model changed; restore its pinned weights.')
    torch.set_num_threads(8);start=time.monotonic();model=conv_tasnet_base(num_sources=2);model.load_state_dict(torch.load(weights,map_location='cpu',weights_only=True));model.eval()
    with torch.inference_mode():output=model(torch.from_numpy(np.asarray(samples,dtype=np.float32))[None,None,:])[0].numpy()
    if output.shape!=(2,len(samples)) or not np.isfinite(output).all():raise ValueError('Separation returned invalid tracks.')
    gain=min(1,.98/max(float(np.abs(output).max()),1e-12));output=output*gain
    return output,{'method':'official-convtasnet-libri2mix','sampleRate':rate,'sources':2,'seconds':len(samples)/rate,'elapsedSeconds':time.monotonic()-start,'sharedLimiterGain':gain,'modelSha256':lock['sha256'],'modelPath':lock['path'],'note':'Two anonymous estimated voices at 8 kHz. Track order is arbitrary; no real identity or automatic speaker-count claim. Crosstalk/artifacts remain possible.'}
