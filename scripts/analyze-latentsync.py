"""Fixed-source comparison and experimental SyncNet timing with shifted controls.

Uses official SyncNet architecture/weights and MFCC/offset premise. Face boxes
come from our saved MediaPipe preparation rather than upstream S3FD. Confidence
is diagnostic, not calibrated phoneme accuracy or an official benchmark score.
"""
import json,sys,math
from pathlib import Path
import numpy as np
import torch,cv2
import python_speech_features
from scipy.signal import medfilt,resample_poly
from PIL import Image,ImageDraw
from video_media import digest,decode_images,audio_samples,encode
ROOT=Path(__file__).resolve().parents[1];E=ROOT/'evidence/acceptance-round9'
lock=json.loads((ROOT/'setup/lipsync-eval.lock.json').read_text());source=ROOT/'runtime/lipsync-eval-source'
for name,expected in lock['sourceFiles'].items():
    if digest(source/name)!=expected:raise ValueError('Changed evaluator source')
model=ROOT/'runtime'/lock['model']['path']
if digest(model)!=lock['model']['sha256']:raise ValueError('Changed evaluator weights')
sys.path.insert(0,str(source));from syncnet import S
device='cpu' if '--cpu' in sys.argv else 'cuda';torch.set_num_threads(8);network=S(num_layers_in_fc_layers=1024).to(device).eval()
network.load_state_dict(torch.load(model,map_location='cpu',weights_only=True),strict=True)
baseline=ROOT/'data/audio-jobs/449a747d-5fea-403a-ab2a-ccec2a7b1e30'
candidate=Path(sys.argv[1]) if len(sys.argv)>1 else E/'lip-repair';manifest=json.loads((candidate/'manifest.json').read_text());track=json.loads((candidate/'lipsync.json').read_text())
mono=resample_poly(audio_samples(manifest['audio']['path'],manifest['audio']['duration']).mean(axis=0),1,3)
frame_sources=[('latentsync',candidate)] if len(sys.argv)>1 else [('musetalk',baseline),('latentsync',candidate)]
frames={name:list(decode_images(directory/'preserved.mkv')) for name,directory in frame_sources}
# Same fixed-source detector track for both methods; lower/side expansion follows
# the upstream SyncNet crop geometry. No detector is run on generated mouths.
boxes=np.array([x['rawCrop'] for x in track['trajectory']]);size=medfilt(np.maximum(boxes[:,2]-boxes[:,0],boxes[:,3]-boxes[:,1])/2,13);cx=medfilt((boxes[:,0]+boxes[:,2])/2,13);cy=medfilt((boxes[:,1]+boxes[:,3])/2,13)
lip_features={};lastframe=min(track['frames'],math.floor(len(mono)/640))-5
with torch.inference_mode():
    for name,images in frames.items():
        cropped=[]
        for i,image in enumerate(images):
            bs=size[i];padding=int(bs*1.8);padded=np.pad(np.array(image)[:,:,::-1],((padding,padding),(padding,padding),(0,0)),constant_values=110);mx=cx[i]+padding;my=cy[i]+padding
            crop=padded[int(my-bs):int(my+bs*1.8),int(mx-bs*1.4):int(mx+bs*1.4)]
            cropped.append(cv2.resize(crop,(224,224)))
        tensor=torch.tensor(np.stack(cropped).transpose(3,0,1,2),dtype=torch.float32)[None]
        features=[]
        for start in range(0,lastframe,10):
            batch=torch.cat([tensor[:,:,i:i+5] for i in range(start,min(start+10,lastframe))]).to(device)
            features.append(network.forward_lip(batch).cpu())
        lip_features[name]=torch.cat(features)
    audio_features={}
    for shift in [0,8,-8]:
        sample_shift=shift*640
        shifted=np.pad(mono,(max(0,sample_shift),max(0,-sample_shift)))[max(0,-sample_shift):max(0,-sample_shift)+len(mono)]
        pcm=np.clip(shifted*32768,-32768,32767).astype(np.int16)
        mfcc=python_speech_features.mfcc(pcm,16000).T
        tensor=torch.tensor(mfcc,dtype=torch.float32)[None,None];features=[]
        for start in range(0,lastframe,10):
            batch=torch.cat([tensor[:,:,:,i*4:i*4+20] for i in range(start,min(start+10,lastframe))]).to(device)
            features.append(network.forward_aud(batch).cpu())
        audio_features[shift]=torch.cat(features)
