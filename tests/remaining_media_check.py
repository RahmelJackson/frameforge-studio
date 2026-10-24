import json,sys,tempfile
from pathlib import Path
import numpy as np
from PIL import Image,ImageDraw
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'scripts'))
from video_media import encode,inspect,digest,decode_images,sample_images,crop_image
from video_reframe import render
from video_extend import process
with tempfile.TemporaryDirectory(prefix='frameforge-remaining-') as tmp:
    root=Path(tmp);pictures=[]
    for i in range(33):
        im=Image.new('RGB',(320,180),(20,30,40));d=ImageDraw.Draw(im);x=70+i*5;d.rectangle((x-20,65,x+20,115),fill=(180,80,30))
        for k in range(6):d.line((x-17+k*6,67,x-17+k*6,112),fill='white',width=2)
        d.text((x-15,83),'BOX',fill='black');pictures.append(im)
    source=root/'source.mp4';encode(pictures,source,(320,180),16);meta={**inspect(source),'path':str(source),'sha256':digest(source)};request={'tool':'reframe','start':0,'end':33/16,'aspect':'portrait','region':[50/320,65/180,40/320,50/180],'seed':42,'volume':1};directory=root/'tracking';directory.mkdir();m={'source':meta,'request':request}
    expected=render(m,directory);rows=json.loads((directory/'reframing.json').read_text(encoding='utf-8'))['trajectory'];centers=[]
    for i,im in enumerate(decode_images(directory/'preserved.mkv')):
        a=np.asarray(im);mask=(a[:,:,0]>120)&(a[:,:,1]<130)&(a[:,:,2]<80);ys,xs=np.where(mask);assert len(xs)>100;centers.append(float(xs.mean()/im.width));base=next(sample_images(source,[i/16]));reference=crop_image(base,im.size,rows[i]['cropX'],rows[i]['cropY']);assert np.array_equal(np.asarray(im),np.asarray(reference))
    assert max(abs(x-.5) for x in centers)<.18,centers
    hidden=root/'occluded.mp4';encode(pictures[:14]+[Image.new('RGB',(320,180),(20,30,40))]*19,hidden,(320,180),16);bad=root/'lost';bad.mkdir();failed=False
    try:render({'source':{**inspect(hidden),'path':str(hidden),'sha256':digest(hidden)},'request':request},bad)
    except ValueError as e:failed='uncertain' in str(e) or 'lost' in str(e) or 'tracking' in str(e)
    assert failed and not (bad/'completed.json').exists()
    for direction in ['forward','backward']:
        folder=root/direction;folder.mkdir();m={'source':meta,'request':{'start':0,'end':17/16,'volume':1,'extensionDirection':direction}};prepared=process(m,folder,'prepare');mask=list(decode_images(folder/'mask.mp4'));assert len(mask)==49
        assert np.asarray(mask[0 if direction=='backward' else -1]).mean()>250
        generated=[Image.new('RGB',tuple(prepared['size']),(80+i,120,140)) for i in range(49)];encode(generated,folder/'raw.mp4',tuple(prepared['size']),16);process(m,folder,'finalize');master=list(decode_images(folder/'preserved.mkv'));offset=32 if direction=='backward' else 0
        for i,base in enumerate(sample_images(source,(i/16 for i in range(17)))):assert np.array_equal(np.asarray(master[i+offset]),np.asarray(crop_image(base,tuple(prepared['size']))))
print('Moving-subject crop, lost-track refusal and bidirectional original-frame retention pass.')
