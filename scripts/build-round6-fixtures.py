"""Original geometric acceptance fixtures, not generated production artwork."""
from pathlib import Path
import json,sys
import numpy as np
from PIL import Image,ImageDraw
from video_media import encode,digest
ROOT=Path(__file__).resolve().parents[1];folder=ROOT/'evidence/acceptance-round6';folder.mkdir(parents=True,exist_ok=True)
count=49;fps=24;frames=[];truth=[]
for i in range(count):
    image=Image.new('RGB',(640,360),(24,34,48));draw=ImageDraw.Draw(image);x=100+round(i*7);y=180
    for k in range(0,640,40):draw.line((k,0,k,359),fill=(42,52,65))
    draw.rounded_rectangle((x-38,y-42,x+38,y+42),radius=7,fill=(175,74,35),outline='white',width=3)
    for k in range(7):draw.line((x-29+k*9,y-32,x-29+k*9,y+32),fill=(245,205,75),width=2)
    draw.text((x-28,y-7),'TRACK',fill='white');frames.append(image);truth.append([x,y])
rate=48000;t=np.arange(round(count/fps*rate))/rate;sound=np.stack([np.sin(t*2*np.pi*440)*.025]*2).astype(np.float32);encode(frames,folder/'tracking-source.mp4',(640,360),fps,sound)
frames[0].save(folder/'motion-reference.png')
occluded=[frame if i<20 else Image.new('RGB',(640,360),(24,34,48)) for i,frame in enumerate(frames)];encode(occluded,folder/'tracking-occluded.mp4',(640,360),fps)
sketch=Image.new('RGB',(768,432),'white');d=ImageDraw.Draw(sketch);d.ellipse((288,75,480,275),outline='black',width=5);d.arc((326,75,442,275),90,270,fill='black',width=3);d.line((300,225,335,335),fill='black',width=4);d.line((466,225,431,335),fill='black',width=4);d.rectangle((335,335,431,380),outline='black',width=4);d.line((0,406,767,406),fill='black',width=3);sketch.save(folder/'balloon-sketch.png')
record={'tracking':{'frames':count,'fps':fps,'centers':truth,'firstRegion':[62/640,138/360,76/640,84/360],'sourceSha256':digest(folder/'tracking-source.mp4'),'occludedSha256':digest(folder/'tracking-occluded.mp4')},'sketch':{'sha256':digest(folder/'balloon-sketch.png'),'description':'Original black-line balloon fixture'}}
(folder/'fixtures.json').write_text(json.dumps(record,indent=2),encoding='utf-8');print(json.dumps({'prepared':True}))
