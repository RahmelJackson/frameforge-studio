import importlib.util, pathlib, tempfile
import numpy as np
from PIL import Image
spec=importlib.util.spec_from_file_location('verify_image',pathlib.Path(__file__).resolve().parents[1]/'scripts/verify-image.py')
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
with tempfile.TemporaryDirectory(prefix='frameforge-images-') as temp:
    root=pathlib.Path(temp);assets=root/'assets';assets.mkdir();out=root/'output';out.mkdir()
    rng=np.random.default_rng(42);source=rng.integers(0,256,(64,64,3),dtype=np.uint8)
    Image.fromarray(source).save(assets/'source.png')
    mask=np.zeros((64,64),dtype=np.uint8);mask[20:40,20:40]=255;Image.fromarray(mask).save(assets/'mask.png')
    Image.fromarray(255-source).save(out/'raw.png')
    request={'tool':'inpaint','asset':'source.png','mask':'mask.png','aspect':'square'}
    report=module.check(out/'raw.png',request,assets,out);assert report['technicalPass']
    final=np.asarray(Image.open(out/'output.png'));assert np.array_equal(final[mask==0],source[mask==0]);assert not np.array_equal(final[mask>0],source[mask>0])
    assert report['provenance']['asset']['sha256']
    # A warm skin candidate has a known offset; match it using a soft edge without changing the background.
    skin=np.zeros((64,64,3),dtype=np.uint8);skin[:]=[130,100,75];skin[25:35,25:35]=[110,80,55]
    Image.fromarray(skin).save(assets/'source.png');soft=np.zeros((64,64),dtype=np.uint8);soft[16:48,16:48]=100;soft[20:44,20:44]=255;Image.fromarray(soft).save(assets/'mask.png');Image.fromarray(skin+40).save(out/'raw.png')
    matched=module.check(out/'raw.png',{'tool':'continuity','asset':'source.png','mask':'mask.png','blend':'boundary'},assets,out)
    assert matched['blending']['applied'] and matched['blending']['rgbOffset']==[-40.,-40.,-40.]
    assert np.array_equal(np.asarray(Image.open(out/'output.png')),skin)
    request={'tool':'create','aspect':'square'};report=module.check(out/'raw.png',request,assets,out);assert not report['technicalPass']
    Image.new('RGB',(768,768),'black').save(out/'raw.png');report=module.check(out/'raw.png',request,assets,out);assert not report['technicalPass']
    request={'tool':'upscale','asset':'source.png','scale':2};Image.fromarray(np.tile(source,(2,2,1))).save(out/'raw.png');assert module.check(out/'raw.png',request,assets,out)['technicalPass']
    Image.new('RGB',(64,64),'black').save(assets/'mask.png')
    try:module.check(out/'raw.png',{'tool':'inpaint','asset':'source.png','mask':'mask.png'},assets,out)
    except ValueError:pass
    else:raise AssertionError('Empty mask accepted')
print('Image positive and negative controls passed')
