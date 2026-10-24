"""Back up source, project state and media; verify before restoring to a new folder."""
import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import zipfile

root=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser();parser.add_argument('--restore',type=Path);parser.add_argument('--target',type=Path);parser.add_argument('--verify-only',action='store_true')
args=parser.parse_args()
def digest(path):
    with path.open('rb') as handle:return hashlib.file_digest(handle,'sha256').hexdigest()
if args.restore:
    archive=args.restore.resolve()
    expected=archive.with_suffix('.sha256').read_text(encoding='utf-8').strip()
    if digest(archive)!=expected:raise ValueError('Backup archive checksum mismatch')
    with zipfile.ZipFile(archive) as bundle:
        records=json.loads(bundle.read('BACKUP-MANIFEST.json'))
        for name,expected in records['files'].items():
            relative=PurePosixPath(name)
            if relative.is_absolute() or '..' in relative.parts or '\\' in name or ':' in name:raise ValueError('Unsafe backup path')
            if hashlib.sha256(bundle.read(name)).hexdigest()!=expected:raise ValueError(f'Backup file checksum mismatch: {name}')
        if args.verify_only:
            print(json.dumps({'verified':True,'files':len(records['files']),'archive':str(archive)}));raise SystemExit
        if not args.target:raise ValueError('Restore requires a new target folder')
        target=args.target.resolve()
        if not target.is_relative_to(root) or target.exists():raise ValueError('Restore target must be a new folder inside this project')
        target.mkdir(parents=True)
        for name in records['files']:
            output=target/Path(name);output.parent.mkdir(parents=True,exist_ok=True);output.write_bytes(bundle.read(name))
        settings=target/'config.local.json'
        config=json.loads(settings.read_text(encoding='utf-8-sig'))
        config.pop('storageRoot',None)  # A restored checkout must not write into the live studio runtime.
        config['python']=str(target/'runtime/engine-env/Scripts/python.exe');config['comfySource']=str(target/'runtime/comfy-engine')
        settings.write_text(json.dumps(config,indent=2),encoding='utf-8')
    print(json.dumps({'restored':True,'target':str(target),'files':len(records['files']),'next':'Run setup-engine.ps1 and restore/download model files before launching.'}));raise SystemExit
directory=root/'backups';directory.mkdir(exist_ok=True)
archive=directory/('studio-'+datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')+'.zip')
records={}
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as bundle:
    for folder,directories,files in os.walk(root):
        directories[:]=[name for name in directories if name not in {'runtime','.git','backups','restore-check','__pycache__'}]
        for filename in files:
            source=Path(folder)/filename
            if source.is_symlink() or source.suffix=='.pyc' or filename.startswith('config.cloud.local.json') or filename=='.env':continue
            relative=source.relative_to(root)
            if relative.parts[0]=='evidence' and source.suffix not in {'.json','.md','.txt','.log'}:continue
            name=relative.as_posix();records[name]=digest(source);bundle.write(source,name)
    bundle.writestr('BACKUP-MANIFEST.json',json.dumps({'created':datetime.now(timezone.utc).isoformat(),'files':records,'excludes':'Model weights, installed runtime, Git internals, prior backups, API credentials, large visual evidence'},indent=2))
archive.with_suffix('.sha256').write_text(digest(archive),encoding='utf-8')
print(json.dumps({'backup':str(archive),'files':len(records),'bytes':archive.stat().st_size}))
