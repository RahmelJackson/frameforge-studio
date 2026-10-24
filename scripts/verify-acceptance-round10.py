"""Recheck six saved cases and exact preserved pixels; never generates media."""
import json
from pathlib import Path
import numpy as np
from PIL import Image
from video_media import digest,decode_images,sample_images
from lip_holds import held_at

root=Path(__file__).resolve().parents[1];folder=root/'evidence/acceptance-round10'
state=json.loads((folder/'state.json').read_text());counts={key:0 for key in state['budget']};bindings={};records=[]
for name,saved in state['jobs'].items():
    planned=state['requests'][name];group=planned['group'];counts[group]+=1
    directory=root/'data'/('audio-jobs' if group=='audio' else 'jobs')/saved['id']
    job=json.loads((directory/'job.json').read_text());report=json.loads((directory/'report.json').read_text())
    assert job['requestId']==planned['request']['requestId'] and report['technicalPass'],name
    assert not job.get('review') and report.get('creativeApproval','pending')=='pending'
    files={'job.json','report.json'}
    if group=='audio':
        manifest=json.loads((directory/'manifest.json').read_text());track=json.loads((directory/'lipsync.json').read_text())
        files.update(report['files']);files.update(['manifest.json','expected.json'])
        for file,expected in report['files'].items():assert digest(directory/file)==expected,(name,file)
        for source in [manifest['source'],manifest['audio']]:assert digest(Path(source['path']))==source['sha256']
        master=list(decode_images(directory/'preserved.mkv'));originals=list(sample_images(manifest['source']['path'],(i/25 for i in range(track['frames']))))
        assert len(master)==len(originals)==track['frames']==60
        holds=manifest['request'].get('lipHolds',[]);held=0
        for i,(actual,original) in enumerate(zip(master,originals)):
            if held_at(i,25,holds):
                assert np.array_equal(actual,original),(name,i);held+=1
        assert held==(12 if name=='marked-cover' else 0)
    elif group=='video':
        files.update(['manifest.json','expected.json','outpainting.json','output.mp4','preserved.mkv','raw.mp4'])
        manifest=json.loads((directory/'manifest.json').read_text());meta=json.loads((directory/'outpainting.json').read_text())
        assert digest(Path(manifest['source']['path']))==meta['sourceSha256']==report['sourceSha256']
        assert digest(directory/'preserved.mkv')==meta['masterSha256'] and digest(directory/'raw.mp4')==meta['rawSha256']
        assert digest(directory/'output.mp4')==report['sha256']
        actual=list(decode_images(directory/'preserved.mkv'));originals=list(sample_images(manifest['source']['path'],(i/16 for i in range(21))))
        assert len(actual)==len(originals)==21
        x,y=meta['offset'];w,h=meta['fittedSize']
        for i,(image,source) in enumerate(zip(actual,originals)):
            assert np.array_equal(image.crop((x,y,x+w,y+h)),source.resize((w,h),Image.Resampling.LANCZOS)),(name,i)
        if meta.get('guide'):
            guide=root/'data/assets'/meta['guide']['asset'];assert digest(guide)==meta['guide']['sha256']
            assert np.array_equal(actual[0],Image.open(guide).convert('RGB'))
            assert len(meta['boundaryMatches'])==20
    else:
        files.update(['output.png','raw.png']);assert digest(directory/'output.png')==report['sha256']
        assert digest(directory/'raw.png')==report['rawSha256']
        for item in report['provenance'].values():
            if 'name' in item:assert digest(root/'data/assets'/item['name'])==item['sha256']
    bindings[name]={file:digest(directory/file) for file in sorted(files)}
    records.append({'name':name,'id':saved['id'],'technicalPass':True,'creativeApproval':'pending'})
assert counts==state['budget']=={'audio':3,'image':1,'video':2}
bound=folder/'saved-bindings.json'
if bound.exists():assert json.loads(bound.read_text())==bindings,'A saved job or report changed after this checkpoint.'
else:bound.write_text(json.dumps(bindings,indent=2))
quality=json.loads((folder/'lip-quality.json').read_text())
assert quality['real-turn']['timing']['generated']['shiftedControlPass']
assert not quality['real-front']['timing']['original']['shiftedControlPass'],'Retain the low-confidence source diagnostic.'
result={'status':'pass','records':records,'budget':counts,'exactHeldFrames':12,'exactFittedOriginalVideoFrames':42,'broadGoalsOpen':15,'creativeApproval':'pending','limitations':'Timing uncertainty, softened teeth, first-guide transition, seams and invented geometry remain open.'}
(folder/'saved-verification.json').write_text(json.dumps(result,indent=2));print(json.dumps(result))
