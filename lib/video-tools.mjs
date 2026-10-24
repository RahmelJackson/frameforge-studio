import {normalizeSegmentPoints,buildSegmentWorkflow,segmentReadiness} from './segmentation.mjs';
import {IMAGE_MODELS} from './images.mjs';
import {MODELS} from './workflow.mjs';
const id=v=>typeof v==='string'&&/^[a-f0-9-]{36}$/.test(v);
const asset=v=>typeof v==='string'&&/^[a-f0-9-]{36}\.(png|jpg|webp)$/.test(v);
export const VIDEO_TOOLS=[{id:'finish',name:'Edit & finish',description:'Trim, reframe, color, captions and audio.'},{id:'shorts',name:'Make a short',description:'A trimmed vertical clip with a guided crop and captions.'},{id:'upscale',name:'Video upscale',description:'Choose faithful resizing or local AI detail enhancement on a bounded clip.'},{id:'restyle',name:'Prompt edit · experimental',description:'Temporal VACE video-to-video editing.'},{id:'relight',name:'AI relight · experimental',description:'Ask the temporal model to change existing lighting.'},{id:'masked',name:'Region edit · experimental',description:'Guide VACE with a painted or tracked mask and optional image reference.'},{id:'story',name:'Narrated storyboard',description:'Build a faceless, explainer or product draft from stills and captions.'}];
VIDEO_TOOLS.push({id:'pose-guide',name:'Detect a body-pose guide',description:'Extract one visible person’s joints from 0.3–3.1 seconds of footage. Inspect the silent guide before reference-motion generation. No face, finger or identity reconstruction.'});
VIDEO_TOOLS.push({id:'segment',name:'Track a selected object · SAM 3.1',description:'Choose keep/exclude points, inspect a neural tracked mask, then use it for a region edit. No text-only object guessing.'});
export const VIDEO_FORMATS={landscape:[768,432],portrait:[432,768],square:[576,576]};
export const VIDEO_GRADES=['original','noir','warm','cool','teal-orange'];
export const TEMPORAL_MODEL='wan2.1_vace_1.3B_fp16.safetensors';
export const INTERPOLATION_MODEL='film_net_fp16.safetensors';
export const RIFE_MODEL='rife_v4.26.safetensors';
export const DETAIL_VIDEO_MODEL='wan2.1_vace_14B_fp16.safetensors';
VIDEO_TOOLS.push({id:'recolor',name:'Tracked material color',description:'Choose a color for automatically selected clothing or a painted fabric region. Retains brightness and folds; inspect the mask edges.'},{id:'interpolate',name:'Smooth motion · 2x frames',description:'A selected local model generates intermediate frames while retaining clip duration and audio. Inspect fast motion and occlusions.'});
VIDEO_TOOLS.push({id:'reframe',name:'Follow a subject',description:'Track a textured subject and crop existing footage around it. Stops when tracking becomes uncertain; no generated edges.'},{id:'extend',name:'Extend video - experimental',description:'Generate two seconds before or after a selected 0.6-2.1 second source range. Retains original frames; inspect the join.'},{id:'motion',name:'Reference motion - experimental',description:'Use a driving clip edge map and a still appearance reference with VACE. Inspect motion and identity; not a guaranteed pose transfer.'});
VIDEO_TOOLS.push({id:'outpaint',name:'Generate missing edges - experimental',description:'Fit the whole source into a new shape and generate the missing borders. Original picture retained in a lossless master; inspect seams and flicker.'});
export function normalizeVideoTool(input){
  const tool=input.tool??'finish';const upscaleMode=input.upscaleMode??'neural';if(!['neural','faithful'].includes(upscaleMode))throw new Error('Choose an upscale method.');if(tool==='upscale'&&upscaleMode==='faithful'&&(input.narration||input.audio!=null))throw new Error('Add sound after resizing with Edit this result.');if(!VIDEO_TOOLS.some(t=>t.id===tool))throw new Error('Choose a video workflow.');
  if(tool!=='story'&&!id(input.sourceJob)&&!id(input.footage))throw new Error('Choose a saved take or upload footage.');
  const numeric=(value,fallback,min,max,name)=>{const n=value==null||value===''?fallback:Number(value);if(!Number.isFinite(n)||n<min||n>max)throw new Error(name+' is out of range.');return n;};
  const aspect=input.aspect??(tool==='shorts'?'portrait':'landscape');if(!Object.hasOwn(VIDEO_FORMATS,aspect))throw new Error('Choose a video format.');
  const grade=input.grade??'original';if(!VIDEO_GRADES.includes(grade))throw new Error('Choose an available color grade.');
  const start=numeric(input.start,0,0,60,'Start'),end=input.end==null||input.end===''?null:numeric(input.end,null,0,60,'End');if(end!=null&&end<=start)throw new Error('The end must follow the start.');
  const text=(v,max,name)=>{if(v!=null&&typeof v!=='string')throw new Error(name+' must be text.');if((v??'').length>max)throw new Error(name+' is too long.');return (v??'').trim();};
  const prompt=text(input.prompt,2500,'Prompt'),narration=text(input.narration,1200,'Narration'),caption=text(input.caption,240,'Caption');
  if(['reframe','extend','outpaint'].includes(tool)&&(narration||input.audio!=null))throw new Error('Add soundtrack or narration afterwards with Edit this result.');
  if(['restyle','relight','masked','motion','extend','outpaint'].includes(tool)&&!prompt)throw new Error('Describe what should change in the video.');
  for(const key of ['reference','overlay'])if(input[key]!=null&&!asset(input[key]))throw new Error('Choose an uploaded '+key+' image.');
  if(input.audio!=null&&!id(input.audio))throw new Error('Choose uploaded audio.');
  if(tool==='motion'&&!asset(input.reference)&&!id(input.keyframeJob))throw new Error('Choose a still appearance reference for motion transfer.');
  const extensionDirection=input.extensionDirection??'forward';if(!['forward','backward'].includes(extensionDirection))throw new Error('Choose forward or backward extension.');
  const region=(input.region??[.25,.25,.5,.5]).map(Number);if(region.length!==4||region.some(n=>!Number.isFinite(n)||n<0||n>1)||region[2]<.05||region[3]<.05||region[0]+region[2]>1.001||region[1]+region[3]>1.001)throw new Error('Draw a region inside the frame.');
  if(input.reframeRecovery!=null&&typeof input.reframeRecovery!=='boolean')throw new Error('Choose whether to allow brief tracking gaps.');
  if(input.mask!=null&&!asset(input.mask))throw new Error('Choose a valid painted mask.');if(input.trackMask!=null&&typeof input.trackMask!=='boolean')throw new Error('Choose fixed or tracked masking.');
  const maskedContent=input.maskedContent??'keep';if(!['keep','replace'].includes(maskedContent))throw new Error('Choose whether to keep or replace the region contents.');
  const relightMode=input.relightMode??'model';if(!['model','preserve'].includes(relightMode))throw new Error('Choose a lighting transfer mode.');
  const materialColor=input.materialColor??'#244b80';if(typeof materialColor!=='string'||!/^#[a-f0-9]{6}$/i.test(materialColor))throw new Error('Choose a material color.');
  const isolateGarment=input.isolateGarment??true;if(typeof isolateGarment!=='boolean')throw new Error('Choose whether to separate garment tones.');
  const motionSafety=input.motionSafety??'off';if(!['off','review','hold'].includes(motionSafety))throw new Error('Choose a motion-risk policy.');
  const selectionMode=input.selectionMode??'manual',clothingPart=input.clothingPart??'upper',materialSeed=input.materialSeed??[.75,.6],videoModel=input.videoModel??'preview',interpolationModel=input.interpolationModel??'film';
  if(!['manual','clothing','segment'].includes(selectionMode)||!['upper','trousers','dress'].includes(clothingPart)||!Array.isArray(materialSeed)||materialSeed.length!==2||materialSeed.some(x=>!Number.isFinite(x)||x<0||x>1))throw new Error('Choose a clothing type and a point inside it.');
  const segmentPoints=tool==='segment'?normalizeSegmentPoints(input.segmentPoints):null;if(input.segmentationJob!=null&&!id(input.segmentationJob))throw Error('Choose a checked segmentation preview.');if(selectionMode==='segment'&&(tool!=='masked'||!id(input.segmentationJob)))throw Error('A tracked neural selection currently requires Region edit and a checked segmentation preview.');
  if(['segment','pose-guide'].includes(tool)&&(input.audio||input.narration))throw Error('Add soundtrack after creating the selection preview.');
  if(!['preview','detail'].includes(videoModel)||!['film','rife'].includes(interpolationModel))throw new Error('Choose an available editing or interpolation model.');
  if(input.keyframeJob!=null&&!id(input.keyframeJob))throw new Error('Choose a saved appearance keyframe.');
  const motionGuide=input.motionGuide??'edges';if(!['edges','prepared-pose'].includes(motionGuide))throw Error('Choose an edge guide or an already prepared pose video.');
  const outpaintMode=input.outpaintMode??'generate';if(!['generate','track-still'].includes(outpaintMode))throw Error('Choose generated borders or a tracked still.');
  if(tool==='outpaint'&&outpaintMode==='track-still'&&input.outpaintGuide!==true)throw Error('Tracked borders require an expanded still guide.');
  const outpaintInset=numeric(input.outpaintInset,0,0,.2,'Border padding'),outpaintGuide=input.outpaintGuide??false;
  const outpaintMatch=input.outpaintMatch??false;if(typeof outpaintMatch!=='boolean')throw new Error('Choose whether to match generated border tones.');
  if(typeof outpaintGuide!=='boolean'||outpaintGuide&&(tool!=='outpaint'||!asset(input.reference)&&!id(input.keyframeJob)))throw new Error('Choose an expanded still guide first.');
  if(input.lightingProposal!=null&&(!id(input.lightingProposal)||tool!=='relight'||relightMode!=='preserve'))throw new Error('Choose a checked original-detail lighting proposal.');
  const cards=tool==='story'?(input.cards??[]).map(c=>{if(!asset(c.asset))throw new Error('Choose an image for each scene.');return {asset:c.asset,caption:text(c.caption,240,'Scene caption'),seconds:numeric(c.seconds,3,1,8,'Scene length')};}):[];
  if(tool==='story'&&(cards.length<1||cards.length>6||cards.reduce((n,c)=>n+c.seconds,0)>30))throw new Error('Choose 1–6 scenes totaling up to 30 seconds.');
  const voice=input.voice??'Microsoft David Desktop';if(!['Microsoft David Desktop','Microsoft Zira Desktop','Microsoft David','Microsoft Mark','Microsoft Zira'].includes(voice))throw new Error('Choose an installed narration voice.');
  if(!Number.isInteger(numeric(input.seed,0,0,2**32-1,'Seed')))throw new Error('Seed must be an integer.');
  const poseFraming=input.poseFraming??'upper';if(!['upper','full'].includes(poseFraming))throw Error('Choose upper-body or full-body pose framing.');
  if(input.poseTarget!=null&&(tool!=='pose-guide'||!asset(input.poseTarget)))throw Error('Choose an uploaded target image for the body-pose guide.');
  return {kind:'video-tool',tool,...(tool==='pose-guide'?{poseFraming,poseTarget:input.poseTarget??null}:{}),...(tool==='segment'?{segmentPoints}:{}),...(selectionMode==='segment'?{segmentationJob:input.segmentationJob}:{}),motionGuide:tool==='motion'?motionGuide:'edges',outpaintMode:tool==='outpaint'?outpaintMode:'generate',outpaintMatch:tool==='outpaint'&&outpaintMatch,outpaintInset:tool==='outpaint'?outpaintInset:0,outpaintGuide:tool==='outpaint'&&outpaintGuide,upscaleMode,reframeRecovery:tool==='reframe'&&input.reframeRecovery===true,extensionDirection,sourceJob:tool!=='story'&&id(input.sourceJob)?input.sourceJob:null,footage:tool!=='story'&&id(input.footage)?input.footage:null,aspect,start,end,grade:['finish','shorts'].includes(tool)?grade:'original',prompt:['restyle','relight','masked','motion','extend','outpaint'].includes(tool)?prompt:'',caption:['finish','shorts'].includes(tool)?caption:'',narration,voice,reference:['restyle','relight','masked','motion','extend','outpaint'].includes(tool)?input.reference??null:null,overlay:['finish','shorts'].includes(tool)?input.overlay??null:null,audio:input.audio??null,cards,region,mask:['masked','recolor'].includes(tool)&&selectionMode==='manual'?input.mask??null:null,trackMask:['masked','recolor'].includes(tool)?input.trackMask??false:false,feather:numeric(input.feather,0,0,32,'Mask feather'),materialColor:materialColor.toLowerCase(),materialStrength:numeric(input.materialStrength,1,0,1,'Color amount'),
    cropX:['interpolate','recolor'].includes(tool)?.5:numeric(input.cropX,.5,0,1,'Crop start X'),cropY:['interpolate','recolor'].includes(tool)?.5:numeric(input.cropY,.5,0,1,'Crop start Y'),cropEndX:['interpolate','recolor'].includes(tool)?.5:numeric(input.cropEndX,input.cropX??.5,0,1,'Crop end X'),cropEndY:['interpolate','recolor'].includes(tool)?.5:numeric(input.cropEndY,input.cropY??.5,0,1,'Crop end Y'),
    exposure:numeric(input.exposure,1,.5,1.5,'Exposure'),saturation:numeric(input.saturation,1,0,2,'Saturation'),volume:numeric(input.volume,1,0,2,'Source volume'),audioVolume:numeric(input.audioVolume,.7,0,2,'Soundtrack volume'),scale:2,
    isolateGarment,motionSafety,selectionMode:['masked','recolor'].includes(tool)?selectionMode:'manual',clothingPart,materialSeed,videoModel,interpolationModel,keyframeJob:['masked','restyle','relight','motion','extend','outpaint'].includes(tool)?input.keyframeJob??null:null,lightingProposal:input.lightingProposal??null,relightMode:tool==='relight'?relightMode:'model',relightStrength:numeric(input.relightStrength,.5,0,1,'Lighting amount'),relightMaxEV:numeric(input.relightMaxEV,.5,.1,2,'Exposure limit'),maskedContent:tool==='masked'?maskedContent:'keep',guidance:numeric(input.guidance,3,1,8,'Guidance'),seed:numeric(input.seed,Math.floor(Math.random()*2**32),0,2**32-1,'Seed'),steps:20};
}
export function buildVideoToolWorkflow(r,names,prefix){
  if(r.tool==='segment')return buildSegmentWorkflow(r,names,prefix);
  const n=(class_type,inputs)=>({class_type,inputs});
  const graph={'1':n('LoadVideo',{file:names.video}),'2':n('GetVideoComponents',{video:['1',0]})};
  if(['recolor','reframe','pose-guide'].includes(r.tool)||r.tool==='outpaint'&&r.outpaintMode==='track-still'||r.tool==='upscale'&&r.upscaleMode==='faithful')throw new Error('This workflow runs locally without a diffusion graph.');
  if(r.tool==='interpolate')return {...graph,'3':n('FrameInterpolationModelLoader',{model_name:r.interpolationModel==='rife'?RIFE_MODEL:INTERPOLATION_MODEL}),'4':n('FrameInterpolate',{interp_model:['3',0],images:['2',0],multiplier:2}),'20':n('CreateVideo',{images:['4',0],fps:r.prepared.fps*2}),'21':n('SaveVideo',{video:['20',0],filename_prefix:prefix,format:'mp4',codec:'h264'})};
  if(r.tool==='upscale'){
    graph['3']=n('UpscaleModelLoader',{model_name:IMAGE_MODELS.upscale});graph['4']=n('ImageUpscaleWithModel',{image:['2',0],upscale_model:['3',0]});graph['5']=n('ImageScaleBy',{image:['4',0],upscale_method:'lanczos',scale_by:.5});graph['20']=n('CreateVideo',{images:['5',0],fps:['2',2]});
  }else{
    const [width,height]=r.prepared.size;
    Object.assign(graph,{'3':n('UNETLoader',{unet_name:r.videoModel==='detail'?DETAIL_VIDEO_MODEL:TEMPORAL_MODEL,weight_dtype:r.videoModel==='detail'?'fp8_e4m3fn':'default'}),'4':n('CLIPLoader',{clip_name:MODELS.encoder,type:'wan',device:'default'}),'5':n('VAELoader',{vae_name:'wan_2.1_vae.safetensors'}),'6':n('CLIPTextEncode',{clip:['4',0],text:(r.tool==='relight'?'Relight the existing scene while preserving the subject and motion. ':'')+r.prompt}),'7':n('CLIPTextEncode',{clip:['4',0],text:'Flicker, abrupt cuts, deformed anatomy, inconsistent identity, low quality, text, watermark.'}),'8':n('WanVaceToVideo',{positive:['6',0],negative:['7',0],vae:['5',0],width,height,length:r.prepared.frames,batch_size:1,strength:1,control_video:['2',0]}),'9':n('ModelSamplingSD3',{model:['3',0],shift:8}),'10':n('KSampler',{model:['9',0],positive:['8',0],negative:['8',1],latent_image:['8',2],seed:r.seed,steps:r.steps,cfg:r.guidance??3,sampler_name:'uni_pc',scheduler:'simple',denoise:1}),'11':n('TrimVideoLatent',{samples:['10',0],trim_amount:['8',3]}),'12':n('VAEDecode',{samples:['11',0],vae:['5',0]}),'20':n('CreateVideo',{images:['12',0],fps:16})});
    if(names.reference){graph['13']=n('LoadImage',{image:names.reference});graph['8'].inputs.reference_image=['13',0];}
    if(['masked','extend','outpaint'].includes(r.tool)&&names.maskVideo){graph['14']=n('LoadVideo',{file:names.maskVideo});graph['15']=n('GetVideoComponents',{video:['14',0]});graph['19']=n('ImageToMask',{image:['15',0],channel:'red'});graph['8'].inputs.control_masks=['19',0];}
    else if(r.tool==='masked'){
      const [x,y,w,h]=r.region;graph['14']=n('SolidMask',{value:0,width,height});graph['15']=n('SolidMask',{value:1,width:Math.max(1,Math.floor(width*w)),height:Math.max(1,Math.floor(height*h))});graph['16']=n('MaskComposite',{destination:['14',0],source:['15',0],x:Math.floor(x*width),y:Math.floor(y*height),operation:'add'});graph['17']=n('MaskToImage',{mask:['16',0]});graph['18']=n('RepeatImageBatch',{image:['17',0],amount:r.prepared.frames});graph['19']=n('ImageToMask',{image:['18',0],channel:'red'});graph['8'].inputs.control_masks=['19',0];
    }
    if(r.tool==='masked'&&r.maskedContent==='replace'){
      // VACE inpainting expects missing content to be neutral, not the old object.
      // The final composite still uses the original soft mask, independently.
      graph['22']=n('ThresholdMask',{mask:['19',0],value:.02});
      graph['23']=n('SolidMask',{value:.5,width,height});graph['24']=n('MaskToImage',{mask:['23',0]});
      graph['25']=n('ImageCompositeMasked',{destination:['2',0],source:['24',0],mask:['22',0],x:0,y:0,resize_source:false});
      graph['8'].inputs.control_video=['25',0];graph['8'].inputs.control_masks=['22',0];
    }
  }
  graph['21']=n('SaveVideo',{video:['20',0],filename_prefix:prefix,format:'mp4',codec:'h264'});return graph;
}
export function videoToolReadiness(info){const out={segment:segmentReadiness(info)};for(const tool of ['upscale','masked','interpolate','detail','rife']){
  const graph=buildVideoToolWorkflow({tool:tool==='detail'?'masked':tool==='rife'?'interpolate':tool,videoModel:tool==='detail'?'detail':'preview',interpolationModel:tool==='rife'?'rife':'film',maskedContent:'replace',prompt:'test',seed:1,steps:20,region:[.25,.25,.5,.5],prepared:{size:[512,288],frames:33,fps:24}},{video:'test.mp4'},'test');
  const missingNodes=[...new Set(Object.values(graph).map(n=>n.class_type))].filter(n=>!info[n]);const missingModels=[];
  for(const n of Object.values(graph))for(const [key,file] of Object.entries(n.inputs))if(['unet_name','clip_name','vae_name','model_name'].includes(key)){const spec=info[n.class_type]?.input?.required?.[key],choices=Array.isArray(spec?.[0])?spec[0]:spec?.[1]?.options;if(!choices?.includes(file))missingModels.push(file);}
  out[tool==='masked'?'temporal':tool]={ready:!missingNodes.length&&!missingModels.length,missingNodes,missingModels};
}return out;}
