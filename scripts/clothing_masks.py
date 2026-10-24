"""Pinned local clothing parser. Never invents a mask behind an occluder."""
import hashlib,json,sys
from pathlib import Path
import numpy as np
import torch
from PIL import Image
from scipy.ndimage import distance_transform_edt
from transformers import SegformerImageProcessor,SegformerForSemanticSegmentation
from video_media import decode_images,digest,encode
ROOT=Path(__file__).resolve().parents[1]
CLASSES={'upper':[4],'trousers':[6],'dress':[7]}
def make_masks(directory):
    manifest=json.loads((directory/'manifest.json').read_text(encoding='utf-8'));r=manifest['request'];prepared=json.loads((directory/'prepared.json').read_text(encoding='utf-8'));lock=[x for x in json.loads((ROOT/'setup/advanced-models.lock.json').read_text(encoding='utf-8')) if x['group']=='clothing']
    for file in lock:
        if digest(ROOT/file['path'])!=file['sha256']:raise ValueError('Clothing model/configuration changed.')
    folder=ROOT/'runtime/selection-models/clothing';processor=SegformerImageProcessor.from_pretrained(folder,local_files_only=True);model=SegformerForSemanticSegmentation.from_pretrained(folder,local_files_only=True).eval()
    torch.set_num_threads(8);masks=[];records=[];seed_luma=None;classes=CLASSES[r['clothingPart']];seed=r['materialSeed'];weights=np.array([.2126,.7152,.0722]);height,width=prepared['size'][1],prepared['size'][0]
    for index,image in enumerate(decode_images(directory/'input.mp4')):
        inputs=processor(images=image,return_tensors='pt')
        with torch.inference_mode():
            logits=model(**inputs).logits;prob=torch.nn.functional.interpolate(logits,size=(height,width),mode='bilinear',align_corners=False).softmax(dim=1)[0];labels=prob.argmax(dim=0).numpy();confidence=prob[classes].sum(dim=0).numpy()
        rgb=np.asarray(image,dtype=float)/255;luma=rgb@weights;selected=np.isin(labels,classes)&(confidence>=.6)
        if index==0:
            x,y=min(width-1,int(seed[0]*width)),min(height-1,int(seed[1]*height));patch=selected[max(0,y-4):y+5,max(0,x-4):x+5]
            if not selected[y,x] or patch.sum()<8:raise ValueError('Click a visible part of the chosen clothing on the source frame.')
            seed_luma=float(np.median(luma[max(0,y-4):y+5,max(0,x-4):x+5][patch]))
        # Keep bright undershirts separate from dark outerwear selected by the seed.
        if r.get('isolateGarment',True):selected &= np.abs(luma-seed_luma)<=.22
        if selected.mean()>.85:raise ValueError('Automatic clothing selection covers too much of the frame.')
        if index==0 and selected.mean()<.002:raise ValueError('No reliable clothing region was found.')
        feather=max(1,float(r.get('feather',4)));mask=np.rint(np.minimum(1,distance_transform_edt(selected)/feather)*255).astype(np.uint8)
        (directory/'masks').mkdir(exist_ok=True);(directory/'selection').mkdir(exist_ok=True)
        Image.fromarray(mask).save(directory/'masks'/f'{index:04d}.png');Image.fromarray(labels.astype(np.uint8)).save(directory/'selection'/f'{index:04d}-labels.png');Image.fromarray(np.rint(confidence*255).astype(np.uint8)).save(directory/'selection'/f'{index:04d}-confidence.png')
        masks.append(Image.fromarray(mask).convert('RGB'));records.append({'frame':index,'coverage':float(selected.mean()),'status':'visible' if selected.any() else 'no-visible-clothing','confidence':float(confidence[selected].mean()) if selected.any() else None})
    if len(masks)!=prepared['frames']:raise ValueError('Parser source frame count changed.')
    encode(masks,directory/'mask.mp4',tuple(prepared['size']),prepared['fps'])
    report={'method':'segformer-clothing-per-frame-v1','classes':classes,'part':r['clothingPart'],'seed':seed,'seedLuma':seed_luma,'threshold':.6,'appearanceLumaTolerance':.22 if r.get('isolateGarment',True) else None,'models':lock,'inputSha256':digest(directory/'input.mp4'),'frames':len(masks),'trajectory':records,'maskSha256':[digest(directory/'masks'/f'{i:04d}.png') for i in range(len(masks))],'note':'Visible clothing only. Empty masks skip fully hidden material; inspect parser boundaries and occlusion behavior. Research model terms apply.'}
    report.update({'method':'segformer-clothing-per-frame-v2','labelSha256':[digest(directory/'selection'/f'{i:04d}-labels.png') for i in range(len(masks))],'confidenceSha256':[digest(directory/'selection'/f'{i:04d}-confidence.png') for i in range(len(masks))]})
    (directory/'selection.json').write_text(json.dumps(report,indent=2),encoding='utf-8');(directory/'tracking.json').write_text(json.dumps({**report,'trajectory':[{'frame':x['frame'],'confidence':x['confidence'] if x['confidence'] is not None else 1} for x in records]},indent=2),encoding='utf-8')
    from selection_check import selection_preview
    selection_preview(directory);print(json.dumps({'frames':len(masks),'minimumCoverage':min(x['coverage'] for x in records)}))
if __name__=='__main__':make_masks(Path(sys.argv[1]))
