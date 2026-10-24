import {normalizeLook,lookPrompt} from './looks.mjs';
export const MODELS = {
  diffusion: 'wan2.2_ti2v_5B_fp16.safetensors',
  encoder: 'umt5_xxl_fp8_e4m3fn_scaled.safetensors',
  vae: 'wan2.2_vae.safetensors',
};
export const PRESETS = [
  { id: 'directed', name: 'Use shot direction', icon: '▧', description: 'Use your complete camera brief.', prompt: '' },
  { id: 'push-in', name: 'Slow push in', icon: '↗', description: 'Move closer. Build intimacy.', prompt: 'The camera slowly dollies forward toward the subject. Smooth subtle forward camera motion, stable composition, continuous single shot.' },
  { id: 'pull-back', name: 'Pull back', icon: '↙', description: 'Reveal the world around it.', prompt: 'The camera slowly dollies backward, gradually revealing the surrounding environment. Smooth continuous single shot.' },
  { id: 'orbit', name: 'Gentle orbit', icon: '↻', description: 'A new perspective on your subject.', prompt: 'The camera gently arcs to the right around the subject, a small smooth cinematic orbit with natural parallax. Preserve subject identity.' },
  { id: 'pan', name: 'Pan right', icon: '→', description: 'Let the scene unfold.', prompt: 'The camera slowly pans to the right in one continuous shot. Natural environmental motion and a steady horizon.' },
  { id: 'locked', name: 'Locked camera', icon: '⊙', description: 'Still frame. Living details.', prompt: 'Locked-off stationary camera. The subject and environment move naturally and subtly while framing stays fixed. Continuous single shot.' },
  { id: 'handheld', name: 'Handheld', icon: '≈', description: 'A little human imperfection.', prompt: 'Subtle handheld camera movement, gentle organic sway, restrained documentary cinematography. Preserve the subject and scene.' },
];
export const SIZES = { landscape: [768, 432], portrait: [432, 768], square: [576, 576] };
export const LENGTHS = { preview: 49, standard: 81, extended: 121, long:241 };
export function generationSize(r){const size=SIZES[r.aspect];return r.profile==='hd'?size.map(v=>Math.round(v*4/3/16)*16):size;}
export const KEYFRAME_MODEL='wan2.2_fun_inpaint_5B_bf16.safetensors';
export const CAMERA_POSES=['Static','Pan Up','Pan Down','Pan Left','Pan Right','Zoom In','Zoom Out','Anti Clockwise (ACW)','ClockWise (CW)'];
export const CAMERA_MODELS={high:'wan2.2_fun_camera_high_noise_14B_fp8_scaled.safetensors',low:'wan2.2_fun_camera_low_noise_14B_fp8_scaled.safetensors',highLora:'wan2.2_i2v_lightx2v_4steps_lora_v1_high_noise.safetensors',lowLora:'wan2.2_i2v_lightx2v_4steps_lora_v1_low_noise.safetensors',vae:'wan_2.1_vae.safetensors'};

