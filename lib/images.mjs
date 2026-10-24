export const IMAGE_MODELS={diffusion:'z_image_turbo_bf16.safetensors',encoder:'qwen_3_4b.safetensors',vae:'ae.safetensors',edit:'qwen_image_edit_2511_fp8mixed.safetensors',editEncoder:'qwen_2.5_vl_7b_fp8_scaled.safetensors',editVae:'qwen_image_vae.safetensors',lightning:'Qwen-Image-Edit-2511-Lightning-4steps-V1.0-bf16.safetensors',upscale:'RealESRGAN_x4plus.safetensors'};
export const LOCAL_IMAGE_TOOLS=['face-anchor','face-neural','face-match','prop-place'];
import {STYLE_TOOL,normalizeStyle} from './style.mjs';
export const ANGLE_MODEL='qwen-image-edit-2511-multiple-angles-lora.safetensors';
import {VIEW_OPTIONS} from '../public/view-options.js';
export {VIEW_OPTIONS};
export const IMAGE_TOOLS=[
  {id:STYLE_TOOL,name:'Generate from a style board · experimental',description:'Create a new subject using all selected cards as style references. Uses style-specific attention; inspect palette, texture and unwanted copied content.'},
  {id:'views',name:'Character / object viewpoints · experimental',description:'Trained multi-angle Qwen adapter with an original source image. Inspect identity and unseen details; a generated view is not new identity ground truth.'},
  {id:'identity-pose',name:'Guided character identity · experimental',description:'PhotoMaker identity adapter with separate scene edges or an editable body skeleton. Compare face, clothing and pose independently.'},
  {id:'face-anchor',name:'Prepare original face reference',description:'Crop one clear face from an original portrait. No invented detail or generated views.'},
  {id:'face-neural',name:'Local neural face swap · research',description:'FaceFusion replacement with face-region and occlusion masks. Local research models; inspect identity and seams.'},
  {id:'face-match',name:'Face lighting match · experimental',description:'Match the light and color of an aligned face edit to its original target.'},
  {id:'prop-place',name:'Place original prop',description:'Place the original object pixels with a four-corner perspective transform.'},
  {id:'continuity',name:'Continuity shot',description:'Use a saved reference pack; identity and scene fidelity need comparison.'},
  {id:'create',name:'Create image',description:'A still from your description.'},
  {id:'cinema',name:'Cinematic still',description:'Prompt-guided lens, angle and focus.'},
  {id:'edit',name:'Edit image',description:'Describe a change to your existing image.'},
  {id:'relight',name:'Relight',description:'Change the light while retaining the scene.'},
  {id:'inpaint',name:'Masked edit',description:'Paint the area to replace; untouched pixels are preserved.'},
  {id:'upscale',name:'Image upscale',description:'Real-ESRGAN detail enhancement at 2× or 4×.'},
  {id:'character',name:'Character reference',description:'Create a new scene from a saved reference. Identity needs review.'},
  {id:'face-swap',name:'Face replacement · experimental',description:'Reference-based face editing; likeness is not guaranteed.'},
  {id:'character-swap',name:'Character replacement · experimental',description:'Replace a subject using a second reference.'},
];
export const IMAGE_SIZES={square:[768,768],landscape:[1024,576],portrait:[576,1024]};
export const STILL_CAMERA={lens:['Natural','24 mm wide','50 mm standard','85 mm portrait'],angle:['Eye level','Low angle','High angle','Overhead'],focus:['Deep focus','Shallow depth of field']};
export const IMAGE_LIGHT={direction:['As described','From the left','From the right','Front light','Back light','Overhead light'],color:['As described','Warm amber','Cool blue','Neutral white','Rose pink'],brightness:['As described','Soft and dim','Balanced exposure','Bright dramatic light']};
const asset=value=>typeof value==='string'&&/^[a-f0-9-]{36}\.(png|jpg|webp)$/.test(value);
export function normalizeImage(input){
  if(!IMAGE_TOOLS.some(t=>t.id===input.tool))throw new Error('Choose an image tool.');
  if(!Object.hasOwn(IMAGE_SIZES,input.aspect??'square'))throw new Error('Choose an image format.');
  const prompt=typeof input.prompt==='string'?input.prompt.trim():'';
  if(!['upscale',...LOCAL_IMAGE_TOOLS].includes(input.tool)&&(!prompt||prompt.length>2500))throw new Error('Describe the image or edit in 1–2500 characters.');
  const needsSource=!['create','cinema',STYLE_TOOL].includes(input.tool);
  if(needsSource&&!asset(input.asset))throw new Error('Upload a source image.');
  if(input.tool==='identity-pose'&&!asset(input.reference))throw new Error('Choose a separate pose/composition guide.');
  const poseGuide=input.poseGuide??'edges';if(!['edges','skeleton'].includes(poseGuide))throw Error('Choose scene edges or an explicit body skeleton.');
  const identityStrength=Number(input.identityStrength??1),poseStrength=Number(input.poseStrength??.65),swapModel=input.swapModel??'hyperswap',includeBeard=input.includeBeard??false;
  if(!Number.isFinite(identityStrength)||identityStrength<0||identityStrength>1||!Number.isFinite(poseStrength)||poseStrength<0||poseStrength>1||!['hyperswap','inswapper'].includes(swapModel)||typeof includeBeard!=='boolean')throw new Error('Choose valid identity, pose and face-boundary controls.');
  if(['face-swap','character-swap',...LOCAL_IMAGE_TOOLS.filter(t=>t!=='face-anchor')].includes(input.tool)&&!asset(input.reference))throw new Error('Upload the replacement reference.');
  if(input.reference!=null&&!asset(input.reference))throw new Error('Choose a valid reference.');
  if(input.reference2!=null&&!asset(input.reference2))throw new Error('Choose a valid third reference.');
  if(['continuity','face-match'].includes(input.tool)&&input.mask!=null&&!asset(input.mask))throw new Error('Choose a valid mask.');
  if(input.tool==='face-anchor'&&input.mask!=null)throw new Error('This tool prepares its own bounded face region.');
  if(input.continuity&&JSON.stringify(input.continuity).length>12000)throw new Error('Continuity snapshot is too large.');
  if(input.tool==='inpaint'&&!asset(input.mask))throw new Error('Paint a mask first.');
  const quality=input.quality??'preview';if(input.tool==='continuity'&&!['preview','precise'].includes(quality))throw new Error('Choose preview or precise rendering.');
  const view={};for(const [key,choices] of Object.entries(VIEW_OPTIONS)){view[key]=input.view?.[key]??choices[key==='elevation'?1:0];if(!choices.includes(view[key]))throw Error('Choose a supported '+key+' viewpoint.');}
  const viewStrength=Number(input.viewStrength??.9);if(!Number.isFinite(viewStrength)||viewStrength<.5||viewStrength>1.2)throw Error('Choose viewpoint strength from 0.5 to 1.2.');
  const blend=input.blend??'none';if(!['none','boundary'].includes(blend)||blend!=='none'&&!(input.tool==='continuity'&&input.mask))throw new Error('Boundary matching requires a masked continuity edit.');
  const propQuad=input.propQuad??[[.65,.65],[.9,.65],[.9,.9],[.65,.9]],propCrop=input.propCrop??[0,0,1,1];
  if(input.tool==='prop-place'&&(!Array.isArray(propQuad)||propQuad.length!==4||propQuad.some(p=>!Array.isArray(p)||p.length!==2||p.some(x=>!Number.isFinite(x)||x<0||x>1))||!Array.isArray(propCrop)||propCrop.length!==4||propCrop.some(x=>!Number.isFinite(x)||x<0||x>1)||propCrop[2]<.01||propCrop[3]<.01||propCrop[0]+propCrop[2]>1.001||propCrop[1]+propCrop[3]>1.001))throw new Error('Choose a crop and four placement corners inside the images.');
  const faceMode=input.faceMode??'finish',cutout=input.cutout??'alpha',matchStrength=Number(input.matchStrength??1);if(!['finish','transfer'].includes(faceMode)||!['alpha','ellipse','grabcut'].includes(cutout)||!Number.isFinite(matchStrength)||matchStrength<0||matchStrength>1)throw new Error('Choose valid finishing controls.');
  const seed=input.seed==null||input.seed===''?Math.floor(Math.random()*2**32):Number(input.seed);
  if(!Number.isSafeInteger(seed)||seed<0||seed>2**48-1)throw new Error('Choose an integer seed between 0 and 281474976710655.');
  const scale=Number(input.scale??2);if(input.tool==='upscale'&&![2,4].includes(scale))throw new Error('Choose 2× or 4× upscale.');
  const camera={};for(const [key,choices] of Object.entries(STILL_CAMERA)){camera[key]=input.camera?.[key]??choices[0];if(!choices.includes(camera[key]))throw new Error('Choose a supported still-camera setting.');}
  const light={};for(const [key,choices] of Object.entries(IMAGE_LIGHT)){light[key]=input.light?.[key]??choices[0];if(!choices.includes(light[key]))throw new Error('Choose a supported lighting setting.');}
  return {kind:'image',tool:input.tool,...(input.tool===STYLE_TOOL?normalizeStyle(input):{}),...(input.tool==='views'?{view,viewStrength}:{}),poseGuide:input.tool==='identity-pose'?poseGuide:'edges',identityStrength,poseStrength,swapModel,includeBeard,prompt:prompt.slice(0,2500),asset:needsSource?input.asset:null,reference:needsSource&&!['upscale','face-anchor'].includes(input.tool)?input.reference??null:null,reference2:input.tool==='continuity'?input.reference2??null:null,continuity:input.tool==='continuity'?input.continuity??null:null,mask:['inpaint','continuity','face-match'].includes(input.tool)?input.mask??null:null,aspect:input.aspect??'square',seed,scale,camera,light,propQuad,propCrop,cutout,faceMode,matchStrength,quality:input.tool==='continuity'?quality:'preview',blend,steps:input.tool===STYLE_TOOL||input.tool==='identity-pose'?30:['create','cinema'].includes(input.tool)?8:input.tool==='continuity'&&quality==='precise'?40:4};
}
export function imagePrompt(r){
  if(r.tool==='views')return '<sks> '+Object.values(r.view).join(' ')+'. '+r.prompt;
  const prefixes={relight:'Relight image 1 according to the instruction. Preserve the subject, composition, geometry and materials. ',character:'Use the character in image 1 as the visual identity reference for this new scene. Preserve their recognizable appearance. ',inpaint:'Edit the region indicated in white in image 2 of image 1. Retain the surrounding scene. ', 'face-swap':'Replace only the face of the person in image 1 with the face from image 2. Preserve the pose, hair, clothing and background in image 1. ', 'character-swap':'Replace the main person in image 1 with the character from image 2. Preserve the scene and pose in image 1. '};
  return (prefixes[r.tool]??'')+r.prompt+(r.tool==='relight'?Object.values(r.light??{}).filter(v=>v!=='As described').map(v=>'. '+v).join(''):'')+(r.tool==='cinema'?`. ${r.camera.lens} lens, ${r.camera.angle}, ${r.camera.focus}. Cinematic still photograph.`:'');
}
export function buildImageWorkflow(r,names={},prefix='frameforge/image'){
  if(r.tool===STYLE_TOOL)throw Error('Style-board generation uses the local style processor.');
  if(LOCAL_IMAGE_TOOLS.includes(r.tool))throw new Error('This image tool runs in the local vision processor, not a diffusion graph.');
  const n=(class_type,inputs)=>({class_type,inputs}),[width,height]=r.size??IMAGE_SIZES[r.aspect];
  if(r.tool==='identity-pose'){const graph={
    '1':n('CheckpointLoaderSimple',{ckpt_name:'sd_xl_base_1.0.safetensors'}),'2':n('LoraLoader',{model:['1',0],clip:['1',1],lora_name:'photomaker-v1-lora.safetensors',strength_model:r.identityStrength??1,strength_clip:1}),
    '3':n('PhotoMakerLoader',{photomaker_model_name:'photomaker-v1.bin'}),'4':n('LoadImage',{image:names.asset}),'5':n('PhotoMakerEncode',{photomaker:['3',0],image:['4',0],clip:['2',1],text:'photograph of a person photomaker'}),
    '6':n('CLIPTextEncode',{clip:['2',1],text:'different person, collage, grid, distorted face, wrong anatomy, extra hands, text, watermark'}),'7':n('LoadImage',{image:names.reference}),'8':n('ImageScale',{image:['7',0],upscale_method:'lanczos',width,height,crop:'center'}),
    '9':n('Canny',{image:['8',0],low_threshold:.2,high_threshold:.6}),'11':n('ControlNetLoader',{control_net_name:'sdxl_canny_1.0.safetensors'}),'16':n('CLIPTextEncode',{clip:['2',1],text:r.prompt}),'17':n('ConditioningCombine',{conditioning_1:['5',0],conditioning_2:['16',0]}),'12':n('ControlNetApplyAdvanced',{positive:['17',0],negative:['6',0],control_net:['11',0],image:['9',0],strength:r.poseStrength??.65,start_percent:0,end_percent:.8}),
    '13':n('EmptyLatentImage',{width,height,batch_size:1}),'14':n('KSampler',{model:['2',0],positive:['12',0],negative:['12',1],latent_image:['13',0],seed:r.seed,steps:30,cfg:5.5,sampler_name:'dpmpp_2m',scheduler:'karras',denoise:1}),
    '15':n('VAEDecode',{samples:['14',0],vae:['1',2]}),'20':n('SaveImage',{images:['15',0],filename_prefix:prefix})
  };
  if(r.poseGuide==='skeleton'){delete graph['9'];graph['8'].inputs.upscale_method='nearest-exact';graph['11'].inputs.control_net_name='sdxl_openpose_xinsir_1.0.safetensors';graph['12'].inputs.image=['8',0];}
  return graph;}
  if(r.tool==='upscale')return {'1':n('LoadImage',{image:names.asset}),'2':n('UpscaleModelLoader',{model_name:IMAGE_MODELS.upscale}),'3':n('ImageUpscaleWithModel',{upscale_model:['2',0],image:['1',0]}),'4':n('ImageScaleBy',{image:['3',0],upscale_method:'lanczos',scale_by:r.scale/4}),'20':n('SaveImage',{images:['4',0],filename_prefix:prefix})};
  const create=['create','cinema'].includes(r.tool);
  const graph={
    '1':n('UNETLoader',{unet_name:create?IMAGE_MODELS.diffusion:IMAGE_MODELS.edit,weight_dtype:'default'}),
    '2':n('CLIPLoader',{clip_name:create?IMAGE_MODELS.encoder:IMAGE_MODELS.editEncoder,type:create?'lumina2':'qwen_image',device:'default'}),
    '3':n('VAELoader',{vae_name:create?IMAGE_MODELS.vae:IMAGE_MODELS.editVae}),
    '6':n('ModelSamplingAuraFlow',{model:['1',0],shift:create?3:3.1}),
    '10':n('KSampler',{model:['6',0],positive:['4',0],negative:['5',0],latent_image:['7',0],seed:r.seed,steps:r.steps,cfg:1,sampler_name:create?'res_multistep':'euler',scheduler:'simple',denoise:1}),
    '11':n('VAEDecode',{samples:['10',0],vae:['3',0]}),
    '20':n('SaveImage',{images:['11',0],filename_prefix:prefix}),
  };
  if(create){graph['4']=n('CLIPTextEncode',{clip:['2',0],text:imagePrompt(r)});graph['5']=n('ConditioningZeroOut',{conditioning:['4',0]});graph['7']=n('EmptySD3LatentImage',{width,height,batch_size:1});}
  else{
    graph['12']=n('LoadImage',{image:names.asset});graph['13']=n('ImageScale',{image:['12',0],upscale_method:'lanczos',width,height,crop:'disabled'});
    const refs={clip:['2',0],vae:['3',0],image1:r.tool==='continuity'?['12',0]:['13',0]};
    if(names.mask&&r.tool!=='continuity'){graph['14']=n('LoadImage',{image:names.mask});refs.image2=['14',0];}
    if(names.reference){graph['15']=n('LoadImage',{image:names.reference});refs[names.mask&&r.tool!=='continuity'?'image3':'image2']=['15',0];}
    if(names.reference2){graph['18']=n('LoadImage',{image:names.reference2});refs.image3=['18',0];}
    graph['4']=n('TextEncodeQwenImageEditPlus',{...refs,prompt:imagePrompt(r)});graph['5']=n('TextEncodeQwenImageEditPlus',{...refs,prompt:''});graph['7']=n('VAEEncode',{pixels:['13',0],vae:['3',0]});
    graph['8']=n('CFGNorm',{model:['6',0],strength:1});graph['9']=n('LoraLoaderModelOnly',{model:['8',0],lora_name:IMAGE_MODELS.lightning,strength_model:1});graph['10'].inputs.model=['9',0];
    if(r.tool==='views'){graph['21']=n('LoraLoaderModelOnly',{model:['9',0],lora_name:ANGLE_MODEL,strength_model:r.viewStrength??.9});graph['10'].inputs.model=['21',0];}
    if(r.tool==='continuity'&&r.quality==='precise'){delete graph['9'];graph['10'].inputs.model=['8',0];graph['10'].inputs.cfg=4;}
    if(r.tool==='continuity'&&!r.mask)graph['7']=n('EmptySD3LatentImage',{width,height,batch_size:1});
    if(r.tool==='inpaint'||(r.tool==='continuity'&&r.mask)){
      graph['16']=n('LoadImageMask',{image:names.mask,channel:'red'});
      graph['17']=n('SetLatentNoiseMask',{samples:['7',0],mask:['16',0]});
      graph['10'].inputs.latent_image=['17',0];
    }
  }
  return graph;
}
export function imageReadiness(info){
  const result={};for(const tool of ['create','edit','inpaint','upscale','identity-pose','identity-skeleton','views']){
    const r=normalizeImage({tool:tool==='identity-skeleton'?'identity-pose':tool,poseGuide:tool==='identity-skeleton'?'skeleton':'edges',prompt:'test',reference:['identity-pose','identity-skeleton'].includes(tool)?'11111111-1111-1111-1111-111111111111.png':null,asset:'11111111-1111-1111-1111-111111111111.png',mask:'11111111-1111-1111-1111-111111111111.png'}),graph=buildImageWorkflow(r,{asset:'test.png',mask:tool==='inpaint'?'mask.png':null});
    const missingNodes=[...new Set(Object.values(graph).map(n=>n.class_type))].filter(n=>!info[n]);
    const specs=Object.values(graph).flatMap(n=>Object.entries(n.inputs).filter(([key])=>['unet_name','clip_name','vae_name','lora_name','model_name','ckpt_name','control_net_name','photomaker_model_name'].includes(key)).map(([key,file])=>[n.class_type,key,file]));
    const missingModels=specs.filter(([name,key,file])=>{const spec=info[name]?.input?.required?.[key],options=Array.isArray(spec?.[0])?spec[0]:spec?.[1]?.options;return !options?.includes(file);}).map(x=>x[2]);
    result[tool]={ready:!missingNodes.length&&!missingModels.length,missingNodes,missingModels};
  }return result;
}
