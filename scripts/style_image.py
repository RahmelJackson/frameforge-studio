"""Local SDXL style-only generation; existing runtimes stay unchanged."""
import os,json,hashlib,time,argparse,importlib.metadata
from workspace_paths import model_root, load_json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
os.environ.setdefault('HF_HUB_OFFLINE','1');os.environ.setdefault('TRANSFORMERS_OFFLINE','1');os.environ.setdefault('PYTHONDONTWRITEBYTECODE','1')
from style_math import pool,style_scale,subtract_content
def digest(p):
 with Path(p).open('rb') as f:return hashlib.file_digest(f,'sha256').hexdigest()
def render(directory,all_blocks=False):
 import torch,numpy as np
 from PIL import Image,ImageOps
 from diffusers import StableDiffusionXLPipeline,DPMSolverMultistepScheduler
 from transformers import CLIPVisionModelWithProjection,CLIPImageProcessor
 if (directory/'completed.json').exists() or (directory/'raw.png').exists():raise ValueError('A saved/ambiguous output already exists; inspect it before any rerun.')
 manifest=load_json((directory/'style-manifest.json').read_text(encoding='utf-8'));request=manifest['request'];subtract=request.get('styleMode')=='subtract';lockfile=ROOT/'setup'/('style-content-models.lock.json' if subtract else 'style-models.lock.json');spec=load_json(lockfile.read_text(encoding='utf-8'));models=[spec['base'],*spec['files']]
 for item in models:
  if Path(item['path']).stat().st_size!=item['bytes'] or digest(item['path'])!=item['sha256']:raise ValueError('Style model changed: '+item['path'])
 if not torch.cuda.is_available():raise ValueError('This style workflow needs the local NVIDIA GPU.')
 for _ in range(12):
  if torch.cuda.mem_get_info()[0]>=10*2**30:break
  time.sleep(.5)
 if torch.cuda.mem_get_info()[0]<10*2**30:raise ValueError('Less than 10 GiB GPU memory free. Close other GPU tasks and retry explicitly.')
 source_rows=manifest['sources']
 if [x['asset'] for x in source_rows]!=request['styleImages']:raise ValueError('Style reference order differs from the saved request.')
 images=[];sources=[]
 for row in source_rows:
  file=Path(row['path'])
  if file.resolve()!= (Path(manifest['assets'])/row['asset']).resolve() or digest(file)!=row['sha256']:raise ValueError('Style reference changed or escaped its asset binding.')
  image=ImageOps.exif_transpose(Image.open(file)).convert('RGB');sources.append({**row,'originalSize':list(image.size)})
  # Fit the complete card before CLIP's square preprocessing: no board layout
  # and no center crop that silently discards the edges of a reference.
  images.append(ImageOps.pad(image,(224,224),method=Image.Resampling.LANCZOS,color=(127,127,127)))
 torch.cuda.reset_peak_memory_stats();start=time.perf_counter();base=Path(spec['directory'])
 encoder=CLIPVisionModelWithProjection.from_pretrained(base/'image_encoder',local_files_only=True,torch_dtype=torch.float16,use_safetensors=True)
 processor=CLIPImageProcessor()
 pipe=StableDiffusionXLPipeline.from_single_file(spec['base']['path'],config=spec.get('configDirectory',str(base/'sdxl-config')),local_files_only=True,torch_dtype=torch.float16,image_encoder=encoder,feature_extractor=processor,add_watermarker=False)
 pipe.load_ip_adapter(str(base),subfolder='adapter',weight_name='ip-adapter_sdxl.safetensors' if subtract else 'ip-adapter_sdxl_vit-h.safetensors',image_encoder_folder=None,local_files_only=True)
 pipe.scheduler=DPMSolverMultistepScheduler.from_config(pipe.scheduler.config,algorithm_type='dpmsolver++',use_karras_sigmas=True)
 pipe.to('cuda');pipe.enable_vae_tiling();pipe.set_ip_adapter_scale(request['styleStrength'] if all_blocks else style_scale(request['styleStrength']))
 active=[];inactive=0
 for name,attention in pipe.unet.attn_processors.items():
  if not hasattr(attention,'scale'):continue
  scales=attention.scale if isinstance(attention.scale,list) else [attention.scale]
  if any(float(x)!=0 for x in scales):active.append({'name':name,'scales':[float(x) for x in scales]})
  else:inactive+=1
 if not all_blocks and any(not x['name'].startswith('up_blocks.0.attentions.1.') for x in active):raise ValueError('Content/layout adapter layers unexpectedly active.')
 with torch.inference_mode():
  tensors=processor(images=images,return_tensors='pt').pixel_values.to('cuda',torch.float16)
  vectors=pipe.image_encoder(tensors).image_embeds.float().cpu().numpy();average=pool(vectors)
  content=np.zeros_like(average);conditioned=average
  if subtract:
   # Match the upstream BigG global-image / SDXL pooled BigG text route.
   # Never subtract SDXL's 1280-vector from the ViT-H 1024-vector.
   if len(pipe.tokenizer_2(request['styleContent'],truncation=False).input_ids)>pipe.tokenizer_2.model_max_length:raise ValueError('Reference-subject description is too long for the local encoder; shorten it instead of silently truncating.')
   content=pipe.encode_prompt(request['styleContent'],device='cuda',do_classifier_free_guidance=False)[2][0].float().cpu().numpy()
   conditioned=subtract_content(average,content,request['styleContentStrength'])
  np.savez(directory/'style-embeddings.npz',cards=vectors,average=average,content=content,conditioned=conditioned)
  positive=torch.from_numpy(conditioned).to('cuda',torch.float16).reshape(1,1,-1);embedded=[torch.cat([torch.zeros_like(positive),positive],dim=0)]
  width,height=request['size'];generator=torch.Generator(device='cuda').manual_seed(request['seed'])
  output=pipe(prompt=request['prompt'],negative_prompt='text, watermark, distorted anatomy, low quality, blurry',width=width,height=height,num_inference_steps=30,guidance_scale=5.0,generator=generator,ip_adapter_image_embeds=embedded).images[0]
 output.save(directory/'raw.png')
 for row in source_rows:
  if digest(row['path'])!=row['sha256']:raise ValueError('Reference changed during generation.')
 keys=['styleImages','styleStrength','prompt','seed','size','steps']+(['styleMode','styleContent','styleContentStrength'] if subtract else [])
 meta={'method':spec['method'],'attention':'all-blocks-control' if all_blocks else 'style-only','sources':sources,'models':models,'modelLockSha256':digest(lockfile),'embeddingSha256':digest(directory/'style-embeddings.npz'),'aggregation':'Equal arithmetic mean of every complete-card global embedding; canvas positions are not used.','encoderInputSize':[224,224],'activeProcessors':active,'inactiveProcessors':inactive,'settings':{k:request[k] for k in keys},'rawSha256':digest(directory/'raw.png'),'seconds':time.perf_counter()-start,'peakAllocatedBytes':torch.cuda.max_memory_allocated(),'packages':{p:importlib.metadata.version(p) for p in ['torch','diffusers','transformers','safetensors']},'creativeApproval':None,'limitations':'Style-specific attention and optional content subtraction reduce reference conditioning; they cannot guarantee zero subject leakage or identical style on every prompt. Inspect the image.'}
 (directory/'style.json').write_text(json.dumps(meta,indent=2),encoding='utf-8');(directory/'completed.json').write_text(json.dumps({'styleMetadataSha256':digest(directory/'style.json'),'rawSha256':meta['rawSha256']}),encoding='utf-8')
 print(json.dumps({'complete':True,'seconds':meta['seconds'],'cards':len(images),'activeProcessors':len(active),'peakAllocatedBytes':meta['peakAllocatedBytes']}))
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('directory',type=Path);p.add_argument('--diagnostic-all-blocks',action='store_true');args=p.parse_args();render(args.directory,args.diagnostic_all_blocks)
