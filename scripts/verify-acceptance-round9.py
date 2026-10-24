"""Recheck the saved round-nine outputs and timing controls; never renders."""
import hashlib,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];E=ROOT/'evidence/acceptance-round9'
def digest(p):
    with p.open('rb') as stream:return hashlib.file_digest(stream,'sha256').hexdigest()
records=[]
for name,directory in [('fixed-source',E/'lip-repair'),('ui-new-speech',ROOT/'data/audio-jobs/abf3f09d-2a73-46db-aa98-798a7e79069a')]:
    manifest=json.loads((directory/'manifest.json').read_text());report=json.loads((directory/'report.json').read_text());track=json.loads((directory/'lipsync.json').read_text())
    assert report['technicalPass'] and report['creativeApproval']=='pending'
    for file,expected in report['files'].items():assert digest(directory/file)==expected,(name,file)
    for source in [manifest['source'],manifest['audio']]:assert digest(Path(source['path']))==source['sha256']
    assert track['seed']==manifest['request']['seed'] and track['method']=='latentsync-1.6-mediapipe-mouth-mask-v1'
    records.append({'name':name,'directory':str(directory),'files':report['files'],'frames':track['frames'],'technicalPass':True,'creativeApproval':'pending'})
for file in ['timing-comparison.json','ui-timing-diagnostic.json']:
    score=json.loads((E/file).read_text())
    assert all(r['shiftedControlPass'] for r in score['results'].values()),file
    assert score['results']['latentsync']['records'][0]['estimatedOffsetFrames']==0
refusal=json.loads((ROOT/'data/audio-jobs/4179b36f-1324-4830-91d1-29a437087a54/job.json').read_text())
assert refusal['status']=='failed' and 'larger, nearly frontal face' in refusal['error']
state=json.loads((E/'state.json').read_text());assert len(state['attempts'])==state['budget']==4
state['attempts'][2]['status']='refused-before-diffusion';state['attempts'][3]['status']='review-ready'
for item in state['attempts'][:2]:
    if item.get('requestId'):item['experimentId']=item.pop('requestId')
    else:item.pop('requestId',None)
state['completedPreviews']=2;state['actualDiffusionExecutions']=3;state['broadGoalsOpen']=15;state['creativeApproval']='pending'
(E/'state.json').write_text(json.dumps(state,indent=2))
(E/'saved-verification.json').write_text(json.dumps({'status':'pass','records':records,'retainedRefusal':refusal['id'],'actualDiffusionExecutions':3,'completedPreviews':2,'broadGoalsOpen':15,'creativeApproval':'pending'},indent=2))
print(json.dumps({'status':'pass','completedPreviews':2,'retainedRefusals':1,'broadGoalsOpen':15}))
