"""Decode a real image, bind provenance, and prove preservation outside a mask."""
import argparse, hashlib, json, pathlib
import numpy as np
from PIL import Image, ImageOps, ImageFilter

def load(file):
    with Image.open(file) as image:
        image.load()
        return ImageOps.exif_transpose(image).convert('RGB')

def check(raw, request, assets, directory):
    image=load(raw); checks=[]; provenance={}
    def record(name, passed, detail): checks.append({'name':name,'pass':bool(passed),'detail':detail})
    source=None; mask=None; blending=None
    for key in ['asset','reference','reference2','mask']:
        if request.get(key):
            file=assets/request[key];provenance[key]={'name':request[key],'sha256':hashlib.sha256(file.read_bytes()).hexdigest()}
    if request.get('asset'): source=load(assets/request['asset'])
    if request['tool']=='inpaint' or request.get('mask'):
        mask=load(assets/request['mask']).getchannel('R')
        if mask.size!=source.size: raise ValueError('Mask and source dimensions differ')
        values=np.asarray(mask)
        if not np.any(values>0) or not np.any(values==0): raise ValueError('Paint part of the image; leave some pixels unmasked')
        edited=image.resize(source.size,Image.Resampling.LANCZOS)
        if request.get('blend')=='boundary':
            # Estimate an illumination/color offset only from corresponding editable skin; retain neutral eyes/teeth with a soft skin weight.
            original=np.asarray(source).astype(float);candidate=np.asarray(edited).astype(float)
            def skin(a):return (a[:,:,0]>a[:,:,1]+6)&(a[:,:,1]>a[:,:,2]+2)&(a.mean(axis=2)>30)&(a.mean(axis=2)<225)
            band=(values>=160)&skin(original)&skin(candidate)
            samples=int(band.sum())
            offset=np.clip(np.median((original-candidate)[band],axis=0),-64,64) if samples>=32 else np.zeros(3)
            skin_weight=np.asarray(Image.fromarray((skin(candidate)*255).astype('uint8')).filter(ImageFilter.GaussianBlur(3))).astype(float)/255
            edited=Image.fromarray(np.clip(candidate+offset*skin_weight[:,:,None],0,255).round().astype('uint8'))
            blending={'method':'paired-editable-skin-offset-v2','samples':samples,'rgbOffset':offset.tolist(),'applied':samples>=32}
            record('Boundary color estimate',np.isfinite(offset).all(),'Bounded skin-color offset from '+str(samples)+' editable skin pixels; appearance still needs review.')
        image=Image.composite(edited,source,mask)
        outside=values==0;delta=np.abs(np.asarray(image).astype(int)-np.asarray(source).astype(int))
        record('Outside-mask preservation',np.max(delta[outside])==0,'Every unmasked RGB pixel equals the source.')
        record('Inside-mask change',np.any(delta[values>0]>0),'At least one painted pixel changed; visual review is still required.')
        expected=source.size
    elif request['tool']=='upscale': expected=tuple(x*request['scale'] for x in source.size)
    else: expected=tuple(request.get('size') or {'square':[768,768],'landscape':[1024,576],'portrait':[576,1024]}[request['aspect']])
    record('Dimensions',image.size==expected,f'{image.width} × {image.height}; expected {expected[0]} × {expected[1]}')
    record('Full decode',True,'All image pixels decoded.')
    pixels=np.asarray(image);record('Non-flat pixels',pixels.std()>1,'Blank or uniform outputs fail this check.')
    selection=None
    if request['tool']=='select':
        channel=pixels[:,:,0]; selected=channel>0
        record('Binary selection',np.all((channel==0)|(channel==255)) and np.all(pixels[:,:,0]==pixels[:,:,1]) and np.all(pixels[:,:,1]==pixels[:,:,2]),'Mask is a lossless black and white PNG.')
        record('Selected and protected pixels',np.any(selected) and np.any(~selected),'Empty and full-frame masks cannot silently become edits.')
        record('Selection source dimensions',image.size==source.size,'Mask matches the original source pixel grid.')
        selection={'method':request['segmentMethod'],'coverage':float(selected.mean()),'semanticApproval':'pending','sourceSha256':provenance['asset']['sha256']}
    if request.get('continuity'):
        for name,checksum in request['continuity'].get('provenance',{}).items():
            if not __import__('re').fullmatch(r'[a-f0-9-]{36}\.(png|jpg|webp)',name):raise ValueError('Invalid continuity asset')
            record('Reference unchanged: '+name,hashlib.sha256((assets/name).read_bytes()).hexdigest()==checksum,'Original anchor checksum matches the saved run.')
    output=directory/'output.png';image.save(output,format='PNG')
    with Image.open(output) as saved: saved.load();record('Saved PNG decode',saved.size==image.size,'Final PNG reopened successfully.')
    vision_file=directory/'vision.json'
    vision=json.loads(vision_file.read_text(encoding='utf-8')) if vision_file.exists() else None
    if vision:
        record('Vision source binding',vision['sourceSha256']==provenance['asset']['sha256'] and (not request.get('reference') or vision['referenceSha256']==provenance['reference']['sha256']),'Original target and reference are unchanged.')
        if request['tool']=='face-anchor':
            box=vision['cropBox'];valid=len(box)==4 and all(isinstance(v,int) for v in box) and 0<=box[0]<box[2]<=source.width and 0<=box[1]<box[3]<=source.height
            record('Original crop coordinates',valid,'Saved crop lies inside the original portrait.')
            record('Exact original face pixels',valid and image.size==source.crop(box).size and np.array_equal(np.asarray(image),np.asarray(source.crop(box))),'Every output pixel comes directly from the recorded original crop; no synthesis or enlargement.')
        if request['tool']=='face-neural':
            root=pathlib.Path(__file__).resolve().parents[1];lockfile=directory/'face-runtime.json'
            if not lockfile.exists():lockfile=root/'setup/facefusion.lock.json'
            lock=json.loads(lockfile.read_text())
            record('Face runtime binding',vision['runtimeLockSha256']==hashlib.sha256(lockfile.read_bytes()).hexdigest() and vision['models']==lock['models'],'Pinned local processor and selected weight checksums recorded.')
            record('Face mask binding',vision['maskSha256']==provenance['mask']['sha256'],'Final preservation uses the preflight face mask.')
            record('No face enhancer',vision['enhancer'] is False,'Face enhancement cannot hide an identity or seam failure.')
        if request['tool']=='prop-place':
            # Independently inspect every pixel beyond a padded placement box;
            # this also catches accidental whole-image color/size changes.
            quad=np.asarray(request['propQuad'])*np.asarray(image.size)
            low=np.floor(quad.min(axis=0)-2).astype(int);high=np.ceil(quad.max(axis=0)+2).astype(int)
            outside=np.ones((image.height,image.width),dtype=bool)
            outside[max(0,low[1]):min(image.height,high[1]+1),max(0,low[0]):min(image.width,high[0]+1)]=False
            delta=np.abs(np.asarray(image).astype(int)-np.asarray(source).astype(int))
            maximum=int(delta[outside].max()) if np.any(outside) else None
            vision['verifiedOutsidePlacementMaxRgb']=maximum
            record('Prop outside preservation',vision['outsideExact'] and maximum==0,'Independent comparison outside the padded placement bounds; maximum RGB change '+str(maximum)+'.')
    if request['tool']=='identity-pose':
        locks=json.loads((directory/'identity-models.json').read_text())
        for item in locks:
            with pathlib.Path(item['path']).open('rb') as stream:checksum=hashlib.file_digest(stream,'sha256').hexdigest()
            record('Identity model binding: '+pathlib.Path(item['path']).name,checksum==item['sha256'],'Pinned original adapter, extracted LoRA, SDXL and structural guide weights.')
    if request['tool']=='views':
        model=json.loads((directory/'angle-model.json').read_text())
        with pathlib.Path(model['path']).open('rb') as stream:checksum=hashlib.file_digest(stream,'sha256').hexdigest()
        record('Angle adapter binding',checksum==model['sha256'],'Pinned trained viewpoint adapter. Geometry and identity still need visual review.')
    style=None
    if request['tool']=='style-board':
        from check_style import check as check_style
        style=check_style(directory,request,assets)
        record('Whole-board style binding and style-only attention',style['valid'],'All '+str(style['cards'])+' reference embeddings averaged exactly; layout injection disabled.')
    report={'selection':selection,'vision':vision,'style':style,'kind':'image','technicalPass':all(c['pass'] for c in checks),'size':list(image.size),'width':image.width,'height':image.height,'sha256':hashlib.sha256(output.read_bytes()).hexdigest(),'rawSha256':hashlib.sha256(raw.read_bytes()).hexdigest(),'checks':checks,'provenance':provenance,'blending':blending,'creativeApproval':'pending','warnings':['Technical checks do not establish identity, lighting quality, anatomy, or prompt adherence.']}
    (directory/'report.json').write_text(json.dumps(report,indent=2,ensure_ascii=True),encoding='utf-8')
    return report

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('directory');p.add_argument('assets');args=p.parse_args()
    directory=pathlib.Path(args.directory)
    request=json.loads((directory/'job.json').read_text(encoding='utf-8'))['request']
    check(directory/'raw.png',request,pathlib.Path(args.assets),directory)
