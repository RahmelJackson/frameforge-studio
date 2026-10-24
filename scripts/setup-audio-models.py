"""Download only the pinned local audio-stage artifacts; no remote code runs."""
import concurrent.futures,hashlib,json,urllib.request,zipfile
from pathlib import Path,PurePosixPath
ROOT=Path(__file__).resolve().parents[1]
BASE=ROOT/'runtime/audio-models'
LOCK=ROOT/'setup/audio-models.lock.json'

def sha(file):
    with file.open('rb') as handle:return hashlib.file_digest(handle,'sha256').hexdigest()

def download(record):
    target=BASE/record['path'];target.parent.mkdir(parents=True,exist_ok=True)
    if target.exists() and record.get('sha256') and sha(target)==record['sha256']:return record
    pending=target.with_suffix(target.suffix+'.download')
    with urllib.request.urlopen(record['url'],timeout=60) as response,pending.open('wb') as output:
        while chunk:=response.read(1024*1024):output.write(chunk)
    checksum=sha(pending)
    if record.get('sha256') and checksum!=record['sha256']:raise ValueError('Checksum mismatch: '+record['path'])
    if record.get('bytes') and pending.stat().st_size!=record['bytes']:raise ValueError('Size mismatch: '+record['path'])
    if record.get('gitBlob') and hashlib.sha1(b'blob '+str(pending.stat().st_size).encode()+b'\0'+pending.read_bytes()).hexdigest()!=record['gitBlob']:raise ValueError('Pinned Git blob mismatch')
    record.update(sha256=checksum,bytes=pending.stat().st_size);pending.replace(target);print('Verified '+record['path'],flush=True);return record

if __name__=='__main__':
    data=json.loads(LOCK.read_text(encoding='utf-8'));BASE.mkdir(parents=True,exist_ok=True)
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:data['files']=list(pool.map(download,data['files']))
    LOCK.write_text(json.dumps(data,indent=2),encoding='utf-8')
    print('Pinned audio models ready.',flush=True)
