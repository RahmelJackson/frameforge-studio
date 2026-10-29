"""Small pinned SyncNet evaluator; kept separate from generation dependencies."""
import hashlib, json, urllib.request, zipfile
from pathlib import Path
root=Path(__file__).resolve().parents[1];runtime=(root/'runtime').resolve()
runtime.mkdir(parents=True, exist_ok=True)
generation=json.loads((root/'setup/latentsync.lock.json').read_text());revision=generation['source']['revision']
archive=runtime/f'latentsync-{revision}.zip'
def digest(p):
    with p.open('rb') as stream:return hashlib.file_digest(stream,'sha256').hexdigest()
if digest(archive)!=generation['source']['sha256']:raise ValueError('Changed source archive')
source=runtime/'lipsync-eval-source';source.mkdir(exist_ok=True)
files={}
with zipfile.ZipFile(archive) as z:
    for relative in ['eval/syncnet/syncnet.py']:
        name=next(n for n in z.namelist() if n.endswith('/'+relative));p=source/'syncnet.py';p.write_bytes(z.read(name));files[p.name]=digest(p)
item={'repo':'ByteDance/LatentSync-1.6','revision':generation['files'][0]['revision'],'file':'auxiliary/syncnet_v2.model','path':'lipsync-eval-models/syncnet_v2.model','bytes':54573114,'sha256':'961e8696f888fce4f3f3a6c3d5b3267cf5b343100b238e79b2659bff2c605442'}
target=runtime/item['path'];target.parent.mkdir(exist_ok=True)
if not target.exists() or digest(target)!=item['sha256']:
    temporary=target.with_suffix('.partial')
    with urllib.request.urlopen(f"https://huggingface.co/{item['repo']}/resolve/{item['revision']}/{item['file']}",timeout=120) as response,temporary.open('wb') as output:
        while chunk:=response.read(4*1024*1024):output.write(chunk)
    if digest(temporary)!=item['sha256'] or temporary.stat().st_size!=item['bytes']:raise ValueError('Changed evaluation weights')
    temporary.replace(target)
(root/'setup/lipsync-eval.lock.json').write_text(json.dumps({'sourceRevision':revision,'sourceFiles':files,'model':item},indent=2))
print('Evaluation weights and architecture verified.')
