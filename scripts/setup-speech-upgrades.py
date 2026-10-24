"""Pinned official local speech weights; no automatic inference-time downloads."""
import hashlib,json,urllib.request,time
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
DEST=ROOT/'runtime/speech-models'
LOCK=ROOT/'setup/speech-upgrades.lock.json'
SPECS=[('ResembleAI/chatterbox','chatterbox',['s3gen.safetensors','t3_cfg.safetensors','ve.safetensors','tokenizer.json','conds.pt','README.md']),('Helsinki-NLP/opus-mt-es-en','translation-es-en',['config.json','generation_config.json','pytorch_model.bin','source.spm','target.spm','vocab.json','tokenizer_config.json','README.md'])]
def get(url):
    return urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'Frameforge-local-setup'}),timeout=90)
def digest(p):
    with p.open('rb') as f:return hashlib.file_digest(f,'sha256').hexdigest()
if LOCK.exists():lock=json.loads(LOCK.read_text(encoding='utf-8'))
else:
    lock={'sources':[],'files':[]}
    for repo,folder,names in SPECS:
        with get('https://huggingface.co/api/models/'+repo+'?blobs=true') as r:meta=json.load(r)
        revision=meta['sha'];lock['sources'].append({'repo':repo,'revision':revision,'folder':folder})
        for name in names:
            item=next(x for x in meta['siblings'] if x['rfilename']==name);record={'repo':repo,'revision':revision,'path':folder+'/'+name,'file':name,'bytes':item['size'],'sha256':item.get('lfs',{}).get('sha256')}
            if not record['sha256']:
                with get(f'https://huggingface.co/{repo}/resolve/{revision}/{name}') as r:record['sha256']=hashlib.sha256(r.read()).hexdigest()
            lock['files'].append(record)
    LOCK.write_text(json.dumps(lock,indent=2),encoding='utf-8',newline='\n')
for item in lock['files']:
    p=DEST/item['path'];p.parent.mkdir(parents=True,exist_ok=True)
    if p.exists() and p.stat().st_size==item['bytes'] and digest(p)==item['sha256']:print('checked',item['path'],flush=True);continue
    temp=p.with_suffix(p.suffix+'.partial');url=f"https://huggingface.co/{item['repo']}/resolve/{item['revision']}/{item['file']}"
    for attempt in range(3):
        try:
            with get(url) as r,temp.open('wb') as out:
                while chunk:=r.read(4*1024*1024):out.write(chunk)
            if temp.stat().st_size!=item['bytes'] or digest(temp)!=item['sha256']:raise ValueError('Model checksum mismatch: '+item['path'])
            temp.replace(p);print('downloaded',item['path'],item['bytes'],flush=True);break
        except Exception:
            if attempt==2:raise
            time.sleep(2)
print(json.dumps({'ready':True,'bytes':sum(x['bytes'] for x in lock['files'])}),flush=True)
