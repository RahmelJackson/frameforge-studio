"""Resume an explicitly pinned large model using verified HTTP byte ranges."""
import concurrent.futures,hashlib,json,os,sys,threading,time,urllib.request
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
item=next(x for x in json.loads((ROOT/'setup/advanced-models.lock.json').read_text()) if x['group']==sys.argv[1])
target=Path(item['path']).resolve()
if not target.is_relative_to(Path('D:/FrameforgeModels/storybuilder').resolve()):raise ValueError('Unexpected model destination.')
if target.exists() and target.stat().st_size==item['bytes']:
    with target.open('rb') as f:checksum=hashlib.file_digest(f,'sha256').hexdigest()
    if checksum==item['sha256']:print(json.dumps({'alreadyVerified':str(target)}));sys.exit(0)
target.parent.mkdir(parents=True,exist_ok=True)
partial=target.with_suffix(target.suffix+'.ranged');state=partial.with_suffix('.ranges.json');chunk=32*1024*1024;lock=threading.Lock()
done=set(json.loads(state.read_text()) if state.exists() else [])
if not partial.exists():
    done=set()
    with partial.open('wb') as f:f.truncate(item['bytes'])
def fetch(index):
    start=index*chunk;end=min(item['bytes'],start+chunk)-1
    for attempt in range(5):
        try:
            req=urllib.request.Request(item['url']+('&' if '?' in item['url'] else '?')+'range_part='+str(index),headers={'Range':f'bytes={start}-{end}'})
            with urllib.request.urlopen(req,timeout=90) as response:
                if response.status!=206 or response.headers.get('Content-Range')!=f'bytes {start}-{end}/{item["bytes"]}':raise ValueError('Server ignored the byte range.')
                data=response.read(end-start+2)
            if len(data)!=end-start+1:raise ValueError('Truncated range.')
            with partial.open('r+b') as f:f.seek(start);f.write(data);f.flush()
            with lock:
                done.add(index);temporary=state.with_suffix('.pending');temporary.write_text(json.dumps(sorted(done)));temporary.replace(state)
                if len(done)%8==0:print(json.dumps({'completeChunks':len(done),'chunks':(item['bytes']+chunk-1)//chunk}),flush=True)
            return
        except Exception:
            if attempt==4:raise
            time.sleep(attempt+1)
indices=range((item['bytes']+chunk-1)//chunk)
with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:list(pool.map(fetch,(i for i in indices if i not in done)))
with partial.open('rb') as f:checksum=hashlib.file_digest(f,'sha256').hexdigest()
if checksum!=item['sha256']:raise ValueError('Model checksum mismatch; keep the ranges for diagnosis.')
partial.replace(target);print(json.dumps({'verified':str(target),'sha256':checksum}),flush=True)
