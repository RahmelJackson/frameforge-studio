import importlib.util,json,pathlib,sys,tempfile,subprocess
import numpy as np
from PIL import Image
ROOT=pathlib.Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'scripts'))
from illumination import lighting_field,apply_field
from video_media import encode,inspect,digest,decode_images
spec=importlib.util.spec_from_file_location('processor',ROOT/'scripts/process-video.py');processor=importlib.util.module_from_spec(spec);spec.loader.exec_module(processor)
rng=np.random.default_rng(92);source=Image.fromarray(rng.integers(16,180,(64,64,3),dtype='uint8'));bright=Image.new('RGB',source.size,'white');dark=Image.new('RGB',source.size,'black')
zero=lighting_field(source,bright,0,.5);assert np.array_equal(np.asarray(apply_field(source,zero)[0]),np.asarray(source))
field=lighting_field(source,bright,.5,.5);assert float(field.max())<=.25+1e-6
changed=lighting_field(source,dark,.5,.5,field,16);assert np.max(np.abs(changed-field))<=.5/16+1e-6
# A proposal containing unrelated geometry cannot transfer its pixel detail.
checker=np.indices((64,64)).sum(axis=0)%2*200;candidate=Image.fromarray(np.repeat(checker[:,:,None],3,axis=2).astype('uint8'))
smooth=lighting_field(Image.new('RGB',(64,64),(90,80,70)),candidate,1,1)
assert float(np.max(np.abs(np.diff(smooth,axis=0))))<.02
with tempfile.TemporaryDirectory(prefix='frameforge-illumination-') as temp:
    root=pathlib.Path(temp);assets=root/'assets';assets.mkdir();directory=root/'job';directory.mkdir()
    original=root/'source.mp4';encode((source.resize((160,160)) for _ in range(16)),original,(160,160),16);info=inspect(original)
    request={'tool':'relight','aspect':'square','start':0,'end':1,'cropX':.5,'cropY':.5,'cropEndX':.5,'cropEndY':.5,'volume':1,'audioVolume':1,'relightMode':'preserve','relightStrength':0,'relightMaxEV':.5}
    manifest={'request':request,'source':{**info,'path':str(original)},'assets':str(assets)};(directory/'manifest.json').write_text(json.dumps(manifest))
    prepared=processor.render(manifest,directory,'prepare');size=tuple(prepared['size']);encode((bright.resize(size) for _ in range(prepared['frames'])),directory/'raw.mp4',size,16)
    expected=processor.render(manifest,directory,'finalize');assert expected['relighting']['fieldsSha256'];assert inspect(directory/'preserved.mkv')['frames']==13
    result=subprocess.run([sys.executable,str(ROOT/'scripts/verify-video-tool.py'),str(directory)],capture_output=True,text=True);assert result.returncode==0,result.stderr
    report=json.loads((directory/'report.json').read_text());assert report['technicalPass'],report
    assert report['relighting']['observedMaximumEV']==0
    request['relightStrength']=.7;(directory/'manifest.json').write_text(json.dumps(manifest));processor.render(manifest,directory,'finalize')
    result=subprocess.run([sys.executable,str(ROOT/'scripts/verify-video-tool.py'),str(directory)],capture_output=True,text=True);assert result.returncode==0,result.stderr
    report=json.loads((directory/'report.json').read_text());assert report['technicalPass'],report
    assert report['relighting']['observedMaximumEV']<=.35+1e-6
    # Changed correction files are rejected even when the video still decodes.
    with (directory/'relight-fields.npz').open('ab') as file:file.write(b'changed')
    result=subprocess.run([sys.executable,str(ROOT/'scripts/verify-video-tool.py'),str(directory)],capture_output=True,text=True);assert result.returncode!=0
print('Bounded neutral lighting, zero amount, temporal step, no proposal-detail transfer, real finalization and tamper rejection passed')
