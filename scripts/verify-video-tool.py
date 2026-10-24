import argparse,json
from pathlib import Path
import numpy as np
import av
from video_media import audio_samples,digest
from importlib.util import spec_from_file_location,module_from_spec
spec=spec_from_file_location('verify_media',Path(__file__).with_name('verify-media.py'));module=module_from_spec(spec);spec.loader.exec_module(module)
p=argparse.ArgumentParser();p.add_argument('directory');p.add_argument('--file',choices=['output.mp4','movie.mp4'],default='output.mp4');args=p.parse_args();directory=Path(args.directory);expected=json.loads((directory/'expected.json').read_text(encoding='utf-8'));video=directory/args.file
report=module.verify(video,expected,directory);audio=audio_samples(video,report['duration']);present=audio is not None and np.max(np.abs(audio))>.0001
if expected.get('faithfulResize'):
    from video_media import sample_images,decode_images
    from PIL import Image
    m=json.loads((directory/'manifest.json').read_text(encoding='utf-8'));source=m['source'];factor=min(1,(500000/(source['size'][0]*source['size'][1]))**.5);base=tuple(max(2,int(v*factor)//2*2) for v in source['size']);maximum=0;observed=0
    for original,actual in zip(sample_images(source['path'],(m['request']['start']+i/expected['fps'] for i in range(expected['frames']))),decode_images(directory/'preserved.mkv')):
        target=original.resize(base,Image.Resampling.LANCZOS).resize(tuple(expected['size']),Image.Resampling.LANCZOS);maximum=max(maximum,int(np.abs(np.asarray(target).astype(int)-np.asarray(actual).astype(int)).max()));observed+=1
    valid=observed==expected['frames'] and maximum==0 and list(base)==expected['faithfulResize']['baseSize'] and list(expected['size'])==[v*2 for v in base] and digest(directory/'preserved.mkv')==expected['faithfulResize']['masterSha256']
    report['checks'].append({'name':'Faithful resize reconstruction','pass':valid,'actual':{'maximumRgbDifference':maximum,'frames':observed}});report['faithfulResize']=expected['faithfulResize']
if expected.get('reframing'):
    from video_media import sample_images,crop_image,decode_images
    m=json.loads((directory/'manifest.json').read_text(encoding='utf-8'));meta=json.loads((directory/'reframing.json').read_text(encoding='utf-8'));frames=expected['frames'];fps=expected['fps'];maximum=0;observed=0
    for i,(base,frame) in enumerate(zip(sample_images(m['source']['path'],(m['request']['start']+i/fps for i in range(frames))),decode_images(directory/'preserved.mkv'))):
        row=meta['trajectory'][i];reference=crop_image(base,tuple(expected['size']),row['cropX'],row['cropY']);maximum=max(maximum,int(np.abs(np.asarray(reference).astype(int)-np.asarray(frame).astype(int)).max()));observed+=1
    gap=0;gap_valid=True;previous_row=None
    for row in meta['trajectory']:
        if row.get('state')=='held-gap':
            gap+=1;gap_valid &= bool(m['request'].get('reframeRecovery')) and gap<=int(fps*.5) and previous_row is not None and row['cropX']==previous_row['cropX'] and row['cropY']==previous_row['cropY'] and row['subjectCenter'] is None
        else:
            gap_valid &= row['confidence']>=(.92 if row.get('state')=='reacquired' else .55);gap=0
        previous_row=row
    valid=gap_valid and gap==0 and observed==frames and len(meta['trajectory'])==frames and maximum==0 and digest(directory/'reframing.json')==expected['reframing']['sha256'] and digest(directory/'preserved.mkv')==expected['reframing']['masterSha256']
    report['checks'].append({'name':'Tracked crop and original pixels','pass':valid,'actual':{'frames':observed,'maximumRgbDifference':maximum,'minimumConfidence':meta['minimumConfidence']}});report['reframing']={**expected['reframing'],'minimumConfidence':meta['minimumConfidence'],'maximumRgbDifference':maximum}
if expected.get('extension'):
    from video_media import sample_images,crop_image,decode_images
    m=json.loads((directory/'manifest.json').read_text(encoding='utf-8'));meta=json.loads((directory/'extension.json').read_text(encoding='utf-8'));master=list(decode_images(directory/'preserved.mkv'));offset=meta['addedFrames'] if meta['direction']=='backward' else 0;maximum=0;observed=0
    for i,base in enumerate(sample_images(m['source']['path'],(m['request']['start']+i/expected['fps'] for i in range(meta['originalFrames'])))):
        reference=crop_image(base,tuple(expected['size']));maximum=max(maximum,int(np.abs(np.asarray(reference).astype(int)-np.asarray(master[i+offset]).astype(int)).max()));observed+=1
    valid=observed==meta['originalFrames'] and len(master)==expected['frames'] and maximum==0 and digest(directory/'extension.json')==expected['extension']['sha256'] and digest(directory/'preserved.mkv')==expected['extension']['masterSha256'] and digest(directory/'raw.mp4')==meta['rawSha256']
    report['checks'].append({'name':'Original continuation frames preserved','pass':valid,'actual':{'frames':observed,'maximumRgbDifference':maximum}});report['extension']={**meta,'originalMaximumRgbDifference':maximum}
manifest_file=directory/'manifest.json'
if expected.get('outpainting'):
    from video_media import sample_images,decode_images
    from PIL import Image
    m=json.loads((directory/'manifest.json').read_text(encoding='utf-8'));meta=json.loads((directory/'outpainting.json').read_text(encoding='utf-8'));maximum=0;observed=0;x,y=meta['offset'];w,h=meta['fittedSize']
    # Independently compute contain geometry, rather than trusting the saved source rectangle.
    sw,sh=m['source']['size'];tw,th=expected['size'];factor=min(tw/sw,th/sh)*(1-m['request'].get('outpaintInset',0));fw,fh=[max(2,round(v*factor/2)*2) for v in [sw,sh]]
    geometry=[w,h]==[fw,fh] and [x,y]==[(tw-fw)//2,(th-fh)//2]
    for original,frame in zip(sample_images(m['source']['path'],(m['request']['start']+i/expected['fps'] for i in range(expected['frames']))),decode_images(directory/'preserved.mkv')):
        reference=np.asarray(original.resize((w,h),Image.Resampling.LANCZOS));actual=np.asarray(frame)[y:y+h,x:x+w];maximum=max(maximum,int(np.abs(reference.astype(int)-actual.astype(int)).max()));observed+=1
    valid=geometry and observed==expected['frames'] and maximum==0 and digest(directory/'outpainting.json')==expected['outpainting']['sha256'] and digest(directory/'preserved.mkv')==expected['outpainting']['masterSha256'] and (meta.get('method')=='bounded-affine-still-border-v1' or digest(directory/'raw.mp4')==meta['rawSha256'])
    if meta.get('method')=='bounded-affine-still-border-v1':
        from track_still_border import tracked_frames
        guide_image=Image.open(Path(m['assets'])/meta['guide']['asset']).convert('RGB');bases=[im.resize((w,h),Image.Resampling.LANCZOS) for im in sample_images(m['source']['path'],(m['request']['start']+i/expected['fps'] for i in range(expected['frames'])))];reconstructed,trajectory=tracked_frames(bases,guide_image,(x,y),m['request'].get('outpaintMatch',False));actual=list(decode_images(directory/'preserved.mkv'));exact=len(actual)==len(reconstructed) and all(np.array_equal(a,b) for a,b in zip(actual,reconstructed));report['checks'].append({'name':'Tracked still border reconstruction','pass':exact and trajectory==meta['trajectory'],'actual':{'exact':exact,'frames':len(actual),'edgeHoldPixels':sum(t['edgeHoldPixels'] for t in trajectory)}})
    report['checks'].append({'name':'Entire original picture preserved within generated borders','pass':valid,'actual':{'frames':observed,'maximumRgbDifference':maximum,'fittedSize':[w,h],'offset':[x,y]}});report['outpainting']={**meta,'originalMaximumRgbDifference':maximum}
    if meta.get('guide'):
        guide=Path(m['assets'])/meta['guide']['asset'];first=np.asarray(next(decode_images(directory/'preserved.mkv')));guide_image=np.asarray(Image.open(guide).convert('RGB'));bound=digest(guide)==meta['guide']['sha256'];report['checks'].append({'name':'Selected still guide retained exactly in first frame','pass':bound and np.array_equal(first,guide_image),'actual':meta['guide']})
if manifest_file.exists():
    bound_manifest=json.loads(manifest_file.read_text(encoding='utf-8'));bound_source=bound_manifest.get('source')
    if bound_source:report['checks'].append({'name':'Source media binding','pass':digest(bound_source['path'])==expected['sourceSha256'],'actual':bound_source['sha256']})
    for name,checksum in expected.get('provenance',{}).items():
        file=Path(bound_manifest['audioPath']) if name=='soundtrack' else Path(bound_manifest['assets'])/name
        report['checks'].append({'name':'Saved input binding: '+name,'pass':digest(file)==checksum})
report['checks'].append({'name':'Audio expectation','pass':bool(present)==expected['hasAudio'],'actual':bool(present),'expected':expected['hasAudio']})
if audio is not None:
    report['audio']={'rms':float(np.sqrt(np.mean(audio**2))),'sampleRate':48000,'channels':2,'samples':audio.shape[1]}
    with av.open(str(video)) as media:
        starts=[];ends=[]
        for frame in media.decode(audio=0):
            if frame.time is not None:starts.append(float(frame.time));ends.append(float(frame.time)+frame.samples/frame.sample_rate)
    audio_duration=max(ends)-min(starts) if starts else 0
    report['audio']['decodedDuration']=audio_duration
    report['checks'].append({'name':'Audio sample duration','pass':bool(starts) and abs(audio_duration-report['duration'])<.06,'actual':audio_duration,'expected':report['duration']})
if expected.get('losslessSha256') and not expected.get('relighting') and not expected.get('interpolation'):
    from video_media import sample_images,crop_image,decode_images
    from PIL import Image,ImageDraw
    manifest=json.loads((directory/'manifest.json').read_text(encoding='utf-8'));request=manifest['request'];source=manifest['source'];frames=expected['frames'];fps=expected['fps'];size=tuple(expected['size'])
    decoded=sample_images(source['path'],(request['start']+i/fps for i in range(frames)));master=decode_images(directory/'preserved.mkv');preview=sample_images(video,(i/fps for i in range(frames)));maximum=0;errors=[];observed=0
    for i,(base,lossless,compressed) in enumerate(zip(decoded,master,preview)):
        t=i/max(1,frames-1);base=crop_image(base,size,request['cropX']+(request['cropEndX']-request['cropX'])*t,request['cropY']+(request['cropEndY']-request['cropY'])*t)
        if (directory/'masks'/f'{i:04d}.png').exists():mask=Image.open(directory/'masks'/f'{i:04d}.png').convert('L')
        else:
            mask=Image.new('L',size,0);x,y,w,h=request['region'];ImageDraw.Draw(mask).rectangle((round(x*size[0]),round(y*size[1]),round((x+w)*size[0])-1,round((y+h)*size[1])-1),fill=255)
        outside=np.asarray(mask)==0
        if not np.any(outside):raise ValueError('A temporal mask left no protected pixels.')
        delta=np.abs(np.asarray(lossless).astype(int)-np.asarray(base).astype(int));maximum=max(maximum,int(delta[outside].max()));errors.append(float(np.abs(np.asarray(compressed).astype(int)-np.asarray(base).astype(int))[outside].mean()));observed+=1
    valid=observed==frames and maximum==0 and digest(directory/'preserved.mkv')==expected['losslessSha256']
    report['checks'].append({'name':'Lossless outside-mask pixels','pass':valid,'actual':{'frames':observed,'maximumRgbDifference':maximum}})
    report['preservation']={'reference':'Original source after the documented crop/resize and time sampling.','losslessSha256':expected['losslessSha256'],'outsideMaxRgb':maximum,'previewOutsideMeanAbsoluteError':float(np.mean(errors)),'master':'preserved.mkv'}
    if (directory/'tracking.json').exists():
        track=json.loads((directory/'tracking.json').read_text(encoding='utf-8'));report['tracking']={'method':track['method'],'frames':track['frames'],'minimumConfidence':min((item['confidence'] for item in track['trajectory'] if item.get('confidence') is not None),default=None)}
if manifest_file.exists() and json.loads(manifest_file.read_text()).get('segmentation'):
    from check_neural_masks import check_reuse
    reused=check_reuse(directory,json.loads(manifest_file.read_text()),expected);report['neuralSelectionReuse']=reused;report['checks'].append({'name':'Checked neural source masks and inward edges','pass':reused['valid'],'actual':reused})
if expected.get('humanPose'):
    from PIL import Image,ImageOps
    from video_media import decode_images
    from body_pose import render as render_pose
    m=json.loads((directory/'manifest.json').read_text(encoding='utf-8'));meta=json.loads((directory/'human-pose.json').read_text(encoding='utf-8'));valid=digest(directory/'human-pose.json')==expected['humanPose']['sha256'] and digest(m['source']['path'])==meta['sourceSha256'] and digest(Path(__file__).resolve().parents[1]/meta['model']['path'])==meta['model']['sha256'];maximum=0;count=0;reconstructed=None;retarget_error=None
    if meta.get('retarget') or m['request'].get('poseTarget'):
        try:
            from pose_retarget import reconstruct_checked
            target=meta['target'];binding=m['poseTarget'];asset=m['request']['poseTarget'];target_path=Path(m['assets'])/asset;r=m['request'];source=m['source']
            ratio=source['size'][0]/source['size'][1];pose_size=[512,288] if ratio>1.2 else [288,512] if ratio<.83 else [384,384]
            duration=min(source['duration'],r['end'] if r['end'] is not None else source['duration'])-r['start'];frames=int(duration*16+1e-6)
            target_valid=target['asset']==binding['asset']==asset and Path(target['path']).resolve()==Path(binding['path']).resolve()==target_path.resolve() and digest(target_path)==target['sha256']==binding['sha256'] and list(ImageOps.exif_transpose(Image.open(target_path)).size)==target['size']
            geometry_valid=meta['method']==expected['humanPose']['method']=='mediapipe-full-video-to-openpose18-v2' and meta['framing']==r.get('poseFraming','upper') and meta['size']==pose_size==expected['size'] and meta['fps']==expected['fps']==16 and meta['frames']==frames==len(meta['rawLandmarks'])==len(meta['rawPoints']) and meta['sourceRange']==[r['start'],r['start']+frames/16] and meta['crop']=={'x':r['cropX'],'y':r['cropY']} and meta['sourceDetectedPeople']==[1]*frames and target['detectedPeople']==1
            if not target_valid or not geometry_valid:raise ValueError('Target image, detected sequence, framing or range binding changed.')
            reconstructed=reconstruct_checked(meta)
        except (ValueError,KeyError,TypeError,IndexError,OSError) as error:
            valid=False;retarget_error=str(error)
    for i,image in enumerate(decode_images(directory/'preserved.mkv')):
        png=directory/'pose-frames'/f'{i:04d}.png';valid &= digest(png)==meta['pngSha256'][i];maximum=max(maximum,int(np.abs(np.asarray(image).astype(int)-np.asarray(Image.open(png)).astype(int)).max()));count+=1
        if reconstructed is not None:maximum=max(maximum,int(np.abs(np.asarray(image).astype(int)-np.asarray(render_pose(reconstructed[i],tuple(meta['size']))).astype(int)).max()))
    valid &= count==expected['frames']==meta['frames'] and maximum==0 and digest(directory/'preserved.mkv')==meta['masterSha256']
    report['checks'].append({'name':'Detected pose guide, pinned task and exact master','pass':bool(valid),'actual':{'frames':count,'maximumRgbDifference':maximum}});report['humanPose']={**expected['humanPose'],'framing':meta['framing'],'limitations':meta['limitations']}
    if meta.get('retarget') or m['request'].get('poseTarget'):
        report['checks'].append({'name':'Target proportions independently reconstructed and image bound','pass':bool(valid and reconstructed is not None),'actual':{'maximumRgbDifference':maximum,'error':retarget_error}})
        report['humanPose']['retarget']={'method':meta.get('retarget',{}).get('method'),'targetAsset':m['request'].get('poseTarget'),'targetSha256':meta.get('target',{}).get('sha256'),'independentlyReconstructed':bool(valid and reconstructed is not None)}
if expected.get('material'):
    from video_media import sample_images,crop_image,decode_images
    from PIL import Image
    manifest=json.loads((directory/'manifest.json').read_text());r=manifest['request'];source=manifest['source'];size=tuple(expected['size']);frames=expected['frames'];fps=expected['fps']
    def linear(a):
        a=np.asarray(a,dtype=np.float64)/255
        return np.where(a<=.04045,a/12.92,((a+.055)/1.055)**2.4)
    weights=np.array([.2126,.7152,.0722]);maximum_luminance_error=0.;changed=0;zero_error=0;count=0;chroma_sum=np.zeros(3);chroma_samples=0
    tracking=json.loads((directory/'tracking.json').read_text())
    for i,(original,master) in enumerate(zip(sample_images(source['path'],(r['start']+i/fps for i in range(frames))),decode_images(directory/'preserved.mkv'))):
        original=crop_image(original,size,r['cropX'],r['cropY']);a=np.asarray(original);b=np.asarray(master);maximum_luminance_error=max(maximum_luminance_error,float(np.max(np.abs(linear(a)@weights-linear(b)@weights))))
        if digest(directory/'masks'/f'{i:04d}.png')!=expected['material']['maskSha256'][i]:raise ValueError('Material mask changed after rendering.')
        matte=np.asarray(Image.open(directory/'masks'/f'{i:04d}.png').convert('L'));out_linear=linear(b);out_luma=out_linear@weights;selected=(matte>250)&(out_luma>.01)&(out_luma<.8)
        chroma_sum+=(out_linear-out_luma[:,:,None])[selected].sum(axis=0);chroma_samples+=int(selected.sum())
        changed+=int(np.any(a!=b,axis=2).sum());zero_error=max(zero_error,int(np.abs(a.astype(int)-b.astype(int)).max()));count+=1
    valid=count==frames and maximum_luminance_error<.008 and (zero_error==0 if r['materialStrength']==0 else changed>0)
    report['checks'].append({'name':'Material luminance and amount','pass':valid,'actual':{'maximumLinearLuminanceError':maximum_luminance_error,'changedPixels':changed,'zeroAmountMaximumRgbError':zero_error if r['materialStrength']==0 else None}})
    target=linear(np.array([int(r['materialColor'][i:i+2],16) for i in [1,3,5]],dtype=np.uint8));direction=target-target@weights;denominator=np.linalg.norm(direction)*np.linalg.norm(chroma_sum);cosine=float(np.dot(chroma_sum,direction)/denominator) if denominator>1e-10 else None
    if r['materialStrength']==1:
        color_ok=chroma_samples>0 and (cosine is not None and cosine>.995 if np.linalg.norm(direction)>.001 else np.linalg.norm(chroma_sum/max(chroma_samples,1))<.003)
        report['checks'].append({'name':'Requested material chroma','pass':bool(color_ok),'actual':{'target':r['materialColor'],'directionCosine':cosine,'samplePixels':chroma_samples}})
    report['material']={**expected['material'],'maximumLinearLuminanceError':maximum_luminance_error,'targetChromaCosine':cosine,'verifiedFrames':count,'master':'preserved.mkv'}
if expected.get('interpolation'):
    from video_media import sample_images,crop_image,decode_images
    manifest=json.loads((directory/'manifest.json').read_text());r=manifest['request'];source=manifest['source'];meta=expected['interpolation'];size=tuple(expected['size']);master=list(decode_images(directory/'preserved.mkv'));count=meta['sourceFrames'];rate=meta['sourceFps']
    original=[crop_image(im,size,r['cropX'],r['cropY']) for im in sample_images(source['path'],(r['start']+i/rate for i in range(count)))]
    maximum=0;cut_error=0;new_frames=0
    for i,image in enumerate(original):
        maximum=max(maximum,int(np.abs(np.asarray(master[2*i]).astype(int)-np.asarray(image).astype(int)).max()))
        if i<count-1:
            middle=np.asarray(master[2*i+1]);a=np.asarray(image);b=np.asarray(original[i+1]);
            if i in meta['cutPairs']+meta.get('heldPairs',[]):cut_error=max(cut_error,int(np.abs(middle.astype(int)-a.astype(int)).max()))
            elif np.mean(np.abs(middle.astype(float)-a.astype(float)))>.75 and np.mean(np.abs(middle.astype(float)-b.astype(float)))>.75 and np.mean(np.abs(a.astype(float)-b.astype(float)))>1.5:new_frames+=1
    endpoint=int(np.abs(np.asarray(master[-1]).astype(int)-np.asarray(original[-1]).astype(int)).max());valid=len(master)==count*2 and maximum==0 and endpoint==0 and cut_error==0 and digest(directory/'preserved.mkv')==expected['losslessSha256']
    report['checks'] += [{'name':'Original interpolation frames and cut protection','pass':valid,'actual':{'originalFrames':count,'maximumRgbError':maximum,'cutGuardMaximumRgbError':cut_error,'endpointMaximumRgbError':endpoint}},{'name':'Interpolation duration','pass':abs(expected['duration']-count/rate)<1e-6,'actual':expected['duration'],'expected':count/rate}]
    report['interpolation']={**meta,'originalFramesMaxRgbError':maximum,'insertedNonduplicateFrames':new_frames,'verifiedFrames':len(master),'master':'preserved.mkv'}
    if meta.get('motionAnalysisSha256'):
        risks=json.loads((directory/'motion-risks.json').read_text());valid=digest(directory/'motion-risks.json')==meta['motionAnalysisSha256'] and risks['inputSha256']==digest(directory/'input.mp4') and risks['frames']==count and risks['uncertainPairs']==meta['uncertainPairs']
        if r.get('motionSafety')=='hold':valid &= set(meta['heldPairs'])==set(risks['uncertainPairs'])-set(meta['cutPairs'])
        report['checks'].append({'name':'Motion risk and hold binding','pass':bool(valid),'actual':{'uncertainIntervals':len(risks['uncertainPairs']),'heldIntervals':len(meta.get('heldPairs',[]))}})
    if not new_frames:report['warnings'].append('No distinct intermediate frames were observed; static footage or cut holds do not demonstrate smoother motion.')
if expected.get('relighting'):
    from video_media import sample_images,crop_image,decode_images
    manifest=json.loads((directory/'manifest.json').read_text(encoding='utf-8'));r=manifest['request'];source=manifest['source'];frames=expected['frames'];fps=expected['fps'];size=tuple(expected['size']);lighting=expected['relighting']
    if digest(source['path'])!=source['sha256']:raise ValueError('The original relighting source changed.')
    if digest(directory/'raw.mp4')!=lighting['candidateSha256'] or digest(directory/'relight-fields.npz')!=lighting['fieldsSha256']:raise ValueError('Lighting proposal or transfer fields changed.')
    fields=np.load(directory/'relight-fields.npz',allow_pickle=False)['ev'];shape_ok=fields.shape==(frames,size[1],size[0]) and np.isfinite(fields).all()
    if not shape_ok:raise ValueError('Lighting transfer fields have invalid dimensions or values.')
    bound=float(np.max(np.abs(fields)));step=float(np.max(np.abs(np.diff(fields,axis=0)))) if frames>1 else 0
    maximum=0;observed=0;preview_errors=[]
    for i,(base,master,preview) in enumerate(zip(sample_images(source['path'],(r['start']+i/fps for i in range(frames))),decode_images(directory/'preserved.mkv'),decode_images(video))):
        t=i/max(1,frames-1);base=crop_image(base,size,r['cropX']+(r['cropEndX']-r['cropX'])*t,r['cropY']+(r['cropEndY']-r['cropY'])*t)
        # Independent reconstruction from original pixels and saved neutral gain.
        rgb=np.asarray(base,dtype=np.float64)/255;rgb=np.where(rgb<=.04045,rgb/12.92,((rgb+.055)/1.055)**2.4)*np.exp2(fields[i,:,:,None].astype(np.float64))
        rgb=np.clip(rgb,0,1);rgb=np.where(rgb<=.0031308,rgb*12.92,1.055*rgb**(1/2.4)-.055)
        target=np.clip(np.rint(rgb*255),0,255).astype('uint8');actual=np.asarray(master)
        maximum=max(maximum,int(np.max(np.abs(actual.astype(int)-target.astype(int)))));observed+=1
        preview_errors.append(float(np.mean(np.abs(np.asarray(preview).astype(int)-actual.astype(int)))))
        if r['relightStrength']==0 and not np.array_equal(actual,np.asarray(base)):raise ValueError('Zero lighting amount changed original pixels.')
    valid=observed==frames and maximum<=1 and digest(directory/'preserved.mkv')==expected['losslessSha256']
    report['checks'] += [
        {'name':'Original-detail lighting transfer','pass':valid,'actual':{'frames':observed,'maximumReconstructionRgbError':maximum}},
        {'name':'Lighting exposure bound','pass':bound<=r['relightMaxEV']*r['relightStrength']+1e-6,'actual':bound,'expectedMaximum':r['relightMaxEV']*r['relightStrength']},
        {'name':'Lighting correction flicker bound','pass':step<=.5/fps+1e-6,'actualEVPerSecond':step*fps,'expectedMaximum':.5}
    ]
    report['relighting']={**lighting,'observedMaximumEV':bound,'observedCorrectionRateEVPerSecond':step*fps,'verifiedFrames':observed,'maximumReconstructionRgbError':maximum,'master':'preserved.mkv','masterSha256':expected['losslessSha256'],'previewMeanAbsoluteError':float(np.mean(preview_errors))}
if manifest_file.exists():
    if bound_manifest.get('editModel'):
        item=bound_manifest['editModel'];report['checks'].append({'name':'Video edit model binding','pass':digest(item['path'])==item['sha256']});report['editModel']=item
    binding=bound_manifest['request'].get('keyframeBinding')
    if binding:
        report['checks'].append({'name':'Appearance keyframe binding','pass':digest(Path(bound_manifest['assets'])/bound_manifest['request']['reference'])==binding['sha256']});report['keyframe']=binding
    if bound_manifest['request'].get('selectionMode')=='clothing':
        from selection_check import verify_selection
        report['selection']=verify_selection(directory)
        report['checks'].append({'name':'Visible clothing mask protection','pass':report['selection']['valid'],'actual':report['selection']})
if expected.get('segmentation'):
    from check_neural_masks import check
    report['segmentation']=check(directory,bound_manifest,expected)
    report['checks'].append({'name':'Neural masks, original source and exact preview reconstruction','pass':report['segmentation']['valid'],'actual':report['segmentation']})
report['warnings']+=expected.get('warnings',[]);report['sourceSha256']=expected.get('sourceSha256');report['provenance']=expected.get('provenance',{});report['technicalPass']=all(c['pass'] for c in report['checks']);(directory/'report.json').write_text(json.dumps(report,indent=2),encoding='utf-8');print(json.dumps(report))
