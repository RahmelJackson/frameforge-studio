"""Known-position fast movement with an opaque foreground occluder."""
from pathlib import Path
import json,sys
import numpy as np
from PIL import Image,ImageDraw
sys.path.insert(0,str(Path(__file__).resolve().parent))
from video_media import encode,decode_images,digest
folder=Path('evidence/acceptance-round4');folder.mkdir(exist_ok=True)
def frame(t):
    y,x=np.indices((192,320));rgb=np.stack([35+x//8,45+y//8,55+(x+y)//16],axis=-1).astype('uint8');image=Image.fromarray(rgb);draw=ImageDraw.Draw(image)
    center=24+abs(((t*28+180)%544)-272);left=round(center-19)
    draw.rectangle((left,70,left+38,114),fill='#ed762b');draw.rectangle((left+5,75,left+12,107),fill='#fff3b8');draw.line((left+4,110,left+33,78),fill='#1b334e',width=3)
    draw.rectangle((140,30,190,155),fill='#8cb2ac');draw.line((140,30,140,155),fill='#e5f2dc',width=2)
    return image
if '--compare' not in sys.argv:
    original=[frame(i) for i in range(24)];truth=[frame(min(i/2,23)) for i in range(48)]
    encode(original,folder/'fast-occlusion-source.mp4',(320,192),8)
    encode(truth,folder/'fast-occlusion-truth.mkv',(320,192),16,codec='ffv1')
    (folder/'fast-occlusion-fixture.json').write_text(json.dumps({'sourceSha256':digest(folder/'fast-occlusion-source.mp4'),'truthSha256':digest(folder/'fast-occlusion-truth.mkv'),'sourceFrames':24,'speedPixelsPerSourceFrame':28,'occluder':[140,30,190,155],'truth':'Known-position opaque composition; original endpoints preserved in interpolation.'},indent=2))
else:
    state=json.loads((folder/'state.json').read_text());truth=list(decode_images(folder/'fast-occlusion-truth.mkv'));metrics={}
    for label in ['fast-film','fast-rife']:
        directory=Path('data/jobs')/state['jobs'][label];actual=list(decode_images(directory/'preserved.mkv'));values=[];occlusion=[]
        for i in range(1,47,2):
            error=np.abs(np.asarray(actual[i],dtype=float)-np.asarray(truth[i],dtype=float));values.append(float(error[65:120].mean()));occlusion.append(float(error[65:120,135:196].mean()))
        metrics[label]={'motionBandMeanRgbError':float(np.mean(values)),'motionBandWorstRgbError':max(values),'occlusionBandMeanRgbError':float(np.mean(occlusion)),'occlusionBandWorstRgbError':max(occlusion),'perIntermediateFrame':values,'creativeAcceptance':'pending visual inspection; synthetic metrics alone do not establish natural motion quality'}
    (folder/'motion-comparison.json').write_text(json.dumps(metrics,indent=2));print(json.dumps(metrics))
