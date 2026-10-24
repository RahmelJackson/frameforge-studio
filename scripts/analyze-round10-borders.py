"""Saved border comparisons; measurements do not approve visual geometry."""
import json
from pathlib import Path
import numpy as np
from PIL import Image,ImageDraw
from video_media import decode_images,encode,digest
root=Path(__file__).resolve().parents[1];folder=root/'evidence/acceptance-round10';state=json.loads((folder/'state.json').read_text());results={};movies={}
for name in ['border-direct','border-guided']:
    directory=root/'data/jobs'/state['jobs'][name]['id'];report=json.loads((directory/'report.json').read_text());meta=json.loads((directory/'outpainting.json').read_text());assert report['technicalPass'];frames=list(decode_images(directory/'preserved.mkv'));movies[name]=frames
    values=np.array([np.asarray(frame) for frame in frames],dtype=np.float64);x,y=meta['offset'];w,h=meta['fittedSize'];mask=np.ones(values.shape[1:3],bool);mask[y:y+h,x:x+w]=False
    boundary=[]
    for image in values:
        edges=[np.abs(image[y-1,x:x+w]-image[y,x:x+w]).mean(),np.abs(image[y+h,x:x+w]-image[y+h-1,x:x+w]).mean(),np.abs(image[y:y+h,x-1]-image[y:y+h,x]).mean(),np.abs(image[y:y+h,x+w]-image[y:y+h,x+w-1]).mean()];boundary.append(float(np.mean(edges)))
    differences=np.abs(np.diff(values,axis=0))[:,mask]
    results[name]={'id':directory.name,'sha256':digest(directory/'preserved.mkv'),'frames':len(frames),'size':meta['size'],'inset':meta['inset'],'meanBoundaryRgb':float(np.mean(boundary)),'topSkyBoundaryRgb':float(np.abs(values[:,y-1,x:x+w]-values[:,y,x:x+w]).mean()),'borderTemporalMeanRgb':float(differences.mean()),'firstJoinMeanRgb':float(differences[0].mean()),'laterTemporalMeanRgb':float(differences[1:].mean()),'originalMaximumRgb':report['outpainting']['originalMaximumRgbDifference'],'guide':meta.get('guide'),'matchedFrames':len(meta.get('boundaryMatches',[])),'creativeApproval':'pending'}
sheet=Image.new('RGB',(1024,640),'#13171b');draw=ImageDraw.Draw(sheet)
for row,name in enumerate(['border-direct','border-guided']):
    draw.text((8,row*320+4),name,fill='white')
    for column,index in enumerate([0,10,20]):
        image=movies[name][index].copy();image.thumbnail((336,220));sheet.paste(image,(column*342,row*320+26));draw.text((column*342+7,row*320+252),f'frame {index} / {index/16:.2f}s',fill='white')
sheet.save(folder/'border-comparison.jpg',quality=95)
comparison=[]
for index in range(21):
    image=Image.new('RGB',(1024,324),'#121619');draw=ImageDraw.Draw(image)
    for column,name in enumerate(['border-direct','border-guided']):image.paste(movies[name][index],(column*512,36));draw.text((column*512+8,10),name,fill='white')
    comparison.append(image)
encode(comparison,folder/'border-comparison.mp4',(1024,324),16)
report={'cases':results,'limitations':['A 10% inset on the same landscape shape; this does not close the retained large portrait expansion failure.','Combined still guide and border matching change two factors; the comparison does not isolate their effects.','Boundary/temporal differences are diagnostics, not acceptance of invented geometry, seams or natural motion.'],'creativeApproval':'pending'}
(folder/'border-quality.json').write_text(json.dumps(report,indent=2));print(json.dumps(results,indent=2))
