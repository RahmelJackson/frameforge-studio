"""Independent saved-output measurements; never assigns creative approval."""
import json,math,re
from pathlib import Path
import cv2,numpy as np
from PIL import Image
from video_media import decode_images,sample_images
ROOT=Path(__file__).resolve().parents[1];folder=ROOT/'evidence/acceptance-round7';state=json.loads((folder/'state.json').read_text(encoding='utf-8'));result={'creativeApproval':'pending'}
def path(name):return ROOT/('data/audio-jobs' if state['jobs'][name]['route']=='/api/audio-jobs' else 'data/jobs')/state['jobs'][name]['id']
def ready(name):return name in state['jobs'] and (path(name)/'report.json').exists() and json.loads((path(name)/'report.json').read_text(encoding='utf-8')).get('technicalPass')
def frames(name):return list(decode_images(path(name)/'output.mp4'))
def psnr(a,b):
    error=float(np.mean((np.asarray(a,dtype=float)-np.asarray(b,dtype=float))**2));return -10*math.log10(max(error,1e-10)/255**2)
camera={}
for name in state['jobs']:
    if not name.startswith('camera-') or not ready(name):continue
    previous=None;matrix=np.eye(3);valid=0;count=0
    for image in frames(name):
        gray=cv2.cvtColor(np.asarray(image),cv2.COLOR_RGB2GRAY)
        if previous is not None:
            pts=cv2.goodFeaturesToTrack(previous,maxCorners=1000,qualityLevel=.01,minDistance=8)
            new,status,_=cv2.calcOpticalFlowPyrLK(previous,gray,pts,None,winSize=(25,25),maxLevel=3)
            if new is not None:
                good=status.ravel()>0;step,inliers=cv2.estimateAffinePartial2D(pts[good],new[good],method=cv2.RANSAC,ransacReprojThreshold=2)
                if step is not None and inliers.sum()>=15:matrix=np.vstack([step,[0,0,1]])@matrix;valid+=1
        previous=gray;count+=1
    h,w=previous.shape;center=(matrix@np.array([w/2,h/2,1]))[:2]-[w/2,h/2]
    camera[name]={'framePairs':count-1,'fittedPairs':valid,'screenRotationDegrees':math.degrees(math.atan2(matrix[1,0],matrix[0,0])),'cumulativeScale':float(np.hypot(matrix[0,0],matrix[1,0])),'screenCenterDeltaPixels':center.tolist(),'method':'Sequential robust partial-affine fit of tracked scene features. Parallax and generated geometry can bias these estimates.'}
result['camera']=camera
if ready('motion-detail'):
    rows=[]
    for i,image in enumerate(frames('motion-detail')):
        a=np.asarray(image,dtype=float);mask=(a[:,:,0]>80)&(a[:,:,0]>a[:,:,1]*1.4)&(a[:,:,2]<90);ys,xs=np.where(mask)
        if not len(xs):continue
        actual=[float(np.median(xs)/image.width),float(np.median(ys)/image.height)];expected=[(100+7*i/16*24)/640,.5];rows.append({'frame':i,'actual':actual,'expected':expected,'error':float(np.linalg.norm(np.array(actual)-expected))})
    result['motionDetail']={'frames':rows,'meanNormalizedPositionError':float(np.mean([r['error'] for r in rows])),'maximumNormalizedPositionError':max(r['error'] for r in rows),'note':'A path error measures this colored toy only; it does not establish human motion transfer.'}
if ready('sketch-guided'):
    ys=[]
    for image in frames('sketch-guided'):
        a=np.asarray(image).mean(axis=2);mask=a<85;mask[int(image.height*.91):]=False;y,x=np.where(mask);ys.append(float(np.median(y)) if len(y) else None)
    result['sketch']={'inkMedianY':ys,'expectedDirection':'decreasing Y for upward balloon motion','note':'Also inspect line integrity and background. Dark projection alone cannot identify a balloon.'}
for name in ['interpolate-film','interpolate-rife']:
    if not ready(name):continue
    master=list(decode_images(path(name)/'preserved.mkv'));truth=list(decode_images(ROOT/'evidence/acceptance-round6/tracking-source.mp4'));values=[];linear=[]
    for i in range(1,min(len(truth)-1,len(master)),2):
        a=truth[i-1].resize(master[i].size);b=truth[i+1].resize(master[i].size);baseline=Image.fromarray(np.rint((np.asarray(a,dtype=float)+np.asarray(b,dtype=float))/2).astype('uint8'));values.append(psnr(master[i],truth[i].resize(master[i].size)));linear.append(psnr(baseline,truth[i].resize(master[i].size)))
    result[name]={'insertedFrameMeanPsnrDb':float(np.mean(values)),'linearBlendMeanPsnrDb':float(np.mean(linear)),'comparedFrames':len(values),'note':'Known moving-box ground truth; no claim for human occlusion or fast deforming motion.'}
for upscale_case in ['upscale-detail','upscale-faithful']:
    if not ready(upscale_case):continue
    output=frames(upscale_case);source=list(decode_images(folder/'upscale-low.mp4'));truth=list(sample_images(ROOT/'data/jobs/8fb32064-6c5e-4f62-8ab6-5bb2ce2bc5c1/output.mp4',(i/24 for i in range(len(output)))));ai=[];baseline=[]
    for actual,low,original in zip(output,source,truth):ai.append(psnr(actual,original.resize(actual.size)));baseline.append(psnr(low.resize(actual.size,Image.Resampling.BICUBIC),original.resize(actual.size)))
    result[upscale_case]={'generatedMeanPsnrDb':float(np.mean(ai)),'bicubicMeanPsnrDb':float(np.mean(baseline)),'frames':len(ai),'note':'Reconstruction against an existing high-resolution studio clip. Inspect invented detail separately.'}
def clean(text):return re.sub(r'[^\w]+',' ',text.lower().replace('9','nine')).strip()
known={'colored-noise-asr':'Welcome back. The garden opens at nine. Great. I will bring the camera. Please meet me by the gate. I will see you there.','overlap-asr':'Welcome back. The garden opens at nine. Great. I will bring the camera.'}
if 'expressive-asr' in state['jobs']:known['expressive-asr']='The train is leaving. We need to hurry. I have the tickets. Follow me to the platform.'
words=[]
for name,expected in known.items():
    if ready(name):
        actual=json.loads((path(name)/'transcript.json').read_text(encoding='utf-8'))['text'];words.append({'case':name,'expected':expected,'actual':actual,'allKnownWordsMatch':clean(expected)==clean(actual)})
result['knownScripts']=words
(folder/'quality-measurements.json').write_text(json.dumps(result,indent=2),encoding='utf-8');print(json.dumps({k:v for k,v in result.items() if k not in ['camera','motionDetail','sketch']},indent=2))
