"""Bounded LatentSync 1.6 comparison, adapted from ByteDance/LatentSync (Apache-2.0).

Uses pinned upstream UNet, Whisper and alignment geometry. Windows adaptation:
existing MediaPipe single-face gates provide eyebrow/nose alignment points;
PyAV replaces Decord/FFmpeg shell I/O; original mouth mask protects the scene.
This is an adapted experiment, not an unmodified upstream quality benchmark.
"""
import json, math, subprocess, sys, types, time, gc, os
from pathlib import Path
import numpy as np
import torch
import cv2
from PIL import Image
from einops import rearrange
from video_media import digest, encode, audio_samples
os.environ.update(HF_HUB_OFFLINE='1',TRANSFORMERS_OFFLINE='1',TOKENIZERS_PARALLELISM='false')

def render_lipsync(directory, manifest, audio_source):
    root=Path(manifest['root']); r=manifest['request']; duration=audio_source['duration']
    if not .5<=duration<=4:
        raise ValueError('LatentSync comparisons require 0.5-4 seconds of speech.')
    if duration>manifest['source']['duration']+.04 and not r['loopVideo']:
        raise ValueError('Speech is longer than the video; choose longer footage or explicit looping.')
    if not torch.cuda.is_available():
        raise ValueError('LatentSync requires the local NVIDIA GPU.')
    free,total=torch.cuda.mem_get_info()
    if free<18*1024**3:
        raise ValueError('LatentSync needs at least 18 GiB free GPU memory. Unload idle generation weights or close GPU-heavy apps.')
    source=root/'runtime/latentsync-source'; models=root/'runtime/latentsync-models'
    lock=json.loads((root/'setup/latentsync.lock.json').read_text()); bindings={}
    for name,expected in lock['source']['files'].items():
        if digest(source/name)!=expected: raise ValueError('Changed LatentSync source: '+name)
    for item in lock['files']:
        if digest(models/item['path'])!=item['sha256']:raise ValueError('Changed LatentSync weights.')
        bindings['latentsync-models/'+item['path']]=item['sha256']
    vae_lock=json.loads((root/'setup/audio-models.lock.json').read_text())['files']
    for item in vae_lock:
        if item['path'].startswith('vae/'):
            if digest(root/'runtime/audio-models'/item['path'])!=item['sha256']:raise ValueError('Changed VAE weights.')
            bindings[item['path']]=item['sha256']
    # The UNet only uses this logger utility. Avoid importing unused Linux-only
    # Decord/dataset helpers; no upstream source file is modified.
    utility=types.ModuleType('latentsync.utils.util')
    utility.zero_rank_log=lambda logger,message:logger.info(message)
    sys.path.insert(0,str(source));sys.modules['latentsync.utils.util']=utility
    from omegaconf import OmegaConf
    from diffusers import AutoencoderKL, DDIMScheduler
    from latentsync.models.unet import UNet3DConditionModel
    from latentsync.whisper.audio2feature import Audio2Feature
    from latentsync.utils.affine_transform import AlignRestore
    config=OmegaConf.load(source/'configs/unet/stage2_512.yaml')
    fps=25;count=math.floor(duration*fps);device='cuda';dtype=torch.float16
    torch.set_num_threads(8);torch.manual_seed(r['seed']);torch.cuda.reset_peak_memory_stats();began=time.monotonic()
    (directory/'lip-input.json').write_text(json.dumps({'frames':count,'fps':fps,'audioSha256':audio_source['sha256']}))
    prepared=subprocess.run([manifest['visionPython'],str(root/'scripts/prepare-lipsync.py'),str(directory)],capture_output=True,text=True,timeout=120)
    if prepared.returncode:raise ValueError(prepared.stderr[-1400:] or 'Face preparation failed.')
    track=json.loads((directory/'lipsync.json').read_text()); originals=[];faces=[];matrices=[]
    restorer=AlignRestore(resolution=512,device=device)
    for index,item in enumerate(track['trajectory']):
        image=np.asarray(Image.open(directory/'lip-frames'/f'{index:04}.png').convert('RGB')).copy();originals.append(image)
        face,matrix=restorer.align_warp_face(image,np.round(item['alignmentPoints']),smooth=r['lipStability']=='stable')
        faces.append(torch.from_numpy(cv2.resize(face,(512,512),interpolation=cv2.INTER_LANCZOS4)).permute(2,0,1))
        matrix=matrix.squeeze(0).float().cpu().numpy()
        matrices.append(matrix);item['affineMatrix']=matrix.tolist()
    faces=torch.stack(faces)
    speech=audio_samples(audio_source['path'],duration).mean(axis=0)
    from scipy.signal import resample_poly
    mono=resample_poly(speech,1,3).astype(np.float32)
    encoder=Audio2Feature(model_path=str(models/'whisper/tiny.pt'),device=device,num_frames=16)
    with torch.inference_mode(): features=encoder.audio2feat(mono)
    chunks=[encoder.get_sliced_feature(features,i,fps)[0] for i in range(count)]
    del encoder;gc.collect();torch.cuda.empty_cache()
    vae=AutoencoderKL.from_pretrained(root/'runtime/audio-models/vae',local_files_only=True,use_safetensors=True,torch_dtype=dtype).to(device).eval()
    vae.config.scaling_factor=.18215;vae.config.shift_factor=0;vae.enable_slicing()
    unet=UNet3DConditionModel.from_config(OmegaConf.to_container(config.model))
    weights=torch.load(models/'latentsync_unet.pt',map_location='cpu',weights_only=True)
    unet.load_state_dict(weights['state_dict'],strict=True);del weights;unet.to(device,dtype).eval()
    scheduler=DDIMScheduler.from_pretrained(source/'configs',local_files_only=True);scheduler.set_timesteps(20,device=device)
    mask=cv2.imread(str(source/'latentsync/utils/mask.png'))
    mask=torch.from_numpy(cv2.resize(cv2.cvtColor(mask,cv2.COLOR_BGR2RGB),(512,512),interpolation=cv2.INTER_LANCZOS4)/255).permute(2,0,1).float()
    # Fixed upstream guidance avoids another unbounded quality knob.
    guidance=1.5;scale=vae.config.scaling_factor
    latents=torch.randn((1,4,1,64,64),device=device,dtype=dtype).repeat(1,1,count,1,1)*scheduler.init_noise_sigma
    generated=[]
    with torch.inference_mode():
        for start in range(0,count,16):
            end=min(start+16,count);print(f'LatentSync frames {start+1}-{end}/{count}',flush=True)
            pixels=faces[start:end].float()/127.5-1
            masked=(pixels*mask).to(device,dtype);reference=pixels.to(device,dtype)
            mask_latent=torch.nn.functional.interpolate(mask[None,0:1].repeat(end-start,1,1,1),size=(64,64)).to(device,dtype)
            def packed(value):return rearrange(value,'f c h w -> 1 c f h w').repeat(2,1,1,1,1)
            masked_latent=packed(vae.encode(masked).latent_dist.sample()*scale)
            reference_latent=packed(vae.encode(reference).latent_dist.sample()*scale)
            mask_latent=packed(mask_latent)
            embeds=torch.stack(chunks[start:end]).to(device,dtype);embeds=torch.cat([torch.zeros_like(embeds),embeds])
            window=latents[:,:,start:end]
            for timestep in scheduler.timesteps:
                inputs=torch.cat([scheduler.scale_model_input(window.repeat(2,1,1,1,1),timestep),mask_latent,masked_latent,reference_latent],dim=1)
                unconditional,conditional=unet(inputs,timestep,encoder_hidden_states=embeds).sample.chunk(2)
                window=scheduler.step(unconditional+guidance*(conditional-unconditional),timestep,window).prev_sample
            decoded=vae.decode(rearrange(window/scale,'b c f h w -> (b f) c h w')).sample
            decoded=decoded*(1-mask.to(device,dtype))+reference*mask.to(device,dtype)
            decoded=((decoded/2+.5).clamp(0,1)*255).permute(0,2,3,1).float().cpu().numpy().round().astype(np.uint8)
            np.save(directory/f'aligned-mouth-{start:04}.npy',decoded)
            for local,patch in enumerate(decoded):
                index=start+local;original=originals[index];patch=cv2.resize(patch,restorer.face_size,interpolation=cv2.INTER_CUBIC)
                patch=cv2.warpAffine(patch,cv2.invertAffineTransform(matrices[index]),(original.shape[1],original.shape[0]),flags=cv2.INTER_LINEAR,borderMode=cv2.BORDER_CONSTANT)
                protection=Image.open(directory/'lip-frames'/f'{index:04}-mask.png').convert('L')
                generated.append(Image.composite(Image.fromarray(patch),Image.fromarray(original),protection))
    sound=np.stack([speech[:round(count/fps*48000)]]*2)
    encode(generated,directory/'preserved.mkv',track['size'],fps,sound,codec='ffv1');encode(generated,directory/'output.mp4',track['size'],fps,sound)
    track.update(method='latentsync-1.6-mediapipe-mouth-mask-v1',audioSha256=audio_source['sha256'],actualDuration=count/fps,sourceRevision=lock['source']['revision'],guidance=guidance,steps=20,resolution=512,seed=r['seed'],seconds=time.monotonic()-began,peakAllocatedGiB=torch.cuda.max_memory_allocated()/1024**3,alignment='MediaPipe eyebrow/nose points with upstream affine geometry; adapted preprocessing')
    (directory/'lipsync.json').write_text(json.dumps(track,indent=2))
    return bindings

if __name__=='__main__':
    directory=Path(sys.argv[1]);manifest=json.loads((directory/'manifest.json').read_text());audio=manifest['audio'];models=render_lipsync(directory,manifest,audio)
    if digest(manifest['source']['path'])!=manifest['source']['sha256'] or digest(audio['path'])!=audio['sha256']:raise ValueError('Original source/audio changed.')
    expected={'tool':'lipsync','duration':audio['duration'],'sourceSha256':manifest['source']['sha256'],'models':models,'details':{'lipSync':True,'lipEngine':'latentsync','loopVideo':manifest['request']['loopVideo']},'manifestSha256':digest(directory/'manifest.json')}
    (directory/'expected.json').write_text(json.dumps(expected,indent=2))
    subprocess.run([str(Path(manifest['root'])/'runtime/audio-env/Scripts/python.exe'),str(Path(manifest['root'])/'scripts/verify-audio.py'),str(directory)],check=True,timeout=120)
