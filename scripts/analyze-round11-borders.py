"""Measure saved guided-generation versus tracked-still borders, without inference."""
import json
from pathlib import Path
import numpy as np
from PIL import Image,ImageDraw
from video_media import decode_images,digest,encode
root=Path(__file__).resolve().parents[1];folder=root/'evidence/acceptance-round11';state=json.loads((folder/'state.json').read_text());cases={'generated-guide':'3720fa6a-ef4b-4ba1-93fc-cc8f34916550','tracked-still':state['jobs']['border-tracked']['id']};movies={};results={}
for name,id in cases.items():
    directory=root/'data/jobs'/id;meta=json.loads((directory/'outpainting.json').read_text());frames=list(decode_images(directory/'preserved.mkv'));movies[name]=frames;a=np.array([np.asarray(im) for im in frames],dtype=float);x,y=meta['offset'];w,h=meta['fittedSize'];mask=np.ones(a.shape[1:3],bool);mask[y:y+h,x:x+w]=False;differences=np.abs(np.diff(a,axis=0))[:,mask]
    edges=[np.abs(a[:,y-1,x:x+w]-a[:,y,x:x+w]).mean(),np.abs(a[:,y+h,x:x+w]-a[:,y+h-1,x:x+w]).mean(),np.abs(a[:,y:y+h,x-1]-a[:,y:y+h,x]).mean(),np.abs(a[:,y:y+h,x+w]-a[:,y:y+h,x+w-1]).mean()]
    results[name]={'id':id,'masterSha256':digest(directory/'preserved.mkv'),'meanBoundaryRgb':float(np.mean(edges)),'firstJoinMeanRgb':float(differences[0].mean()),'laterTemporalMeanRgb':float(differences[1:].mean()),'maximumEdgeHoldPixels':max((row['edgeHoldPixels'] for row in meta.get('trajectory',[])),default=0),'creativeApproval':'pending'}
sheet=Image.new('RGB',(1024,640),'#13171b');draw=ImageDraw.Draw(sheet)
for row,(name,frames) in enumerate(movies.items()):
    draw.text((8,row*320+6),name,fill='white')
    for col,index in enumerate([0,10,20]):
        image=frames[index].copy();image.thumbnail((336,220));sheet.paste(image,(col*342,row*320+32))
sheet.save(folder/'border-comparison.jpg',quality=94)
combined=[]
for index in range(21):
    image=Image.new('RGB',(1024,324),'#13171b');draw=ImageDraw.Draw(image)
    for col,(name,frames) in enumerate(movies.items()):image.paste(frames[index],(col*512,36));draw.text((col*512+8,10),name,fill='white')
    combined.append(image)
encode(combined,folder/'border-comparison.mp4',(1024,324),16);(folder/'border-quality.json').write_text(json.dumps({'cases':results,'limitations':['A short near-static source, with one already generated still. Original fitted pixels remain exact.','Tracked 2D borders may freeze independent objects or reveal parallax; invented rock and faint still seam are retained.','Small exposed outer strips hold the initial guide, up to a strict 2% canvas cap; this is not generated new scenery.'],'creativeApproval':'pending'},indent=2));print(json.dumps(results,indent=2))
