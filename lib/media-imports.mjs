import {mkdir,readFile,readdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
export async function recordComfyImport(data,kind,item,source){
 if(source!=='comfyui')return;
 const directory=path.join(data,'imports');await mkdir(directory,{recursive:true});
 const record={...item,kind,origin:'comfyui',importId:randomUUID(),createdAt:new Date().toISOString()};await writeFile(path.join(directory,record.importId+'.json'),JSON.stringify(record));return record;
}
export async function listMediaImports(data){
 const directory=path.join(data,'imports');let files;try{files=await readdir(directory);}catch(e){if(e.code==='ENOENT')return [];throw e;}
 const items=[];for(const file of files.filter(n=>/^[a-f0-9-]{36}\.json$/.test(n))){try{items.push(JSON.parse(await readFile(path.join(directory,file),'utf8')));}catch{}}
 return items.sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,200);
}
