import path from 'node:path';
import {mkdir,open,stat,rename,realpath,statfs,writeFile} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
const hashFile=async file=>{const hash=createHash('sha256');for await(const chunk of createReadStream(file))hash.update(chunk);return hash.digest('hex');};
const contained=(root,file)=>{const rel=path.relative(root,file);if(!rel||rel==='..'||rel.startsWith('..'+path.sep)||path.isAbsolute(rel))throw Error('Model destination is outside its configured folder.');};
export class ModelDownloads{
 constructor({directory,roots,resolveModels,fetcher=fetch}){Object.assign(this,{directory,roots,resolveModels,fetcher});this.jobs=[];this.running=false;}
 async init(){await mkdir(this.directory,{recursive:true});return this;}
 describe(){return {roots:this.roots,jobs:this.jobs.map(({models,...j})=>j),running:this.running};}
 async enqueue({selection,acceptTerms=false}){
  if(acceptTerms!==true)throw Error('Review the model source terms, then confirm the download.');
  if(this.running)throw Error('A model download is already running. Check its progress first.');
  this.running=true;try{const models=await this.resolveModels(selection);if(!models.length)throw Error('No pinned downloadable files for this selection.');
  for(const m of models){if(!(/^https:\/\/huggingface\.co\/[^/]+\/[^/]+\/resolve\/[a-f0-9]{40}\//.test(m.url??'')||/^https:\/\/github\.com\/[^/]+\/[^/]+\/releases\/download\/(?!latest(?:\/|$))[^/]+\//.test(m.url??''))||!/^[a-f0-9]{64}$/.test(m.sha256??'')||!Number.isSafeInteger(m.bytes)||m.bytes<=0)throw Error('This file does not have a pinned size, checksum and source. Use its manual setup guide.');this.target(m);}
  const job={id:randomUUID(),status:'queued',selection,models,total:models.reduce((n,m)=>n+m.bytes,0),received:0,files:models.map(m=>({name:m.name,bytes:m.bytes,status:'queued'})),createdAt:new Date().toISOString()};
  this.jobs.unshift(job);this.running=true;void this.run(job).finally(()=>{this.running=false;});return this.describe();}catch(error){this.running=false;throw error;}
 }
 target(model){const destination=model.installPath??model.destination,namespace=model.installRoot??'models',root=this.roots[namespace];if(!root||typeof destination!=='string')throw Error('Configure the model storage folder first.');const relative=destination.replace(/^models\//,'');if(relative.includes('\\')||relative.split('/').some(p=>!p||p==='.'||p==='..'||p.includes(':')))throw Error('Invalid model destination.');const target=path.resolve(root,...relative.split('/'));contained(path.resolve(root),target);return {root:path.resolve(root),target};}
 async safeTarget(model){const {root,target}=this.target(model);await mkdir(root,{recursive:true});const canonicalRoot=await realpath(root);await mkdir(path.dirname(target),{recursive:true});const canonicalParent=await realpath(path.dirname(target));contained(canonicalRoot,path.join(canonicalParent,path.basename(target)));try{const existing=await realpath(target);contained(canonicalRoot,existing);}catch(e){if(e.code!=='ENOENT')throw e;}return target;}
 async run(job){
  job.status='downloading';
  try{for(const [i,m] of job.models.entries()){
   const state=job.files[i],target=await this.safeTarget(m);job.current=m.name;
   let current;try{current=await stat(target);}catch(e){if(e.code!=='ENOENT')throw e;}
   if(current){if(current.size===m.bytes&&await hashFile(target)===m.sha256){state.status='verified';job.received+=m.bytes;continue;}throw Error('An existing file differs from the pinned model: '+m.name+'. Keep it and inspect before replacing it.');}
   const part=target+'.frameforge-part';let offset=0;try{contained(await realpath(this.roots[m.installRoot??'models']),await realpath(part));offset=(await stat(part)).size;}catch(e){if(e.code!=='ENOENT')throw e;}
   if(offset>m.bytes)throw Error('Partial file is larger than the expected model.');
   const disk=await statfs(path.dirname(target));if(Number(disk.bavail)*Number(disk.bsize)<m.bytes-offset+512*1024**2)throw Error('Not enough free space for '+m.name+'.');
   if(offset<m.bytes){
    const response=await this.fetcher(m.url,{headers:offset?{Range:'bytes='+offset+'-'}:{},signal:AbortSignal.timeout(12*60*60*1000)});
    if(response.status===401||response.status===403)throw Error('This source needs browser sign-in or a model agreement. Use its download link, then check setup again.');
    if(!response.ok)throw Error('Download returned HTTP '+response.status+'. Retry to resume.');
    if(offset&&response.status!==206)throw Error('The source did not honor the resume request. Partial file retained.');
    if(response.status===206&&!String(response.headers.get('content-range')).startsWith('bytes '+offset+'-'))throw Error('Unexpected download range.');
    const handle=await open(part,offset?'a':'wx');state.status='downloading';job.received+=offset;
    try{for await(const chunk of response.body){if(offset+chunk.length>m.bytes)throw Error('Download exceeds the pinned size.');let done=0;while(done<chunk.length){const r=await handle.write(chunk,done,chunk.length-done);done+=r.bytesWritten;}offset+=chunk.length;job.received+=chunk.length;state.received=offset;}}finally{await handle.close();}
   }else job.received+=offset;
   state.status='checking';if((await stat(part)).size!==m.bytes||await hashFile(part)!==m.sha256)throw Error('Size or checksum mismatch for '+m.name+'. Partial file retained for inspection.');
   // A second installer must never silently overwrite a model placed during download.
   try{await stat(target);throw Error('A model appeared at the destination during download. Inspect it before replacing.');}catch(e){if(e.code!=='ENOENT')throw e;}
   await rename(part,target);state.status='verified';
  }job.status='completed';job.message='Verified files installed. Refresh ComfyUI model lists, then check setup again.';
  }catch(error){job.status='failed';job.error=error.message;}finally{job.updatedAt=new Date().toISOString();await writeFile(path.join(this.directory,job.id+'.json'),JSON.stringify(job,null,2));}
 }
}
