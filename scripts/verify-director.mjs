import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
const aligned=process.argv.includes('--aligned');
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url))),directory=path.join(root,'evidence',aligned?'director-aligned':'director'),stateFile=path.join(directory,'state.json'),base='http://127.0.0.1:4317';
const api=async(route,method='GET',body)=>{const response=await fetch(base+route,{method,...(body?{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(120000)}),value=await response.json();if(!response.ok)throw Error(value.error??'Request failed.');return value;};
await mkdir(directory,{recursive:true});
let state;try{state=JSON.parse(await readFile(stateFile,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
if(!state){
  if(!process.argv.includes('--render'))throw Error('Use --render for the one bounded preview; subsequent checks use --resume.');
  const jobs=await api('/api/jobs');if(jobs.some(j=>['processing','uploading','submitting','submitted','running','cancelling','verifying'].includes(j.status)))throw Error('Wait for existing work before this bounded preview.');
  const baseline=jobs.find(j=>j.id==='624a2af2-97e1-4193-93c1-d57c6f2362cd');if(!baseline?.report?.technicalPass)throw Error('Retained baseline is unavailable.');
  const input={name:'Camera prompt comparison · cathedral',aspect:'landscape',bible:{scene:'A luminous stone cathedral',character:'A white and gold armored knight; retain the same helmet and armor',location:'Tall straight columns and stained-glass windows',prop:'',style:'Natural cinematic detail',lighting:'Steady soft sunbeams and floating dust'},shots:[{id:randomUUID(),title:'Rightward cathedral reveal',action:'The knight remains standing and breathes subtly.',start:'The original cathedral composition.',end:'The columns remain upright and the horizon stays level; the knight remains visible.',notes:'Compare background displacement, scale, roll and armor geometry with retained baseline 624a2af2. Keep visual approval pending.',recipe:'pan-right',pace:'steady',length:'preview',screenDirection:'neutral',asset:baseline.request.asset,seed:baseline.request.seed,cameraMirror:true}]};
  if(aligned){input.name='Aligned camera direction · cathedral';input.shots[0].recipe='track-right';input.shots[0].title='Sideways tracking reveal';input.shots[0].notes='Align the text with the native lateral translation. Compare roll, scale and geometry with baseline; keep creative approval pending.';}
  const plan=await api('/api/director','POST',input),prepared=await api(`/api/director/${plan.id}/shots/${plan.shots[0].id}/prepare`);
  state={createdAt:new Date().toISOString(),planId:plan.id,shotId:plan.shots[0].id,baselineId:baseline.id,requestId:randomUUID(),request:prepared.request};
  // Persist before submission so a lost acknowledgment cannot trigger an automatic duplicate.
  await writeFile(stateFile,JSON.stringify(state,null,2));
  const job=await api('/api/jobs','POST',{...state.request,requestId:state.requestId});state.jobId=job.id;await writeFile(stateFile,JSON.stringify(state,null,2));console.log(JSON.stringify({planId:state.planId,jobId:state.jobId,status:job.status}));
}else if(!process.argv.includes('--resume'))throw Error('A preview is already recorded. Use --resume.');
if(!state.jobId){const job=(await api('/api/jobs')).find(j=>j.requestId===state.requestId);if(!job)throw Error('Submission acknowledgment is ambiguous. Inspect engine history; do not resubmit automatically.');state.jobId=job.id;await writeFile(stateFile,JSON.stringify(state,null,2));}
const deadline=Date.now()+10*60*1000;let job;
while(Date.now()<deadline){job=(await api('/api/jobs')).find(j=>j.id===state.jobId);if(!job)throw Error('Recorded preview is missing.');if(['review-ready','technical-failed','failed','cancelled','needs-attention','verification-blocked'].includes(job.status))break;await new Promise(resolve=>setTimeout(resolve,2000));}
if(!job?.report?.technicalPass)throw Error(job?.error??`Preview remains ${job?.status}; resume this saved request later.`);
let plan=await api(`/api/director/${state.planId}`);if(plan.selections[state.shotId]!==job.id)await api(`/api/director/${state.planId}/shots/${state.shotId}/select`,'POST',{revision:plan.revision,jobId:job.id});
const result={...state,job,technicalPass:true,creativeAcceptance:'Pending playback and comparison. No automatic creative approval.',planUrl:`${base}/director?plan=${state.planId}`,baselineUrl:`${base}/outputs/${state.baselineId}/output.mp4`,candidateUrl:`${base}/outputs/${state.jobId}/output.mp4`};
await writeFile(path.join(directory,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({planId:state.planId,jobId:job.id,status:job.status,size:job.report.size,duration:job.report.duration,technicalPass:true,creativeAcceptance:result.creativeAcceptance},null,2));
