import json,sys,tempfile
from pathlib import Path
import numpy as np
from PIL import Image,ImageDraw
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'scripts'))
from video_media import encode,inspect,sample_images,decode_images
from video_outpaint import process,placement
from lip_holds import strength_at,held_at
from match_outpaint_border import match_border
yy,xx=np.mgrid[:32,:48];truth=np.stack([xx+yy,xx*2+20,yy*3+30],axis=2).astype(np.uint8)
mask=np.ones((32,48),dtype=np.uint8)*255;mask[4:-4,4:-4]=0;candidate=truth.copy();candidate[mask>0]=candidate[mask>0]+25
matched,detail=match_border(Image.fromarray(candidate),Image.fromarray(truth),Image.fromarray(mask))
assert np.abs(np.asarray(matched).astype(int)-truth).max()<=1 and detail['originalMaxRgb']==0 and detail['boundaryMeanRgbAfter']<detail['boundaryMeanRgbBefore']
ranges=[{'start':.8,'end':1.28}]
assert all(held_at(i,25,ranges)==(20<=i<32) for i in range(60))
assert all(strength_at(i,25,ranges)==0 for i in range(20,32))
assert strength_at(19,25,ranges)>.49 and strength_at(32,25,ranges)==.5 and strength_at(33,25,ranges)>.99
parent=(ROOT/'runtime').resolve();parent.mkdir(exist_ok=True)
with tempfile.TemporaryDirectory(prefix='outpaint-guide-tests-',dir=parent) as name:
    folder=Path(name);assert folder.resolve().parent==parent;assets=folder/'assets';assets.mkdir();output=folder/'job';output.mkdir()
    frames=[]
    for i in range(13):
        frame=Image.new('RGB',(320,180),(36,64,100));ImageDraw.Draw(frame).rectangle((20+i,50,80+i,100),fill='orange');frames.append(frame)
    source=folder/'source.mp4';encode(frames,source,(320,180),16);info=inspect(source)
    fitted,offset=placement(info['size'],(512,288),.1);assert fitted== (460,260)
    bases=[im.resize(fitted,Image.Resampling.LANCZOS) for im in sample_images(source,(i/16 for i in range(13)))]
    guide=Image.new('RGB',(512,288),'green');guide.paste(bases[0],offset);guide.save(assets/'guide.png')
    manifest={'request':{'tool':'outpaint','aspect':'landscape','start':0,'end':13/16,'volume':1,'outpaintInset':.1,'outpaintGuide':True,'reference':'guide.png'},'source':{'path':str(source),**info},'assets':str(assets)}
    prepared=process(manifest,output,'prepare');assert prepared['guide']['asset']=='guide.png';assert max(np.asarray(next(sample_images(output/'mask.mp4',[0]))).flatten())==0
    encode([Image.new('RGB',(512,288),'blue') for _ in range(13)],output/'raw.mp4',(512,288),16)
    process(manifest,output,'finalize');master=list(decode_images(output/'preserved.mkv'));assert np.array_equal(np.asarray(master[0]),np.asarray(guide))
    x,y=offset;w,h=fitted
    for frame,base in zip(master,bases):assert np.array_equal(np.asarray(frame)[y:y+h,x:x+w],np.asarray(base))
    guide.putpixel((0,0),(255,0,0));guide.save(assets/'guide.png')
    try:process(manifest,output,'finalize');raise AssertionError('Changed guide accepted')
    except ValueError as error:assert 'guide changed' in str(error)
print('Explicit holds, small-border geometry, source/first-guide preservation and tamper refusal pass.')
