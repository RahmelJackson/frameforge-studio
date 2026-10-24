"""Real footage to an inspected body-joint guide; uncertain joints stay absent."""
import os,json,sys
from pathlib import Path
import numpy as np
from PIL import Image,ImageOps
from video_media import digest,sample_images,crop_image,encode,inspect
from body_pose import render
from pose_retarget import retarget_sequence,LIMITATIONS
ROOT=Path(__file__).resolve().parents[1]
os.environ.setdefault('MPLCONFIGDIR',str(ROOT/'runtime/vision-cache'))
MAPPING=[0,None,12,14,16,11,13,15,24,26,28,23,25,27,5,2,8,7]
def points18(landmarks,threshold=.6):
    def point(p):return [p.x,p.y] if min(p.visibility,p.presence)>=threshold and 0<=p.x<=1 and 0<=p.y<=1 else None
    points=[point(landmarks[i]) if i is not None else None for i in MAPPING]
    if points[2] is not None and points[5] is not None:points[1]=np.mean([points[2],points[5]],axis=0).tolist()
    return points
def fit_sequence(sequence,size,framing):
    values=[[p if framing=='full' or i not in [8,9,10,11,12,13] else None for i,p in enumerate(frame)] for frame in sequence]
    pixel=np.array([np.array(p)*size for frame in values for p in frame if p is not None]);low=pixel.min(axis=0);high=pixel.max(axis=0)
    if np.min(high-low)<5:raise ValueError('The detected body is too small or flat for a guide.')
    scale=min(np.array(size)*.84/(high-low));center=(high+low)/2;target=np.array(size)*[.5,.5]
    transformed=[[((np.array(p)*size-center)*scale+target)/size if p is not None else None for p in frame] for frame in values]
    return [[p.tolist() if p is not None else None for p in frame] for frame in transformed],{'scale':float(scale),'sourcePixelCenter':center.tolist(),'targetPixelCenter':target.tolist(),'margin':.08,'policy':'One fixed fit across the whole selected clip; no per-frame recentering.'}
