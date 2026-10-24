import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {randomUUID,createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url))),directory=path.join(root,'evidence'),base=process.env.STUDIO_URL??'http://127.0.0.1:4317',flags=new Set(process.argv.slice(2));
await mkdir(directory,{recursive:true});
const file=path.join(directory,'image-state.json'),report={at:new Date().toISOString(),creativeReview:'pending',gates:[]};
async function request(route,input){const response=await fetch(base+route,{...(input?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)}:{}),signal:AbortSignal.timeout(90000)}),body=await response.json();if(!response.ok)throw new Error(body.error??'Studio request failed');return body;}
try{
  const health=await request('/api/health');for(const tool of ['create','edit','inpaint','upscale']){const value=health.images?.[tool];report.gates.push({name:tool+' readiness',pass:!!value?.ready,details:value});}if(report.gates.some(g=>!g.pass))throw new Error('An image workflow is not ready.');
  let state;try{state=JSON.parse(await readFile(file,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
  if(flags.has('--render')){
    if(state)throw new Error('An image benchmark already exists. Use --resume; preserve it before deliberately creating another.');
    state={requestId:randomUUID(),createdAt:new Date().toISOString()};await writeFile(file,JSON.stringify(state,null,2));
    const job=await request('/api/jobs',{kind:'image',tool:'create',prompt:'A single brass compass with an emerald green dial resting on a dark walnut table beside a window, warm morning sunlight from the left, realistic product photograph, no text, no people.',aspect:'square',seed:73126,requestId:state.requestId});state.jobId=job.id;await writeFile(file,JSON.stringify(state,null,2));
  }
  if(flags.has('--resume')&&!state)throw new Error('No saved benchmark exists. --render deliberately creates one.');
  if(state){
    const deadline=Date.now()+20*60*1000;let previous='';
    while(true){const job=(await request('/api/jobs')).find(j=>j.requestId===state.requestId);if(!job)throw new Error('Saved dispatch has no acknowledged job. Inspect it; no replacement was submitted.');
      if(previous!==job.status){console.log(job.id+': '+job.status);previous=job.status;}
      report.jobId=job.id;
      if(job.report){report.gates.push({name:'Saved image artifact',pass:!!job.report.technicalPass,details:job.report});report.artifact=base+`/outputs/${job.id}/${job.image}`;if(!job.report.technicalPass)throw new Error('Image artifact checks failed.');const response=await fetch(report.artifact,{signal:AbortSignal.timeout(30000)});if(!response.ok)throw new Error('Saved PNG is unavailable.');const checksum=createHash('sha256').update(Buffer.from(await response.arrayBuffer())).digest('hex');report.gates.push({name:'Served PNG checksum',pass:checksum===job.report.sha256});if(checksum!==job.report.sha256)throw new Error('Saved PNG differs from its verification evidence.');break;}
      if(['needs-attention','failed','cancelled','technical-failed','verification-blocked'].includes(job.status))throw new Error(job.error??job.status);
      if(!flags.has('--resume')&&!flags.has('--render'))throw new Error('Benchmark is still active. Use --resume to monitor the original job.');
      if(Date.now()>deadline)throw new Error('Monitoring budget expired. The original render may continue; resume without resubmitting.');
      await new Promise(resolve=>setTimeout(resolve,4000));
    }
  }
  report.status=state?'technical-pass':'readiness-pass';
}catch(error){report.status='needs-attention';report.error=error.message;process.exitCode=1;}
await writeFile(path.join(directory,'image-latest-run.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
