import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url))),directory=path.join(root,'evidence/look-acceptance-v1');await mkdir(directory,{recursive:true});
const statePath=path.join(directory,'state.json'),base='http://127.0.0.1:4317';
const call=async(route,body)=>{const r=await fetch(base+route,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(60000)}:{});const result=await r.json();if(!r.ok)throw new Error(JSON.stringify(result));return result;};
let state;try{state=JSON.parse(await readFile(statePath,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
if(state&&!process.argv.includes('--resume'))throw new Error('Evidence exists; use --resume.');
if(!state){state={started:new Date().toISOString(),cases:[
  {name:'natural',look:{style:'natural',lighting:'soft',palette:'original',lens:'wide',depth:'deep'}},
  {name:'noir',look:{style:'noir',lighting:'original',palette:'original',lens:'wide',depth:'deep'}},
  {name:'warm-portrait',look:{style:'natural',lighting:'golden',palette:'warm',lens:'portrait',depth:'shallow'}}
].map(c=>({...c,requestId:randomUUID()})),creativeReview:'pending'};}
const save=()=>writeFile(statePath,JSON.stringify(state,null,2));await save();const started=Date.now();
for(const item of state.cases){
  let job=(await call('/api/jobs')).find(j=>j.requestId===item.requestId);
  if(!job){job=await call('/api/jobs',{...item,mode:'text',engine:'wan5b',preset:'locked',aspect:'landscape',length:'preview',quality:'draft',seed:80421,prompt:'A woman wearing a red coat holds a brass compass in a quiet stone observatory. Tall arched windows and a blue telescope are visible behind her. She looks at the compass, breathing gently. One continuous shot.'});}
  item.jobId=job.id;await save();
  while(['uploading','submitting','submitted','running','verifying'].includes(job.status)){
    if(Date.now()-started>10*60*1000)throw new Error('Bounded monitor expired; resume without duplicating.');
    await new Promise(r=>setTimeout(r,2500));job=(await call('/api/jobs')).find(j=>j.id===item.jobId);
  }
  item.status=job.status;item.report=job.report;item.error=job.error;item.elapsedSeconds=(Date.parse(job.updatedAt)-Date.parse(job.createdAt))/1000;await save();console.log(JSON.stringify({name:item.name,jobId:job.id,status:job.status,pass:job.report?.technicalPass}));
  if(!job.report?.technicalPass)throw new Error('Render failed; preserve evidence and inspect.');
}
state.completed=new Date().toISOString();await save();
