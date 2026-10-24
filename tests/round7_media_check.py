import sys,json,tempfile
from pathlib import Path
import numpy as np,cv2
from PIL import Image,ImageDraw
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'scripts'))
from video_media import encode,inspect,digest,decode_images,sample_images
from video_reframe import render,recover_template
from video_outpaint import process,placement
from video_upscale import render as resize
with tempfile.TemporaryDirectory(prefix='frameforge-round7-') as tmp:
    root=Path(tmp);pictures=[]
    for i in range(33):
        image=Image.new('RGB',(320,180),(20,30,40));d=ImageDraw.Draw(image);x=70+i*4
        if not 14<=i<18:
            d.rectangle((x-20,65,x+20,115),fill=(180,80,30))
            for k in range(6):d.line((x-17+k*6,67,x-17+k*6,112),fill='white',width=2)
            d.text((x-15,83),'BOX',fill='black')
        pictures.append(image)
    source=root/'source.mp4';encode(pictures,source,(320,180),16);meta={**inspect(source),'path':str(source),'sha256':digest(source)};r={'tool':'reframe','start':0,'end':33/16,'aspect':'portrait','region':[50/320,65/180,40/320,50/180],'seed':42,'volume':1,'reframeRecovery':True}
    folder=root/'recover';folder.mkdir();render({'source':meta,'request':r},folder);record=json.loads((folder/'reframing.json').read_text())
    assert record['recoveries']==1 and 1<=record['heldFrames']<=8,record
    gray=cv2.cvtColor(np.asarray(pictures[0]),cv2.COLOR_RGB2GRAY);template=gray[65:115,50:90];twins=np.full_like(gray,25);twins[65:115,50:90]=template;twins[65:115,200:240]=template
    assert recover_template(twins,template,np.array([70.,90.]),200) is None
    bad=root/'lost.mp4';encode(pictures[:14]+[Image.new('RGB',(320,180),(20,30,40))]*19,bad,(320,180),16);failed=False;folder=root/'failed';folder.mkdir()
    try:render({'source':{**inspect(bad),'path':str(bad),'sha256':digest(bad)},'request':r},folder)
    except ValueError:failed=True
    assert failed and not (folder/'completed.json').exists()
    folder=root/'outpaint';folder.mkdir();m={'source':meta,'request':{'start':0,'end':2,'aspect':'portrait','volume':1}};p=process(m,folder,'prepare')
    raw=[Image.new('RGB',tuple(p['size']),(60+i,100,130)) for i in range(p['frames'])];encode(raw,folder/'raw.mp4',tuple(p['size']),16);process(m,folder,'finalize')
    fitted,offset=placement(meta['size'],p['size']);x,y=offset;w,h=fitted
    for original,result in zip(sample_images(source,(i/16 for i in range(p['frames']))),decode_images(folder/'preserved.mkv')):
        assert np.array_equal(np.asarray(original.resize(fitted,Image.Resampling.LANCZOS)),np.asarray(result)[y:y+h,x:x+w])
    (folder/'input.mp4').write_bytes(b'changed');failed=False
    try:process(m,folder,'finalize')
    except ValueError:failed=True
    assert failed
    folder=root/'resize';folder.mkdir();r={'start':0,'end':2,'volume':1};e=resize({'source':meta,'request':r},folder)
    assert e['size']==[640,360] and e['frames']==32
    for original,result in zip(sample_images(source,(i/16 for i in range(e['frames']))),decode_images(folder/'preserved.mkv')):
        assert np.array_equal(np.asarray(original.resize((320,180),Image.Resampling.LANCZOS).resize((640,360),Image.Resampling.LANCZOS)),np.asarray(result))
print('Unique recovery, ambiguous/long-gap refusal, exact entire-source outpaint preservation and tamper refusal passed.')
