from pathlib import Path
import sys
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from track_still_border import tracked_frames
import numpy as np,cv2
from PIL import Image
from body_pose import render
rng=np.random.default_rng(17);original=rng.integers(0,256,(180,280,3),dtype=np.uint8);guide=rng.integers(0,256,(200,320,3),dtype=np.uint8);guide[10:190,20:300]=original
bases=[Image.fromarray(original),Image.fromarray(cv2.warpAffine(original,np.float32([[1,0,1],[0,1,0]]),(280,180),borderMode=cv2.BORDER_REFLECT))]
frames,records=tracked_frames(bases,Image.fromarray(guide),(20,10));assert np.array_equal(frames[0],guide);assert .7<records[1]['matrix'][0][2]<1.3;assert records[1]['edgeHoldPixels']<320*200*.02
for actual,base in zip(frames,bases):assert np.array_equal(np.asarray(actual)[10:190,20:300],base)
for bad in [[Image.new('RGB',(280,180))]*2,[bases[0],Image.fromarray(rng.integers(0,256,(180,280,3),dtype=np.uint8))]]:
    candidate=Image.fromarray(guide.copy());candidate.paste(bad[0],(20,10))
    try:tracked_frames(bad,candidate,(20,10));raise AssertionError('Unsuitable scene was accepted')
    except ValueError:pass
changed=guide.copy();changed[10,20]=255-guide[10,20]
try:tracked_frames(bases,Image.fromarray(changed),(20,10));raise AssertionError('Wrong original accepted')
except ValueError:pass
points=[[.5,.5]]*18;image=render(points,(288,512));assert image.size==(288,512) and np.asarray(image).max()==255
print('Known motion, exact original/first guide, weak-texture/changed-guide/scene-loss refusals pass.')