export function normalizeRequest(input) {
  const engine=input.engine??'wan5b';
  const mode=input.mode??'image';
  if(!['image','text','sketch'].includes(mode))throw new Error('Choose image-to-video or text-to-video.');
  if(mode==='text'&&['camera','keyframes'].includes(engine))throw new Error('This generation mode requires reference images.');
  if(!['wan5b','camera','keyframes'].includes(engine))throw new Error('Choose an installed generation mode.');
  if(input.quality!=null&&!['draft','standard'].includes(input.quality))throw new Error('Choose draft or standard quality.');
  const preset = PRESETS.find(x => x.id === input.preset);
  if (!preset) throw new Error('Choose a supported motion preset.');
  if (!SIZES[input.aspect]) throw new Error('Choose a supported aspect ratio.');
  if (!Object.hasOwn(LENGTHS, input.length)) throw new Error('Choose a supported clip length.');
  if (typeof input.prompt !== 'string' || !input.prompt.trim() || input.prompt.length > 2500) throw new Error('Describe your shot in 1–2500 characters.');
  if (mode==='image'&&!/^[a-f0-9-]{36}\.(png|jpg|webp)$/.test(input.asset ?? '')) throw new Error('Upload a reference image first.');
  if(engine==='keyframes'&&!/^[a-f0-9-]{36}\.(png|jpg|webp)$/.test(input.endAsset??''))throw new Error('Upload an ending reference frame.');
  const profile=input.profile??'standard';if(!['standard','hd'].includes(profile))throw new Error('Choose a generation profile.');if(engine!=='wan5b'&&(profile!=='standard'||input.length==='long'))throw new Error('Long and higher-resolution profiles currently use the quick Wan 5B engine.');if(profile==='hd'&&input.length!=='preview')throw new Error('Larger-size previews currently use the two-second length; measure longer large-size profiles before enabling them.');
  const seed = input.seed === '' || input.seed == null ? Math.floor(Math.random() * 2 ** 32) : Number(input.seed);
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 2 ** 48 - 1) throw new Error('Seed must be an integer between 0 and 281474976710655.');
  const cameraPose=input.cameraPose??'Zoom In',cameraSpeed=Number(input.cameraSpeed??1),cameraMirror=input.cameraMirror??false;
  const cameraSampling=input.cameraSampling??'fast';
  if(!['fast','full'].includes(cameraSampling))throw Error('Choose fast or full camera sampling.');
  if(typeof cameraMirror!=='boolean'||cameraMirror&&(engine!=='camera'||!['Pan Left','Pan Right'].includes(cameraPose)))throw Error('Mirrored conditioning requires a horizontal camera movement.');
  if(engine==='camera'&&(!CAMERA_POSES.includes(cameraPose)||!Number.isFinite(cameraSpeed)||cameraSpeed<0||cameraSpeed>2))throw new Error('Choose a supported camera movement and speed between 0 and 2.');
  return { profile,endAsset:engine==='keyframes'?input.endAsset:null,look:normalizeLook(input.look), asset:mode==='text'?null:input.asset, prompt: input.prompt.trim(), preset: preset.id, aspect: input.aspect, length: input.length, seed, steps:engine==='camera'?(cameraSampling==='full'?20:4):input.quality === 'draft' ? 12 : 20, fps:engine==='camera'?16:24,engine,mode,...(engine==='camera'?{cameraPose,cameraSpeed,cameraMirror,cameraSampling}:{}) };
}

export function buildWorkflow(request, imageName, prefix, endImageName) {
  if(request.engine==='keyframes')return buildKeyframeWorkflow(request,imageName,endImageName,prefix);
  if(request.engine==='camera')return buildCameraWorkflow(request,imageName,prefix);
  const [width, height] = generationSize(request);
  const motion = PRESETS.find(x => x.id === request.preset);
  const node = (class_type, inputs) => ({ class_type, inputs });
  const graph={
    '1': node('UNETLoader', { unet_name: MODELS.diffusion, weight_dtype: 'default' }),
    '2': node('CLIPLoader', { clip_name: MODELS.encoder, type: 'wan', device: 'default' }),
    '3': node('VAELoader', { vae_name: MODELS.vae }),
    '4': node('LoadImage', { image: imageName }),
    '5': node('CLIPTextEncode', { clip: ['2', 0], text: `${request.prompt}. ${motion.prompt}${lookPrompt(request.look)?' '+lookPrompt(request.look):''}` }),
    '6': node('CLIPTextEncode', { clip: ['2', 0], text: 'Distorted anatomy, identity changes, flicker, abrupt cuts, text, subtitles, watermark, overexposure, low quality, unstable background.' }),
    '7': node('Wan22ImageToVideoLatent', { vae: ['3', 0], start_image: ['4', 0], width, height, length: LENGTHS[request.length], batch_size: 1 }),
    '8': node('ModelSamplingSD3', { model: ['1', 0], shift: 8 }),
    '9': node('KSampler', { model: ['8', 0], positive: ['5', 0], negative: ['6', 0], latent_image: ['7', 0], seed: request.seed, steps: request.steps, cfg: 5, sampler_name: 'uni_pc', scheduler: 'simple', denoise: 1 }),
    '10': node('VAEDecode', { samples: ['9', 0], vae: ['3', 0] }),
    '11': node('CreateVideo', { images: ['10', 0], fps: request.fps }),
    '12': node('SaveVideo', { video: ['11', 0], filename_prefix: prefix, format: 'mp4', codec: 'h264' }),
  };
  if(request.mode==='text'){delete graph['4'];delete graph['7'].inputs.start_image;}
  return graph;
}

