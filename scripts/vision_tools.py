"""Local, bounded vision finishing. Runs in the isolated vision environment."""
import argparse, hashlib, json, os
from pathlib import Path
import cv2
import numpy as np
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
os.environ.setdefault("MPLCONFIGDIR",str(ROOT/"runtime/vision-cache"))

def digest(file):
    return hashlib.sha256(Path(file).read_bytes()).hexdigest()

def rgb(file):
    return np.asarray(ImageOps.exif_transpose(Image.open(file)).convert('RGB')).copy()

def landmarks(image):
    import mediapipe as mp
    model = ROOT/'runtime/vision-models/face_landmarker.task'
    expected = json.loads((ROOT/'setup/vision-models.lock.json').read_text(encoding='utf-8'))['models'][0]
    if digest(model) != expected['sha256']:
        raise ValueError('Face landmark model checksum changed. Restore the pinned model.')
    options = mp.tasks.vision.FaceLandmarkerOptions(base_options=mp.tasks.BaseOptions(model_asset_path=str(model)), num_faces=2)
    with mp.tasks.vision.FaceLandmarker.create_from_options(options) as detector:
        result = detector.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=image))
    if len(result.face_landmarks) != 1:
        raise ValueError('Choose an aligned image with exactly one clearly visible face.')
    return np.array([(p.x*image.shape[1], p.y*image.shape[0]) for p in result.face_landmarks[0]], np.float32), expected['sha256']

def face_match(target, candidate, strength=1):
    if target.shape != candidate.shape:
        raise ValueError('Target and edited face must use the same framing and dimensions.')
    a, model = landmarks(target)
    b, _ = landmarks(candidate)
    width = np.linalg.norm(a[234]-a[454])
    if width < 60 or np.linalg.norm(a[1]-b[1]) > width*.25:
        raise ValueError('Faces are too small or misaligned. Use an edited copy of this exact target.')
    def patches(points):
        mask = np.zeros(target.shape[:2], np.uint8)
        for point in [points[1]*.55+points[234]*.45, points[1]*.55+points[454]*.45, points[10]*.65+points[1]*.35]:
            cv2.circle(mask, tuple(point.round().astype(int)), max(3,round(width*.045)), 255, -1)
        return mask>0
    lab_a = cv2.cvtColor(target.astype(np.float32)/255, cv2.COLOR_RGB2Lab)
    lab_b = cv2.cvtColor(candidate.astype(np.float32)/255, cv2.COLOR_RGB2Lab)
    pa, pb = patches(a), patches(b)
    ca, cb = np.median(lab_a[pa],axis=0), np.median(lab_b[pb],axis=0)
    shift = np.clip(ca-cb, [-45,-25,-25], [45,25,25])*strength
    # Cheek/forehead chroma selects skin; eyes, teeth, hair and beard keep their colors.
    distance = np.linalg.norm((lab_b[:,:,1:]-cb[1:])/np.array([10,14]), axis=2)
    weight = np.exp(-.5*distance**4).astype(np.float32)
    weight = cv2.GaussianBlur(weight,(0,0),1.5)
    changed = lab_b+shift*weight[:,:,None]
    local_light=np.clip(cv2.GaussianBlur(lab_a[:,:,0],(0,0),width*.09)-cv2.GaussianBlur(lab_b[:,:,0],(0,0),width*.09),-25,25)
    changed[:,:,0]=lab_b[:,:,0]+(.8*local_light*strength+.2*shift[0])*weight
    changed[:,:,0] = np.clip(changed[:,:,0],0,100)
    output = cv2.cvtColor(changed.astype(np.float32),cv2.COLOR_Lab2RGB)
    hull = cv2.convexHull(np.vstack([a[:468],b[:468]]).round().astype(np.int32))
    mask = np.zeros(target.shape[:2],np.uint8)
    cv2.fillConvexPoly(mask,hull,255)
    # Inward feather: all zero-mask pixels remain exactly the target.
    distance_mask = cv2.distanceTransform(mask,cv2.DIST_L2,3)
    mask = np.clip(distance_mask/max(4,width*.045),0,1)*255
    return (np.clip(output,0,1)*255).round().astype(np.uint8),mask.astype(np.uint8),{'method':'landmark-cheek-local-light-v2','modelSha256':model,'labShift':shift.tolist(),'targetCheekLab':ca.tolist(),'candidateCheekLab':cb.tolist(),'skinSamplePixels':int(pb.sum())}

