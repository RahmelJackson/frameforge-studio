import {WORKFLOW_HELP} from '../public/workflow-help.js';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
const docs='https://docs.comfy.org/tutorials/';
// ComfyUI's documented model-download metadata; execution values stay intact.
export function withModelDownloads(graph,models){const result=structuredClone(graph);for(const node of result.nodes??[]){const names=new Set((node.widgets_values??[]).filter(v=>typeof v==='string').map(v=>v.split(/[\\/]/).at(-1)));const matches=models.filter(m=>names.has(m.name)&&/\.(safetensors|sft)$/.test(m.name));if(matches.length)node.properties={...node.properties,models:matches.map(({name,url,directory})=>({name,url,directory}))};}return result;}
export function modelDependencies(graph,lock){const names=new Set(graph.nodes.flatMap(n=>(n.widgets_values??[]).filter(v=>typeof v==='string'&&/\.(safetensors|pth|bin|ckpt)$/.test(v)).map(v=>v.split(/[\\/]/).at(-1))));return {models:lock.filter(m=>names.has(m.name)),missingDownloads:[...names].filter(name=>!lock.some(m=>m.name===name))};}
const cloud=(id,name,task,file,guide)=>({id,name,task,file:'upstream/'+file+'.json',execution:'partner',model:name.split(' · ')[0],guide:docs+'partner-nodes/'+guide,cloudUrl:'https://cloud.comfy.org/?template='+file,status:'Official template · paid run not tested here',requirements:'Sign in to an up-to-date ComfyUI or Comfy Cloud account with credits. Replace example media in Load Image / Load Video before running. No downloadable model weights.'});
export const WORKFLOWS=[
 {id:'wan-i2v',name:'Wan 2.2 5B · image to video',task:'Animate a still locally',model:'Wan 2.2 5B',file:'local/wan-i2v.json',execution:'local',guide:docs+'video/wan/wan2_2',status:'Existing local generation workflow',requirements:'Three pinned model files, a reference image and a compatible GPU. This is an open-weight alternative, not Seedance.'},
 {id:'wan-camera',name:'Wan 2.2 Fun Camera · camera control',task:'Direct a camera move locally',model:'Wan 2.2 Fun Camera 14B',file:'local/wan-camera.json',execution:'local',guide:docs+'video/wan/wan2-2-fun-camera',status:'Existing local workflow · motion quality varies',requirements:'Both camera diffusion models, both acceleration LoRAs, encoder and VAE. Native camera controls remain experimental.'},
 {id:'z-image',name:'Z-Image Turbo · create image',task:'Create a still locally',model:'Z-Image Turbo',file:'local/z-image.json',execution:'local',guide:docs+'image/z-image/z-image-turbo',status:'Existing local generation workflow',requirements:'Diffusion model, text encoder and VAE. No cloud credits.'},
 {id:'qwen-edit',name:'Qwen Image Edit 2511 · edit image',task:'Edit a still locally',model:'Qwen Image Edit 2511',file:'local/qwen-edit.json',execution:'local',guide:docs+'image/qwen/qwen-image-edit-2511',status:'Existing local workflow · selective edits need review',requirements:'Qwen edit diffusion model, encoder, VAE and Lightning LoRA. Replace the example input image.'},
 cloud('seedance-i2v','Seedance 2.5 · image to video','Animate a still with synced audio','api_seedance2_5_i2v_1080p','bytedance/seedance-2-5'),
 cloud('seedance-t2v','Seedance 2.5 · text to video','Generate video from a brief','api_seedance2_5_t2v','bytedance/seedance-2-5'),
 cloud('seedance-frames','Seedance 2.5 · first / last frame','Connect two keyframes','api_seedance2_5_flf2v','bytedance/seedance-2-5'),
 cloud('seedance-reference','Seedance 2.5 · references','Use image, video and audio references','api_seedance2_5_r2v','bytedance/seedance-2-5'),
 cloud('seedance-edit','Seedance 2.5 · edit video','Edit existing footage','api_seedance2_5_video_editing','bytedance/seedance-2-5'),
 cloud('seedance-extend','Seedance 2.5 · extend video','Extend existing footage','api_seedance2_5_video_extend','bytedance/seedance-2-5'),
 cloud('seedance-draft','Seedance 2.5 · draft preview','Try a lower resolution preview','api_seedance2_5_draft_i2v','bytedance/seedance-2-5-draft'),
 cloud('kling-video','Kling 3.0 · multi-shot video','Direct a sequence of shots','api_kling_v3_video','kling/kling-3-0'),
 cloud('seedream-create','Seedream 5.0 Pro · create image','Create a paid-model still','api_bytedance_seedream_5_0_pro_t2i','bytedance/seedream-5-pro'),
 cloud('seedream-edit','Seedream 5.0 Pro · edit image','Edit with a paid image model','api_bytedance_seedream_5_0_pro_image_edit','bytedance/seedream-5-pro'),
];
for(const entry of WORKFLOWS)entry.explanation=WORKFLOW_HELP[entry.id];
const widgetNames={
 ByteDance2ReferenceNodeV2:['Model','Prompt','Resolution','Aspect ratio','Duration (seconds)','Generate audio','Task type','Output format','Auto downscale','Auto upscale','Seed','Seed control','Watermark'],
 ByteDance2TextToVideoNode:['Model','Prompt','Resolution','Aspect ratio','Duration (seconds)','Generate audio','Output format','Seed','Seed control','Watermark'],
 ByteDance2FirstLastFrameNode:['Model','Prompt','Resolution','Duration (seconds)','Generate audio','Output format','Seed','Seed control','Watermark','First-frame asset ID','Last-frame asset ID'],
 ByteDance2DraftToFinalVideoNode:['Draft task ID','Watermark'],
 KlingVideoNode:['Storyboard mode','Shot 1 prompt','Shot 1 duration','Shot 2 prompt','Shot 2 duration','Generate audio','Model','Resolution','Aspect ratio'],
 LoadImage:['Input image','Upload mode'],SaveVideo:['Filename prefix','Format','Codec'],SaveImage:['Filename prefix'],MarkdownNote:['Notes'],
};
export async function workflowPacket(root,id){
 const entry=WORKFLOWS.find(w=>w.id===id);if(!entry)throw Error('Unknown workflow.');
 const graph=JSON.parse(await readFile(path.join(root,'workflows',entry.file),'utf8'));
 const lock=JSON.parse(await readFile(path.join(root,'workflows','models.json'),'utf8'));
 const dependencies=modelDependencies(graph,lock);return {...entry,graph:withModelDownloads(graph,dependencies.models),widgetNames,...dependencies,source:entry.execution==='partner'?'Comfy-Org/workflow_templates':'Frameforge graph builders',reviewed:'2026-10-24',partnerInfo:docs+'partner-nodes/overview',pricing:docs+'partner-nodes/pricing'};
}
