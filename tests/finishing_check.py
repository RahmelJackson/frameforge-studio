import json,sys,tempfile,importlib.util,subprocess
from pathlib import Path
import numpy as np
from PIL import Image
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'scripts'))
from material_color import recolor,linear
from video_media import encode,inspect,sample_images,decode_images,digest,audio_samples
spec=importlib.util.spec_from_file_location('process',ROOT/'scripts/process-video.py');process=importlib.util.module_from_spec(spec);spec.loader.exec_module(process)
image=np.random.default_rng(4).integers(10,240,(64,64,3),dtype=np.uint8);mask=np.zeros((64,64),np.uint8);mask[12:52,12:52]=255
out=np.asarray(recolor(Image.fromarray(image),Image.fromarray(mask),'#244b80',1));assert np.array_equal(out[mask==0],image[mask==0]);assert np.max(np.abs(linear(out)@np.array([.2126,.7152,.0722])-linear(image)@np.array([.2126,.7152,.0722])))<.008
assert np.array_equal(np.asarray(recolor(Image.fromarray(image),Image.fromarray(mask),'#244b80',0)),image)
base=ROOT/'runtime/finishing-tests';base.mkdir(exist_ok=True)
with tempfile.TemporaryDirectory(dir=base) as tmp:
    d=Path(tmp);assets=d/'assets';assets.mkdir();directory=d/'job';directory.mkdir();source=d/'source.mp4'
    frames=[]
    for i in range(9):
        a=np.zeros((96,160,3),np.uint8);a[:]=[35,40,45];a[20:72,20+i*3:72+i*3]=image[:52,:52];frames.append(Image.fromarray(a))
    tone=np.sin(np.arange(54000)/48000*2*np.pi*440).astype(np.float32)*.1;encode(frames,source,(160,96),8,np.stack([tone,tone]));info={**inspect(source),'path':str(source)}
    r={'tool':'interpolate','aspect':'landscape','start':0,'end':None,'cropX':.5,'cropY':.5,'cropEndX':.5,'cropEndY':.5,'volume':1,'audioVolume':1,'narration':'','cards':[]}
    lock=json.loads((ROOT/'setup/interpolation-model.lock.json').read_text());m={'request':r,'source':info,'assets':str(assets),'interpolationModel':lock};(directory/'manifest.json').write_text(json.dumps(m));p=process.render(m,directory,'prepare')
    # Fake intermediate frames isolate the adapter contract; actual FILM is exercised by saved live previews.
    originals=list(sample_images(source,(i/8 for i in range(9))));candidate=[]
    for i,a in enumerate(originals):
        candidate.append(a)
        if i<8:candidate.append(Image.blend(a,originals[i+1],.5))
    encode(candidate,directory/'raw.mp4',(160,96),16);process.render(m,directory,'finalize');checked=inspect(directory/'output.mp4');assert checked['frames']==18 and checked['fps']==16 and abs(checked['duration']-1.125)<1e-6
    master=list(decode_images(directory/'preserved.mkv'));assert all(np.array_equal(np.asarray(master[2*i]),np.asarray(originals[i])) for i in range(9));assert audio_samples(directory/'output.mp4',1.125) is not None
    bad={**m,'interpolationModel':{**lock,'sha256':'0'*64}}
    try:process.render(bad,directory,'finalize')
    except ValueError as e:assert 'model changed' in str(e)
    else:raise AssertionError('Changed interpolation model accepted')
    # A held uncertain interval must contain only the earlier original pixels.
    risks={'inputSha256':p['inputSha256'],'frames':9,'uncertainPairs':[2,5]}
    (directory/'motion-risks.json').write_text(json.dumps(risks));p['motionAnalysisSha256']=digest(directory/'motion-risks.json');(directory/'prepared.json').write_text(json.dumps(p));r['motionSafety']='hold';(directory/'manifest.json').write_text(json.dumps(m))
    process.render(m,directory,'finalize');master=list(decode_images(directory/'preserved.mkv'));assert all(np.array_equal(np.asarray(master[2*i+1]),np.asarray(originals[i])) for i in [2,5])
    result=subprocess.run([sys.executable,str(ROOT/'scripts/verify-video-tool.py'),str(directory)],capture_output=True,text=True);assert result.returncode==0,result.stderr;assert json.loads((directory/'report.json').read_text())['technicalPass']
    risks['uncertainPairs']=[1];(directory/'motion-risks.json').write_text(json.dumps(risks))
    try:process.render(m,directory,'finalize')
    except ValueError as e:assert 'Motion risk evidence changed' in str(e)
    else:raise AssertionError('Changed motion risk evidence accepted')
    r['motionSafety']='off'
    (directory/'input.mp4').write_bytes(b'changed')
    try:process.render(m,directory,'finalize')
    except ValueError as e:assert 'Prepared footage' in str(e)
    else:raise AssertionError('Changed interpolation input accepted')
    r.update(tool='recolor',region=[.12,.18,.6,.6],mask=None,trackMask=False,feather=4,seed=4,materialColor='#244b80',materialStrength=1);m['visionPython']=str(ROOT/'runtime/vision-env/Scripts/python.exe');(directory/'manifest.json').write_text(json.dumps(m));expected=process.render(m,directory)
    # Reusing a folder must not carry obsolete interpolation metadata into the color report.
    assert 'material' in expected and 'interpolation' not in expected
    result=subprocess.run([sys.executable,str(ROOT/'scripts/verify-video-tool.py'),str(directory)],capture_output=True,text=True);assert result.returncode==0,result.stderr
    report=json.loads((directory/'report.json').read_text());assert report['technicalPass'] and report['preservation']['outsideMaxRgb']==0
    r['materialColor']='#7c2540';(directory/'manifest.json').write_text(json.dumps(m));result=subprocess.run([sys.executable,str(ROOT/'scripts/verify-video-tool.py'),str(directory)],capture_output=True,text=True);assert result.returncode==0,result.stderr;wrong=json.loads((directory/'report.json').read_text());assert not wrong['technicalPass'] and any(c['name']=='Requested material chroma' and not c['pass'] for c in wrong['checks']);r['materialColor']='#244b80';(directory/'manifest.json').write_text(json.dumps(m))
    tampered=Image.open(directory/'masks/0000.png');tampered.putpixel((0,0),255);tampered.save(directory/'masks/0000.png');result=subprocess.run([sys.executable,str(ROOT/'scripts/verify-video-tool.py'),str(directory)],capture_output=True,text=True);assert result.returncode!=0 and 'Material mask changed' in result.stderr
print('Material invariants, interpolation timing/audio and negative controls passed')
