import sys
from pathlib import Path
from importlib.util import spec_from_file_location,module_from_spec
import numpy as np
from PIL import Image
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
spec=spec_from_file_location('light_transfer',Path(__file__).resolve().parents[1]/'scripts/round13-light-transfer.py');m=module_from_spec(spec);spec.loader.exec_module(m)
source=Image.fromarray(np.tile(np.array([[[31,112,142],[200,80,23],[250,240,100]]],dtype=np.uint8),(24,8,1)))
assert np.array_equal(m.apply(source,np.full((24,24),.5),0),np.asarray(source))
out=m.apply(source,np.full((24,24),.5),.65)
assert out.shape==np.asarray(source).shape
original=m.linear(source);actual=m.linear(out)
ratios=actual/np.maximum(original,1e-6)
# Quantization permits a small channel-ratio error; the scalar operation must
# retain which channel dominates each original material, including gamut caps.
assert np.array_equal(actual.argmax(2),original.argmax(2))
assert np.max(np.ptp(ratios,axis=2))<.035
try:m.apply(source,np.zeros((24,24)),1.1);raise AssertionError('Unbounded strength accepted')
except ValueError:pass
left=Image.fromarray(np.tile(np.linspace(220,50,24).astype(np.uint8)[None,:,None],(24,1,3)))
right=Image.fromarray(np.asarray(left)[:,::-1].copy())
f=m.field(left,right)
assert np.isfinite(f).all() and abs(f.max())<=.75 and abs(f.min())<=.75
assert np.mean(f[:,:8])>np.mean(f[:,-8:])
assert np.max(abs(f+m.field(right,left)))<1e-10
print('Original RGB zero control, bounded gains, preserved material channel order and opposite directional fields pass.')
