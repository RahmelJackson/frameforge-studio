"""MuseTalk 1.5 model adapter with MediaPipe crops and original-frame compositing.

Model conditioning follows the pinned official TMElyralab/MuseTalk implementation.
Adaptations: local-only loading, safe tensor/state loading, no MMLab detector stack,
bounded frames, deterministic seed, and exact protected pixels in an FFV1 master.
See setup/AUDIO-NOTICES.md and the retained upstream MIT notice.
"""
import json,math,subprocess
from pathlib import Path
import numpy as np
import torch
from PIL import Image
from diffusers import UNet2DConditionModel,AutoencoderKL
from transformers import WhisperModel,WhisperFeatureExtractor
from video_media import encode,digest

def render_lipsync(directory,manifest,audio_source):
    from importlib import import_module
    process=import_module('audio-process');root=Path(manifest['root']);models=root/'runtime/audio-models';source=manifest['source'];r=manifest['request'];duration=audio_source['duration']
    if not 0.5<=duration<=8:raise ValueError('Lip-sync previews require 0.5–8 seconds of speech. Shorten the script first.')
    if duration>source['duration']+.04 and not r['loopVideo']:raise ValueError('Speech is longer than the video. Enable explicit source looping or use longer footage.')
    if not torch.cuda.is_available():raise ValueError('The installed lip-sync preview needs the local NVIDIA GPU.')
    bindings={};[bindings.update(process.model_binding(family)) for family in ['musetalk','vae','whisper']]
    torch.manual_seed(r['seed']);torch.set_num_threads(8);device='cuda';dtype=torch.float16;fps=25;frames=math.floor(duration*fps)
    (directory/'lip-input.json').write_text(json.dumps({'frames':frames,'fps':fps,'audioSha256':audio_source['sha256']}))
    prepared=subprocess.run([manifest['visionPython'],str(root/'scripts/prepare-lipsync.py'),str(directory)],capture_output=True,text=True,timeout=120)
    if prepared.returncode:raise ValueError(prepared.stderr[-1400:] or 'Face preparation failed.')
    track=json.loads((directory/'lipsync.json').read_text());samples=process.read_audio(audio_source,16000)
    feature=WhisperFeatureExtractor.from_pretrained(models/'whisper',local_files_only=True);whisper=WhisperModel.from_pretrained(models/'whisper',local_files_only=True).encoder.to(device,dtype).eval()
    with torch.inference_mode():
        hidden=whisper(feature(samples,sampling_rate=16000,return_tensors='pt').input_features.to(device,dtype),output_hidden_states=True).hidden_states
        hidden=torch.stack(hidden,dim=2)[:,:math.floor(duration*50)];hidden=torch.cat([torch.zeros_like(hidden[:,:4]),hidden,torch.zeros_like(hidden[:,:12])],dim=1)
        chunks=torch.cat([hidden[:,i*2:i*2+10] for i in range(frames)],dim=0).reshape(frames,50,384)
    del whisper;torch.cuda.empty_cache()
    positions=torch.arange(50,device=device,dtype=torch.float32)[:,None];frequencies=torch.exp(torch.arange(0,384,2,device=device,dtype=torch.float32)*(-math.log(10000)/384));pe=torch.zeros(50,384,device=device);pe[:,0::2]=torch.sin(positions*frequencies);pe[:,1::2]=torch.cos(positions*frequencies);chunks=chunks+pe.to(dtype)[None]
    unet=UNet2DConditionModel(**json.loads((models/'musetalk/musetalk.json').read_text()));weights=torch.load(models/'musetalk/unet.pth',map_location='cpu',weights_only=True);unet.load_state_dict(weights);del weights;unet.to(device,dtype).eval()
    vae=AutoencoderKL.from_pretrained(models/'vae',local_files_only=True,use_safetensors=True).to(device,dtype).eval();scale=vae.config.scaling_factor;output=[]
    with torch.inference_mode():
        for index,item in enumerate(track['trajectory']):
            original=Image.open(directory/'lip-frames'/f'{index:04}.png').convert('RGB');crop=original.crop(item['crop']).resize((256,256),Image.Resampling.LANCZOS);tensor=torch.from_numpy(np.asarray(crop).copy()).permute(2,0,1)[None].to(device,dtype)/255
            masked=tensor.clone();masked[:,:,128:,:]=0
            a=vae.encode(masked*2-1).latent_dist;b=vae.encode(tensor*2-1).latent_dist
            latent=torch.cat([(a.mode() if r.get('lipStability')=='stable' else a.sample())*scale,(b.mode() if r.get('lipStability')=='stable' else b.sample())*scale],dim=1)
            predicted=unet(latent,torch.tensor([0],device=device),encoder_hidden_states=chunks[index:index+1]).sample
            decoded=(vae.decode(predicted/scale).sample/2+.5).clamp(0,1);patch=Image.fromarray((decoded[0].permute(1,2,0).float().cpu().numpy()*255).round().astype(np.uint8))
            box=item['crop'];patch=patch.resize((box[2]-box[0],box[3]-box[1]),Image.Resampling.LANCZOS);candidate=original.copy();candidate.paste(patch,box[:2]);mask=Image.open(directory/'lip-frames'/f'{index:04}-mask.png').convert('L');output.append(Image.composite(candidate,original,mask))
    speech=process.read_audio(audio_source,48000);speech=np.stack([speech[:round(frames/fps*48000)]]*2);encode(output,directory/'preserved.mkv',track['size'],fps,speech,codec='ffv1');encode(output,directory/'output.mp4',track['size'],fps,speech)
    track['audioSha256']=audio_source['sha256'];track['actualDuration']=frames/fps;track['latentMode']='posterior-mode' if r.get('lipStability')=='stable' else 'sample';(directory/'lipsync.json').write_text(json.dumps(track,indent=2));return bindings
