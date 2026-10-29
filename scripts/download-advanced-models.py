"""Resumable, checksummed selected local models; no dependency or engine changes."""
import concurrent.futures,hashlib,json,urllib.request
from workspace_paths import model_root, load_json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def sha(file):
    with file.open('rb') as stream:return hashlib.file_digest(stream,'sha256').hexdigest()
def download(item):
    target=Path(item['path']);target=target if target.is_absolute() else ROOT/target
    if not (target.resolve().is_relative_to((ROOT/'runtime').resolve()) or target.resolve().is_relative_to(model_root().resolve())):raise ValueError('Model target outside configured roots.')
    target.parent.mkdir(exist_ok=True,parents=True)
    if target.exists():
        if sha(target)!=item['sha256']:raise ValueError('Existing model changed: '+str(target))
        return item['group']+' already verified'
    partial=target.with_suffix(target.suffix+'.part');offset=partial.stat().st_size if partial.exists() else 0
    if offset<item['bytes']:
        request=urllib.request.Request(item['url'],headers={'Range':'bytes='+str(offset)+'-'} if offset else {})
        with urllib.request.urlopen(request,timeout=120) as response:
            append=offset>0 and response.status==206
            with partial.open('ab' if append else 'wb') as output:
                while chunk:=response.read(8*1024*1024):output.write(chunk)
    if partial.stat().st_size!=item['bytes'] or sha(partial)!=item['sha256']:raise ValueError('Model checksum mismatch: '+str(target))
    partial.replace(target);return item['group']+' verified '+target.name
if __name__=='__main__':
    lock=load_json((ROOT/'setup/advanced-models.lock.json').read_text(encoding='utf-8'))
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        for task in concurrent.futures.as_completed([pool.submit(download,item) for item in lock]):print(task.result(),flush=True)
