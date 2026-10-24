import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {randomUUID,createHash} from 'node:crypto';
const root=new URL('../',import.meta.url),directory=new URL('evidence/acceptance-round7/',root),base='http://127.0.0.1:4317';
await mkdir(directory,{recursive:true});
let state={started:new Date().toISOString(),budget:{video:18,audio:10,local:6},requests:{},jobs:{},creativeApproval:'pending'};
try{state=JSON.parse(await readFile(new URL('state.json',directory),'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
const save=()=>writeFile(new URL('state.json',directory),JSON.stringify(state,null,2));
const api=async(route,body)=>{const r=await fetch(base+route,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{});const j=await r.json();if(!r.ok)throw Error(j.error??r.statusText);return j;};
const camera=JSON.parse(await readFile(new URL('evidence/camera-acceptance-v1/state.json',root),'utf8'));
const old=JSON.parse(await readFile(new URL('evidence/acceptance-round6/state.json',root),'utf8'));
const cameraBase={asset:camera.asset,engine:'camera',mode:'image',preset:'locked',aspect:'landscape',length:'preview',quality:'draft',seed:71226,cameraSpeed:1,prompt:'A cinematic lunar landscape with a research base, rovers and a giant planet. Preserve the towers, structures and landscape geometry. Subtle environmental movement. One continuous shot.'};
const cases={};
for(const [name,pose] of Object.entries({up:'Pan Up',down:'Pan Down',left:'Pan Left',cw:'ClockWise (CW)',acw:'Anti Clockwise (ACW)',static:'Static'}))cases['camera-'+name]={group:'video',request:{...cameraBase,cameraPose:pose}};
for(const [name,speed] of [['slow',.5],['fast',1.5]])cases['camera-'+name]={group:'video',request:{...cameraBase,cameraPose:'Zoom In',cameraSpeed:speed}};
for(const direction of ['forward','backward'])cases['extend-'+direction]={group:'video',request:{...old.requests['extend-'+direction].request,requestId:undefined,videoModel:'detail'}};
cases['motion-detail']={group:'video',request:{...old.requests['motion-reference'].request,requestId:undefined,videoModel:'detail'}};
if(state.extraCases)Object.assign(cases,state.extraCases);
try{Object.assign(cases,JSON.parse(await readFile(new URL('extra-cases.json',directory),'utf8')));}catch(e){if(e.code!=='ENOENT')throw e;}
const names=process.argv.find(a=>a.startsWith('--cases='))?.slice(8).split(',');
if(names){
 for(const name of names){
  const item=cases[name];if(!item)throw Error('Unknown case '+name);
  if(!state.requests[name]){
   if(Object.values(state.requests).filter(x=>x.group===item.group).length>=state.budget[item.group])throw Error('Preview budget exhausted: '+item.group);
   state.requests[name]={...item,route:item.group==='audio'?'/api/audio-jobs':'/api/jobs',request:{...item.request,requestId:randomUUID()}};await save();
  }
  const saved=state.requests[name];let job=(await api(saved.route)).find(x=>x.requestId===saved.request.requestId);
  if(!job)job=await api(saved.route,saved.request);
  state.jobs[name]={id:job.id,route:saved.route};await save();console.log(name,job.id,job.status);
  const began=Date.now();let last;
  while(['processing','uploading','submitting','submitted','running','verifying'].includes(job.status)){
   if(Date.now()-began>30*60*1000)throw Error('Monitor deadline; resume the saved request, do not duplicate.');
   if(last!==job.status){console.log(name,job.status);last=job.status;}
   await new Promise(r=>setTimeout(r,2000));job=(await api(saved.route)).find(x=>x.id===job.id);
  }
  await writeFile(new URL(name+'.json',directory),JSON.stringify(job,null,2));
  state.jobs[name].status=job.status;state.jobs[name].technicalPass=job.report?.technicalPass===true;await save();
  console.log(name,job.status,job.error??'');
  if(item.expectedFailure&&job.report?.technicalPass)throw Error('Expected refusal was not enforced: '+name);
  if(!job.report?.technicalPass&&!item.expectedFailure)throw Error('Retained failed case '+name);
 }
}else{
 const records=[];
 for(const [name,record] of Object.entries(state.jobs)){
  const job=(await api(record.route)).find(x=>x.id===record.id);if(!job)throw Error('Missing '+name);
  const intentional=state.requests[name]?.expectedFailure===true;
  if(!job.report?.technicalPass&&!intentional)throw Error('Unexpected incomplete/failed result '+name+': '+job.status);
  if(intentional&&(job.status!=='failed'||!/(tracking|uncertain|blocked|mouth|face)/i.test(job.error??'')))throw Error('Expected bounded refusal missing: '+name);
  if(job.report?.technicalPass){
   const files=record.route==='/api/audio-jobs'?job.report.files:{[job.video]:job.report.sha256};
   for(const [file,expected] of Object.entries(files)){const bytes=await readFile(new URL(`data/${record.route==='/api/audio-jobs'?'audio-jobs':'jobs'}/${job.id}/${file}`,root));if(createHash('sha256').update(bytes).digest('hex')!==expected)throw Error('Changed '+name+'/'+file);}
  }
  records.push({name,id:job.id,status:job.status,technicalPass:job.report?.technicalPass===true,creativeReview:job.review??'pending'});
 }
 const used={};for(const [group,limit] of Object.entries(state.budget)){used[group]=Object.values(state.requests).filter(x=>x.group===group).length;if(used[group]>limit)throw Error('Recorded preview budget exceeded: '+group);}
 await writeFile(new URL('saved-verification.json',directory),JSON.stringify({at:new Date().toISOString(),status:'pass',records,budget:state.budget,used},null,2));console.log(JSON.stringify({records:records.length,technicalPasses:records.filter(x=>x.technicalPass).length,expectedRefusals:records.filter(x=>x.status==='failed').length,used},null,2));
}
