"""Bounded 2D tracking of an inspected border still; no new image inference."""
import json,math,sys
from pathlib import Path
try:
    import cv2
except ModuleNotFoundError:
    # Read the already pinned vision runtime without installing into the engine.
    sys.path.append(str(Path(__file__).resolve().parents[1]/'runtime/vision-env/Lib/site-packages'))
    import cv2
import numpy as np
from PIL import Image
from video_media import digest,sample_images,encode,audio_samples
from video_outpaint import SIZES,placement

def tracked_frames(bases,guide,offset,match=False):
    x,y=offset;w,h=bases[0].size;size=guide.size;guide_array=np.asarray(guide)
    if not np.array_equal(guide_array[y:y+h,x:x+w],np.asarray(bases[0])):raise ValueError('The still guide must retain this exact fitted first source frame.')
    gray=cv2.cvtColor(np.asarray(bases[0]),cv2.COLOR_RGB2GRAY)
    points=cv2.goodFeaturesToTrack(gray,maxCorners=800,qualityLevel=.01,minDistance=5)
    if points is None or len(points)<24:raise ValueError('Not enough source texture to track a still border.')
    mask=Image.new('L',size,255);mask.paste(Image.new('L',(w,h),0),offset);records=[];frames=[]
    for index,base in enumerate(bases):
        if index==0:
            frames.append(guide.copy());records.append({'frame':0,'matrix':[[1,0,0],[0,1,0]],'edgeHoldPixels':0});continue
        current=cv2.cvtColor(np.asarray(base),cv2.COLOR_RGB2GRAY)
        moved,valid,_=cv2.calcOpticalFlowPyrLK(gray,current,points,None,winSize=(25,25),maxLevel=3)
        if moved is None:raise ValueError('Still-border tracking lost the scene.')
        returned,back_valid,_=cv2.calcOpticalFlowPyrLK(current,gray,moved,None,winSize=(25,25),maxLevel=3)
        if returned is None:raise ValueError('Still-border reverse tracking failed.')
        keep=(valid.ravel()>0)&(back_valid.ravel()>0)&(np.linalg.norm(points-returned,axis=2).ravel()<.7)
        if keep.sum()<24:raise ValueError('Too few reliable source tracks for the border.')
        matrix,inliers=cv2.estimateAffinePartial2D(points[keep],moved[keep],method=cv2.RANSAC,ransacReprojThreshold=1.2,maxIters=2000,confidence=.99)
        if matrix is None or inliers is None or inliers.sum()<24 or inliers.mean()<.8:raise ValueError('Scene motion is not coherent enough for one tracked still.')
        selected=points[keep][inliers.ravel()>0].reshape(-1,2);coverage=cv2.contourArea(cv2.convexHull(selected))/(w*h)
        predicted=cv2.transform(points[keep],matrix);error=np.linalg.norm(predicted-moved[keep],axis=2).ravel()[inliers.ravel()>0]
        scale=float(np.hypot(matrix[0,0],matrix[1,0]));rotation=math.degrees(math.atan2(matrix[1,0],matrix[0,0]));center=matrix@np.array([w/2,h/2,1])-[w/2,h/2]
        if coverage<.08 or np.median(error)>.6 or not .97<=scale<=1.03 or abs(rotation)>2 or np.linalg.norm(center)>8:raise ValueError('Use a near-static scene: this still-border method refuses large motion or weak scene coverage.')
        outer=matrix.copy();outer[:,2]+=np.array([x,y])-matrix[:,:2]@np.array([x,y])
        warped=cv2.warpAffine(guide_array,outer,size,flags=cv2.INTER_LINEAR,borderMode=cv2.BORDER_CONSTANT)
        visible=cv2.warpAffine(np.ones((size[1],size[0]),np.uint8)*255,outer,size,flags=cv2.INTER_NEAREST)>0
        holes=~visible;holes[y:y+h,x:x+w]=False
        if holes.sum()>size[0]*size[1]*.02:raise ValueError('Tracked still exposes too much missing outer picture. Choose a larger guide or a steadier source.')
        warped[holes]=guide_array[holes];warped[y:y+h,x:x+w]=np.asarray(base);image=Image.fromarray(warped)
        record={'frame':index,'matrix':matrix.tolist(),'tracks':int(inliers.sum()),'inlierFraction':float(inliers.mean()),'coverage':coverage,'medianError':float(np.median(error)),'scale':scale,'rotation':rotation,'centerDelta':center.tolist(),'edgeHoldPixels':int(holes.sum())}
        if match:
            from match_outpaint_border import match_border
            fixed=Image.new('RGB',size);fixed.paste(base,offset);image,record['boundaryMatch']=match_border(image,fixed,mask)
        frames.append(image);records.append(record)
    return frames,records

def render(manifest,directory):
    r=manifest['request'];s=manifest['source'];start=r['start'];end=min(s['duration'],r['end'] if r['end'] is not None else s['duration']);fps=16
    if not .6<=end-start<=3.1:raise ValueError('Keep a still-border preview between 0.6 and 3.1 seconds.')
    if digest(s['path'])!=s['sha256']:raise ValueError('Source changed before border tracking.')
    count=1+4*math.floor((min(49,math.floor((end-start)*fps))-1)/4);size=SIZES[r['aspect']];fitted,offset=placement(s['size'],size,r.get('outpaintInset',0))
    guide_file=Path(manifest['assets'])/r['reference'];guide=Image.open(guide_file).convert('RGB');guide_hash=digest(guide_file)
    if guide.size!=size:raise ValueError('Prepare the expanded still for this exact format and padding.')
    bases=[im.resize(fitted,Image.Resampling.LANCZOS) for im in sample_images(s['path'],(start+i/fps for i in range(count)))];frames,trajectory=tracked_frames(bases,guide,offset,r.get('outpaintMatch',False))
    audio=audio_samples(s['path'],count/fps,s.get('startTime',0)+start)*r['volume'] if s.get('hasAudio') else None
    if audio is not None:audio*=min(1,.98/max(float(np.abs(audio).max()),1e-12))
    if digest(s['path'])!=s['sha256'] or digest(guide_file)!=guide_hash:raise ValueError('Source or guide changed during tracking.')
    encode(frames,directory/'preserved.mkv',size,fps,audio,codec='ffv1');encode(frames,directory/'output.mp4',size,fps,audio)
    meta={'method':'bounded-affine-still-border-v1','frames':count,'fps':fps,'size':list(size),'duration':count/fps,'sourceSha256':s['sha256'],'fittedSize':list(fitted),'offset':list(offset),'inset':r.get('outpaintInset',0),'guide':{'asset':r['reference'],'sha256':guide_hash},'trajectory':trajectory,'masterSha256':digest(directory/'preserved.mkv'),'note':'One still border follows bounded 2D scene motion. Tiny uncovered outer strips retain the initial guide; inspect parallax, frozen content, joins and edge holds.'}
    (directory/'outpainting.json').write_text(json.dumps(meta,indent=2));expected={'frames':count,'fps':fps,'size':list(size),'duration':count/fps,'hasAudio':audio is not None,'sourceSha256':s['sha256'],'warnings':[meta['note']],'provenance':{r['reference']:guide_hash},'outpainting':{'sha256':digest(directory/'outpainting.json'),'masterSha256':meta['masterSha256']}}
    (directory/'expected.json').write_text(json.dumps(expected,indent=2));(directory/'completed.json').write_text(json.dumps({'sha256':digest(directory/'output.mp4')}));return expected
