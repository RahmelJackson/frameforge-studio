import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import path from 'node:path';
const activeStates=['processing','uploading','submitting','submitted','running','cancelling','verifying'];
export class BatchQueue{
  constructor(directory,{getJobs,submit}){this.file=path.join(directory,'batches.json');this.batches=[];this.pending=Promise.resolve();this.lock=false;this.getJobs=getJobs;this.submit=submit;}
  async open(){try{this.batches=JSON.parse(await readFile(this.file,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}return this;}
  list(){return structuredClone(this.batches);}
  mutate(action){const op=this.pending.catch(()=>{}).then(async()=>{const draft=structuredClone(this.batches),result=action(draft);await mkdir(path.dirname(this.file),{recursive:true});await writeFile(this.file+'.tmp',JSON.stringify(draft,null,2));await rename(this.file+'.tmp',this.file);this.batches=draft;return structuredClone(result);});this.pending=op;return op;}
  add(requests,requestId){return this.mutate(all=>{
    const existing=all.find(b=>b.requestId===requestId);if(existing)return existing;
    if(!/^[a-f0-9-]{36}$/.test(requestId??''))throw new Error('A batch request ID is required.');
    if(!Array.isArray(requests)||requests.length<1||requests.length>4)throw new Error('A batch supports 1–4 shots.');
    if(all.some(b=>b.status==='running'))throw new Error('Finish or stop the current batch first.');
    const batch={id:randomUUID(),requestId,createdAt:new Date().toISOString(),deadline:Date.now()+30*60*1000,status:'running',items:requests.map(request=>({id:randomUUID(),requestId:randomUUID(),request,status:'waiting'}))};all.unshift(batch);return batch;
  });}
  stop(id){return this.mutate(all=>{const b=all.find(b=>b.id===id);if(!b)throw new Error('Batch not found.');b.status='stopped';b.items.filter(i=>i.status==='waiting').forEach(i=>i.status='cancelled');return b;});}
  async update(id,action){return this.mutate(all=>{const b=all.find(b=>b.id===id);action(b);return b;});}
  async tick(){
    if(this.lock)return;this.lock=true;
    try{
      for(const snapshot of this.list().filter(b=>['running','stopped'].includes(b.status))){
        const jobs=this.getJobs(),item=snapshot.items.find(i=>['waiting','dispatching','active'].includes(i.status));if(!item){if(snapshot.status==='running')await this.update(snapshot.id,b=>b.status='completed');continue;}
        const job=jobs.find(j=>j.requestId===item.requestId);
        if(job){await this.update(snapshot.id,b=>{const i=b.items.find(i=>i.id===item.id);i.jobId=job.id;if(activeStates.includes(job.status)){i.status='active';return;}if(job.report?.technicalPass){i.status='completed';return;}i.status='failed';i.error=job.error??'The take needs attention.';if(b.status==='running')b.status='paused';});continue;}
        if(item.status!=='waiting'){await this.update(snapshot.id,b=>{b.status='paused';b.error='A dispatch has no saved job. Inspect before submitting a new batch; automatic retry is disabled.';});continue;}
        if(snapshot.status!=='running')continue;
        if(Date.now()>snapshot.deadline){await this.update(snapshot.id,b=>{b.status='paused';b.error='The 30-minute dispatch budget expired. Remaining shots were not submitted.';});continue;}
        if(jobs.some(j=>activeStates.includes(j.status)))continue;
        // Save dispatch intent first. A crash here is ambiguous, never a reason to repeat blindly.
        const claimed=await this.mutate(all=>{const b=all.find(b=>b.id===snapshot.id),i=b.items.find(i=>i.id===item.id);if(b.status!=='running'||i.status!=='waiting')return false;i.status='dispatching';return true;});
        if(!claimed)continue;
        try{
          const response=await this.submit({...item.request,quality:item.request.kind==='image'?(item.request.quality??'preview'):item.request.steps===12?'draft':'standard',requestId:item.requestId});
          await this.update(snapshot.id,b=>{const i=b.items.find(i=>i.id===item.id);if(response.code===409){i.status=b.status==='running'?'waiting':'cancelled';return;}const j=response.body?.job??response.body;if(j?.id){i.jobId=j.id;i.status='active';}else{b.status='paused';b.error=response.body?.error??'Submission needs inspection.';}});
        }catch(error){await this.update(snapshot.id,b=>{b.status='paused';b.error='Submission could not be confirmed: '+error.message;});}
        return;
      }
    }finally{this.lock=false;}
  }
}
