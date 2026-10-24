"""Install a pinned local model suite; partial downloads are resumed and hashed."""
import argparse, hashlib, json, pathlib, shutil, time
import requests

ROOT = pathlib.Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--destination', default='D:/FrameforgeModels/storybuilder')
parser.add_argument('--manifest', default='setup/image-models.lock.json')
parser.add_argument('--record', default='runtime/image-models-manifest.json')
args = parser.parse_args()
destination = pathlib.Path(args.destination).resolve()
models = json.loads((ROOT/args.manifest).read_text(encoding='utf-8'))
destination.mkdir(parents=True, exist_ok=True)
def digest(file):
    h = hashlib.sha256()
    with file.open('rb') as stream:
        for chunk in iter(lambda: stream.read(16*1024*1024), b''): h.update(chunk)
    return h.hexdigest()

for model in models:
    target = destination/model['directory']/pathlib.Path(model['path']).name
    target.parent.mkdir(parents=True, exist_ok=True)
    if target.exists():
        if target.stat().st_size == model['bytes'] and digest(target) == model['sha256']:
            print('Verified existing', target.name, flush=True); continue
        raise RuntimeError('Existing model differs; preserve and inspect: '+str(target))
    partial = target.with_suffix(target.suffix+'.partial')
    offset = partial.stat().st_size if partial.exists() else 0
    if shutil.disk_usage(destination).free < model['bytes']-offset+2*1024**3: raise RuntimeError('Insufficient space')
    print('Downloading', target.name, 'bytes', model['bytes'], 'resume', offset, flush=True)
    url = f"https://huggingface.co/{model['repo']}/resolve/{model['revision']}/{model['path']}"
    for attempt in range(5):
        try:
            offset = partial.stat().st_size if partial.exists() else 0
            if offset == model['bytes']: break
            with requests.get(url, headers={'Range':f'bytes={offset}-'} if offset else {}, stream=True, timeout=(30,120)) as response:
                response.raise_for_status()
                if offset and response.status_code != 206: raise RuntimeError('Server did not honor resume')
                with partial.open('ab' if offset else 'wb') as stream:
                    last = time.monotonic()
                    for chunk in response.iter_content(8*1024*1024):
                        stream.write(chunk); offset += len(chunk)
                        if time.monotonic()-last > 30: print(target.name, offset, '/', model['bytes'], flush=True); last=time.monotonic()
            break
        except (requests.RequestException, OSError) as error:
            print('Download interrupted:', str(error)[:180], flush=True)
            if attempt == 4: raise
            time.sleep(3)
    if partial.stat().st_size != model['bytes'] or digest(partial) != model['sha256']: raise RuntimeError('Checksum mismatch: '+str(partial))
    partial.rename(target)
    print('Verified', target.name, flush=True)
(ROOT/args.record).write_text(json.dumps({'directory':str(destination),'models':models},indent=2),encoding='utf-8')
print('All pinned models verified', flush=True)
