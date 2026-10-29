"""Pinned optional speech families stored in the configured model folder."""
import json
from workspace_paths import model_root, load_json
from pathlib import Path
from video_media import digest
ROOT=Path(__file__).resolve().parents[1]
MODEL_ROOT=model_root()
def bind(family):
    records=[r for r in load_json((ROOT/'setup/round12-speech-models.lock.json').read_text()) if r['directory']==family]
    if not records:raise ValueError('Missing pinned speech family.')
    result={}
    for r in records:
        file=MODEL_ROOT/family/Path(r['path']).name
        if digest(file)!=r['sha256']:raise ValueError('Changed speech model: '+str(file))
        result['round12/'+family+'/'+file.name]=r['sha256']
    return result
