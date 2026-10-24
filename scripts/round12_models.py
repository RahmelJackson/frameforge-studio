"""Pinned optional speech families stored on the user's D: model drive."""
import json
from pathlib import Path
from video_media import digest
ROOT=Path(__file__).resolve().parents[1]
MODEL_ROOT=Path('D:/FrameforgeModels/storybuilder')
def bind(family):
    records=[r for r in json.loads((ROOT/'setup/round12-speech-models.lock.json').read_text()) if r['directory']==family]
    if not records:raise ValueError('Missing pinned speech family.')
    result={}
    for r in records:
        file=MODEL_ROOT/family/Path(r['path']).name
        if digest(file)!=r['sha256']:raise ValueError('Changed speech model: '+str(file))
        result['round12/'+family+'/'+file.name]=r['sha256']
    return result