def face_anchor(image):
    points, model = landmarks(image)
    low, high = points[:468].min(axis=0), points[:468].max(axis=0)
    span = high-low
    if min(span)<80:
        raise ValueError('The original face has too little detail. Choose a closer original portrait.')
    # Keep hair/chin context; never enlarge a small face to imply extra detail.
    left,top=np.maximum(0,np.floor(low-span*[.3,.5])).astype(int)
    right,bottom=np.minimum([image.shape[1],image.shape[0]],np.ceil(high+span*[.3,.25])).astype(int)
    return image[top:bottom,left:right].copy(), {'method':'original-face-anchor-v1','cropBox':[int(left),int(top),int(right),int(bottom)],'modelSha256':model,'originalSize':[image.shape[1],image.shape[0]],'faceSize':span.tolist(),'generated':False}

def prepare_neural(directory, target, reference, include_beard=False):
    a,model=landmarks(target);b,_=landmarks(reference)
    for points in [a,b]:
        if np.ptp(points[:468,0])<80:
            raise ValueError('Choose closer portraits; both faces need at least 80 original pixels of detail.')
    mask=np.zeros(target.shape[:2],np.uint8)
    points=a[:468].copy()
    if include_beard:
        # Explicit lower-face expansion; keep the upper hair and background bounded.
        lower=points[points[:,1]>np.quantile(points[:,1],.65)].copy()
        lower[:,1]+=np.ptp(points[:,0])*.16
        points=np.concatenate([points,lower])
    cv2.fillConvexPoly(mask,cv2.convexHull(points.round().astype(np.int32)),255)
    mask=(np.minimum(1,cv2.distanceTransform(mask,cv2.DIST_L2,3)/max(5,np.ptp(a[:468,0])*.035))*255).astype(np.uint8)
    Image.fromarray(mask).save(directory/'auto-mask.png')
    Image.fromarray(target).save(directory/'face-target.png')
    Image.fromarray(reference).save(directory/'face-reference.png')
    return {'method':'single-face-preflight-v1','includeBeard':bool(include_beard),'modelSha256':model,'sourceSize':[target.shape[1],target.shape[0]],'maskSha256':digest(directory/'auto-mask.png'),'preparedTargetSha256':digest(directory/'face-target.png'),'preparedReferenceSha256':digest(directory/'face-reference.png')}

def transfer_face(target, reference, strength=1):
    from scipy.interpolate import LinearNDInterpolator
    a,model=landmarks(target);b,_=landmarks(reference)
    height,width=target.shape[:2];left,top=np.maximum(0,a[:468].min(axis=0).astype(int));right,bottom=np.minimum([width-1,height-1],np.ceil(a[:468].max(axis=0)).astype(int))
    yy,xx=np.mgrid[top:bottom+1,left:right+1]
    mapping=LinearNDInterpolator(a[:468],b[:468])(xx,yy).astype(np.float32)
    valid=np.isfinite(mapping).all(axis=2)
    mapped=cv2.remap(reference,np.nan_to_num(mapping[:,:,0],nan=-1),np.nan_to_num(mapping[:,:,1],nan=-1),cv2.INTER_LINEAR,borderMode=cv2.BORDER_REFLECT_101)
    candidate=target.copy();patch=candidate[top:bottom+1,left:right+1];patch[valid]=mapped[valid]
    raw,mask,report=face_match(target,candidate,strength)
    footprint=np.zeros(target.shape[:2],np.uint8);footprint[top:bottom+1,left:right+1]=valid.astype(np.uint8)*255
    feather=(np.minimum(1,cv2.distanceTransform(footprint,cv2.DIST_L2,3)/max(8,(right-left)*.06))*255).astype(np.uint8);mask=np.minimum(mask,feather)
    report['method']='landmark-texture-transfer-local-light-v1';report['referenceDimensions']=[reference.shape[1],reference.shape[0]]
    return raw,mask,report

