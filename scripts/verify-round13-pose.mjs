import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';import {fileURLToPath} from 'node:url';import {randomUUID} from 'node:crypto';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url))),dir=path.join(root,'evidence/round13-pose'),file=path.join(dir,'state.json'),base='http://127.0.0.1:4317';
const api=async(route,body)=>{const r=await fetch(base+route,{...(body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(120000)}),v=await r.json();if(!r.ok)throw Error(JSON.stringify(v));return v;};
await mkdir(dir,{recursive:true});let state;try{state=JSON.parse(await readFile(file,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
if(!state){if(!process.argv.includes('--render'))throw Error('Use --render once, --resume after.');
 const jobs=await api('/api/jobs');if(jobs.some(j=>['processing','uploading','submitting','submitted','running','cancelling','verifying'].includes(j.status)))throw Error('App work is active.');
 const targetJob=jobs.find(j=>j.id==='78fa11a1-b0ab-4b0a-a5ac-b8eff2e36a9b');if(!targetJob?.report?.technicalPass)throw Error('Target fixture unavailable.');
 const target=await api(`/api/jobs/${targetJob.id}/image-asset`,{});
 state={at:new Date().toISOString(),requestId:randomUUID(),targetJobId:targetJob.id,targetSha256:targetJob.report.sha256,targetScope:'Previously generated standing proposal; used for measurable 2D proportions, not evidence of true identity.',baselineId:'4991eb06-0966-41cd-a4f6-d1dcce36df32',request:{kind:'video-tool',tool:'pose-guide',footage:'8bfd6deb-7cd2-4a08-a94f-cef8c107d86a',start:0,end:2.3125,poseFraming:'upper',poseTarget:target.name,seed:202610406}};
 await writeFile(file,JSON.stringify(state,null,2));const job=await api('/api/jobs',{...state.request,requestId:state.requestId});state.jobId=job.id;await writeFile(file,JSON.stringify(state,null,2));
}else if(!process.argv.includes('--resume'))throw Error('Already recorded; resume existing case.');
if(!state.jobId){const j=(await api('/api/jobs')).find(j=>j.requestId===state.requestId);if(!j)throw Error('Ambiguous acknowledgment; inspect before any retry.');state.jobId=j.id;await writeFile(file,JSON.stringify(state,null,2));}
const deadline=Date.now()+120000;let last;
while(Date.now()<deadline){const job=(await api('/api/jobs')).find(j=>j.id===state.jobId);if(job.status!==last){last=job.status;console.log(JSON.stringify({jobId:job.id,status:last,error:job.error}));}if(['review-ready','technical-failed','failed','needs-attention'].includes(last)){await writeFile(path.join(dir,'result.json'),JSON.stringify({state,job},null,2));if(!job.report?.technicalPass)process.exitCode=1;break;}await new Promise(r=>setTimeout(r,1000));}
