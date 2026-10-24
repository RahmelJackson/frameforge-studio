from pathlib import Path
import sys,tempfile,json,copy
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
import numpy as np
from PIL import Image,ImageDraw
from video_media import encode,inspect,digest
from neural_masks import finalize,import_masks,project_first_mask
from check_neural_masks import check,check_reuse
from human_pose import points18,fit_sequence
from types import SimpleNamespace
landmarks=[SimpleNamespace(x=.1+i*.02,y=.2+i*.01,visibility=.9,presence=.9) for i in range(33)]
joints=points18(landmarks);assert joints[2]==[landmarks[12].x,landmarks[12].y] and joints[5]==[landmarks[11].x,landmarks[11].y]
landmarks[16].visibility=.1;assert points18(landmarks)[4] is None
poses,fit=fit_sequence([joints,[[p[0]+.05,p[1]] if p else None for p in joints]],(288,512),'upper')
assert all(p is None for frame in poses for p in frame[8:14]);assert all(.079<=v<=.921 for frame in poses for p in frame if p for v in p)
assert abs(poses[1][4][0]-poses[0][4][0]-.05*fit['scale'])<1e-6
projected,geometry=project_first_mask(Image.new('L',(96,64),255),(160,80),{'size':[96,64],'crop':{'cropX':.25,'cropY':.5}},0)
assert geometry['sourceCrop']==[10,0,130,80] and np.count_nonzero(projected)==120*80
assert not np.asarray(projected)[:,:10].any() and not np.asarray(projected)[:,130:].any()
with tempfile.TemporaryDirectory() as temp:
    root=Path(temp);origin=root/'origin';origin.mkdir();size=(96,64);fps=16;frames=5
    images=[];masks=[]
    for i in range(frames):
        image=Image.new('RGB',size,(30,40,50));d=ImageDraw.Draw(image);d.rectangle((20+i,20,50+i,50),fill=(130,90,50));images.append(image)
        mask=Image.new('RGB',size);ImageDraw.Draw(mask).rectangle((20+i,20,50+i,50),fill='white');masks.append(mask)
    encode(images,root/'source.mp4',size,fps);encode(images,origin/'input.mp4',size,fps);encode(masks,origin/'raw.mp4',size,fps);(root/'model').write_bytes(b'model-fixture')
    source={**inspect(root/'source.mp4'),'path':str(root/'source.mp4')};crop={k:.5 for k in ['cropX','cropY','cropEndX','cropEndY']}
    r={'tool':'segment','start':0,'volume':1,'feather':6,'segmentPoints':[{'x':.3,'y':.5,'label':1},{'x':.8,'y':.5,'label':0}],**crop}
    prepared={'frames':frames,'size':list(size),'fps':fps,'duration':frames/fps,'sourceRange':[0,frames/fps],'inputSha256':digest(origin/'input.mp4')};(origin/'prepared.json').write_text(json.dumps(prepared))
    manifest={'request':r,'source':source,'segmentationModel':{'path':str(root/'model'),'sha256':digest(root/'model')}}
    expected=finalize(manifest,origin);report=check(origin,manifest,expected);assert report['valid'] and report['maximumReconstructionRgbError']==0
    import subprocess
    frame=root/'first.png';images[0].save(frame);projection_input={'directory':str(origin),'metadataSha256':digest(origin/'segmentation.json'),'sourceSha256':source['sha256'],'time':0,'frame':str(frame),'frameSha256':digest(frame),'output':str(root/'projected.png'),'jobId':'test','feather':6}
    def project_cli(settings):
        file=root/'projection-input.json';file.write_text(json.dumps(settings));return subprocess.run([sys.executable,str(Path(__file__).resolve().parents[1]/'scripts/selection-keyframe.py'),str(file)],capture_output=True,text=True)
    assert project_cli(projection_input).returncode==0
    for change in [{'time':.1},{'sourceSha256':'changed'},{'metadataSha256':'changed'},{'frameSha256':'changed'}]:assert project_cli({**projection_input,**change}).returncode!=0
    meta=json.loads((origin/'segmentation.json').read_text());assert all(x['confidence'] is None for x in meta['trajectory'])
    bound={'jobId':'test','directory':str(origin),'metadataSha256':digest(origin/'segmentation.json')}
    def reuse(m):
        folder=root/('reuse'+str(len(list(root.iterdir()))));folder.mkdir();(folder/'prepared.json').write_text(json.dumps(prepared));import_masks(m,folder);return folder
    reuse_manifest={'request':r,'source':source,'segmentation':bound};reused=reuse(reuse_manifest)
    assert check_reuse(reused,reuse_manifest,expected)['valid']
    original=np.asarray(Image.open(origin/'masks/0000.png'));soft=np.asarray(Image.open(reused/'masks/0000.png'));assert np.any((soft>0)&(soft<255)) and np.max(soft[original==0])==0
    for change in [{'source':{**source,'sha256':'bad'}},{'request':{**r,'cropX':.8}},{'segmentation':{**bound,'metadataSha256':'bad'}}]:
        try:reuse({'request':r,'source':source,'segmentation':bound,**change});raise AssertionError('Changed binding accepted')
        except ValueError:pass
    old=(origin/'masks/0001.png').read_bytes();(origin/'masks/0001.png').write_bytes(old+b'tamper')
    assert not check(origin,manifest,expected)['valid']
    try:reuse({'request':r,'source':source,'segmentation':bound});raise AssertionError('Changed mask accepted')
    except ValueError:pass
    (origin/'masks/0001.png').write_bytes(old)
    changed=copy.deepcopy(prepared);changed['sourceRange']=[.1,.1+frames/fps];folder=root/'range';folder.mkdir();(folder/'prepared.json').write_text(json.dumps(changed))
    try:import_masks({'request':r,'source':source,'segmentation':bound},folder);raise AssertionError('Changed range accepted')
    except ValueError:pass
print('Exact neural overlay, provenance, explicit points and tamper/range/crop refusals pass.')