def place_prop(target, prop, quad, crop, cutout):
    height,width=target.shape[:2]
    rgba=np.array(prop.convert('RGBA'))
    x,y,w,h=crop
    box=(round(x*prop.width),round(y*prop.height),round((x+w)*prop.width),round((y+h)*prop.height))
    rgba=rgba[box[1]:box[3],box[0]:box[2]].copy()
    if rgba.shape[0]<8 or rgba.shape[1]<8:raise ValueError('Prop crop is too small.')
    if cutout=='ellipse':
        alpha=np.zeros(rgba.shape[:2],np.uint8);cv2.ellipse(alpha,(rgba.shape[1]//2,rgba.shape[0]//2),(max(1,rgba.shape[1]//2-1),max(1,rgba.shape[0]//2-1)),0,0,360,255,-1);rgba[:,:,3]=np.minimum(rgba[:,:,3],alpha)
    if cutout=='grabcut':
        segment=np.full(rgba.shape[:2],cv2.GC_PR_FGD,np.uint8);border=max(2,round(min(rgba.shape[:2])*.025));segment[:border]=segment[-border:]=cv2.GC_BGD;segment[:,:border]=segment[:,-border:]=cv2.GC_BGD;cv2.circle(segment,(rgba.shape[1]//2,rgba.shape[0]//2),max(3,round(min(rgba.shape[:2])*.12)),cv2.GC_FGD,-1);cv2.grabCut(rgba[:,:,:3],segment,None,np.zeros((1,65)),np.zeros((1,65)),5,cv2.GC_INIT_WITH_MASK);alpha=np.where((segment==cv2.GC_FGD)|(segment==cv2.GC_PR_FGD),255,0).astype(np.uint8);rgba[:,:,3]=np.minimum(rgba[:,:,3],alpha)
    points=np.array(quad,np.float32)*[width,height]
    if not cv2.isContourConvex(points.astype(np.float32)) or cv2.contourArea(points.astype(np.float32))<64:raise ValueError('Use a convex prop placement with visible area.')
    transform=cv2.getPerspectiveTransform(np.array([[0,0],[rgba.shape[1]-1,0],[rgba.shape[1]-1,rgba.shape[0]-1],[0,rgba.shape[0]-1]],np.float32),points.astype(np.float32))
    # Premultiplied color avoids dark fringes on a transparent cutout.
    alpha=rgba[:,:,3].astype(np.float32)/255
    color=cv2.warpPerspective(rgba[:,:,:3].astype(np.float32)*alpha[:,:,None],transform,(width,height),flags=cv2.INTER_LINEAR)
    coverage=cv2.warpPerspective(alpha,transform,(width,height),flags=cv2.INTER_LINEAR)
    result=(color+target*(1-coverage[:,:,None])).round().clip(0,255).astype(np.uint8)
    return result,{'method':'original-prop-perspective-v1','quad':quad,'crop':crop,'cutout':cutout,'outsideExact':bool(np.array_equal(result[coverage==0],target[coverage==0]))}

def track(directory):
    manifest=json.loads((directory/'manifest.json').read_text(encoding='utf-8'));r=manifest['request'];cv2.setRNGSeed(int(r.get('seed',0))%(2**31));prepared=json.loads((directory/'prepared.json').read_text(encoding='utf-8'))
    width,height=prepared['size'];count=prepared['frames'];assets=Path(manifest['assets'])
    if r.get('mask'):
        mask=np.array(ImageOps.fit(Image.open(assets/r['mask']).convert('L'),(width,height),method=Image.Resampling.NEAREST))
    else:
        mask=np.zeros((height,width),np.uint8);x,y,w,h=r['region'];cv2.rectangle(mask,(round(x*width),round(y*height)),(round((x+w)*width)-1,round((y+h)*height)-1),255,-1)
    if not np.any(mask>0) or not np.any(mask==0):raise ValueError('Paint part of the frame and leave some area untouched.')
    capture=cv2.VideoCapture(str(directory/'input.mp4'));ok,frame=capture.read()
    if not ok:raise ValueError('Cannot decode the prepared source for tracking.')
    gray=cv2.cvtColor(frame,cv2.COLOR_BGR2GRAY);features=cv2.goodFeaturesToTrack(gray,maxCorners=180,qualityLevel=.005,minDistance=4,mask=(mask>128).astype(np.uint8)*255)
    if r.get('trackMask') and (features is None or len(features)<6):raise ValueError('Not enough texture to track this mask. Choose a textured subject region or use a fixed mask.')
    trajectory=[];masks=[];previous=gray;matrix=np.eye(3,dtype=np.float64)
    for index in range(count):
        confidence=1.;kept=0
        if index:
            ok,frame=capture.read()
            if not ok:raise ValueError('Prepared source ended before the mask track.')
            gray=cv2.cvtColor(frame,cv2.COLOR_BGR2GRAY)
            if r.get('trackMask'):
                predicted,status,_=cv2.calcOpticalFlowPyrLK(previous,gray,features,None,winSize=(21,21),maxLevel=3)
                if predicted is None:raise ValueError('Mask tracking lost the subject; no extrapolated edit was submitted.')
                reverse,back,_=cv2.calcOpticalFlowPyrLK(gray,previous,predicted,None,winSize=(21,21),maxLevel=3)
                if reverse is None:raise ValueError('Mask tracking failed its backward check.')
                valid=(status.ravel()>0)&(back.ravel()>0)&(np.linalg.norm(reverse-features,axis=2).ravel()<1.5)
                kept=int(valid.sum());confidence=kept/len(features)
                if kept<6 or confidence<.55:raise ValueError('Mask tracking confidence fell below the safety threshold. Use a shorter clip or fixed mask.')
                step,inliers=cv2.estimateAffinePartial2D(features[valid],predicted[valid],method=cv2.RANSAC,ransacReprojThreshold=2)
                if step is None or inliers.sum()<6 or np.linalg.norm(step[:,2])>min(width,height)*.25 or not .8<np.linalg.norm(step[:,0])<1.25:raise ValueError('Mask motion is unreliable; no automatic continuation was attempted.')
                matrix=np.vstack([step,[0,0,1]])@matrix
                features=predicted[valid].reshape(-1,1,2)
        moved=cv2.warpPerspective(mask,matrix,(width,height),flags=cv2.INTER_NEAREST)
        if r.get('feather',0):moved=(np.minimum(1,cv2.distanceTransform((moved>128).astype(np.uint8),cv2.DIST_L2,3)/r['feather'])*255).astype(np.uint8)
        if not np.any(moved):raise ValueError('Tracked region left the frame.')
        masks.append(Image.fromarray(moved).convert('RGB'));trajectory.append({'frame':index,'confidence':confidence,'points':kept,'transform':matrix[:2].tolist()});previous=gray
    capture.release();folder=directory/'masks';folder.mkdir(exist_ok=True)
    for index,image in enumerate(masks):image.convert('L').save(folder/f'{index:04d}.png')
    from video_media import encode
    encode(masks,directory/'mask.mp4',(width,height),prepared['fps'])
    record={'method':'lk-forward-backward-affine-v1' if r.get('trackMask') else 'fixed-freehand-mask-v1','frames':count,'trajectory':trajectory,'maskSha256':[digest(folder/f'{i:04d}.png') for i in range(count)]}
    (directory/'tracking.json').write_text(json.dumps(record,indent=2),encoding='utf-8')
    return {'frames':count,'minimumConfidence':min(row['confidence'] for row in trajectory)}

def image_job(directory):
    job=json.loads((directory/'job.json').read_text(encoding='utf-8'));r=job['request'];cv2.setRNGSeed(int(r.get('seed',0))%(2**31));assets=directory.parents[1]/'assets';target=rgb(assets/r['asset'])
    if r['tool']=='face-anchor':
        result,report=face_anchor(target)
    elif r['tool']=='face-neural':
        report=prepare_neural(directory,target,rgb(assets/r['reference']),r.get('includeBeard',False))
        report['sourceSha256']=digest(assets/r['asset']);report['referenceSha256']=digest(assets/r['reference'])
        (directory/'face-preflight.json').write_text(json.dumps(report,indent=2),encoding='utf-8');return report
    elif r['tool']=='face-match':
        function=transfer_face if r.get('faceMode')=='transfer' else face_match
        result,mask,report=function(target,rgb(assets/r['reference']),r.get('matchStrength',1));Image.fromarray(mask).save(directory/'auto-mask.png')
    else:
        result,report=place_prop(target,ImageOps.exif_transpose(Image.open(assets/r['reference'])),r['propQuad'],r['propCrop'],r['cutout'])
    Image.fromarray(result).save(directory/'raw.png');report['sourceSha256']=digest(assets/r['asset'])
    if r.get('reference'):report['referenceSha256']=digest(assets/r['reference'])
    (directory/'vision.json').write_text(json.dumps(report,indent=2),encoding='utf-8');return report

def motion_risks(directory):
    capture=cv2.VideoCapture(str(directory/'input.mp4'));images=[]
    while True:
        ok,im=capture.read()
        if not ok:break
        factor=min(1,320/im.shape[1]);im=cv2.resize(im,(round(im.shape[1]*factor),round(im.shape[0]*factor)));images.append(cv2.cvtColor(im,cv2.COLOR_BGR2GRAY))
    capture.release();records=[]
    for i,(a,b) in enumerate(zip(images,images[1:])):
        forward=cv2.calcOpticalFlowFarneback(a,b,None,.5,5,25,5,7,1.5,0);back=cv2.calcOpticalFlowFarneback(b,a,None,.5,5,25,5,7,1.5,0)
        y,x=np.indices(a.shape,dtype=np.float32);back_sample=cv2.remap(back,x+forward[:,:,0],y+forward[:,:,1],cv2.INTER_LINEAR,borderMode=cv2.BORDER_CONSTANT)
        magnitude=np.linalg.norm(forward,axis=2);moving=magnitude>2;fraction=float(moving.mean());p95=float(np.percentile(magnitude[moving],95)) if moving.any() else 0
        inconsistent=float((np.linalg.norm(forward+back_sample,axis=2)[moving]>1.5).mean()) if moving.any() else 0
        uncertain=fraction>.005 and (p95>12 or inconsistent>.2)
        records.append({'pair':i,'movingFraction':fraction,'motionP95Pixels':p95,'forwardBackwardFailureFraction':inconsistent,'uncertain':bool(uncertain)})
    report={'method':'farneback-forward-backward-risk-v1','inputSha256':digest(directory/'input.mp4'),'frames':len(images),'analysisWidth':images[0].shape[1],'pairs':records,'uncertainPairs':[r['pair'] for r in records if r['uncertain']],'note':'Heuristic risk gate, not a quality score. Holding uncertain intervals prevents invented intermediate pixels but introduces judder.'}
    (directory/'motion-risks.json').write_text(json.dumps(report,indent=2),encoding='utf-8');return report

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('mode',choices=['image','track','motion']);p.add_argument('directory',type=Path);args=p.parse_args();print(json.dumps({'image':image_job,'track':track,'motion':motion_risks}[args.mode](args.directory)))
