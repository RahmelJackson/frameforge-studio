"""Pin and fetch the LatentSync experiment into this installation’s runtime.

Does not modify an existing environment. Shared Torch is read-only; experiment
dependencies take precedence in a separate environment.
"""
import hashlib, json, sys, urllib.request, zipfile, shutil, subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RUNTIME = (ROOT / 'runtime').resolve()
RUNTIME.mkdir(parents=True, exist_ok=True)
LOCK = ROOT / 'setup/latentsync.lock.json'
SOURCE = RUNTIME / 'latentsync-source'
MODELS = RUNTIME / 'latentsync-models'

def get(url):
    return urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent':'Frameforge-LatentSync-experiment'}), timeout=120)

def digest(file):
    with file.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()

if LOCK.exists():
    lock = json.loads(LOCK.read_text())
else:
    with get('https://api.github.com/repos/bytedance/LatentSync/commits/main') as response:
        revision = json.load(response)['sha']
    lock = {'source': {'repo':'bytedance/LatentSync', 'revision':revision}, 'files':[]}
    for repo, names, prefix in [
        ('ByteDance/LatentSync-1.6', ['latentsync_unet.pt','whisper/tiny.pt'], ''),
    ]:
        with get('https://huggingface.co/api/models/'+repo+'?blobs=true') as response:
            metadata = json.load(response)
        for name in names:
            record = next(x for x in metadata['siblings'] if x['rfilename']==name)
            lock['files'].append({'repo':repo, 'revision':metadata['sha'], 'file':name, 'path':prefix+name,
                                  'bytes':record['size'], 'sha256':record['lfs']['sha256']})
    LOCK.write_text(json.dumps(lock, indent=2), encoding='utf-8')

def download(url, target, expected=None, size=None):
    target.parent.mkdir(parents=True, exist_ok=True)
    if target.exists() and (size is None or target.stat().st_size==size) and expected and digest(target)==expected:
        print('checked',target.name,flush=True)
        return
    temporary = target.with_suffix(target.suffix+'.partial')
    with get(url) as response, temporary.open('wb') as output:
        while chunk := response.read(4*1024*1024):
            output.write(chunk)
    if size and temporary.stat().st_size!=size or expected and digest(temporary)!=expected:
        raise ValueError('Download checksum/size mismatch: '+str(target))
    temporary.replace(target)
    print('downloaded',target.name,target.stat().st_size,flush=True)

revision = lock['source']['revision']
archive = RUNTIME / f'latentsync-{revision}.zip'
download(f'https://codeload.github.com/bytedance/LatentSync/zip/{revision}', archive, lock['source'].get('sha256'))
lock['source']['sha256'] = digest(archive)
with zipfile.ZipFile(archive) as bundle:
    # Only code/configuration/license; no remote demo media is needed.
    base = bundle.namelist()[0].split('/')[0]+'/'
    for member in bundle.infolist():
        relative = member.filename.removeprefix(base)
        if member.is_dir() or not relative or relative.split('/')[0] not in ['latentsync','configs','LICENSE','README.md','requirements.txt']:
            continue
        target = SOURCE / relative
        if not target.resolve().is_relative_to(SOURCE.resolve()):
            raise ValueError('Unsafe archive path')
        target.parent.mkdir(parents=True,exist_ok=True)
        with bundle.open(member) as original, target.open('wb') as output:
            shutil.copyfileobj(original,output)
lock['source']['files'] = {str(p.relative_to(SOURCE)).replace('\\','/'):digest(p) for p in sorted(SOURCE.rglob('*')) if p.is_file() and '__pycache__' not in p.parts}
LOCK.write_text(json.dumps(lock,indent=2),encoding='utf-8')
for item in lock['files']:
    download(f"https://huggingface.co/{item['repo']}/resolve/{item['revision']}/{item['file']}", MODELS/item['path'], item['sha256'],item['bytes'])
print(json.dumps({'ready':True,'source':revision,'bytes':sum(x['bytes'] for x in lock['files'])}),flush=True)
