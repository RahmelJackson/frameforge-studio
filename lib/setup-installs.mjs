import {spawn} from 'node:child_process';
import {randomUUID,createHash} from 'node:crypto';
import path from 'node:path';
export const installationId=root=>createHash('sha256').update(path.resolve(root)).digest('hex').slice(0,20);

export class SetupInstalls{
 constructor({root,onComplete=async()=>{},spawnProcess=spawn}){Object.assign(this,{root,onComplete,spawnProcess});this.jobs=[];this.running=false;}
 describe(){return {running:this.running,jobs:this.jobs.map(job=>({...job}))};}
 async start(input){
  if(!input||Object.keys(input).some(key=>!['profile','acceptDownload'].includes(key))||!['media','vision'].includes(input.profile)||input.acceptDownload!==true)throw Error('Choose media or vision and confirm the software download.');
  if(this.running)throw Error('Software setup is already running. Check its progress first.');
  const job={id:randomUUID(),profile:input.profile,status:'installing',log:'Preparing isolated CPU software…',startedAt:new Date().toISOString()};
  this.jobs.unshift(job);this.jobs=this.jobs.slice(0,5);this.running=true;
  let child;
  try{child=this.spawnProcess(process.execPath,[path.join(this.root,'scripts/setup-processor.mjs'),input.profile,'--managed','--install'],{cwd:this.root,windowsHide:true,stdio:['ignore','pipe','pipe']});}
  catch(error){this.running=false;job.status='failed';job.log=error.message;return this.describe();}
  const append=chunk=>job.log=(job.log+'\n'+String(chunk).replace(/\x1b\[[0-9;]*m/g,'')).slice(-6000);
  child.stdout.on('data',append);child.stderr.on('data',append);
  let finished=false;const finish=async(code,error)=>{if(finished)return;finished=true;job.status=code===0?'completed':'failed';if(error)append(error.message);if(code===0){try{await this.onComplete(input.profile);}catch(error){job.status='failed';append(error.message);}}job.finishedAt=new Date().toISOString();this.running=false;};
  child.once('error',error=>void finish(1,error));child.once('close',code=>void finish(code));
  return this.describe();
 }
}