def run(directory):
    import mediapipe as mp
    m=json.loads((directory/'manifest.json').read_text(encoding='utf-8'));r=m['request'];source=m['source'];lock=json.loads((ROOT/'setup/human-pose.lock.json').read_text(encoding='utf-8'));model=ROOT/lock['path']
    if digest(source['path'])!=source['sha256'] or digest(model)!=lock['sha256']:raise ValueError('Pose source or task bundle changed.')
    start=r['start'];duration=min(source['duration'],r['end'] if r['end'] is not None else source['duration'])-start
    if not .3<=duration<=3.101:raise ValueError('Choose 0.3–3.1 seconds for a body-pose guide.')
    fps=16;frames=int(duration*fps+1e-6);ratio=source['size'][0]/source['size'][1];size=(512,288) if ratio>1.2 else (288,512) if ratio<.83 else (384,384)
    options=mp.tasks.vision.PoseLandmarkerOptions(base_options=mp.tasks.BaseOptions(model_asset_path=str(model)),running_mode=mp.tasks.vision.RunningMode.VIDEO,num_poses=2,min_pose_detection_confidence=.6,min_pose_presence_confidence=.6,min_tracking_confidence=.6)
    def landmarks_json(landmarks):return [{key:float(getattr(p,key)) for key in ['x','y','z','visibility','presence']} for p in landmarks]
    target_meta=None
    if r.get('poseTarget'):
        target_binding=m.get('poseTarget',{});target_path=Path(m['assets'])/r['poseTarget']
        if target_binding.get('asset')!=r['poseTarget'] or Path(target_binding.get('path','')).resolve()!=target_path.resolve() or digest(target_path)!=target_binding.get('sha256'):raise ValueError('The selected target image changed or is not bound to this request.')
        target_image=ImageOps.exif_transpose(Image.open(target_path)).convert('RGB')
        target_options=mp.tasks.vision.PoseLandmarkerOptions(base_options=mp.tasks.BaseOptions(model_asset_path=str(model)),running_mode=mp.tasks.vision.RunningMode.IMAGE,num_poses=2,min_pose_detection_confidence=.6,min_pose_presence_confidence=.6)
        with mp.tasks.vision.PoseLandmarker.create_from_options(target_options) as detector:
            result=detector.detect(mp.Image(image_format=mp.ImageFormat.SRGB,data=np.asarray(target_image).copy()))
            if len(result.pose_landmarks)!=1:raise ValueError('The target image must show exactly one clearly visible person.')
            target_meta={**target_binding,'size':list(target_image.size),'landmarks':landmarks_json(result.pose_landmarks[0]),'points':points18(result.pose_landmarks[0]),'detectedPeople':1}
    elif m.get('poseTarget'):
        raise ValueError('Unexpected target image binding.')
    sequence=[];visibility=[];raw_landmarks=[]
    with mp.tasks.vision.PoseLandmarker.create_from_options(options) as detector:
        for i,image in enumerate(sample_images(source['path'],(start+i/fps for i in range(frames)))):
            image=crop_image(image,size,r['cropX'],r['cropY']);result=detector.detect_for_video(mp.Image(image_format=mp.ImageFormat.SRGB,data=np.asarray(image).copy()),round(i/fps*1000))
            if len(result.pose_landmarks)!=1:raise ValueError('Pose guide requires exactly one detected person in every frame. Trim or choose clearer footage.')
            points=points18(result.pose_landmarks[0]);upper=[1,2,3,4,5,6,7]
            if any(points[j] is None for j in upper):raise ValueError('Shoulders, elbows or wrists are uncertain in frame '+str(i)+'. Trim or choose clearer footage; missing limbs are not invented.')
            sequence.append(points);visibility.append([{'visibility':p.visibility,'presence':p.presence} for p in result.pose_landmarks[0]]);raw_landmarks.append(landmarks_json(result.pose_landmarks[0]))
    framing=r.get('poseFraming','upper');retarget=None;guide_sequence=sequence
    if target_meta:guide_sequence,retarget=retarget_sequence(sequence,size,target_meta['points'],target_meta['size'],framing)
    points,fit=fit_sequence(guide_sequence,size,framing);images=[render(p,size) for p in points]
    folder=directory/'pose-frames';folder.mkdir(exist_ok=True)
    for i,image in enumerate(images):image.save(folder/f'{i:04d}.png')
    encode(images,directory/'preserved.mkv',size,fps,codec='ffv1');encode(images,directory/'output.mp4',size,fps)
    meta={'method':'mediapipe-full-video-to-openpose18-v2' if target_meta else 'mediapipe-full-video-to-openpose18-v1','sourceSha256':source['sha256'],'sourceRange':[start,start+frames/fps],'model':lock,'size':list(size),'fps':fps,'frames':frames,'rawPoints':sequence,'points':points,'visibility':visibility,'fit':fit,'framing':framing,'pngSha256':[digest(folder/f'{i:04d}.png') for i in range(frames)],'masterSha256':digest(directory/'preserved.mkv'),'limitations':LIMITATIONS if target_meta else 'Body joints only. Visibility is a model estimate. No face/finger reconstruction, body-proportion retargeting or identity transfer.'}
    if target_meta:meta.update({'target':target_meta,'retarget':retarget,'rawLandmarks':raw_landmarks,'crop':{'x':r['cropX'],'y':r['cropY']},'sourceDetectedPeople':[1]*frames})
    (directory/'human-pose.json').write_text(json.dumps(meta,indent=2),encoding='utf-8');expected={'frames':frames,'fps':fps,'size':list(size),'duration':frames/fps,'hasAudio':False,'sourceSha256':source['sha256'],'humanPose':{'sha256':digest(directory/'human-pose.json'),'method':meta['method']},'warnings':[meta['limitations']]}
    (directory/'expected.json').write_text(json.dumps(expected,indent=2),encoding='utf-8');(directory/'completed.json').write_text(json.dumps({'sha256':digest(directory/'output.mp4')}),encoding='utf-8');return expected
if __name__=='__main__':print(json.dumps(run(Path(sys.argv[1]))))
