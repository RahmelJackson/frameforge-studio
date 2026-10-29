import path from 'node:path';
import {readFileSync} from 'node:fs';

export function workspaceConfig(root){
 try{return JSON.parse(readFileSync(path.join(root,'config.local.json'),'utf8').replace(/^\uFEFF/,''));}
 catch(error){if(error.code==='ENOENT')return {};throw error;}
}
export function configuredModelRoot(root,config=workspaceConfig(root)){
 const folder=config.modelRoot||process.env.FRAMEFORGE_MODEL_ROOT||(config.comfySource?path.join(config.comfySource,'models'):null);
 return folder?path.resolve(root,folder):null;
}
export function resolveSetupPaths(value,{root,modelRoot=configuredModelRoot(root)}={}){
 if(Array.isArray(value))return value.map(item=>resolveSetupPaths(item,{root,modelRoot}));
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,resolveSetupPaths(item,{root,modelRoot})]));
 if(typeof value!=='string')return value;
 if(/^models[\\/]/.test(value))return path.join(modelRoot||path.join(root,'models'),...value.slice(7).split(/[\\/]/));
 // Runtime entries retain their workspace-relative form for existing consumers.
 return value;
}
