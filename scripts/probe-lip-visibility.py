"""Probe a new use of the pinned face-occlusion model, before enabling it."""
import json,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.append(str(ROOT/'runtime/facefusion-env/Lib/site-packages'))
import cv2,numpy as np,mediapipe as mp,onnxruntime as ort
from PIL import Image,ImageDraw
from video_media import sample_images,digest
root=Path(__file__).resolve().parents[1];folder=root/'evidence/acceptance-round10'
lock=json.loads((root/'setup/facefusion.lock.json').read_text());item=next(i for i in lock['models'] if i['path'].endswith('/xseg_1.onnx'));model=root/lock['source']/item['path']
assert digest(model)==item['sha256']
options=ort.SessionOptions();options.intra_op_num_threads=4;session=ort.InferenceSession(str(model),options,providers=['CPUExecutionProvider'])
face_model=root/'runtime/vision-models/face_landmarker.task'
options=mp.tasks.vision.FaceLandmarkerOptions(base_options=mp.tasks.BaseOptions(model_asset_path=str(face_model)),num_faces=2)
image=next(sample_images(folder/'real-front.mp4',[.9]));rgb=np.asarray(image).copy()
with mp.tasks.vision.FaceLandmarker.create_from_options(options) as detector:
    result=detector.detect(mp.Image(image_format=mp.ImageFormat.SRGB,data=rgb))
    assert len(result.face_landmarks)==1
    p=np.array([(v.x*image.width,v.y*image.height) for v in result.face_landmarks[0]])
crop=np.rint([p[234,0],2*p[197,1]-p[152,1],p[454,0],p[152,1]*1.05]).astype(int);x0,y0,x1,y1=crop
mouth=np.rint([min(p[61,0],p[291,0])-8,p[0,1]-9,max(p[61,0],p[291,0])+8,p[17,1]+12]).astype(int);a,b,c,d=mouth
records={};sheet=Image.new('RGB',(768,512),'#14181b')
for index,name in enumerate(['clear','textured-object']):
    values=rgb.copy()
    if index:
        yy,xx=np.mgrid[b:d,a:c];pattern=(xx//4+yy//7)%2;values[b:d,a:c]=np.where(pattern[:,:,None],np.array([30,35,48]),np.array([190,115,30]))
    patch=cv2.resize(values[y0:y1,x0:x1,::-1],(256,256)).astype(np.float32)[None]/255
    mask=session.run(None,{session.get_inputs()[0].name:patch})[0].squeeze().clip(0,1)
    mask=cv2.resize(mask,(x1-x0,y1-y0));section=mask[b-y0:d-y0,a-x0:c-x0]
    records[name]={'mouthMean':float(section.mean()),'mouthLowFraction':float((section<.5).mean()),'mouthStd':float(values[b:d,a:c].mean(2).std())}
    preview=Image.fromarray(values).crop(tuple(crop)).resize((256,384));sheet.paste(preview,(index*384,24));mask_image=Image.fromarray(np.uint8(mask*255)).convert('RGB').resize((128,192));sheet.paste(mask_image,(index*384+256,24))
    ImageDraw.Draw(sheet).text((index*384+5,5),name,fill='white')
    Image.fromarray(values).save(folder/(name+'-visibility.png'))
sheet.save(folder/'visibility-probe.jpg',quality=94);(folder/'visibility-probe.json').write_text(json.dumps({'model':item,'crop':crop.tolist(),'mouth':mouth.tolist(),'records':records},indent=2));print(json.dumps(records))
