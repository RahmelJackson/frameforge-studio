import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url))),directory=path.join(root,'evidence/round13-camera'),file=path.join(directory,'state.json'),base='http://127.0.0.1:4317';
const api=async(route,body)=>{const res=await fetch(base+route,{...(body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(120000)}),value=await res.json();if(!res.ok)throw Error(JSON.stringify(value));return value;};
await mkdir(directory,{recursive:true});let state;
try{state=JSON.parse(await readFile(file,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
if(!state){
 if(!process.argv.includes('--render'))throw Error('Use --render once, then --resume.');
 const jobs=await api('/api/jobs');if(jobs.some(j=>['processing','uploading','submitting','submitted','running','cancelling','verifying'].includes(j.status)))throw Error('Existing render is active.');
 const original=jobs.find(j=>j.id==='00481537-dae4-43f3-8e19-cd02d30dc6a0');if(!original?.report?.technicalPass)throw Error('Same-prompt accelerated baseline is missing.');
 state={at:new Date().toISOString(),baselineId:original.id,baselineSha256:original.report.sha256,requestId:randomUUID(),request:{...original.request,cameraSampling:'full'},hypothesis:'Compare official 20-step CFG3.5 no-acceleration path against the same prompt, source, native pose, mirror, speed and seed. Goal: correct lateral movement with no worse scale drift or roll. Preserve original files; no automatic approval.'};
 await writeFile(file,JSON.stringify(state,null,2));const job=await api('/api/jobs',{...state.request,requestId:state.requestId});state.jobId=job.id;await writeFile(file,JSON.stringify(state,null,2));
}else if(!process.argv.includes('--resume'))throw Error('Existing case recorded; use --resume.');
if(!state.jobId){const job=(await api('/api/jobs')).find(j=>j.requestId===state.requestId);if(!job)throw Error('Ambiguous submission: inspect history before any rerun.');state.jobId=job.id;await writeFile(file,JSON.stringify(state,null,2));}
const deadline=Date.now()+20*60*1000;let last;
while(Date.now()<deadline){const job=(await api('/api/jobs')).find(j=>j.id===state.jobId);if(!job)throw Error('Recorded job missing.');if(job.status!==last){last=job.status;console.log(JSON.stringify({jobId:job.id,status:last,promptId:job.promptId,error:job.error}));}if(['review-ready','technical-failed','failed','cancelled','needs-attention','verification-blocked'].includes(last)){await writeFile(path.join(directory,'result.json'),JSON.stringify({state,job},null,2));if(!job.report?.technicalPass)process.exitCode=1;break;}await new Promise(resolve=>setTimeout(resolve,2000));}