export function buildCameraWorkflow(request,imageName,prefix){
  const [width,height]=generationSize(request),length=LENGTHS[request.length];
  const node=(class_type,inputs)=>({class_type,inputs});
  const full=request.cameraSampling==='full',steps=full?20:4,split=steps/2;
  const sampling={steps,cfg:full?3.5:1,sampler_name:'euler',scheduler:'simple',positive:['10',0],negative:['10',1]};
  const graph={
    '1':node('UNETLoader',{unet_name:CAMERA_MODELS.high,weight_dtype:'default'}),
    '2':node('UNETLoader',{unet_name:CAMERA_MODELS.low,weight_dtype:'default'}),
    '3':node('LoraLoaderModelOnly',{model:['1',0],lora_name:CAMERA_MODELS.highLora,strength_model:1}),
    '4':node('LoraLoaderModelOnly',{model:['2',0],lora_name:CAMERA_MODELS.lowLora,strength_model:1}),
    '5':node('CLIPLoader',{clip_name:MODELS.encoder,type:'wan',device:'default'}),
    '6':node('VAELoader',{vae_name:CAMERA_MODELS.vae}),
    '7':node('LoadImage',{image:imageName}),
    '8':node('CLIPTextEncode',{clip:['5',0],text:request.prompt+(lookPrompt(request.look)?' '+lookPrompt(request.look):'')}),
    '9':node('CLIPTextEncode',{clip:['5',0],text:'Flicker, abrupt cuts, distorted geometry, identity changes, low quality, watermark, text, subtitles.'}),
    '10':node('WanCameraImageToVideo',{positive:['8',0],negative:['9',0],vae:['6',0],width,height,length,batch_size:1,start_image:['7',0],camera_conditions:['11',0]}),
    '11':node('WanCameraEmbedding',{camera_pose:request.cameraPose,width,height,length,speed:request.cameraSpeed,fx:.5,fy:.5,cx:.5,cy:.5}),
    '12':node('ModelSamplingSD3',{model:['3',0],shift:8}),
    '13':node('ModelSamplingSD3',{model:['4',0],shift:8}),
    '14':node('KSamplerAdvanced',{...sampling,model:['12',0],latent_image:['10',2],add_noise:'enable',noise_seed:request.seed,start_at_step:0,end_at_step:split,return_with_leftover_noise:'enable'}),
    '15':node('KSamplerAdvanced',{...sampling,model:['13',0],latent_image:['14',0],add_noise:'disable',noise_seed:0,start_at_step:split,end_at_step:steps,return_with_leftover_noise:'disable'}),
    '16':node('VAEDecode',{samples:['15',0],vae:['6',0]}),
    '17':node('CreateVideo',{images:['16',0],fps:16}),
    '18':node('SaveVideo',{video:['17',0],filename_prefix:prefix,format:'mp4',codec:'h264'}),
  };
  if(full){delete graph['3'];delete graph['4'];graph['12'].inputs.model=['1',0];graph['13'].inputs.model=['2',0];}
  if(request.cameraMirror){graph['21']=node('ImageFlip',{image:['7',0],flip_method:'y-axis: horizontally'});graph['10'].inputs.start_image=['21',0];graph['11'].inputs.camera_pose=request.cameraPose==='Pan Right'?'Pan Left':'Pan Right';graph['22']=node('ImageFlip',{image:['16',0],flip_method:'y-axis: horizontally'});graph['17'].inputs.images=['22',0];}
  return graph;
}

