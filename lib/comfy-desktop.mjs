// Finds ComfyUI Desktop's user folder (its own custom_nodes, separate from Frameforge's engine)
// and installs or updates the Frameforge plugin there, so it shows up in the Desktop app too.
import {readFile,stat,cp,mkdir,realpath,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
export function desktopConfigPaths(env=process.env,platform=process.platform,home=os.homedir()){
 if(platform==='win32')return [path.join(env.APPDATA??path.join(home,'AppData','Roaming'),'ComfyUI','config.json')];
 if(platform==='darwin')return [path.join(home,'Library','Application Support','ComfyUI','config.json')];
 return [path.join(env.XDG_CONFIG_HOME??path.join(home,'.config'),'ComfyUI','config.json')];
}
const exists=async(p,kind='isDirectory')=>{try{return (await stat(p))[kind]();}catch{return false;}};
async function digest(dir){const h=createHash('sha256');const walk=async d=>{for(const e of (await readdir(d,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){if(e.name==='__pycache__')continue;const p=path.join(d,e.name);if(e.isDirectory())await walk(p);else{h.update(path.relative(dir,p));h.update(await readFile(p));}}};await walk(dir);return h.digest('hex');}
export async function findDesktop({source,env,platform,home}={}){
 for(const file of desktopConfigPaths(env,platform,home)){
  let base;try{base=JSON.parse(await readFile(file,'utf8')).basePath;}catch{continue;}
  if(typeof base!=='string'||!path.isAbsolute(base)||!await exists(path.join(base,'custom_nodes')))continue;
  const plugin=path.join(base,'custom_nodes','comfyui-frameforge'),installed=await exists(plugin);
  const current=installed&&source?(await digest(plugin))===(await digest(source)):false;
  return {found:true,basePath:base,plugin,installed,current};
 }
 return {found:false};
}
export async function installDesktop({source,...where}={}){
 const desk=await findDesktop({source,...where});if(!desk.found)throw Error('ComfyUI Desktop was not found on this computer. Open it once, or download the plugin and unzip it into your ComfyUI custom_nodes folder.');
 const root=await realpath(path.join(desk.basePath,'custom_nodes'));await mkdir(desk.plugin,{recursive:true});
 const target=await realpath(desk.plugin);if(path.relative(root,target).startsWith('..'))throw Error('Unexpected plugin location.');
 await cp(source,target,{recursive:true,force:true});return {...await findDesktop({source,...where}),message:'Frameforge is installed in ComfyUI Desktop. Restart ComfyUI Desktop to load it.'};
}
