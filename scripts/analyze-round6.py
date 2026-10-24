"""Independent measurements on the recorded previews; never approves takes."""
import json,re
from pathlib import Path
import numpy as np
from video_media import decode_images
ROOT=Path(__file__).resolve().parents[1];folder=ROOT/'evidence/acceptance-round6';state=json.loads((folder/'state.json').read_text(encoding='utf-8'))
def job_path(key):return ROOT/('data/audio-jobs' if state['jobs'][key]['route']=='/api/audio-jobs' else 'data/jobs')/state['jobs'][key]['id']
errors=[];motion=[]
for i,image in enumerate(decode_images(job_path('motion-reference')/'output.mp4')):
    a=np.asarray(image);mask=(a[:,:,0]>80)&(a[:,:,0]>a[:,:,1]*1.4)&(a[:,:,2]<90);ys,xs=np.where(mask)
    if len(xs)<30:raise ValueError('Motion fixture subject cannot be measured.')
    actual=[float(np.median(xs)/image.width),float(np.median(ys)/image.height)];expected=[(100+7*i/16*24)/640,.5];error=float(np.linalg.norm(np.array(actual)-expected));errors.append(error);motion.append({'frame':i,'expected':expected,'actual':actual,'error':error})
record={'motionFixture':{'method':'Independent orange-pixel median against known original horizontal path','maximumNormalizedPositionError':max(errors),'meanNormalizedPositionError':float(np.mean(errors)),'pathWithinEightPercent':max(errors)<.08,'frames':motion,'visualLimit':'Background appearance changes into brighter blue grid lines. Human pose/occlusion untested.'},'creativeFindings':{'forwardExtension':'Reject broad continuity: unwanted dark foreground object and dome distortion appear in the generated section.','backwardExtension':'Narrow static-observatory comparison looks stable; not broad action-continuation acceptance.','sketch':'Requested upward balloon motion is not clear; stray ink artifacts appear. Still open.','profiles':'Static text-to-video architectural examples; do not establish action/identity quality or maximum hardware capacity.'},'creativeApproval':'pending'}
(folder/'quality-measurements.json').write_text(json.dumps(record,indent=2),encoding='utf-8');print(json.dumps({'motionMeanError':record['motionFixture']['meanNormalizedPositionError'],'motionMaxError':max(errors),'pathPass':max(errors)<.08,'creativeApproval':'pending'}))
