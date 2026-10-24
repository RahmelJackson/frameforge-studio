"""Saved image/camera comparisons; diagnostics never approve a creative goal."""
import json,math
from pathlib import Path
from track_still_border import cv2
import numpy as np
from PIL import Image,ImageDraw,ImageOps
from video_media import decode_images,digest
root=Path(__file__).resolve().parents[1];folder=root/'evidence/acceptance-round11';state=json.loads((folder/'state.json').read_text());results={};movies={}
cases={'camera-native-knight':'7be7b04e-242b-4857-a65d-416f67faad61'}
cases.update({name:j['id'] for name,j in state['jobs'].items() if name.startswith('camera-') and j.get('technicalPass')})
for name,id in cases.items():
    frames=list(decode_images(root/'data/jobs'/id/'output.mp4'));movies[name]=frames;previous=None;matrix=np.eye(3);valid=0
    for image in frames:
        gray=cv2.cvtColor(np.asarray(image),cv2.COLOR_RGB2GRAY)
        if previous is not None:
            points=cv2.goodFeaturesToTrack(previous,maxCorners=1000,qualityLevel=.01,minDistance=8)
            if points is not None:
                moved,status,_=cv2.calcOpticalFlowPyrLK(previous,gray,points,None,winSize=(25,25),maxLevel=3)
                if moved is not None:
                    keep=status.ravel()>0;step,inliers=cv2.estimateAffinePartial2D(points[keep],moved[keep],method=cv2.RANSAC,ransacReprojThreshold=2)
                    if step is not None and inliers.sum()>=15:matrix=np.vstack([step,[0,0,1]])@matrix;valid+=1
        previous=gray
    h,w=previous.shape;center=(matrix@np.array([w/2,h/2,1]))[:2]-[w/2,h/2]
    results[name]={'id':id,'sha256':digest(root/'data/jobs'/id/'output.mp4'),'fittedPairs':valid,'framePairs':len(frames)-1,'centerDeltaPixels':center.tolist(),'cumulativeScale':float(np.hypot(matrix[0,0],matrix[1,0])),'screenRotationDegrees':math.degrees(math.atan2(matrix[1,0],matrix[0,0])),'limit':'Image-feature motion only; inspect scene geometry and actual camera direction.','creativeApproval':'pending'}
sheet=Image.new('RGB',(1024,360*len(movies)),'#13171b');draw=ImageDraw.Draw(sheet)
for row,(name,frames) in enumerate(movies.items()):
    draw.text((8,row*360+8),name,fill='white')
    for col,index in enumerate([0,len(frames)//2,len(frames)-1]):
        im=ImageOps.contain(frames[index],(336,285));sheet.paste(im,(col*342,row*360+40));draw.text((col*342+8,row*360+330),f'frame {index}',fill='white')
sheet.save(folder/'camera-comparison.jpg',quality=94)
images={'Original identity':root/'data/assets/34659372-3bbb-4bbf-87c3-e3fa0a74f791.png'}
images.update({name:root/'data/jobs'/j['id']/'output.png' for name,j in state['jobs'].items() if name.startswith('pose-') and j.get('technicalPass')})
sheet=Image.new('RGB',(300*len(images),580),'#13171b');draw=ImageDraw.Draw(sheet)
for col,(name,file) in enumerate(images.items()):
    im=ImageOps.contain(Image.open(file).convert('RGB'),(288,530));sheet.paste(im,(col*300,35));draw.text((col*300+5,8),name,fill='white')
sheet.save(folder/'pose-comparison.jpg',quality=94)
(folder/'camera-quality.json').write_text(json.dumps(results,indent=2));print(json.dumps(results,indent=2))
