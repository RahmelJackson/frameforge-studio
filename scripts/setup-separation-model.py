"""Restore the pinned official TorchAudio two-speaker separation weights."""
import argparse,json,urllib.request,hashlib,os
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];LOCK=ROOT/'setup/audio-separation.lock.json'
p=argparse.ArgumentParser();p.add_argument('--record',action='store_true',help='Record an explicitly reviewed first download; refuses to replace a lock.');args=p.parse_args()
url='https://download.pytorch.org/torchaudio/models/conv_tasnet_base_libri2mix.pt';target=ROOT/'runtime/audio-models/separation/conv_tasnet_base_libri2mix.pt';target.parent.mkdir(exist_ok=True,parents=True)
lock=json.loads(LOCK.read_text(encoding='utf-8')) if LOCK.exists() else None
if not lock and not args.record:raise ValueError('A pinned lock is required before restore.')
if lock and args.record:raise ValueError('A lock already exists. Restore without --record; do not silently replace trusted weights.')
def digest(path):
    with path.open('rb') as file:return hashlib.file_digest(file,'sha256').hexdigest()
if not target.exists():
    temporary=target.with_suffix('.part')
    with urllib.request.urlopen(url,timeout=60) as response,temporary.open('wb') as output:
        if response.headers.get('Content-Length') and int(response.headers['Content-Length'])>30000000:raise ValueError('Unexpected model download size.')
        count=0
        while block:=response.read(1024*1024):
            count+=len(block)
            if count>30000000:raise ValueError('Download exceeds the bounded model size.')
            output.write(block)
    if lock and (digest(temporary)!=lock['sha256'] or temporary.stat().st_size!=lock['bytes']):raise ValueError('Model download differs from the pinned weight file.')
    os.replace(temporary,target)
record={'url':url,'path':target.relative_to(ROOT/'runtime/audio-models').as_posix(),'sha256':digest(target),'bytes':target.stat().st_size,'architecture':'torchaudio.models.conv_tasnet_base(num_sources=2)','sampleRate':8000,'sources':2,'runtime':'Existing TorchAudio 2.10.0+cu130, no extra packages','documentation':'https://docs.pytorch.org/audio/2.10.0/generated/torchaudio.pipelines.CONVTASNET_BASE_LIBRI2MIX.html','source':'https://github.com/pytorch/audio/tree/v2.10.0/examples/source_separation','hashProvenance':'First download over HTTPS from official PyTorch asset host; hash pinned locally. Future restore refuses any changed bytes.'}
if lock and (record['sha256']!=lock['sha256'] or record['bytes']!=lock['bytes']):raise ValueError('Installed separation weights changed.')
if args.record:LOCK.write_text(json.dumps(record,indent=2),encoding='utf-8')
print(json.dumps(record,indent=2))
