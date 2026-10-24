"""Author a known body-joint driving sequence, without model inference."""
import json,sys,subprocess
from pathlib import Path
import numpy as np
from body_pose import render
from video_media import encode,digest
root=Path(__file__).resolve().parents[1];folder=root/'evidence/acceptance-round11';state=json.loads((folder/'state.json').read_text())
a=state['guides']['standing']['points'];b=state['guides']['raised']['points'];frames=[];trajectory=[]
for index in range(29):
    t=index/28;t=t*t*(3-2*t);points=((1-t)*np.asarray(a)+t*np.asarray(b)).tolist();frames.append(render(points,(288,512)));trajectory.append({'frame':index,'points':points})
file=folder/'body-pose-driver.mp4';encode(frames,file,(288,512),16);(folder/'body-pose-driver.json').write_text(json.dumps({'file':str(file),'sha256':digest(file),'trajectory':trajectory,'method':'authored OpenPose18 smooth arm lift; no detected-human or retargeting claim'},indent=2));print(json.dumps({'file':str(file),'sha256':digest(file),'frames':len(frames)}))
