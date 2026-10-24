"""Independent pixel protection checks for saved clothing classifications."""
import json
from pathlib import Path
import numpy as np
from PIL import Image,ImageDraw
from video_media import decode_images,digest

def verify_selection(directory):
    report=json.loads((directory/'selection.json').read_text());manifest=json.loads((directory/'manifest.json').read_text());request=manifest['request'];root=Path(__file__).resolve().parents[1]
    classes={'upper':[4],'trousers':[6],'dress':[7]}[request['clothingPart']]
    valid=report['classes']==classes and report['seed']==request['materialSeed'] and report['inputSha256']==digest(directory/'input.mp4') and report['threshold']==.6 and report['appearanceLumaTolerance']==(.22 if request.get('isolateGarment',True) else None)
    expected_models=[x for x in json.loads((root/'setup/advanced-models.lock.json').read_text()) if x['group']=='clothing']
    valid &= report['models']==expected_models
    for item in report['models']:valid &= digest(root/item['path'])==item['sha256']
    forbidden=0;frames=0
    for i,image in enumerate(decode_images(directory/'input.mp4')):
        mask=np.asarray(Image.open(directory/'masks'/f'{i:04d}.png'));labels=np.asarray(Image.open(directory/'selection'/f'{i:04d}-labels.png'));confidence=np.asarray(Image.open(directory/'selection'/f'{i:04d}-confidence.png'))
        luma=np.asarray(image,dtype=float)/255@np.array([.2126,.7152,.0722]);editable=mask>0
        forbidden+=int(np.count_nonzero(editable&(~np.isin(labels,classes)|(confidence<153)|((np.abs(luma-report['seedLuma'])>.220001) if request.get('isolateGarment',True) else np.zeros_like(editable)))))
        valid &= digest(directory/'masks'/f'{i:04d}.png')==report['maskSha256'][i]
        if report['method'].endswith('-v2'):valid &= digest(directory/'selection'/f'{i:04d}-labels.png')==report['labelSha256'][i] and digest(directory/'selection'/f'{i:04d}-confidence.png')==report['confidenceSha256'][i]
        frames+=1
    return {'valid':bool(valid and forbidden==0 and frames==report['frames']),'frames':frames,'forbiddenEditablePixels':forbidden,'method':report['method'],'minimumCoverage':min(f['coverage'] for f in report['trajectory']),'note':'Proves masks obey saved model classifications, not that the model labels every garment correctly.'}

def selection_preview(directory):
    info=json.loads((directory/'selection.json').read_text());indices={0,info['frames']//2,info['frames']-1};cards=[]
    for i,image in enumerate(decode_images(directory/'input.mp4')):
        if i not in indices:continue
        matte=np.asarray(Image.open(directory/'masks'/f'{i:04d}.png'),dtype=float)/255
        rgb=np.asarray(image,dtype=float);overlay=Image.fromarray(np.rint(rgb*(1-.5*matte[:,:,None])+np.array([200,255,100])*.5*matte[:,:,None]).astype('uint8'));overlay.thumbnail((288,512));cards.append((i,overlay))
    sheet=Image.new('RGB',(sum(im.width for _,im in cards),max(im.height for _,im in cards)+26),'#141617');draw=ImageDraw.Draw(sheet);x=0
    for i,im in cards:sheet.paste(im,(x,26));draw.text((x+5,6),'Saved selection - frame '+str(i),fill='white');x+=im.width
    sheet.save(directory/'selection-preview.jpg',quality=94)
