"""Gradient-domain correction of generated borders with a fixed original interior.

Only editable border pixels are solved. Source-normal gradients replace the
candidate's abrupt boundary jump; generated gradients remain within the border.
This changes color joins, not invented geometry or semantic correctness.
"""
import json,sys,uuid
from pathlib import Path
import numpy as np
from PIL import Image
from scipy.sparse import coo_matrix
from scipy.sparse.linalg import splu
from video_media import digest

def match_border(candidate,original,mask):
    generated=np.asarray(candidate,dtype=np.float64);fixed=np.asarray(original,dtype=np.float64);editable=np.asarray(mask)>127
    if generated.shape!=fixed.shape or editable.shape!=fixed.shape[:2] or editable.sum()==0 or (~editable).sum()==0 or editable.sum()>200_000:raise ValueError('Choose a bounded generated border with a protected original interior.')
    height,width=editable.shape;ys,xs=np.where(editable);indices=np.full(editable.shape,-1,dtype=np.int64);indices[ys,xs]=np.arange(len(ys));rows=[];cols=[];values=[];rhs=np.zeros((len(ys),3));before=[];after_edges=[]
    for number,(y,x) in enumerate(zip(ys,xs)):
        degree=0
        for dy,dx in [(-1,0),(1,0),(0,-1),(0,1)]:
            ny,nx=y+dy,x+dx
            if not(0<=ny<height and 0<=nx<width):continue
            degree+=1
            if editable[ny,nx]:
                rows.append(number);cols.append(indices[ny,nx]);values.append(-1.0);rhs[number]+=generated[y,x]-generated[ny,nx]
            else:
                iy,ix=ny+dy,nx+dx
                gradient=fixed[ny,nx]-fixed[iy,ix] if 0<=iy<height and 0<=ix<width and not editable[iy,ix] else np.zeros(3)
                rhs[number]+=fixed[ny,nx]+gradient;before.append(np.abs(generated[y,x]-fixed[ny,nx]).mean());after_edges.append((number,ny,nx))
        rows.append(number);cols.append(number);values.append(float(degree))
    system=coo_matrix((values,(rows,cols)),shape=(len(ys),len(ys))).tocsc();solved=splu(system).solve(rhs)
    output=fixed.copy();output[ys,xs]=np.clip(np.rint(solved),0,255);output=output.astype(np.uint8)
    after=[np.abs(output[ys[i],xs[i]].astype(float)-fixed[y,x]).mean() for i,y,x in after_edges]
    return Image.fromarray(output),{'editablePixels':len(ys),'originalMaxRgb':int(np.abs(output[~editable].astype(float)-fixed[~editable]).max()),'boundaryMeanRgbBefore':float(np.mean(before)),'boundaryMeanRgbAfter':float(np.mean(after)),'method':'source-normal-gradient border solve; original interior fixed exactly'}

if __name__=='__main__':
    directory=Path(sys.argv[1]);assets=Path(sys.argv[2]);job=json.loads((directory/'job.json').read_text());report=json.loads((directory/'report.json').read_text());r=job['request']
    if r['kind']!='image' or r['tool']!='inpaint' or not report['technicalPass']:raise ValueError('Choose a checked still-guide image.')
    proposal=json.loads((assets/(r['asset']+'.proposal.json')).read_text())
    for key in ['asset','mask']:
        if digest(assets/r[key])!=report['provenance'][key]['sha256']:raise ValueError('The still-guide inputs changed.')
    if digest(directory/'output.png')!=report['sha256']:raise ValueError('The still guide changed after checking.')
    original=Image.open(assets/r['asset']).convert('RGB');mask=Image.open(assets/r['mask']).getchannel('R');candidate=Image.open(directory/'output.png').convert('RGB')
    image,detail=match_border(candidate,original,mask);name=str(uuid.uuid4())+'.png';image.save(assets/name)
    result={'name':name,'url':'/assets/'+name,'sha256':digest(assets/name),'sourceGuideJob':job['id'],'guideSha256':report['sha256'],'sourceSha256':proposal['sourceSha256'],'canvasSha256':proposal['assetSha256'],'maskSha256':proposal['maskSha256'],'detail':detail,'creativeApproval':'pending'}
    (assets/(name+'.guide.json')).write_text(json.dumps(result,indent=2));print(json.dumps(result))
