import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url))),directory=path.join(root,'evidence/keyframe-acceptance-v1');await mkdir(directory,{recursive:true});
const statePath=path.join(directory,'state.json'),base='http://127.0.0.1:4317';
const call=async(route,body)=>{const r=await fetch(base+route,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{});const j=await r.json();if(!r.ok)throw new Error(j.error);return j;};
let state;try{state=JSON.parse(await readFile(statePath,'utf8'));if(!process.argv.includes('--resume'))throw new Error('Evidence exists; use --resume.');}catch(e){if(e.code!=='ENOENT')throw e;}
if(!state){const first=JSON.parse(await readFile(path.join(root,'data/jobs/4a51aef6-65ee-4d2a-a5b4-710c3a2340cb/job.json'),'utf8'));state={initialJobId:first.id,initialFinding:'Endpoints resemble references, but the middle introduces an unwanted bird.',request:{...first.request,requestId:randomUUID(),aspect:'square',length:'standard',quality:'standard',prompt:'Only flowers and blue sky fill the frame. The closed pink flower buds smoothly transform into fully open pastel blossoms, matching the ending image. Continuous gentle time-lapse transition, static camera, fixed stems and a steady blue sky background.'},creativeReview:'pending'};await writeFile(statePath,JSON.stringify(state,null,2));}
let job=(await call('/api/jobs')).find(j=>j.requestId===state.request.requestId);if(!job)job=await call('/api/jobs',state.request);
state.jobId=job.id;await writeFile(statePath,JSON.stringify(state,null,2));console.log('Monitoring '+job.id);const started=Date.now();
while(['uploading','submitting','submitted','running','verifying'].includes(job.status)){if(Date.now()-started>10*60*1000)throw new Error('Monitor limit reached; resume this job.');await new Promise(r=>setTimeout(r,2500));job=(await call('/api/jobs')).find(j=>j.id===state.jobId);}
state.status=job.status;state.report=job.report;state.error=job.error;await writeFile(statePath,JSON.stringify(state,null,2));console.log(JSON.stringify({jobId:job.id,status:job.status,technicalPass:job.report?.technicalPass}));
