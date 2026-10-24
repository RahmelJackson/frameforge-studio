"""Saved files, colored controls and original-pixel checks; no model inference."""
import json
from pathlib import Path
import numpy as np
from PIL import Image
from video_media import digest,decode_images,sample_images
root=Path(__file__).resolve().parents[1];folder=root/'evidence/acceptance-round11';state=json.loads((folder/'state.json').read_text());records=[];bindings={};counts={k:0 for k in state['budget']};failed=[]
for name,saved in state['jobs'].items():
    directory=root/'data/jobs'/saved['id'];job=json.loads((directory/'job.json').read_text());assert job['requestId']==state['requests'][name]['request']['requestId'];assert not job.get('review');files={'job.json','workflow.json'}
    if job['status']=='failed':
        assert name in ['pose-raised','pose-raised-repair'] and not (directory/'output.png').exists();failed.append(saved['id'])
    else:
        report=json.loads((directory/'report.json').read_text());assert job['status']=='review-ready' and report['technicalPass'];files.add('report.json');group=state['requests'][name]['group'];counts[group]+=1
        output=directory/('output.png' if group=='image' else 'output.mp4');assert digest(output)==report['sha256'];files.add(output.name)
        if group=='image':
            files.update(['raw.png','identity-models.json']);assert digest(directory/'raw.png')==report['rawSha256']
            for item in report['provenance'].values():
                if 'name' in item:assert digest(root/'data/assets'/item['name'])==item['sha256']
            assert len(json.loads((directory/'identity-models.json').read_text()))==4
        else:
            frames=list(decode_images(output));assert len(frames)==report['frames'] and list(frames[0].size)==report['size']
            files.add('expected.json')
            if group=='camera':
                graph=json.loads((directory/'workflow.json').read_text());assert graph['11']['inputs']['camera_pose']=='Pan Left' and graph['17']['inputs']['images']==['22',0]
            if group in ['motion','local']:
                files.add('manifest.json');m=json.loads((directory/'manifest.json').read_text());assert digest(m['source']['path'])==m['source']['sha256']
                for file,sha in report['provenance'].items():assert digest(root/'data/assets'/file)==sha
            if group=='motion':
                files.update(['input.mp4','prepared.json','raw.mp4']);p=json.loads((directory/'prepared.json').read_text());assert digest(directory/'input.mp4')==p['inputSha256'];assert m['request']['motionGuide']=='prepared-pose'
                actual=np.array([np.asarray(i) for i in decode_images(directory/'input.mp4')],dtype=float);expected=np.array([np.asarray(i) for i in sample_images(m['source']['path'],(i/16 for i in range(29)))],dtype=float);mask=expected.max(axis=3)>40;error=float(np.abs(actual-expected)[mask].mean());chroma=float(np.ptp(actual,axis=3)[mask].mean()/np.ptp(expected,axis=3)[mask].mean());assert error<40 and .65<chroma<1.2
                records.append({'case':name,'coloredGuideForegroundMaeRgb':error,'chromaRetention':chroma})
            if group=='local':
                files.update(['preserved.mkv','outpainting.json']);meta=json.loads((directory/'outpainting.json').read_text());assert digest(directory/'preserved.mkv')==meta['masterSha256'];x,y=meta['offset'];w,h=meta['fittedSize'];master=list(decode_images(directory/'preserved.mkv'));source=list(sample_images(m['source']['path'],(i/16 for i in range(21))));assert len(master)==len(source)==21
                for actual,original in zip(master,source):assert np.array_equal(actual.crop((x,y,x+w,y+h)),original.resize((w,h),Image.Resampling.LANCZOS))
                guide=root/'data/assets'/meta['guide']['asset'];assert digest(guide)==meta['guide']['sha256'];assert np.array_equal(master[0],Image.open(guide).convert('RGB'));assert max(t['edgeHoldPixels'] for t in meta['trajectory'])<512*288*.02
        records.append({'case':name,'id':job['id'],'technicalPass':True,'creativeApproval':'pending'})
    bindings[name]={file:digest(directory/file) for file in sorted(files)}
assert counts=={'image':3,'camera':2,'motion':1,'local':1} and len(failed)==2
file=folder/'saved-bindings.json'
if file.exists():assert json.loads(file.read_text())==bindings,'Saved output or report changed.'
else:file.write_text(json.dumps(bindings,indent=2))
result={'status':'pass','completed':counts,'retainedPreInferenceFailures':failed,'records':records,'broadGoalsOpen':15,'creativeApproval':'pending'};(folder/'saved-verification.json').write_text(json.dumps(result,indent=2));print(json.dumps(result))