results={}
for name,lip in lip_features.items():
    records=[]
    for shift,audio in audio_features.items():
        padded=torch.nn.functional.pad(audio,(0,0,15,15));distance=torch.stack([torch.nn.functional.pairwise_distance(lip[[i]].repeat(31,1),padded[i:i+31]) for i in range(len(lip))]).mean(0)
        minimum,index=distance.min(0)
        records.append({'audioShiftFrames':shift,'estimatedOffsetFrames':15-int(index),'minimumDistance':float(minimum),'confidence':float(distance.median()-minimum),'meanDistanceByOffset':distance.tolist()})
    zero=records[0]['estimatedOffsetFrames'];passed=all(abs((item['estimatedOffsetFrames']-zero)+item['audioShiftFrames'])<=2 for item in records[1:])
    results[name]={'shiftedControlPass':passed,'records':records}
if len(sys.argv)>1:
    report={'method':'SyncNet v2 fixed MediaPipe crop diagnostic; adapted preprocessing','candidate':str(candidate),'videoSha256':digest(candidate/'preserved.mkv'),'audioSha256':manifest['audio']['sha256'],'modelSha256':lock['model']['sha256'],'frames':track['frames'],'results':results,'limitations':[('Short filmed-example sample; not broad face/pose coverage.' if '--real' in sys.argv else 'Synthetic frontal face and short preset speech only.'),'Not an official upstream benchmark or proof of individual phoneme alignment.','Shifted controls must pass before interpreting offsets.'],'creativeApproval':'pending'}
    output=next((Path(a.split('=',1)[1]) for a in sys.argv[2:] if a.startswith('--output=')),E/'ui-timing-diagnostic.json');output.write_text(json.dumps(report,indent=2));print(json.dumps(results));raise SystemExit
sheet=Image.new('RGB',(960,500),'#13171b');draw=ImageDraw.Draw(sheet)
selected=[6,18,29,40,49]
for row,name in enumerate(['musetalk','latentsync']):
    draw.text((10,row*250+5),name,fill='white')
    for column,index in enumerate(selected):
        crop=track['trajectory'][index]['crop'];mouth=[crop[0],round(crop[1]+(crop[3]-crop[1])*.38),crop[2],crop[3]]
        image=frames[name][index].crop(mouth);image.thumbnail((180,210));sheet.paste(image,(column*192+6,row*250+28));draw.text((column*192+6,row*250+235),f'{index/25:.2f}s',fill='white')
sheet.save(E/'mouth-comparison.jpg',quality=95)
comparison=[]
for i in range(track['frames']):
    image=Image.new('RGB',(864,808),'#111418');draw=ImageDraw.Draw(image)
    for n,name in enumerate(['musetalk','latentsync']):
        image.paste(frames[name][i],(n*432,40));draw.text((n*432+15,12),name,fill='white')
    comparison.append(image)
sound=audio_samples(manifest['audio']['path'],track['frames']/25)
encode(comparison,E/'lip-comparison.mp4',(864,808),25,sound)
report={'method':'SyncNet v2 fixed MediaPipe crop diagnostic; adapted from the pinned upstream evaluator','modelSha256':lock['model']['sha256'],'sourceRevision':lock['sourceRevision'],'sources':{'audio':manifest['audio']['sha256'],'musetalk':digest(baseline/'preserved.mkv'),'latentsync':digest(candidate/'preserved.mkv')},'frames':track['frames'],'fps':25,'results':results,'limitations':['Synthetic portrait and short preset speech, not real-world coverage.','MediaPipe boxes replace upstream S3FD detection; scores are not official benchmark values.','If shifted controls fail, offset/confidence do not validate phoneme alignment.','Neither timing scores nor pixel preservation establish realistic teeth, identity, profiles or occlusion.'],'creativeApproval':'pending'}
(E/'timing-comparison.json').write_text(json.dumps(report,indent=2));print(json.dumps({name:{'controlPass':r['shiftedControlPass'],'offset':r['records'][0]['estimatedOffsetFrames'],'confidence':r['records'][0]['confidence']} for name,r in results.items()}))
