from pathlib import Path
from types import SimpleNamespace
import copy,sys
import numpy as np
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from pose_retarget import retarget_sequence,reconstruct_checked
from human_pose import points18,fit_sequence,MAPPING
from body_pose import render

def landmarks(points):
    result=[dict(x=.5,y=.5,z=0.,visibility=.1,presence=.1) for _ in range(33)]
    for i,index in enumerate(MAPPING):
        if index is not None and points[i] is not None:
            result[index]=dict(x=points[i][0],y=points[i][1],z=0.,visibility=.95,presence=.95)
    return result

def mapped(rows):return points18([SimpleNamespace(**r) for r in rows])
driver=[[.5,.2],[.5,.3],[.35,.3],[.25,.45],[.2,.65],[.65,.3],[.75,.45],[.8,.65],[.42,.55],[.4,.72],[.38,.9],[.58,.55],[.6,.72],[.62,.9],None,None,None,None]
target=copy.deepcopy(driver)
for index,value in {3:[.23,.37],4:[.13,.38],6:[.77,.37],7:[.87,.38],9:[.41,.68],10:[.39,.8],12:[.59,.68],13:[.61,.8]}.items():target[index]=value
target_rows=landmarks(target);target=mapped(target_rows)
raw_rows=[]
for i in range(5):
    points=[[p[0]+i*.012,p[1]+i*.005] if p else None for p in driver]
    points[4][0]-=i*.015;points[7][1]-=i*.017
    raw_rows.append(landmarks(points))
raw=[mapped(rows) for rows in raw_rows];size=(288,512);target_size=(800,1200)

for framing in ['upper','full']:
    altered,measurements=retarget_sequence(raw,size,target,target_size,framing)
    fitted,fit=fit_sequence(altered,size,framing)
    meta={'size':list(size),'framing':framing,'rawLandmarks':raw_rows,'rawPoints':raw,'points':fitted,'fit':fit,'retarget':measurements,'target':{'size':list(target_size),'landmarks':target_rows,'points':target}}
    checked=reconstruct_checked(meta)
    assert all(np.array_equal(render(a,size),render(b,size)) for a,b in zip(checked,fitted))
    for i,frame in enumerate(altered):
        assert np.allclose(frame[1],raw[i][1]) # Source neck trajectory survives before global fit.
        for bone in measurements['lengths']:
            a,b=bone['from'],bone['to'];out=(np.array(frame[b])-frame[a])*size;inp=(np.array(raw[i][b])-raw[i][a])*size
            assert abs(np.linalg.norm(out)-bone['driverPixels'])<1e-8
            assert np.allclose(out/np.linalg.norm(out),inp/np.linalg.norm(inp))
    assert np.allclose(np.array(fitted[-1][1])-fitted[0][1],(np.array(raw[-1][1])-raw[0][1])*fit['scale'])
    if framing=='upper':assert all(frame[i] is None for frame in fitted for i in range(8,14))
    for mutate in [lambda m:m['retarget']['lengths'][2].update(driverPixels=12),lambda m:m['fit'].update(scale=1),lambda m:m['target']['landmarks'][14].update(x=.1),lambda m:m['rawPoints'][2][4].__setitem__(0,.123),lambda m:m['points'][1][7].__setitem__(1,.123),lambda m:m['rawLandmarks'][1][16].update(visibility=.1),lambda m:m['retarget'].update(method='invented')]:
        changed=copy.deepcopy(meta);mutate(changed)
        try:reconstruct_checked(changed);raise AssertionError('Altered metadata accepted')
        except ValueError:pass

def must_refuse(source,goal,framing='upper'):
    try:retarget_sequence(source,size,goal,target_size,framing);raise AssertionError('Bad anatomy accepted')
    except ValueError:pass
missing=copy.deepcopy(target);missing[4]=None;must_refuse(raw,missing)
tiny=copy.deepcopy(target);tiny[3]=tiny[4][:];must_refuse(raw,tiny)
missing_leg=copy.deepcopy(target);missing_leg[10]=None;must_refuse(raw,missing_leg,'full')
missing_source=copy.deepcopy(raw);missing_source[2][6]=None;must_refuse(missing_source,target)
bad=copy.deepcopy(target);bad[4][0]=float('nan');must_refuse(raw,bad)
# Front-facing portrait and wide reference images must use pixel-space proportions.
_,different_aspect=retarget_sequence(raw,size,target,(1200,800),'upper')
_,original_aspect=retarget_sequence(raw,size,target,target_size,'upper')
assert abs(different_aspect['lengths'][2]['relativeToShoulders']-original_aspect['lengths'][2]['relativeToShoulders'])>.01
print('Target lengths, source directions/root motion, fixed framing, independent reconstruction and rejection controls pass.')
