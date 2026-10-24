"""Single-face landmark crops for the bounded MuseTalk adapter."""
import json,sys,math,os
from pathlib import Path
import numpy as np
from PIL import Image,ImageDraw,ImageFilter
os.environ.setdefault("MPLCONFIGDIR",str(Path(__file__).resolve().parents[1]/"runtime/vision-cache"))
import mediapipe as mp
from video_media import sample_images,digest
from lip_holds import strength_at,held_at
ROOT=Path(__file__).resolve().parents[1]
directory=Path(sys.argv[1]);manifest=json.loads((directory/'manifest.json').read_text(encoding='utf-8'));config=json.loads((directory/'lip-input.json').read_text());source=manifest['source'];frames=config['frames'];fps=25
model=ROOT/'runtime/vision-models/face_landmarker.task';lock=json.loads((ROOT/'setup/vision-models.lock.json').read_text())['models'][0]
if digest(model)!=lock['sha256']:raise ValueError('Face landmark model changed.')
options=mp.tasks.vision.FaceLandmarkerOptions(base_options=mp.tasks.BaseOptions(model_asset_path=str(model)),num_faces=2)
folder=directory/'lip-frames';folder.mkdir(exist_ok=True);records=[];smoothed=None
with mp.tasks.vision.FaceLandmarker.create_from_options(options) as detector:
    # Decode again at each explicit loop boundary instead of requesting decreasing timestamps.
    originals=[]
    while len(originals)<frames:
        count=min(frames-len(originals),math.ceil(source['duration']*fps));originals.extend(sample_images(source['path'],(i/fps for i in range(count))))
    for index,image in enumerate(originals):
        rgb=np.asarray(image).copy();result=detector.detect(mp.Image(image_format=mp.ImageFormat.SRGB,data=rgb))
        if len(result.face_landmarks)!=1:raise ValueError('Lip sync requires one clearly visible face in every frame. No frames were skipped.')
        points=np.array([(p.x*image.width,p.y*image.height) for p in result.face_landmarks[0]])
        left,right=points[234,0],points[454,0];chin=points[152,1];middle=points[197,1];top=2*middle-chin;bottom=chin+(chin-top)*.1
        if right-left<80 or abs(points[1,0]-(left+right)/2)/(right-left)>.24:raise ValueError('Use a larger, nearly frontal face without severe profile turns.')
        mx0=max(0,round(min(points[61,0],points[291,0])));mx1=min(image.width,round(max(points[61,0],points[291,0])))
        my0=max(0,round(points[0,1]-4));my1=min(image.height,round(points[17,1]+4))
        mouth=rgb[my0:my1,mx0:mx1].mean(axis=2)
        hold=held_at(index,fps,manifest['request'].get('lipHolds',[]))
        if (not mouth.size or float(mouth.std())<3) and not hold:raise ValueError('The mouth region has no visible detail or is blocked. Use a clear face; an occlusion was not painted over.')
        crop=[max(0,round(left)),max(0,round(top)),min(image.width,round(right)),min(image.height,round(bottom))]
        raw_crop=crop.copy()
        if manifest['request'].get('lipStability')=='stable':
            raw=np.array(crop,dtype=float);smoothed=raw if smoothed is None else .65*raw+.35*smoothed;crop=np.rint(smoothed).astype(int).tolist()
        if crop[2]<=crop[0] or crop[3]<=crop[1]:raise ValueError('Invalid face crop.')
        image.save(folder/f'{index:04}.png');mask=Image.new('L',image.size);draw=ImageDraw.Draw(mask);w=crop[2]-crop[0];h=crop[3]-crop[1]
        mouth_left=min(points[61,0],points[291,0])-w*.1;mouth_right=max(points[61,0],points[291,0])+w*.1;mouth_top=points[0,1]-h*.06;mouth_bottom=points[17,1]+h*.10
        draw.ellipse((mouth_left,mouth_top,mouth_right,mouth_bottom),fill=255);mask=mask.filter(ImageFilter.GaussianBlur(max(1,w*.018)))
        strength=strength_at(index,fps,manifest['request'].get('lipHolds',[]));mask=Image.fromarray(np.rint(np.asarray(mask)*strength).astype(np.uint8));mask.save(folder/f'{index:04}-mask.png')
        align3=[points[[70,63,105,66,107]].mean(axis=0).tolist(),points[[336,296,334,293,300]].mean(axis=0).tolist(),points[[1,4]].mean(axis=0).tolist()]
        records.append({'crop':crop,'rawCrop':raw_crop,'alignmentPoints':align3,'originalHold':hold,'mouthEditStrength':strength,'originalSha256':digest(folder/f'{index:04}.png'),'maskSha256':digest(folder/f'{index:04}-mask.png')})
(directory/'lipsync.json').write_text(json.dumps({'method':'musetalk-v15-mouth-mask-v2','frames':frames,'fps':fps,'size':[image.width,image.height],'landmarkSha256':lock['sha256'],'trajectory':records},indent=2))