export function cameraReadiness(info,cameraSampling='fast'){
  const graph=buildCameraWorkflow({aspect:'landscape',length:'preview',prompt:'test',cameraPose:'Zoom In',cameraSpeed:1,seed:1,cameraSampling},'test.png','test');
  const missingNodes=[...new Set([...Object.values(graph).map(n=>n.class_type),'ImageFlip'])].filter(name=>!info[name]);
  const specs=[['UNETLoader','unet_name',CAMERA_MODELS.high],['UNETLoader','unet_name',CAMERA_MODELS.low],['LoraLoaderModelOnly','lora_name',CAMERA_MODELS.highLora],['LoraLoaderModelOnly','lora_name',CAMERA_MODELS.lowLora],['CLIPLoader','clip_name',MODELS.encoder],['VAELoader','vae_name',CAMERA_MODELS.vae]];
  const missingModels=specs.filter(([name])=>cameraSampling!=='full'||name!=='LoraLoaderModelOnly').filter(([name,key,file])=>!info[name]?.input?.required?.[key]?.[0]?.includes(file)).map(x=>x[2]);
  return {ready:!missingNodes.length&&!missingModels.length,missingNodes,missingModels};
}

export function readiness(info) {
  const workflow = buildWorkflow({ aspect: 'landscape', length: 'preview', preset: 'locked', prompt: 'test', seed: 1, steps: 12, fps: 24 }, 'test.png', 'test');
  const missingNodes = [...new Set(Object.values(workflow).map(x => x.class_type))].filter(x => !info[x]);
  const specs = [['UNETLoader', 'unet_name', MODELS.diffusion], ['CLIPLoader', 'clip_name', MODELS.encoder], ['VAELoader', 'vae_name', MODELS.vae]];
  const missingModels = specs.filter(([n, key, name]) => !info[n]?.input?.required?.[key]?.[0]?.includes(name)).map(x => x[2]);
  return { ready: !missingNodes.length && !missingModels.length, missingNodes, missingModels };
}

export function buildKeyframeWorkflow(request,startImage,endImage,prefix){
  const graph=buildWorkflow({...request,engine:'wan5b',mode:'image'},startImage,prefix);
  graph['1'].inputs.unet_name=KEYFRAME_MODEL;
  graph['13']={class_type:'LoadImage',inputs:{image:endImage}};
  const [width,height]=generationSize(request);
  graph['7']={class_type:'WanFunInpaintToVideo',inputs:{positive:['5',0],negative:['6',0],vae:['3',0],start_image:['4',0],end_image:['13',0],width,height,length:LENGTHS[request.length],batch_size:1}};
  Object.assign(graph['9'].inputs,{positive:['7',0],negative:['7',1],latent_image:['7',2],cfg:6});
  return graph;
}
export function keyframeReadiness(info){
  const graph=buildKeyframeWorkflow({aspect:'landscape',length:'preview',preset:'locked',prompt:'test',seed:1,steps:20,fps:24},'start.png','end.png','test');
  const missingNodes=[...new Set(Object.values(graph).map(n=>n.class_type))].filter(n=>!info[n]);
  const specs=[['UNETLoader','unet_name',KEYFRAME_MODEL],['CLIPLoader','clip_name',MODELS.encoder],['VAELoader','vae_name',MODELS.vae]];
  const missingModels=specs.filter(([n,key,file])=>!info[n]?.input?.required?.[key]?.[0]?.includes(file)).map(s=>s[2]);
  return {ready:!missingNodes.length&&!missingModels.length,missingNodes,missingModels};
}
