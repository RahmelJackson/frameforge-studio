import {spawn} from 'node:child_process';
import {mkdir,readFile,writeFile,open} from 'node:fs/promises';
import {installationId} from '../lib/setup-installs.mjs';
import net from 'node:net';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const defaultRoot=fileURLToPath(new URL('../',import.meta.url));
export {installationId};
const settings=async root=>{try{return JSON.parse((await readFile(path.join(root,'config.local.json'),'utf8')).replace(/^\uFEFF/,''));}catch(error){if(error.code==='ENOENT')return {};throw error;}};
async function probe(port){try{const response=await fetch('http://127.0.0.1:'+port+'/api/quickstart',{signal:AbortSignal.timeout(1500)});if(response.ok){const value=await response.json();if(value.app==='frameforge')return value;}}catch{}return null;}
const available=port=>new Promise(resolve=>{const socket=net.createServer();socket.once('error',()=>resolve(false));socket.listen(port,'127.0.0.1',()=>socket.close(()=>resolve(true)));});
export function openBrowser(url){const command=process.platform==='win32'?'rundll32.exe':process.platform==='darwin'?'open':'xdg-open',args=process.platform==='win32'?['url.dll,FileProtocolHandler',url]:[url];const child=spawn(command,args,{stdio:'ignore',detached:true,windowsHide:true});child.on('error',()=>console.log('Open this address in your browser: '+url));child.unref();}
export async function launchStudio({root=defaultRoot,port,openPage=true}={}){
 const config=await settings(root),preferred=Number(port??process.env.PORT??config.port??4317);
 if(!Number.isInteger(preferred)||preferred<1024||preferred>65515)throw Error('Choose a local port from 1024 to 65515.');
 let selected;
 for(let candidate=preferred;candidate<preferred+20;candidate++){
  const existing=await probe(candidate);
  if(existing){
   if(existing.installationId!==installationId(root))continue;
   // A manually restarted instance can have a new PID. Adopt only a server
   // identifying this exact installation, never another copy's workspace.
   await mkdir(path.join(root,'runtime'),{recursive:true});
   await writeFile(path.join(root,'runtime/launcher.json'),JSON.stringify({pid:existing.pid,port:candidate,installationId:existing.installationId},null,2));
   const url='http://127.0.0.1:'+candidate+(existing.quickstartComplete?'/':'/welcome');if(openPage)openBrowser(url);return {url,reused:true,pid:existing.pid,installationId:existing.installationId};
  }
  if(await available(candidate)){selected=candidate;break;}
  try{const response=await fetch('http://127.0.0.1:'+candidate+'/api/catalog',{signal:AbortSignal.timeout(1000)}),catalog=await response.json();if(catalog.images&&Array.isArray(catalog.presets))throw Error('An older Frameforge is already running on port '+candidate+'. Finish its jobs and restart that Studio before using the new launcher.');}catch(error){if(error.message.startsWith('An older Frameforge'))throw error;}
 }
 if(!selected)throw Error('No free local port was found. Close an older Studio or set PORT.');
 await mkdir(path.join(root,'runtime'),{recursive:true});
 const out=await open(path.join(root,'runtime/launcher.stdout.log'),'a'),err=await open(path.join(root,'runtime/launcher.stderr.log'),'a');
 let child;
 try{
  child=spawn(process.execPath,[path.join(root,'server.mjs')],{cwd:root,env:{...process.env,PORT:String(selected)},detached:true,windowsHide:true,stdio:['ignore',out.fd,err.fd]});
  await new Promise((resolve,reject)=>{child.once('spawn',resolve);child.once('error',reject);});child.unref();
 }finally{await out.close();await err.close();}
 for(let attempt=0;attempt<240;attempt++){
  if(attempt===40||attempt===120)console.log('Still starting. First-launch security checks can take a minute...');
  const status=await probe(selected);
  if(status?.installationId===installationId(root)){
   const latest=await settings(root);latest.port=selected;
   await writeFile(path.join(root,'config.local.json'),JSON.stringify(latest,null,2)+'\n');
   await writeFile(path.join(root,'runtime/launcher.json'),JSON.stringify({pid:child.pid,port:selected,installationId:status.installationId},null,2));
   const url='http://127.0.0.1:'+selected+(status.quickstartComplete?'/':'/welcome');if(openPage)openBrowser(url);
   return {url,reused:false,pid:child.pid,installationId:status.installationId};
  }
  await new Promise(resolve=>setTimeout(resolve,250));
 }
 throw Error('Studio did not become ready. Check runtime/launcher.stderr.log. No other process was stopped.');
}
export async function stopStudio({root=defaultRoot}={}){
 let record;try{record=JSON.parse(await readFile(path.join(root,'runtime/launcher.json'),'utf8'));}catch(error){if(error.code==='ENOENT')return {stopped:false,note:'This launcher has no Studio to stop.'};throw error;}
 const status=await probe(record.port);
 if(!status)return {stopped:false,note:'Studio is already stopped.'};
 if(status.installationId!==installationId(root)||status.pid!==record.pid||status.installationId!==record.installationId)throw Error('The running process belongs to a different installation. Nothing was stopped.');
 if(!status.canStop)throw Error('A generation or setup job is active. Wait for it to finish before stopping Studio.');
 process.kill(record.pid);return {stopped:true,note:'Frameforge stopped. ComfyUI and models are unchanged.'};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{const value=process.argv.includes('--stop')?await stopStudio():await launchStudio({openPage:!process.argv.includes('--no-browser')});console.log(value.url?'Frameforge is ready: '+value.url:value.note);}
 catch(error){console.error(error.message);process.exitCode=1;}
}
