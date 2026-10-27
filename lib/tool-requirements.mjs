import path from 'node:path';
import {readFile,stat} from 'node:fs/promises';
import {imageToolSetup} from './image-tool-setup.mjs';
import {normalizeVideoTool,buildVideoToolWorkflow,VIDEO_TOOLS} from './video-tools.mjs';
import {apiToCanvas} from '../public/workflow-graph.js';
import {modelDependencies} from './workflow-catalog.mjs';
const read=async(root,file)=>JSON.parse(await readFile(path.join(root,file),'utf8'));
const basename=s=>String(s).split(/[\\/]/).at(-1);
const collect=value=>Array.isArray(value)?value.flatMap(collect):value&&typeof value==='object'?(value.sha256&&(value.url||value.repo)&&value.bytes?[value]:Object.values(value).flatMap(collect)):[];
export async function modelRegistry(root){
 const lockNames=['advanced-models','round12-models','style-models','style-content-models','vision-models','audio-models','speech-upgrades','speech-runtime','latentsync','audio-separation','round12-speech-models','round13-asr','round13-relight','interpolation-model','human-pose'];
 const records=[];
 for(const name of lockNames){let lock;try{lock=await read(root,'setup/'+name+'.lock.json');}catch(e){if(e.code==='ENOENT')continue;throw e;}
  for(const entry of collect(lock)){
   const repo=entry.repo??entry.repository,file=entry.file??entry.filename??entry.path,namePart=basename(entry.path??file);
   const url=entry.url??(repo&&entry.revision&&file?'https://huggingface.co/'+repo+'/resolve/'+entry.revision+'/'+file:null);
   if(!url||!file)continue;
   let destination=entry.path??file,installRoot='runtime',installPath;
   if(entry.directory&&['diffusion_models','text_encoders','vae','loras','checkpoints','controlnet','upscale_models','frame_interpolation','clip_vision'].includes(entry.directory)){installRoot='models';installPath=entry.directory+'/'+namePart;}
   else if(/^runtime[\/]/.test(destination))installPath=destination.replace(/^runtime[\/]/,'');
   else if(/FrameforgeModels[\\/]storybuilder[\\/]/i.test(destination)){installRoot='models';installPath=destination.split(/FrameforgeModels[\\/]storybuilder[\\/]/i)[1].replaceAll('\\','/');}
   else if(entry.directory?.startsWith('speech/')){installRoot='models';installPath=entry.directory+'/'+namePart;}
   else if(name==='round13-relight'){installRoot='models';installPath='relight/'+(entry.local??destination);}
   else if(name==='audio-separation')installPath='audio-models/'+destination;
   else if(name==='audio-models')installPath='audio-models/'+destination;
   else if(name==='speech-upgrades')installPath='speech-models/'+destination;
   else if(name==='latentsync')installPath='latentsync-models/'+destination;
   // A source lock without an explicit install mapping stays a useful manual link.
   records.push({...entry,name:namePart,url,licenseUrl:entry.licenseUrl??(repo?'https://huggingface.co/'+repo+'/tree/'+entry.revision:url.replace(/\/releases\/.*/, '')),destination:installPath?(installRoot==='models'?'models/':'runtime/')+installPath:destination,installRoot,installPath,lock:name});
  }
 }
 const core=await read(root,'workflows/models.json');return [...core,...records];
}
export async function toolRequirements(root,{context,tool,input={}}){
 if(context==='images'){
  try{return await imageToolSetup(root,tool);}catch(error){if(error.statusCode!==400)throw error;}
 }
 const registry=await modelRegistry(root);
 if(context==='video-tools'){
  const placeholder='11111111-1111-4111-8111-111111111111',request=normalizeVideoTool({...input,tool,footage:placeholder,prompt:'Check required models',start:0,end:2});let api=null;
  try{api=buildVideoToolWorkflow({...request,prepared:{size:[512,288],frames:33,fps:16}},{video:'prepared.mp4',reference:placeholder+'.png',maskVideo:'mask.mp4'});}catch{}
  if(api){const graph=apiToCanvas(api,await read(root,'workflows/node-schemas.json'));return {id:'video-tool:'+tool,name:tool+' · local setup',execution:'local',graph,...modelDependencies(graph,registry),requirements:'Exact model stage for the selected video tool. Inputs are not needed for this setup check.'};}
 }
 let models=[],requirements='This is a local CPU tool; no ComfyUI weights are needed. Studio media helpers and the selected processor must be installed.';
 if(context==='images'&&tool==='style-board')models=registry.filter(m=>['style-models','style-content-models'].includes(m.lock));
 if(context==='images'&&['face-neural','face-anchor','face-match','prop-place'].includes(tool))models=registry.filter(m=>m.lock==='vision-models');
 if(context==='video-tools'&&['segment','pose-guide','recolor','masked'].includes(tool))models=registry.filter(m=>m.lock===(tool==='segment'?'round12-models':tool==='pose-guide'?'human-pose':'advanced-models'));
 if(context==='audio'){
  const allowed=['speech','expressive','convert','dialogue','transcribe','dub','lipsync','separate','caption'];if(!allowed.includes(tool))throw Error('Choose a listed audio tool.');
  const locks={speech:['audio-models'],expressive:['speech-upgrades','round12-speech-models'],convert:['speech-upgrades','round12-speech-models'],dialogue:['speech-runtime','speech-upgrades','round12-speech-models'],transcribe:['audio-models','round13-asr'],dub:['audio-models','speech-runtime','speech-upgrades'],lipsync:['audio-models','latentsync'],separate:['audio-separation'],caption:[]}[tool];
  models=registry.filter(m=>locks.includes(m.lock));if(tool==='speech')models=models.filter(m=>m.path?.startsWith('kokoro/'));if(tool==='transcribe')models=models.filter(m=>m.path?.startsWith('asr/')||m.directory==='speech/asr-large');requirements='Local '+tool+' model files. Some selectable engines have separate files below. Python environments and processor source installation remain separate from model downloads.';
 }
 const unique=[...new Map(models.map(m=>[m.destination,m])).values()];return {id:context+':'+tool,name:tool+' · local setup',execution:'local',graph:null,models:unique,missingDownloads:[],requirements,processor:true};
}
export async function checkProcessorFiles(packet,{root,modelRoot}){
 if(!packet.processor)return packet;
 const models=await Promise.all(packet.models.map(async m=>{let state='unknown';if(m.installPath){const base=m.installRoot==='models'?modelRoot:path.join(root,'runtime');if(base){try{const info=await stat(path.join(base,m.installPath));state=info.isFile()&&info.size===m.bytes?'available':'missing';}catch(e){if(e.code!=='ENOENT')throw e;state='missing';}}}return {...m,state};}));
 return {...packet,models};
}
