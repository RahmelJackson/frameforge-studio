"""Pinned BigG counterpart for the upstream InstantStyle content subtraction route."""
import concurrent.futures,json,urllib.request
from workspace_paths import model_root, load_json
from pathlib import Path
from setup_style_shared import digest,fetch,download
ROOT=Path(__file__).resolve().parents[1]
def prepare():
 original=load_json((ROOT/'setup/style-models.lock.json').read_text(encoding='utf-8'))
 dest=(model_root()/'style-content');dest.mkdir(parents=True,exist_ok=True)
 lock=ROOT/'setup/style-content-models.lock.json'
 if lock.exists():spec=load_json(lock.read_text(encoding='utf-8'))
 else:
  repo='h94/IP-Adapter';revision='018e402774aeeddd60609b4ecdb7e298259dc729'
  entries={x['rfilename']:x for x in json.load(fetch(f'https://huggingface.co/api/models/{repo}/revision/{revision}?blobs=true'))['siblings']}
  spec={**original,'method':'instantstyle-up-only-content-subtraction-v2','directory':str(dest),'configDirectory':str(Path(original['directory'])/'sdxl-config'),'files':[x for x in original['files'] if 'sdxl-config' in x['path']]}
  for source,local in {'sdxl_models/image_encoder/config.json':'image_encoder/config.json','sdxl_models/image_encoder/model.safetensors':'image_encoder/model.safetensors','sdxl_models/ip-adapter_sdxl.safetensors':'adapter/ip-adapter_sdxl.safetensors'}.items():
   row=entries[source];url=f'https://huggingface.co/{repo}/resolve/{revision}/{source}';sha=row.get('lfs',{}).get('sha256')
   if sha is None:
    import hashlib
    content=fetch(url).read();sha=hashlib.sha256(content).hexdigest()
    if len(content)!=row['size']:raise ValueError('Config size mismatch')
    p=dest/local;p.parent.mkdir(parents=True,exist_ok=True)
    if p.exists() and digest(p)!=sha:raise ValueError('Existing config differs')
    p.write_bytes(content)
   spec['files'].append({'repo':repo,'revision':revision,'file':source,'path':str(dest/local),'url':url,'bytes':row['size'],'sha256':sha})
  if sum(x['bytes'] for x in spec['files'])>4_400_000_000:raise ValueError('Content model budget exceeded')
  lock.write_text(json.dumps(spec,indent=2),encoding='utf-8')
 with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:list(pool.map(download,spec['files']))
 print(json.dumps({'ready':True,'newModelBytes':sum(x['bytes'] for x in spec['files'] if 'style-content' in x['path'])}))
if __name__=='__main__':prepare()
