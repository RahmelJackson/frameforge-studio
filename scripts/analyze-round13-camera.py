"""Compare the retained camera baseline with one prompt candidate; never approve it."""
import json,math,sys
from pathlib import Path
from track_still_border import cv2
import numpy as np
from PIL import Image,ImageDraw,ImageOps
from video_media import decode_images,digest
root=Path(__file__).resolve().parents[1]
folder=root/'evidence/round13-camera';state=json.loads((folder/'state.json').read_text(encoding='utf-8'))
result={};sheet=Image.new('RGB',(1024,670),'#141914');draw=ImageDraw.Draw(sheet)
for row,(name,job_id) in enumerate([('Fast 4-step baseline',state['baselineId']),('Full 20-step candidate',state['jobId'])]):
    file=root/'data/jobs'/job_id/'output.mp4';frames=list(decode_images(file));matrix=np.eye(3);previous=None;valid=0
    for image in frames:
        gray=cv2.cvtColor(np.asarray(image),cv2.COLOR_RGB2GRAY)
        if previous is not None:
            points=cv2.goodFeaturesToTrack(previous,maxCorners=1000,qualityLevel=.01,minDistance=8)
            if points is not None:
                moved,status,_=cv2.calcOpticalFlowPyrLK(previous,gray,points,None,winSize=(25,25),maxLevel=3)
                if moved is not None:
                    keep=status.ravel()>0
                    step,inliers=cv2.estimateAffinePartial2D(points[keep],moved[keep],method=cv2.RANSAC,ransacReprojThreshold=2)
                    if step is not None and inliers.sum()>=15:
                        matrix=np.vstack([step,[0,0,1]])@matrix;valid+=1
        previous=gray
    h,w=previous.shape;center=(matrix@np.array([w/2,h/2,1]))[:2]-[w/2,h/2]
    result[name]={'jobId':job_id,'sha256':digest(file),'fittedPairs':valid,'framePairs':len(frames)-1,'centerDeltaPixels':center.tolist(),'cumulativeScale':float(np.hypot(matrix[0,0],matrix[1,0])),'screenRotationDegrees':math.degrees(math.atan2(matrix[1,0],matrix[0,0]))}
    draw.text((10,row*335+10),name,fill='white')
    for col,index in enumerate([0,len(frames)//2,len(frames)-1]):
        image=ImageOps.contain(frames[index],(332,265));sheet.paste(image,(col*342,row*335+40));draw.text((col*342+10,row*335+310),f'Frame {index}',fill='white')
result['limitations']='Image feature diagnostics from one fixed-seed scene; not calibrated camera poses or proof of general prompt improvement. Creative approval remains pending.'
(folder/'comparison.json').write_text(json.dumps(result,indent=2),encoding='utf-8');sheet.save(folder/'comparison.jpg',quality=94)
print(json.dumps(result,indent=2))
