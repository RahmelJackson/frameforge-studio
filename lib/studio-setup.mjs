import {workflowPacket,WORKFLOWS} from './workflow-catalog.mjs';
import {access} from 'node:fs/promises';
import {spawn} from 'node:child_process';

export async function mediaRuntime(python,modules='av,numpy,PIL'){
 try{await access(python);}catch{return {available:false,setup:'npm run setup:media',requires:'Python 3.12',description:'For uploads, previews and technical checks inside the studio. Native ComfyUI graph export does not need these helpers.'};}
 return new Promise(resolve=>{const child=spawn(python,['-c','import '+modules+'; print("ready")'],{windowsHide:true});let output='';const done=available=>resolve({available,setup:'npm run setup:media',requires:'Python 3.12',description:'CPU image/video upload and verification helpers; extra speech/vision processors are separate.'});child.stdout.on('data',c=>output+=c);child.stderr.resume();const timer=setTimeout(()=>{child.kill();done(false);},6000);child.once('error',()=>{clearTimeout(timer);done(false);});child.once('close',code=>{clearTimeout(timer);done(code===0&&output.trim()==='ready');});});
}

export const SETUP_LINKS={comfy:'https://www.comfy.org/download',instructions:'https://docs.comfy.org/installation/desktop/windows',models:'https://docs.comfy.org/development/core-concepts/models',cloud:'https://cloud.comfy.org/',ollama:'https://ollama.com/download',node:'https://nodejs.org/en/download'};
const basename=value=>String(value).split(/[\\/]/).at(-1);
export async function discoverComfy(fetcher=fetch){const urls=['http://127.0.0.1:8188','http://127.0.0.1:8189','http://127.0.0.1:8000'];const found=await Promise.allSettled(urls.map(async url=>{const r=await fetcher(url+'/system_stats',{signal:AbortSignal.timeout(1500)});if(!r.ok)return null;const v=await r.json();return v.system&&Array.isArray(v.devices)?{url,version:typeof v.system.comfyui_version==='string'?v.system.comfyui_version.slice(0,80):null}:null;}));return {found:found.filter(r=>r.status==='fulfilled'&&r.value).map(r=>r.value),checked:urls};}
// Where a missing node type comes from, so the setup panel can link straight to it. Anything not
// listed is a core node: the fix is updating ComfyUI.
export const NODE_SOURCES=[
 [/^H3CharacterSwap/,'h3_character_swap node pack (patched for Openjutsu)','https://github.com/akatz-labs/h3-character-swap-tool/tree/0670e4fdf95adf2262caa4b81afed2a9c4ae4b7b/worker_nodes/h3_character_swap'],
 [/^MiniMaxH3Loop|^H3Loop/,'ComfyUI-MiniMaxH3-Loop','https://github.com/pxl-pshr/ComfyUI-MiniMaxH3-Loop'],
 [/^VHS_/,'ComfyUI-VideoHelperSuite','https://github.com/Kosinkadink/ComfyUI-VideoHelperSuite'],
 [/VFI$|^RIFE|^FILM/,'ComfyUI-Frame-Interpolation','https://github.com/Fannovel16/ComfyUI-Frame-Interpolation'],
 [/^ADE_|AnimateDiff/,'ComfyUI-AnimateDiff-Evolved','https://github.com/Kosinkadink/ComfyUI-AnimateDiff-Evolved'],
 [/^IPAdapter/,'ComfyUI_IPAdapter_plus','https://github.com/cubiq/ComfyUI_IPAdapter_plus']];
export function nodeSource(type){const hit=NODE_SOURCES.find(([re])=>re.test(type));return hit?{type,pack:hit[1],url:hit[2]}:{type,pack:'ComfyUI core',url:'https://docs.comfy.org/installation/update_comfyui',update:true};}
export function inspectRequirements(packet,info=null){
 const options=new Set();
 for(const node of Object.values(info??{}))for(const group of Object.values(node.input??{}))for(const field of Object.values(group??{})){const choices=Array.isArray(field?.[0])?field[0]:field?.[1]?.options;if(Array.isArray(choices))for(const option of choices)if(typeof option==='string')options.add(basename(option));}
 const models=(packet.models??[]).map(model=>({...model,state:packet.processor?model.state??'unknown':info===null?'unknown':options.has(model.name)?'available':'missing'}));
 const groups=new Set((packet.graph?.definitions?.subgraphs??[]).map(g=>g.id));
 const graphNodes=Array.isArray(packet.graph?.nodes)?[...packet.graph.nodes,...(packet.graph.definitions?.subgraphs??[]).flatMap(g=>g.nodes??[])]:Object.values(packet.graph??{});
 const missingNodes=info===null?[]:[...new Set(graphNodes.map(n=>n.type??n.class_type).filter(type=>type&&!groups.has(type)&&!['Note','MarkdownNote','Reroute','PrimitiveNode'].includes(type)&&!info[type]))];
 const unresolved=packet.missingDownloads??[];
 return {models,missingNodes,nodeSources:missingNodes.map(nodeSource),unresolved,ready:packet.execution==='local'&&info!==null&&!missingNodes.length&&!unresolved.length&&models.every(m=>m.state==='available'),verification:'Model names advertised by ComfyUI; file hashes, memory fit and visual quality are checked separately.'};
}
export async function setupReport({root,comfy,workflow='wan-i2v',packet,studioMedia}){
 packet??=await workflowPacket(root,workflow);
 let info=null,connected=false;
 try{info=await comfy.json('/object_info');connected=true;}catch{}
 return {workflow:packet.id,name:packet.name,execution:packet.execution,engineUrl:comfy.url,connected,cloudUrl:packet.cloudUrl??SETUP_LINKS.cloud,guide:packet.guide,requirements:packet.requirements,studioMedia,links:SETUP_LINKS,...inspectRequirements(packet,info),catalog:WORKFLOWS.map(({id,name,execution})=>({id,name,execution}))};
}
