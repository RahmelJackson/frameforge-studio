"""Transfer only a bounded opposed-light field; never copy generated face/color."""
import json, math
from pathlib import Path
import numpy as np
from PIL import Image,ImageDraw,ImageFilter
from video_media import digest
ROOT=Path(__file__).resolve().parents[1];DIRECTORY=ROOT/'evidence/round13-relight'

def linear(pixels):
    a=np.asarray(pixels,dtype=np.float64)/255
    return np.where(a<=.04045,a/12.92,((a+.055)/1.055)**2.4)

def srgb(a):
    return np.round(np.clip(np.where(a<=.0031308,a*12.92,1.055*np.maximum(a,0)**(1/2.4)-.055),0,1)*255).astype(np.uint8)

def field(left,right):
    # Compare the opposed proposals to cancel common appearance alterations.
    # No generated image pixels enter the output image; just a smooth scalar gain.
    def low(image):
        y=linear(image)@np.array([.2126,.7152,.0722])
        log=np.log2(np.maximum(y,1e-4))
        # PIL float images do not support GaussianBlur: filter positive encoded
        # log EV through the verified project scipy runtime without quantization.
        from scipy.ndimage import gaussian_filter
        return gaussian_filter(log,12,mode='reflect')
    ev=(low(left)-low(right))*.5
    ev-=float(ev.mean())
    return np.clip(ev,-.75,.75)

def apply(source,ev,strength):
    if not 0<=strength<=1:raise ValueError('Lighting strength must be0–1.')
    if strength==0:return np.asarray(source).copy()
    original=linear(source);gain=2**(ev*strength)
    # Cap equal-channel gains before gamut clipping so material chroma stays.
    gain=np.minimum(gain,.995/np.maximum(original.max(axis=2),1e-5))
    return srgb(original*gain[:,:,None])

def main():
    run=json.loads((DIRECTORY/'run.json').read_text(encoding='utf-8'))
    if run['status']!='complete':raise ValueError('Both checked lighting proposals are required.')
    source=Image.open(DIRECTORY/'condition.png').convert('RGB');left=Image.open(DIRECTORY/'left.png').convert('RGB');right=Image.open(DIRECTORY/'right.png').convert('RGB')
    if left.size!=source.size or right.size!=source.size:raise ValueError('Proposal geometry differs.')
    for name in ('left','right'):
        if digest(DIRECTORY/(name+'.png'))!=run['cases'][name]['sha256']:raise ValueError('Proposal changed.')
    ev=field(left,right);strength=.65;outputs={}
    for name,sign in [('left',1),('right',-1)]:
        pixels=apply(source,ev*sign,strength);path=DIRECTORY/('preserved-'+name+'.png');Image.fromarray(pixels).save(path);outputs[name]={'path':str(path),'sha256':digest(path)}
    # A zero-strength control must be exactly the original sampled RGB image.
    assert np.array_equal(apply(source,ev,0),np.asarray(source))
    report={'method':'opposed-proposal-scalar-linear-light-v1','sources':{n:digest(DIRECTORY/(n+'.png')) for n in ['condition','left','right']},'settings':{'strength':strength,'maxEv':.75,'blurSigmaPixels':12},'actualFieldEv':[float(ev.min()),float(ev.max())],'outputs':outputs,'zeroStrengthExact':True,'geometry':'Output uses each original pixel at its original coordinate; no generated texture/color is copied.','limitations':'Low-frequency illumination approximation. Does not infer physically correct cast shadows, hidden geometry or temporal consistency. Generated changes may influence the estimated field; inspect it.','creativeApproval':None}
    (DIRECTORY/'light-transfer.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    w,h=source.size;sheet=Image.new('RGB',(w*3,h+32),'#16181c');draw=ImageDraw.Draw(sheet)
    for i,(label,img) in enumerate([('Original',source),('Original + left-light field',Image.open(outputs['left']['path'])),('Original + right-light field',Image.open(outputs['right']['path']))]):
        draw.text((w*i+8,8),label,fill='white');sheet.paste(img,(w*i,32))
    sheet.save(DIRECTORY/'preserved-comparison.png');print(json.dumps(report))
if __name__=='__main__':main()
