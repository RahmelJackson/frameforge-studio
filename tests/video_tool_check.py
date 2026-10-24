import importlib.util,json,pathlib,sys,tempfile
import numpy as np
from PIL import Image
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[1]/'scripts'))
from video_media import encode,inspect,audio_samples,sample_images,grade_image
spec=importlib.util.spec_from_file_location('processor',pathlib.Path(__file__).resolve().parents[1]/'scripts/process-video.py');processor=importlib.util.module_from_spec(spec);spec.loader.exec_module(processor)
with tempfile.TemporaryDirectory(prefix='frameforge-video-tools-') as temp:
    root=pathlib.Path(temp);assets=root/'assets';assets.mkdir();directory=root/'edit';directory.mkdir()
    rgb=np.zeros((180,320,3),dtype=np.uint8);rgb[:,:106]=[210,20,20];rgb[:,106:213]=[20,210,20];rgb[:,213:]=[20,20,210]
    source=root/'source.mp4';tone=np.sin(np.arange(96000)/48000*2*np.pi*440).astype(np.float32)*.15;encode((Image.fromarray(rgb) for _ in range(48)),source,(320,180),24,np.stack([tone,tone]));info=inspect(source)
    r={'tool':'shorts','aspect':'portrait','start':.5,'end':1.5,'cropX':0,'cropEndX':1,'cropY':.5,'cropEndY':.5,'grade':'original','exposure':1,'saturation':1,'volume':1,'audioVolume':.7,'narration':'','caption':'','cards':[],'overlay':None}
    source_info={**info,'path':str(source)};manifest={'request':r,'source':source_info,'assets':str(assets)};(directory/'manifest.json').write_text(json.dumps(manifest),encoding='utf-8');expected=processor.render(manifest,directory)
    result=inspect(directory/'output.mp4');assert result['frames']==24 and result['size']==[432,768] and abs(result['duration']-1)<.001
    first,last=list(sample_images(directory/'output.mp4',[0,23/24]));a=np.asarray(first)[384,216];b=np.asarray(last)[384,216];assert a[0]>150 and a[2]<50,(a,b);assert b[2]>150 and b[0]<50,(a,b)
    audio=audio_samples(directory/'output.mp4',1);assert audio is not None and np.sqrt(np.mean(audio**2))>.05
    frequency=np.argmax(np.abs(np.fft.rfft(audio[0])));assert 430<frequency<450,frequency
    r['grade']='noir';processor.render(manifest,directory);frame=np.asarray(next(sample_images(directory/'output.mp4',[.5]))).astype(int);assert np.max(np.ptp(frame,axis=2))<5
    # Source integrity is a precondition, not a silent promise.
    bad={**manifest,'source':{**source_info,'sha256':'0'*64}}
    try:processor.render(bad,directory)
    except ValueError:pass
    else:raise AssertionError('Changed source accepted')
    # Never conceal a truncated model output by repeating its last frame.
    r['tool']='upscale';processor.render(manifest,directory,'prepare')
    encode((Image.new('RGB',(640,360),'gray') for _ in range(23)),directory/'raw.mp4',(640,360),24)
    try:processor.render(manifest,directory,'finalize')
    except ValueError as error:assert 'model output' in str(error)
    else:raise AssertionError('Truncated model output accepted')
    encode((Image.new('RGB',(640,360),'gray') for _ in range(24)),directory/'raw.mp4',(640,360),24)
    processor.render(manifest,directory,'finalize');assert inspect(directory/'output.mp4')['frames']==24
    with (directory/'input.mp4').open('ab') as stream:stream.write(b'changed')
    try:processor.render(manifest,directory,'finalize')
    except ValueError as error:assert 'Prepared footage' in str(error)
    else:raise AssertionError('Changed prepared footage accepted')
    Image.new('RGB',(320,180),'red').save(assets/'red.png');Image.new('RGB',(320,180),'blue').save(assets/'blue.png')
    r.update(tool='story',aspect='landscape',cards=[{'asset':'red.png','caption':'First scene','seconds':1},{'asset':'blue.png','caption':'Second scene','seconds':1}]);story={'request':r,'assets':str(assets)};processor.render(story,directory);frames=list(sample_images(directory/'output.mp4',[.1,1.1]));assert np.asarray(frames[0])[100,100,0]>200;assert np.asarray(frames[1])[100,100,2]>200
    gray=Image.new('RGB',(32,32),(128,128,128));warm=np.asarray(grade_image(gray,'warm'));cool=np.asarray(grade_image(gray,'cool'));assert warm[:,:,0].mean()>warm[:,:,2].mean();assert cool[:,:,2].mean()>cool[:,:,0].mean()
print('Real video trim/crop trajectory, audio frequency, monochrome, story order and integrity controls passed')
