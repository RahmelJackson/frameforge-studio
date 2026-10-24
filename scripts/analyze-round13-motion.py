"""Measure guide following at original screen coordinates, retaining uncertainty."""
import os,json,math
from pathlib import Path
import numpy as np
from PIL import Image,ImageDraw,ImageOps
from video_media import decode_images,digest
from human_pose import points18
ROOT=Path(__file__).resolve().parents[1];folder=ROOT/'evidence/round13-pose'
os.environ.setdefault('MPLCONFIGDIR',str(ROOT/'runtime/vision-cache'))
import mediapipe as mp
lock=json.loads((ROOT/'setup/human-pose.lock.json').read_text(encoding='utf-8'));model=ROOT/lock['path']
if digest(model)!=lock['sha256']:raise ValueError('Detector changed.')
result={'model':lock,'creativeApproval':None,'limitations':'Detected2D joints are estimates. Direct screen error does not distinguish translation, proportions, occlusion or anatomy. Missing joints/people are counted, not silently excluded from acceptance. One seed and two matched outputs do not establish generalization.'}
sheet=Image.new('RGB',(1000,660),'#171a17');draw=ImageDraw.Draw(sheet)
for row,label in enumerate(['driver','retarget']):
    case=json.loads((folder/f'motion-{label}.json').read_text(encoding='utf-8'));directory=ROOT/'data/jobs'/case['jobId'];report=json.loads((directory/'report.json').read_text(encoding='utf-8'));video=directory/'output.mp4'
    if not report['technicalPass'] or digest(video)!=report['sha256']:raise ValueError('Unchecked/changed video.')
    request=case['request'];guide=json.loads((ROOT/'data/jobs'/request['sourceJob']/'human-pose.json').read_text(encoding='utf-8'));frames=list(decode_images(video));detections=[];missing=[];errors=[]
    options=mp.tasks.vision.PoseLandmarkerOptions(base_options=mp.tasks.BaseOptions(model_asset_path=str(model)),running_mode=mp.tasks.vision.RunningMode.VIDEO,num_poses=2,min_pose_detection_confidence=.6,min_pose_presence_confidence=.6,min_tracking_confidence=.6)
    with mp.tasks.vision.PoseLandmarker.create_from_options(options) as detector:
        for i,image in enumerate(frames):
            found=detector.detect_for_video(mp.Image(image_format=mp.ImageFormat.SRGB,data=np.asarray(image).copy()),round(i/16*1000))
            points=points18(found.pose_landmarks[0]) if len(found.pose_landmarks)==1 else [None]*18;detections.append(points)
            for joint in [2,3,4,5,6,7]:
                expected=guide['points'][i][joint];actual=points[joint]
                if actual is None or expected is None:missing.append({'frame':i,'joint':joint})
                else:errors.append({'frame':i,'joint':joint,'normalizedError':float(np.linalg.norm(np.asarray(actual)-expected))})
    wrists=[v['normalizedError'] for v in errors if v['joint'] in [4,7]];all_error=[v['normalizedError'] for v in errors]
    result[label]={'jobId':case['jobId'],'sha256':digest(video),'guideJobId':request['sourceJob'],'guideMetadataSha256':digest(ROOT/'data/jobs'/request['sourceJob']/'human-pose.json'),'frames':len(frames),'requiredJointSlots':len(frames)*6,'missingJointSlots':len(missing),'detectedSlotFraction':len(errors)/(len(frames)*6),'meanVisibleJointError':float(np.mean(all_error)) if all_error else None,'meanVisibleWristError':float(np.mean(wrists)) if wrists else None,'maximumVisibleWristError':float(max(wrists)) if wrists else None,'detections':detections,'errors':errors,'missing':missing}
    draw.text((8,row*330+8),label+' proportions',fill='white')
    for col,index in enumerate([0,len(frames)//2,len(frames)-1]):
        thumb=ImageOps.contain(frames[index],(325,285));sheet.paste(thumb,(col*333,row*330+28));draw.text((col*333+4,row*330+314),f'Frame{index}',fill='white')
(folder/'motion-quality.json').write_text(json.dumps(result,indent=2),encoding='utf-8');sheet.save(folder/'motion-comparison.jpg',quality=94)
print(json.dumps({k:{x:v[x] for x in ['detectedSlotFraction','meanVisibleJointError','meanVisibleWristError','maximumVisibleWristError']} for k,v in result.items() if k in ['driver','retarget']}))
