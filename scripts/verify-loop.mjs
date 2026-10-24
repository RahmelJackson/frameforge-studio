import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const base=process.env.STUDIO_URL??'http://127.0.0.1:4317';
const evidence=path.join(root,'evidence');
await mkdir(evidence,{recursive:true});
const args=new Set(process.argv.slice(2));
const started=Date.now();
const report={started:new Date().toISOString(),gates:[],creativeReview:'pending'};
async function request(route,options){const response=await fetch(base+route,{...options,signal:AbortSignal.timeout(120000)});const data=await response.json();if(!response.ok)throw new Error(data.error??'Request failed');return data;}
async function finish(status,error){report.status=status;report.error=error;report.elapsedSeconds=(Date.now()-started)/1000;await writeFile(path.join(evidence,'latest-run.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));process.exitCode=status==='technical-pass'||status==='checks-pass'?0:1;}
try{
  const tests=(await readdir(path.join(root,'tests'))).filter(x=>x.endsWith('.test.mjs')).map(x=>path.join(root,'tests',x));
  const test=spawnSync(process.execPath,['--test',...tests],{cwd:root,encoding:'utf8',timeout:120000,windowsHide:true});
  await writeFile(path.join(evidence,'tests.txt'),(test.stdout??'')+(test.stderr??''));
  if(test.status!==0)throw new Error('Application regression tests failed. See evidence/tests.txt.');
  report.gates.push({name:'Application tests',pass:true});
  const health=await request('/api/health');
  if(health.videoTools){const ready=Object.values(health.videoTools).every(mode=>mode.ready);report.gates.push({name:'Video workflow readiness',pass:ready,details:health.videoTools});if(!ready)throw new Error('A video workflow needs its local models or nodes.');}
  if(health.images){const ready=Object.values(health.images).every(mode=>mode.ready);report.gates.push({name:'Image workflow readiness',pass:ready,details:health.images});if(!ready)throw new Error('An image workflow needs its local models or nodes.');}
  report.gates.push({name:'ComfyUI readiness',pass:health.ready,details:health});
  if(!health.ready)throw new Error('Engine or required models unavailable. Run the startup script; no render was submitted.');
  if(!args.has('--render')&&!args.has('--resume')){await finish('checks-pass');}
  else{
    let state;
    try{state=JSON.parse(await readFile(path.join(evidence,'live-state.json'),'utf8'));}catch{}
    if(args.has('--render')&&!args.has('--resume')&&state)throw new Error('An evidence run already exists. Use --resume to inspect it. Archive evidence/live-state.json deliberately before starting another generation.');
    if(args.has('--resume')&&!state)throw new Error('There is no previous verification run to resume.');
    if(!state){
      const image=await readFile(path.join(root,'public/sample.jpg'));
      const asset=await request('/api/assets',{method:'POST',headers:{'Content-Type':'image/jpeg'},body:image});
      state={requestId:randomUUID(),asset:asset.name};
      await writeFile(path.join(evidence,'live-state.json'),JSON.stringify(state,null,2));
    }
    let jobs=await request('/api/jobs');
    let job=jobs.find(j=>j.requestId===state.requestId);
    if(!job){
      job=await request('/api/jobs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({requestId:state.requestId,asset:state.asset,prompt:'A white and gold dragon-armored knight stands in a luminous cathedral. Subtle breathing and a slight natural turn of the head. Sunbeams and floating dust. Preserve the armor, helmet, and identity throughout the shot.',preset:'push-in',aspect:'landscape',length:'preview',quality:'draft',seed:20261016})});
    }
    state.jobId=job.id;report.jobId=job.id;
    await writeFile(path.join(evidence,'live-state.json'),JSON.stringify(state,null,2));
    let lastStatus='';
    while(Date.now()-started<30*60*1000){
      if(job.status!==lastStatus){console.log(`Shot ${job.id}: ${job.status}`);lastStatus=job.status;}
      if(job.status==='review-ready'){
        report.gates.push({name:'Rendered video',pass:!!job.report?.technicalPass,details:job.report});
        report.artifacts={video:`${base}/outputs/${job.id}/${job.video}`,frames:`${base}/outputs/${job.id}/contact-sheet.jpg`,workflow:`${base}/outputs/${job.id}/workflow.json`};
        await finish(job.report?.technicalPass?'technical-pass':'failed');break;
      }
      if(['failed','technical-failed','verification-blocked','needs-attention'].includes(job.status))throw new Error(`${job.status}: ${job.error??JSON.stringify(job.report)}`);
      await new Promise(resolve=>setTimeout(resolve,4000));
      jobs=await request('/api/jobs');job=jobs.find(j=>j.id===state.jobId);
      if(!job)throw new Error('Saved job is missing. No replacement job was submitted.');
    }
    if(!report.status)await finish('blocked','30-minute polling limit reached. The existing GPU job may still be running. Resume to inspect it; do not submit a duplicate.');
  }
}catch(e){await finish('blocked',e.message);}
