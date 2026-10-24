import {apiToCanvas,canvasToApi} from '../public/workflow-graph.js';
const node=(class_type,inputs)=>({class_type,inputs});
const string=['STRING'],integer=['INT'],boolean=['BOOLEAN'],combo=values=>['COMBO',{options:values}];
const shared={LoadImage:{input:{required:{image:string}},output:['IMAGE','MASK']},LoadVideo:{input:{required:{file:string}},output:['VIDEO']},SaveImage:{input:{required:{images:['IMAGE'],filename_prefix:string}},output:[]},SaveVideo:{input:{required:{video:['VIDEO'],filename_prefix:string,format:combo(['auto','mp4']),codec:combo(['auto','h264'])}},output:[]}};
export const CLOUD_TASKS={image:['seedream-create','seedream-edit'],video:['seedance-i2v','seedance-t2v','seedance-frames','seedance-reference','seedance-edit','seedance-extend'],audio:['seed-audio']};
export function cloudWorkflow(task,input){
 const schemas=structuredClone(shared),graph={},ratio={landscape:'16:9',portrait:'9:16',square:'1:1'}[input.aspect]??'16:9',prompt=String(input.prompt??'').trim();
 if(!Object.values(CLOUD_TASKS).flat().includes(task))throw Error('This task has no direct Cloud adapter yet.');if(!prompt||prompt.length>10000)throw Error('Describe the Cloud result first.');
 const seed=Number(input.seed||1)%2147483648;if(!Number.isSafeInteger(seed)||seed<0)throw Error('Choose a valid seed.');
 const image=(id,name)=>{if(!name)throw Error('Choose the required reference image.');graph[id]=node('LoadImage',{image:name});return [id,0];};
 if(task==='seed-audio'){
  if(prompt.length>3000)throw Error('Seed Audio prompts are limited to 3000 characters.');
  schemas.ByteDanceSeedAudio={input:{required:{text_prompt:string,reference_mode:combo(['text only']),sample_rate:combo(['24000']),speech_rate:integer,loudness_rate:integer,pitch_rate:integer,seed:['INT',{control_after_generate:true}],model:combo(['seed-audio-1.0-multilingual'])}},output:['AUDIO']};schemas.SaveAudio={input:{required:{audio:['AUDIO'],filename_prefix:string}},output:[]};
  graph['9']=node('ByteDanceSeedAudio',{text_prompt:prompt,reference_mode:'text only',sample_rate:'24000',speech_rate:0,loudness_rate:0,pitch_rate:0,seed,model:'seed-audio-1.0-multilingual'});graph['20']=node('SaveAudio',{audio:['9',0],filename_prefix:'Frameforge/cloud-speech'});
 }else if(task.startsWith('seedream')){
  const [width,height]=input.aspect==='portrait'?[1152,2048]:input.aspect==='square'?[2048,2048]:[2048,1152];
  const fields={prompt:string,model:combo(['seedream 5.0 pro']),'model.size_preset':string,'model.width':integer,'model.height':integer,'model.prompt_optimization':combo(['standard','fast']),'model.seed':['INT',{control_after_generate:true}],'model.watermark':boolean,'model.thinking':boolean};
  const inputs={prompt,model:'seedream 5.0 pro','model.size_preset':'Custom','model.width':width,'model.height':height,'model.prompt_optimization':'standard','model.seed':seed,'model.watermark':false,'model.thinking':true};
  if(task==='seedream-edit'){fields['model.images.image_1']=['IMAGE'];inputs['model.images.image_1']=image('1',input.asset);if(input.reference){fields['model.images.image_2']=['IMAGE'];inputs['model.images.image_2']=image('2',input.reference);}if(input.reference2){fields['model.images.image_3']=['IMAGE'];inputs['model.images.image_3']=image('3',input.reference2);}}
  schemas.ByteDanceSeedreamNodeV3={input:{required:fields},output:['IMAGE']};graph['9']=node('ByteDanceSeedreamNodeV3',inputs);graph['20']=node('SaveImage',{images:['9',0],filename_prefix:'Frameforge/cloud'});
 }else{
  const duration=Number(input.cloudDuration??5),resolution=input.cloudResolution??'720p';if(!Number.isInteger(duration)||duration<4||duration>30||!['480p','720p','1080p'].includes(resolution))throw Error('Cloud video requires 4–30 seconds and an available resolution.');
  const frames=task==='seedance-frames',text=task==='seedance-t2v',type=frames?'ByteDance2FirstLastFrameNode':text?'ByteDance2TextToVideoNode':'ByteDance2ReferenceNodeV2';
  const fields={model:combo(['Seedance 2.5']),'model.prompt':string,'model.resolution':combo(['480p','720p','1080p'])},inputs={model:'Seedance 2.5','model.prompt':prompt,'model.resolution':resolution};
  if(!frames){fields['model.ratio']=string;inputs['model.ratio']=ratio;}
  Object.assign(fields,{'model.duration':integer,'model.generate_audio':boolean});Object.assign(inputs,{'model.duration':duration,'model.generate_audio':input.cloudAudio!==false});
  if(!text&&!frames){fields['model.task_type']=combo(['reference','edit','extend']);inputs['model.task_type']=task==='seedance-edit'?'edit':task==='seedance-extend'?'extend':'reference';}
  fields['model.output_format']=combo(['mp4']);inputs['model.output_format']='mp4';
  if(!text&&!frames){Object.assign(fields,{'model.auto_downscale':boolean,'model.auto_upscale':boolean});Object.assign(inputs,{'model.auto_downscale':true,'model.auto_upscale':false});}
  Object.assign(fields,{seed:['INT',{control_after_generate:true}],watermark:boolean});Object.assign(inputs,{seed,watermark:false});
  if(frames){fields.first_frame=['IMAGE'];fields.last_frame=['IMAGE'];inputs.first_frame=image('1',input.asset);inputs.last_frame=image('2',input.endAsset);fields.first_frame_asset_id=string;fields.last_frame_asset_id=string;inputs.first_frame_asset_id='';inputs.last_frame_asset_id='';}
  else if(!text){if(input.asset){fields['model.reference_images.image_1']=['IMAGE'];inputs['model.reference_images.image_1']=image('1',input.asset);}if(input.video){fields['model.reference_videos.video_1']=['VIDEO'];graph['3']=node('LoadVideo',{file:input.video});inputs['model.reference_videos.video_1']=['3',0];}if(!input.asset&&!input.video)throw Error('Choose reference media first.');if(['seedance-edit','seedance-extend'].includes(task)&&!input.video)throw Error('Choose video footage for editing or extension.');}
  schemas[type]={input:{required:fields},output:['VIDEO','STRING']};graph['9']=node(type,inputs);graph['20']=node('SaveVideo',{video:['9',0],filename_prefix:'Frameforge/cloud',format:'mp4',codec:'h264'});
 }
 const canvas=apiToCanvas(graph,schemas);
 return {api:canvasToApi(canvas),graph:canvas,model:task==='seed-audio'?'Seed Audio 1.0':task.startsWith('seedream')?'Seedream 5.0 Pro':'Seedance 2.5',media:task==='seed-audio'?'audio':task.startsWith('seedream')?'image':'video'};
}
export function executableGraph(canvas,plan){
 const graph=canvasToApi(canvas),allowed=new Set(Object.values(plan.api).map(n=>n.class_type));
 if(Object.values(graph).some(n=>!allowed.has(n.class_type)))throw Error('Added node classes require preparing a new supported workflow.');
 if(!Object.values(graph).some(n=>['SaveImage','SaveVideo','SaveAudio'].includes(n.class_type)))throw Error('Keep a connected output-saving node.');
 const fileNames=new Set(plan.files.map(f=>f.name));for(const n of Object.values(graph)){if(['LoadImage','LoadImageMask'].includes(n.class_type)&&!fileNames.has(n.inputs.image)||n.class_type==='LoadVideo'&&!fileNames.has(n.inputs.file))throw Error('Select source media in the tab, then update its workflow.');
  const prototypes=Object.values(plan.api).filter(original=>original.class_type===n.class_type);if(!prototypes.some(original=>Object.keys(original.inputs).every(key=>key in n.inputs)))throw Error('Reconnect the required inputs on '+n.class_type+' before running.');
  if(n.class_type.startsWith('ByteDance2')){if(n.inputs.model!=='Seedance 2.5')throw Error('Prepare a workflow for the selected model.');const duration=n.inputs['model.duration'];if(!Number.isInteger(duration)||duration<4||duration>30||!['480p','720p','1080p'].includes(n.inputs['model.resolution']))throw Error('Choose a supported Cloud duration/resolution.');}
  if(n.class_type==='ByteDanceSeedreamNodeV3'&&n.inputs.model!=='seedream 5.0 pro')throw Error('Prepare a workflow for the selected model.');}
 return graph;
}
