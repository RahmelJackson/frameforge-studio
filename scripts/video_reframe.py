"""Texture-tracked subject crop. Reject lost tracking; never invent missing edges."""
import json,math,sys
from pathlib import Path
import cv2,numpy as np
from video_media import sample_images,encode,crop_image,audio_samples,digest,SIZES

def recover_template(gray,template,last_center,maximum_distance):
    """Require one strong appearance match; repeated similar subjects are ambiguous."""
    scores=cv2.matchTemplate(gray,template,cv2.TM_CCOEFF_NORMED);_,score,_,location=cv2.minMaxLoc(scores)
    th,tw=template.shape;target=np.array([location[0]+tw/2,location[1]+th/2],dtype=float)
    competitors=scores.copy();lx,ly=location;competitors[max(0,ly-th//2):min(scores.shape[0],ly+th//2+1),max(0,lx-tw//2):min(scores.shape[1],lx+tw//2+1)]=-1
    second=float(competitors.max())
    if score<.92 or score-second<.08 or np.linalg.norm(target-last_center)>maximum_distance:return None
    mask=np.zeros(gray.shape,np.uint8);mask[ly:ly+th,lx:lx+tw]=255
    points=cv2.goodFeaturesToTrack(gray,maxCorners=160,qualityLevel=.005,minDistance=3,mask=mask)
    return (target,points,float(score)) if points is not None and len(points)>=6 else None
def render(manifest,directory):
    r=manifest['request'];s=manifest['source'];start=r['start'];end=min(s['duration'],r['end'] if r['end'] is not None else s['duration']);fps=min(30,s['fps']);count=round((end-start)*fps);size=SIZES[r['aspect']]
    if not 2<=count<=900 or end-start>30:raise ValueError('Tracking needs 2-900 frames within 30 seconds.')
    if digest(s['path'])!=s['sha256']:raise ValueError('Source changed.')
    originals=list(sample_images(s['path'],(start+i/fps for i in range(count))));w,h=originals[0].size;x,y,rw,rh=r['region'];center=np.array([(x+rw/2)*w,(y+rh/2)*h]);matrix=np.eye(3);points=None;previous=None;trajectory=[];output=[]
    cv2.setRNGSeed(int(r['seed'])%(2**31));cropw=min(w,h*size[0]/size[1]);croph=cropw*size[1]/size[0];smooth=center.copy();target=center.copy();gap=0;template=None;recoveries=0
    for i,image in enumerate(originals):
        gray=cv2.cvtColor(np.asarray(image),cv2.COLOR_RGB2GRAY);confidence=1.;state='tracked'
        if i:
            failure=None
            try:
                if gap:raise ValueError('Awaiting a unique subject reappearance.')
                predicted,status,_=cv2.calcOpticalFlowPyrLK(previous,gray,points,None,winSize=(25,25),maxLevel=3)
                if predicted is None:raise ValueError('Subject tracking was lost. Use a shorter clip or clearer region.')
                reverse,back,_=cv2.calcOpticalFlowPyrLK(gray,previous,predicted,None,winSize=(25,25),maxLevel=3)
                if reverse is None:raise ValueError('Subject tracking failed its backward check.')
                valid=(status.ravel()>0)&(back.ravel()>0)&(np.linalg.norm(reverse-points,axis=2).ravel()<1.5);confidence=float(valid.mean())
                if valid.sum()<6 or confidence<.55:raise ValueError('Subject became uncertain or occluded. No guessed crop was exported.')
                step,inliers=cv2.estimateAffinePartial2D(points[valid],predicted[valid],method=cv2.RANSAC,ransacReprojThreshold=2)
                if step is None or inliers.sum()<6 or np.linalg.norm(step[:,2])>min(w,h)*.25:raise ValueError('Subject motion is too abrupt for this tracker.')
                matrix=np.vstack([step,[0,0,1]])@matrix;points=predicted[valid].reshape(-1,1,2);target=(matrix@np.array([*center,1]))[:2]
            except ValueError as error:failure=error
            if failure:
                if not r.get('reframeRecovery'):raise failure
                recovered=recover_template(gray,template,target,min(w,h)*.4)
                if recovered:
                    target,points,confidence=recovered;matrix=np.eye(3);matrix[:2,2]=target-center;gap=0;state='reacquired';recoveries+=1
                else:
                    gap+=1;confidence=0.;state='held-gap'
                    if gap>math.floor(fps*.5):raise ValueError('Subject tracking did not recover uniquely within half a second. No guessed crop was exported.')
        smooth=target if i==0 else smooth if state=='held-gap' else smooth+.45*(target-smooth)
        cx=float(np.clip((smooth[0]-cropw/2)/max(w-cropw,1),0,1));cy=float(np.clip((smooth[1]-croph/2)/max(h-croph,1),0,1));output.append(crop_image(image,size,cx,cy));trajectory.append({'frame':i,'confidence':confidence,'state':state,'subjectCenter':target.tolist() if state!='held-gap' else None,'cropX':cx,'cropY':cy})
        if points is None:
            mask=np.zeros((h,w),np.uint8);cv2.rectangle(mask,(round(x*w),round(y*h)),(round((x+rw)*w)-1,round((y+rh)*h)-1),255,-1);points=cv2.goodFeaturesToTrack(gray,maxCorners=160,qualityLevel=.005,minDistance=3,mask=mask)
            if points is None or len(points)<6:raise ValueError('Choose a textured subject region to follow.')
            template=gray[round(y*h):round((y+rh)*h),round(x*w):round((x+rw)*w)].copy()
        previous=gray
    if gap:raise ValueError('Subject tracking remained lost at the end. Trim before the loss or include its reappearance.')
    duration=count/fps;audio=audio_samples(s['path'],duration,s.get('startTime',0)+start)*r['volume'] if s.get('hasAudio') else None
    if audio is not None:audio*=min(1,.98/max(float(np.abs(audio).max()),1e-12))
    encode(output,directory/'preserved.mkv',size,fps,audio,codec='ffv1');encode(output,directory/'output.mp4',size,fps,audio)
    record={'method':'lk-subject-following-crop-v2','trajectory':trajectory,'minimumConfidence':min(v['confidence'] for v in trajectory if v['state']!='held-gap'),'region':r['region'],'recoveries':recoveries,'heldFrames':sum(v['state']=='held-gap' for v in trajectory),'note':'Crops existing pixels. Optional brief gaps hold the crop and require a unique near-exact appearance match within half a second. Changed pose/scale, repeated subjects and long occlusions may fail.'};(directory/'reframing.json').write_text(json.dumps(record,indent=2),encoding='utf-8')
    expected={'frames':count,'fps':fps,'size':list(size),'duration':duration,'hasAudio':audio is not None,'warnings':[],'sourceSha256':s['sha256'],'sourceRange':[start,start+duration],'provenance':{},'reframing':{'sha256':digest(directory/'reframing.json'),'masterSha256':digest(directory/'preserved.mkv')}}
    (directory/'expected.json').write_text(json.dumps(expected,indent=2),encoding='utf-8');(directory/'completed.json').write_text(json.dumps({'sha256':digest(directory/'output.mp4')}),encoding='utf-8');return expected
if __name__=='__main__':
    directory=Path(sys.argv[1]);print(json.dumps(render(json.loads((directory/'manifest.json').read_text(encoding='utf-8')),directory)))
