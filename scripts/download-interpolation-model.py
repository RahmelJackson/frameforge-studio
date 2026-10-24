"""Restore only the small, pinned native FILM checkpoint."""
import hashlib,json,urllib.request
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];lock=json.loads((ROOT/'setup/interpolation-model.lock.json').read_text(encoding='utf-8-sig'));target=(ROOT/lock['path']).resolve()
if not target.is_relative_to((ROOT/'runtime/models/frame_interpolation').resolve()):raise ValueError('Unexpected model location.')
def valid(file):
    with file.open('rb') as stream:return file.stat().st_size==lock['bytes'] and hashlib.file_digest(stream,'sha256').hexdigest()==lock['sha256']
if target.exists():
    if not valid(target):raise ValueError('Existing interpolation weight changed. Preserve it for inspection before restoring.')
else:
    target.parent.mkdir(parents=True,exist_ok=True);partial=target.with_suffix('.part')
    with urllib.request.urlopen(lock['url'],timeout=60) as response,partial.open('wb') as output:
        while chunk:=response.read(1024*1024):output.write(chunk)
    if not valid(partial):raise ValueError('Downloaded interpolation weight failed its size/checksum check.')
    partial.replace(target)
print(json.dumps({'ready':True,'path':str(target),'bytes':lock['bytes'],'sha256':lock['sha256']}))
