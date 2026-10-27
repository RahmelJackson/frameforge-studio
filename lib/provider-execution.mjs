import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {providerPacket,providerReadiness} from './provider-workflows.mjs';
import {assertOpenProvider} from './provider-policy.mjs';
import {apiToCanvas,canvasToApi} from '../public/workflow-graph.js';
import {ComfyClient} from './comfy.mjs';

export const LOCAL_PROVIDER_RECIPES=[
 {id:'ltx-vfx',providerId:'ltx-vfx',variant:'default',name:'LTX 2.5 · atmospheric VFX',kind:'video',profile:{size:[640,384],frames:121,fps:24}},
 {id:'flux3-image',providerId:'flux3-video',variant:'local',name:'FLUX 3 Image Klein · image edit',kind:'image',profile:{megapixels:1,steps:16}},
 {id:'minimax-h3-local',providerId:'minimax-h3',variant:'local',name:'MiniMax H3 · image to video',kind:'video',profile:{size:[640,384],frames:56,fps:24}}
];
export const providerRecipe=id=>LOCAL_PROVIDER_RECIPES.find(r=>r.id===id);
const digest=value=>createHash('sha256').update(value).digest('hex');
export async function executableProvider(root,id){
 const recipe=providerRecipe(id);if(!recipe)throw Error('Choose a supported local provider recipe.');
 const packet=await providerPacket(root,recipe.providerId,recipe.variant);assertOpenProvider(packet);
 let api=packet.graph;
 if(id==='flux3-image'){
  const bytes=await readFile(path.join(root,'workflows/bonus/frameforge-flux3-image-api.json'));
  if(digest(bytes)!=='9613ef19f01e7c01582715d3bb6cc6fc866d39ff25c31fef4e4486ddaa887fa1')throw Error('The reviewed FLUX API graph changed.');
  api=JSON.parse(bytes);
 }
 return {...packet,id,name:recipe.name,recipe,api,execution:'local',nativeEditorRequired:false,missingDownloads:[],requirements:packet.limits};
}
export async function providerSetup({root,id,engines}){
 const packet=await executableProvider(root,id),ready=await providerReadiness({root,id:packet.recipe.providerId,variant:packet.recipe.variant,engines});
 return {packet,ready};
}
export function bindProviderAPI(packet,{asset,prompt,seed}){
 const api=structuredClone(packet.api),id=packet.id;
 for(const n of Object.values(api)){
  if(n.class_type==='LoadImage')n.inputs.image=asset;
  if(n.class_type==='SaveImage'||n.class_type==='SaveVideo')n.inputs.filename_prefix='Frameforge/prepared';
  if(n.class_type==='RandomNoise')n.inputs.noise_seed=seed;
  if(n.class_type==='KSampler')n.inputs.seed=seed;
 }
 if(id==='ltx-vfx')api['398:376'].inputs.value=prompt;
 if(id==='minimax-h3-local')api['105:104'].inputs.prompt=prompt;
 if(id==='flux3-image'){api['49'].inputs.prompt=prompt;api['47'].inputs['sampling_mode.seed']=seed;}
 return api;
}
export async function prepareProviderPlan({root,data,input,workflow,context,engines,inspectImage}){
 const {packet,ready}=await providerSetup({root,id:workflow,engines}),recipe=packet.recipe;
 if(context!==(recipe.kind==='image'?'images':'create'))throw Error('Choose the Images tab for FLUX, or Video for LTX/H3.');
 if(input.mask||input.reference||input.reference2||input.endAsset)throw Error('This local provider recipe accepts one starting image. Clear extra references, ending frames or masks, or choose a workflow that supports them.');
 if(!/^[a-f0-9-]{36}\.(png|jpg|webp)$/.test(input.asset??''))throw Error('Choose a starting image first.');
 const prompt=String(input.prompt??'').trim(),seed=Number(input.seed??1);
 if(!prompt||prompt.length>4000)throw Error('Use a prompt of 1–4000 characters.');
 if(!Number.isSafeInteger(seed)||seed<0||seed>2147483647)throw Error('Use a seed between 0 and 2147483647.');
 const file=path.join(data,'assets',input.asset),bytes=await readFile(file),dimensions=await inspectImage(file);
 if(dimensions.width*dimensions.height>4000000)throw Error('Use a starting image up to four megapixels.');
 const api=bindProviderAPI(packet,{asset:input.asset,prompt,seed});
 // Dynamic node inputs are already flattened in these reviewed API graphs. Infer only
 // the widget schema needed for a lossless editable canvas, retaining all API links.
 const graph=providerCanvas(api),canonical=canvasToApi(graph);
 const request={kind:recipe.kind,tool:recipe.kind==='image'?'edit':undefined,mode:'image',asset:input.asset,prompt,seed,aspect:'landscape',look:{},providerWorkflow:workflow,model:packet.model,...(recipe.kind==='video'?{workflowExpected:recipe.profile,fps:24,length:'short'}:{megapixels:1})};
 return {context,provider:'local',execution:'local',providerWorkflow:workflow,task:workflow,name:recipe.name,model:packet.model,rawInput:{...request},request,api:canonical,graph,files:[{name:input.asset,path:file,bytes:bytes.length,sha256:digest(bytes),contentType:'image/'+(input.asset.endsWith('.jpg')?'jpeg':input.asset.split('.').at(-1)),url:'/assets/'+input.asset}],models:packet.models,missingDownloads:[],warnings:[packet.limits,...(packet.licenseNotice?[packet.licenseNotice]:[])],status:'Prepared for local Studio generation',engineUrl:ready.engineUrl,readiness:ready,previews:Object.fromEntries(graph.nodes.filter(n=>n.type==='LoadImage').map(n=>[n.id,{url:'/assets/'+input.asset,label:'Your starting image'}])),explanation:{category:recipe.kind,bestFor:recipe.kind==='image'?'Reference-based local image edits.':'Short local atmospheric and image-to-video previews.',example:packet.example??prompt,title:recipe.name,summary:packet.summary,inputs:[packet.input],output:packet.output,steps:['Check the pinned model files and compatible engine.','Run this bounded local graph with your image, prompt and seed.','Decode the result, inspect it and save it to your library.'],limits:packet.limits}};
}
export function assertProviderPlan(p,graph){
 if(!providerRecipe(p.providerWorkflow)||p.execution!=='local')throw Error('Unknown provider plan.');
 const candidate=graph?canvasToApi(graph):p.api;
 // Provider profiles deliberately remain fixed. Edits to topology, loaders, source,
 // dimensions or sampler settings require a new supported plan, including outside strict mode.
 if(JSON.stringify(candidate)!==JSON.stringify(p.api))throw Error('Prepare a new provider workflow to change its image, prompt or seed. Run uses the reviewed bounded graph.');
 return candidate;
}
export function providerEngine(plan){return new ComfyClient(plan.engineUrl);}

export function providerCanvas(api){
 const info={};for(const node of Object.values(api)){
  const s=info[node.class_type]??={input:{required:{}},output:[]};
  for(const [key,value] of Object.entries(node.inputs)){
   const link=Array.isArray(value)&&value.length===2&&api[value[0]];
   s.input.required[key]=[link?'*':typeof value==='boolean'?'BOOLEAN':typeof value==='number'?'FLOAT':'STRING'];
   if(link){const source=info[api[value[0]].class_type]??={input:{required:{}},output:[]};while(source.output.length<=value[1])source.output.push('*');}
  }
 }
 return apiToCanvas(api,info);
}
