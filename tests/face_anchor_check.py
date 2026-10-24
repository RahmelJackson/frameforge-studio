import importlib.util,json,sys,tempfile
from pathlib import Path
import numpy as np
from PIL import Image
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'scripts'));import vision_tools as vision
spec=importlib.util.spec_from_file_location('verify',ROOT/'scripts/verify-image.py');verify=importlib.util.module_from_spec(spec);spec.loader.exec_module(verify)
original=np.random.default_rng(16).integers(0,255,(400,500,3),dtype=np.uint8)
points=np.tile([[150.,100.],[300.,280.]],(239,1)).astype(np.float32)
vision.landmarks=lambda image:(points,'detector')
crop,report=vision.face_anchor(original);box=report['cropBox'];assert report['generated'] is False;assert crop.shape[0]<400 and crop.shape[1]<500
assert np.array_equal(crop,original[box[1]:box[3],box[0]:box[2]])
vision.landmarks=lambda image:(points*.1,'detector')
try:vision.face_anchor(original)
except ValueError:pass
else:raise AssertionError('Small original face accepted')
folder=ROOT/'runtime/vision-tests';folder.mkdir(exist_ok=True)
with tempfile.TemporaryDirectory(dir=folder) as tmp:
    d=Path(tmp);assets=d/'assets';assets.mkdir();Image.fromarray(original).save(assets/'source.png');Image.fromarray(crop).save(d/'raw.png')
    report['sourceSha256']=vision.digest(assets/'source.png');(d/'vision.json').write_text(json.dumps(report))
    request={'tool':'face-anchor','asset':'source.png','size':[crop.shape[1],crop.shape[0]],'aspect':'square'}
    result=verify.check(d/'raw.png',request,assets,d);assert result['technicalPass']
    crop[0,0]^=255;Image.fromarray(crop).save(d/'raw.png');result=verify.check(d/'raw.png',request,assets,d);assert not result['technicalPass'];assert any(c['name']=='Exact original face pixels' and not c['pass'] for c in result['checks'])
print('Exact crop and negative controls passed')
