import {access,statfs} from 'node:fs/promises';
import {constants} from 'node:fs';
import path from 'node:path';
import {mediaRuntime,setupReport} from './studio-setup.mjs';

export async function engineConnection(comfy){
 try{const response=await comfy.request('/system_stats',{signal:AbortSignal.timeout(1500)}),stats=await response.json();return {connected:Array.isArray(stats.devices)&&!!stats.system};}
 catch{return {connected:false};}
}
// Folders that commonly break local installs on Windows: synced, very long or non-ASCII paths.
export function folderWarnings(root,platform=process.platform){const w=[];if(/onedrive|dropbox|google drive|icloud/i.test(root))w.push('It is inside a synced folder; syncing can lock files mid-render. Move it to a local folder such as C:\\Frameforge.');if(platform==='win32'&&root.length>110)w.push('The path is very long ('+root.length+' characters); some Python packages fail past Windows path limits. Use a short folder such as C:\\Frameforge.');if(/[^\x00-\x7f]/.test(root))w.push('The path has non-English characters, which some model tools cannot read. Use a plain folder name.');return w;}
// The small local language model that writes shot lists and narration (optional).
export async function writerModel(fetcher=fetch){try{const {listAssistantModels}=await import('./assistant-connection.mjs');const {pickWriterModel}=await import('./shot-writer.mjs');const list=await listAssistantModels(fetcher,{provider:'ollama'});return {connected:list.connected,model:list.connected?pickWriterModel(list.models):null};}catch{return {connected:false,model:null};}}
export async function setupDoctor({root,python,comfy,workflow,mode='browse',checkMedia=mediaRuntime,checkEngine=engineConnection,checkWriter=writerModel}={}){
 if(!['browse','local','online'].includes(mode))throw Error('Choose browse, local or online setup.');
 const checks=[],add=(id,label,state,detail,href)=>checks.push({id,label,state,detail,...(href?{href}:{})});
 add('node','Studio runtime',Number(process.versions.node.split('.')[0])>=22?'ready':'missing','Node.js '+process.versions.node+'. Node 22 or newer is required.','https://nodejs.org/download');
 try{await access(root,constants.W_OK);add('folder','Studio folder','ready','The extracted Studio folder is writable.');}catch{add('folder','Studio folder','missing','Extract the whole ZIP into a folder you can write to, outside protected application folders.','/welcome');}
 try{let disk;try{disk=await statfs(path.join(root,'runtime'));}catch{disk=await statfs(root);}const free=Number(disk.bavail)*Number(disk.bsize);add('space','Runtime storage',free>=1024**3?'ready':'optional',(free/1024**3).toFixed(1)+' GiB free on the runtime drive. Model downloads check their own destination and required size.','/setup#workflow-models');}catch{add('space','Runtime storage','optional','Disk space could not be checked. Review the drive before downloading large models.','/setup#workflow-models');}
 const warnings=folderWarnings(root);if(warnings.length)add('path','Install location','optional',warnings.join(' '));
 const [engine,media,writer]=await Promise.all([checkEngine(comfy),checkMedia(python),checkWriter()]);
 add('writer','Shot writer (local language model)',writer.model?'ready':'optional',writer.model?writer.model+' writes shot lists, narration and stock keywords for Produce. It runs on the CPU and unloads after each use.':writer.connected?'Ollama is running but has no small chat model. Run: ollama pull gemma3:4b. Produce still works with built-in rules.':'Optional. Install Ollama from https://ollama.com/download, then run: ollama pull gemma3:4b. Produce still works with built-in rules.');
 add('engine','Local ComfyUI',engine.connected?'ready':mode==='local'?'missing':'optional',engine.connected?'Connected. Each workflow still checks its own model files and node types.':'Start ComfyUI and connect its local address. It is optional for browsing and external online handoffs.','/setup#local-install');
 add('media','Media uploads and checks',media.available?'ready':'optional',media.available?'CPU helpers are ready for Studio uploads, previews and export checks.':'Only needed for media uploads and checks inside Studio. Install the isolated media profile; it keeps ComfyUI’s Python unchanged.','/welcome#media-tools');
 let selected;
 if(workflow){const report=await setupReport({root,comfy,workflow});selected={id:report.workflow,name:report.name,execution:report.execution,ready:report.ready,missingModels:report.models.filter(model=>model.state!=='available').map(model=>model.name),missingNodes:report.missingNodes,unresolved:report.unresolved};
  if(report.execution==='partner')add('workflow',report.name,'optional','This workflow runs in your provider account. Review the model, required inputs and cost there; no provider account was contacted.','/library?collection=workflows&workflow='+encodeURIComponent(workflow));
  else add('workflow',report.name,report.ready?'ready':mode==='local'?'missing':'optional',report.ready?'Required model names and node types are advertised by ComfyUI. Hashes, hardware fit and creative quality are checked separately.':'Check this workflow’s missing files and node sources. Nothing was downloaded.','/setup?workflow='+encodeURIComponent(workflow)+'#workflow-models');
 }
 return {mode,checks,selected,blocking:checks.filter(check=>check.state==='missing').length,optional:checks.filter(check=>check.state==='optional').length,canBrowse:true,actions:'Checks only. No installs, downloads, generation, settings changes or provider sign-ins.'};
}
