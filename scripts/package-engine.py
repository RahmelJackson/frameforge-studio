"""Snapshot the used engine source and exact active dependency closure for setup."""
import hashlib
import importlib.metadata as metadata
import json
import os
import sys
from pathlib import Path
import zipfile
from packaging.requirements import Requirement
from packaging.utils import canonicalize_name

root=Path(__file__).resolve().parents[1]
config=json.loads((root/'config.local.json').read_text(encoding='utf-8-sig'))
source=Path(sys.argv[1] if len(sys.argv)>1 else config['comfySource'])
output=root/'setup';output.mkdir(exist_ok=True)
requirements=[]
for line in (source/'requirements.txt').read_text(encoding='utf-8').splitlines():
    line=line.strip()
    if line and not line.startswith('#'):requirements.append(Requirement(line))
requirements.append(Requirement('comfyui-frontend-package'))
pending=requirements[:];versions={}
while pending:
    requirement=pending.pop()
    if requirement.marker and not requirement.marker.evaluate({'extra':''}):continue
    name=canonicalize_name(requirement.name)
    if name in versions:continue
    dist=metadata.distribution(name);versions[name]=dist.version
    for value in dist.requires or []:
        req=Requirement(value)
        if not req.marker or req.marker.evaluate({'extra':''}):pending.append(req)
(output/'requirements-windows.lock.txt').write_text('--extra-index-url https://download.pytorch.org/whl/cu130\n'+''.join(f'{name}=={version}\n' for name,version in sorted(versions.items())),encoding='utf-8')
archive=output/'comfy-engine-source.zip'
excluded={'.git','.github','.ci','__pycache__','models','input','output','custom_nodes','user','temp','web_custom_versions','tests','tests-unit'}
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as bundle:
    for folder,directories,files in os.walk(source):
        directories[:]=[d for d in directories if d!='__pycache__' and (Path(folder)!=source or d not in excluded)]
        for filename in files:
            target=Path(folder)/filename
            if target.is_symlink() or target.suffix=='.pyc':continue
            bundle.write(target,target.relative_to(source).as_posix())
with zipfile.ZipFile(archive) as bundle:
    for critical in ['main.py','execution.py','comfy/ldm/models/autoencoder.py','LICENSE']:
        if critical not in bundle.namelist():raise RuntimeError('Incomplete engine snapshot: '+critical)
digest=hashlib.file_digest(archive.open('rb'),'sha256').hexdigest()
manifest={'engineVersion':'0.22.3','sourceArchive':archive.name,'sha256':digest,'python':'3.12','platform':'Windows x64','torch':versions['torch'],'dependencies':len(versions),'sourceOrigin':'Installed ComfyUI source snapshot; upstream GPL license retained in archive','omitted':['models','input/output/user data','third-party custom nodes','tests','caches']}
(output/'manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
print(json.dumps(manifest,indent=2));print('Archive bytes:',archive.stat().st_size)
