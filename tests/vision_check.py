import importlib.util,json,sys,tempfile,subprocess
from pathlib import Path
import numpy as np
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
import vision_tools as vision
from video_media import encode,inspect,digest,sample_images,crop_image,decode_images

runtime=(ROOT/'runtime').resolve();test_directory=(ROOT/'runtime/vision-tests').resolve()
assert test_directory.parent==runtime and test_directory.name=='vision-tests'
test_directory.mkdir(parents=True,exist_ok=True)
with tempfile.TemporaryDirectory(prefix='frameforge-vision-',dir=test_directory) as temp:
    root=Path(temp);assets=root/'assets';assets.mkdir()
    texture=np.random.default_rng(22).integers(40,240,(40,40,3),dtype=np.uint8)
    def moving(cut=False):
        for i in range(17):
            frame=np.zeros((96,160,3),np.uint8);frame[:]=[25,30,35]
            if not cut or i<8:frame[25:65,20+2*i:60+2*i]=texture
            yield Image.fromarray(frame)
    source=root/'input.mp4';encode(moving(),source,(160,96),16)
    mask=np.zeros((96,160),np.uint8);mask[23:67,18:62]=255;Image.fromarray(mask).save(assets/'mask.png')
    manifest={'request':{'mask':'mask.png','trackMask':True,'feather':3},'assets':str(assets)}
    (root/'manifest.json').write_text(json.dumps(manifest),encoding='utf-8');(root/'prepared.json').write_text(json.dumps({'size':[160,96],'frames':17,'fps':16}),encoding='utf-8')
    report=vision.track(root);trajectory=json.loads((root/'tracking.json').read_text(encoding='utf-8'))
    shift=trajectory['trajectory'][-1]['transform'][0][2];assert abs(shift-32)<1.5,shift
    assert report['minimumConfidence']>.55
    first=np.asarray(Image.open(root/'masks/0000.png'));last=np.asarray(Image.open(root/'masks/0016.png'))
    assert abs(np.where(last>128)[1].mean()-np.where(first>128)[1].mean()-32)<1.5
    encode(moving(True),source,(160,96),16)
    try:vision.track(root)
    except ValueError:pass
    else:raise AssertionError('Tracker continued after the textured subject vanished')
    # Exact original pixels survive the independent FFV1 round trip.
    images=list(moving());master=root/'master.mkv';encode(images,master,(160,96),16,codec='ffv1')
    decoded=list(decode_images(master))
    assert all(np.array_equal(np.asarray(a),np.asarray(b)) for a,b in zip(images,decoded))
    # Original prop color/markings are copied and all uncovered pixels stay exact.
    target=np.full((96,160,3),31,np.uint8);prop=Image.fromarray(np.dstack([texture,np.full((40,40),255,np.uint8)]))
    out,proof=vision.place_prop(target,prop,[[40/160,24/96],[79/160,24/96],[79/160,63/96],[40/160,63/96]],[0,0,1,1],'alpha')
    assert proof['outsideExact'] and np.array_equal(out[5,5],target[5,5]);assert np.max(np.abs(out[24:64,40:80].astype(int)-texture.astype(int)))<1
    try:vision.place_prop(target,prop,[[0,0],[1,1],[1,0],[0,1]],[0,0,1,1],'alpha')
    except ValueError:pass
    else:raise AssertionError('Crossed prop corners were accepted')
    try:vision.face_match(target,target)
    except ValueError:pass
    else:raise AssertionError('A face was invented in a uniform image')
    # Exercise the real preparation, finalization and independent verifier with a
    # deliberately destructive model candidate. Protected pixels must still win.
    spec=importlib.util.spec_from_file_location('process_video',ROOT/'scripts/process-video.py')
    process=importlib.util.module_from_spec(spec);spec.loader.exec_module(process)
    encode(moving(),source,(160,96),16)
    original=root/'original.mp4';original.write_bytes(source.read_bytes())
    request={'tool':'masked','mask':'mask.png','trackMask':True,'feather':3,'seed':22,'aspect':'landscape','start':0,'end':17/16,'volume':1,'cropX':.5,'cropY':.5,'cropEndX':.5,'cropEndY':.5,'region':[.1,.2,.3,.5]}
    manifest={'request':request,'assets':str(assets),'source':{**inspect(original),'path':str(original)},'visionPython':sys.executable}
    (root/'manifest.json').write_text(json.dumps(manifest),encoding='utf-8')
    prepared=process.render(manifest,root,'prepare')
    encode((Image.new('RGB',prepared['size'],(190,20,40)) for _ in range(prepared['frames'])),root/'raw.mp4',prepared['size'],prepared['fps'])
    process.render(manifest,root,'finalize')
    result=subprocess.run([sys.executable,str(ROOT/'scripts/verify-video-tool.py'),str(root)],capture_output=True,text=True,timeout=30)
    assert result.returncode==0,result.stderr
    report=json.loads((root/'report.json').read_text());assert report['technicalPass'] and report['preservation']['outsideMaxRgb']==0
    Image.new('L',prepared['size'],255).save(root/'masks/0000.png')
    try:process.render(manifest,root,'finalize')
    except ValueError as error:assert 'mask frame changed' in str(error)
    else:raise AssertionError('Finalization accepted a changed prepared mask')
print('Tracking follows ground truth, stops on lost subject, preserves lossless pixels and exact prop texture, and rejects ambiguous geometry/no face')
