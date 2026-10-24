"""Render user-authored OpenPose-18 joints; no anatomy inference or identity claim."""
import json,sys,uuid,math
from pathlib import Path
import numpy as np
from PIL import Image,ImageDraw
from video_media import digest
SIZES={'portrait':(576,1024),'landscape':(1024,576),'square':(768,768)}
LIMBS=[(1,2),(1,5),(2,3),(3,4),(5,6),(6,7),(1,8),(8,9),(9,10),(1,11),(11,12),(12,13),(1,0),(0,14),(14,16),(0,15),(15,17)]
COLORS=[(255,0,0),(255,85,0),(255,170,0),(255,255,0),(170,255,0),(85,255,0),(0,255,0),(0,255,85),(0,255,170),(0,255,255),(0,170,255),(0,85,255),(0,0,255),(85,0,255),(170,0,255),(255,0,255),(255,0,170),(255,0,85)]
def render(points,size):
    canvas=Image.new('RGB',size);draw=ImageDraw.Draw(canvas);w,h=size;radius=max(3,round(min(size)/128));width=max(4,round(min(size)/64))
    for i,(a,b) in enumerate(LIMBS):
        if points[a] is None or points[b] is None:continue
        start=(round(points[a][0]*w),round(points[a][1]*h));end=(round(points[b][0]*w),round(points[b][1]*h));color=tuple(round(v*.6) for v in COLORS[i])
        draw.line((start,end),fill=color,width=width);draw.ellipse((start[0]-width//2,start[1]-width//2,start[0]+width//2,start[1]+width//2),fill=color)
    for i,p in enumerate(points):
        if p is None:continue
        x,y=round(p[0]*w),round(p[1]*h);draw.ellipse((x-radius,y-radius,x+radius,y+radius),fill=COLORS[i])
    return canvas
if __name__=='__main__':
    request=json.loads(Path(sys.argv[1]).read_text());assets=Path(sys.argv[2]);name=str(uuid.uuid4())+'.png';render(request['points'],SIZES[request['aspect']]).save(assets/name)
    result={**request,'name':name,'sha256':digest(assets/name),'method':'user-authored-openpose18-body-guide-v1','limitations':'Body-joint control only; no face, finger, identity or rear-facing annotation.'};(assets/(name+'.pose.json')).write_text(json.dumps(result,indent=2));print(json.dumps(result))
