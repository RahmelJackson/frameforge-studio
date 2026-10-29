"""Pin style adapter/configs and reuse the already installed SDXL checkpoint."""
import concurrent.futures,hashlib,json,urllib.request
from workspace_paths import model_root, load_json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];DEST=(model_root()/'style');LOCK=ROOT/'setup/style-models.lock.json'
REPOS={'h94/IP-Adapter':'018e402774aeeddd60609b4ecdb7e298259dc729','stabilityai/stable-diffusion-xl-base-1.0':'462165984030d82259a11f4367a4eed129e94a7b'}
FILES={'h94/IP-Adapter':{'models/image_encoder/config.json':'image_encoder/config.json','models/image_encoder/model.safetensors':'image_encoder/model.safetensors','sdxl_models/ip-adapter_sdxl_vit-h.safetensors':'adapter/ip-adapter_sdxl_vit-h.safetensors'},'stabilityai/stable-diffusion-xl-base-1.0':{p:'sdxl-config/'+p for p in ['LICENSE.md','model_index.json','scheduler/scheduler_config.json','text_encoder/config.json','text_encoder_2/config.json','tokenizer/vocab.json','tokenizer/merges.txt','tokenizer/special_tokens_map.json','tokenizer/tokenizer_config.json','tokenizer_2/vocab.json','tokenizer_2/merges.txt','tokenizer_2/special_tokens_map.json','tokenizer_2/tokenizer_config.json','unet/config.json','vae/config.json']}}
def digest(p):
 with Path(p).open('rb') as f:return hashlib.file_digest(f,'sha256').hexdigest()
def fetch(url):return urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'Frameforge-local-style'}),timeout=60)
def prepare():
 DEST.mkdir(parents=True,exist_ok=True)
 if LOCK.exists():spec=load_json(LOCK.read_text(encoding='utf-8'))
 else:
  spec={'schema':1,'method':'instantstyle-up-only-global-mean-v1','base':next(x for x in load_json((ROOT/'setup/advanced-models.lock.json').read_text(encoding='utf-8')) if x['group']=='sdxl'),'directory':str(DEST),'files':[],'sources':['https://github.com/instantX-research/InstantStyle','https://huggingface.co/docs/diffusers/using-diffusers/ip_adapter'],'weightLicenses':{'IP-Adapter':'Apache-2.0','SDXL':'CreativeML Open RAIL++-M'}}
  for repo,paths in FILES.items():
   revision=REPOS[repo];metadata=json.load(fetch('https://huggingface.co/api/models/'+repo+'/revision/'+revision+'?blobs=true'));entries={x['rfilename']:x for x in metadata['siblings']}
   for source,local in paths.items():
    row=entries[source];url=f'https://huggingface.co/{repo}/resolve/{revision}/{source}';sha=row.get('lfs',{}).get('sha256')
    if sha is None:
     content=fetch(url).read();sha=hashlib.sha256(content).hexdigest()
     if len(content)!=row['size']:raise ValueError('Metadata size mismatch')
     path=DEST/local;path.parent.mkdir(parents=True,exist_ok=True)
     if path.exists() and digest(path)!=sha:raise ValueError('Existing config differs')
     path.write_bytes(content)
    spec['files'].append({'repo':repo,'revision':revision,'file':source,'path':str(DEST/local),'url':url,'bytes':row['size'],'sha256':sha})
  if sum(x['bytes'] for x in spec['files'])>4_000_000_000:raise ValueError('Style model budget exceeded')
  LOCK.write_text(json.dumps(spec,indent=2),encoding='utf-8')
 def one(item):
  path=Path(item['path']);path.parent.mkdir(parents=True,exist_ok=True)
  if path.exists():
   if path.stat().st_size!=item['bytes'] or digest(path)!=item['sha256']:raise ValueError('Existing model differs: '+str(path))
   return
  part=path.with_suffix(path.suffix+'.partial');offset=part.stat().st_size if part.exists() else 0
  request=urllib.request.Request(item['url'],headers={'User-Agent':'Frameforge-local-style',**({'Range':f'bytes={offset}-'} if offset else {})})
  with urllib.request.urlopen(request,timeout=60) as response:
   if offset and response.status!=206:raise ValueError('Download resume not honored; partial retained')
   with part.open('ab' if offset else 'xb') as out:
    while data:=response.read(4*1024*1024):out.write(data)
  if part.stat().st_size!=item['bytes'] or digest(part)!=item['sha256']:raise ValueError('Downloaded bytes differ: '+str(path))
  part.replace(path);print('Checked '+path.name,flush=True)
 with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:list(pool.map(one,spec['files']))
 if digest(spec['base']['path'])!=spec['base']['sha256']:raise ValueError('Installed SDXL changed')
 print(json.dumps({'ready':True,'files':len(spec['files']),'newBytes':sum(x['bytes'] for x in spec['files']),'baseReused':spec['base']['path']}))
if __name__=='__main__':prepare()
