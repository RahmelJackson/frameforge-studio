import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const standalone=process.argv.includes('--standalone');
const camera=process.argv.includes('--camera')||standalone;
const directory=path.join(root,'evidence',standalone?'standalone-acceptance':camera?'camera-acceptance-v1':'acceptance-v1');
await mkdir(directory,{recursive:true});
const statePath=path.join(directory,'state.json');
const base=process.env.STUDIO_URL??'http://127.0.0.1:4317';
const flags=new Set(process.argv.slice(2));
if(!flags.has('--render')&&!flags.has('--resume'))throw new Error('Use --render for the bounded seven-shot suite, or --resume to inspect/continue its saved requests.');
const request=async(route,options)=>{const r=await fetch(base+route,{...options,signal:AbortSignal.timeout(60000)});const j=await r.json();if(!r.ok)throw new Error(j.error??r.statusText);return j;};
let state;
try{state=JSON.parse(await readFile(statePath,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
if(state&&flags.has('--render')&&!flags.has('--resume'))throw new Error('Suite already exists. Use --resume; no duplicate suite was submitted.');
if(!state&&flags.has('--resume'))throw new Error('No saved suite exists.');
const save=()=>writeFile(statePath,JSON.stringify(state,null,2));
if(!state){
  const image=await readFile(path.join(root,camera?'evidence/camera-reference.jpg':'public/sample.jpg'));
  const asset=await request('/api/assets',{method:'POST',body:image});
  state={started:new Date().toISOString(),asset:asset.name,reference:camera?'Official Comfy Org Fun Camera workflow reference':'Official Comfy Org sample: knight and cathedral geometry',creativeReview:'pending',cases:(camera?[
    ['locked','landscape','preview','draft','Zoom In'],['locked','landscape','preview','draft','Zoom Out'],['locked','landscape','preview','draft','Pan Right'],
  ]:[
    ['push-in','landscape','preview','draft'],['pull-back','landscape','preview','draft'],
    ['orbit','square','standard','draft'],['pan','landscape','extended','draft'],
    ['locked','landscape','preview','draft'],['handheld','portrait','preview','draft'],
    ['locked','landscape','preview','standard'],
  ]).map(([preset,aspect,length,quality,cameraPose])=>({requestId:randomUUID(),preset,aspect,length,quality,...(camera?{engine:'camera',cameraPose,cameraSpeed:1}:{})}))};
  if(camera){const second=await request('/api/assets',{method:'POST',body:await readFile(path.join(root,'public/sample.jpg'))});state.secondAsset=second.name;}
  if(standalone)state.cases=[
    {requestId:randomUUID(),preset:'locked',aspect:'landscape',length:'preview',quality:'draft',engine:'wan5b'},
    {requestId:randomUUID(),preset:'locked',aspect:'landscape',length:'preview',quality:'draft',engine:'camera',cameraPose:'Zoom In',cameraSpeed:1},
  ];
  await save();
}
const started=Date.now();
for(const item of state.cases){
  let job=(await request('/api/jobs')).find(j=>j.requestId===item.requestId);
  if(!job){
    if(Date.now()-started>20*60*1000)throw new Error('Suite monitor budget reached. Resume later; existing jobs are not duplicated.');
    const alternate=camera&&item.cameraPose==='Pan Right';
    job=await request('/api/jobs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...item,asset:alternate?state.secondAsset:state.asset,seed:71226,prompt:camera&&!alternate?'A cinematic lunar landscape with a research base, rovers and a giant planet. Preserve the towers, structures and landscape geometry. Subtle environmental movement. One continuous shot.':'A white and gold armored knight stands in a cathedral. Preserve the identity, armor details, straight architectural lines and scene geometry. Subtle breathing, floating dust and natural light. One continuous shot.'})});
  }
  item.jobId=job.id;await save();let last;
  while(['uploading','submitting','submitted','running','verifying','cancelling'].includes(job.status)){
    if(job.status!==last){console.log(`${item.preset}/${item.aspect}/${item.length}/${item.quality}: ${job.status} (${job.id})`);last=job.status;}
    if(Date.now()-started>20*60*1000)throw new Error('Suite monitor budget reached. Resume the same suite.');
    await new Promise(r=>setTimeout(r,2500));job=(await request('/api/jobs')).find(j=>j.id===item.jobId);
    if(!job)throw new Error('Saved job disappeared; inspect before retrying.');
  }
  item.status=job.status;item.technicalPass=job.report?.technicalPass??false;item.report=job.report;item.error=job.error;
  item.elapsedSeconds=(Date.parse(job.updatedAt)-Date.parse(job.createdAt))/1000;
  await save();
  if(!item.technicalPass)throw new Error(`Case failed: ${item.jobId}. Saved evidence preserved; no automatic retry.`);
}
state.completed=new Date().toISOString();state.technicalPass=state.cases.every(x=>x.technicalPass);await save();
console.log(JSON.stringify({technicalPass:state.technicalPass,cases:state.cases.length,creativeReview:'pending',evidence:statePath},null,2));
