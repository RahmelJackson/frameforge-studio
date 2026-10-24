// Persist every request ID before submitting. Re-run a case to inspect its job.
import{readFile,writeFile,mkdir}from'node:fs/promises';import{randomUUID}from'node:crypto';import{POSES}from'../public/body-pose.js';
const root=new URL('../',import.meta.url),folder=new URL('evidence/acceptance-round11/',root),base='http://127.0.0.1:4317';await mkdir(folder,{recursive:true});
let state={started:new Date().toISOString(),budget:{image:3,camera:2,motion:1,local:2},guides:{},requests:{},jobs:{},creativeApproval:'pending'};
try{state=JSON.parse(await readFile(new URL('state.json',folder),'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
const save=()=>writeFile(new URL('state.json',folder),JSON.stringify(state,null,2));
async function api(route,body,headers){const response=await fetch(base+route,body?{method:'POST',headers:headers??{'Content-Type':'application/json'},body:headers?body:JSON.stringify(body)}:{}),value=await response.json();if(!response.ok)throw Error(value.error??response.statusText);return value;}
const name=process.argv.find(a=>a.startsWith('--case='))?.slice(7);if(!name){console.log(JSON.stringify(state,null,2));process.exit(0);}
const cases={};
for(const [key,action]of Object.entries({standing:'stands facing the camera with both arms relaxed away from her body',raised:'stands facing the camera with her right arm lifted above her head and her other arm relaxed',seated:'sits on a simple gray stool with bent knees and both feet visible'})){
 cases['pose-'+key]={group:'image',request:{kind:'image',tool:'identity-pose',asset:'34659372-3bbb-4bbf-87c3-e3fa0a74f791.png',poseGuide:'skeleton',identityStrength:1,poseStrength:.85,aspect:'portrait',seed:2026102201,prompt:'Full-body studio photograph of the same adult woman, brown skin, short black curly hair, teal linen button shirt, simple dark trousers, silver round pendant. She '+action+'. Plain neutral gray background, soft even light, realistic anatomy. Preserve her recognizable face, hairstyle and clothing.'}};
}
cases['pose-raised-combined']=structuredClone(cases['pose-raised']);
cases['pose-raised-repair']=structuredClone(cases['pose-raised']);
const oldCamera=JSON.parse(await readFile(new URL('data/jobs/7be7b04e-242b-4857-a65d-416f67faad61/job.json',root),'utf8'));
cases['camera-knight']={group:'camera',request:{...oldCamera.request,cameraMirror:true,quality:'draft'}};
const lunar=JSON.parse(await readFile(new URL('evidence/acceptance-round7/state.json',root),'utf8')).requests['camera-left'].request;
cases['camera-lunar']={group:'camera',request:{...lunar,cameraPose:'Pan Right',cameraMirror:true,requestId:undefined}};
const border=JSON.parse(await readFile(new URL('evidence/acceptance-round10/state.json',root),'utf8')).requests['border-guided'].request;
cases['border-tracked']={group:'local',request:{...border,outpaintMode:'track-still',requestId:undefined}};
try{Object.assign(cases,JSON.parse(await readFile(new URL('extra-cases.json',folder),'utf8')));}catch(e){if(e.code!=='ENOENT')throw e;}
if(!state.requests[name]){
 const item=cases[name];if(!item)throw Error('Unknown planned case '+name);
 if(Object.values(state.requests).filter(x=>x.group===item.group).length>=state.budget[item.group]+(item.group==='image'&&['pose-raised-repair','pose-raised-combined'].includes(name)&&state.jobs['pose-raised']?.status==='failed'?(name==='pose-raised-combined'&&state.jobs['pose-raised-repair']?.status==='failed'?2:1):0))throw Error('Budget exhausted: '+item.group);
 if(name.startsWith('pose-')){const key=['pose-raised-repair','pose-raised-combined'].includes(name)?'raised':name.slice(5);if(!state.guides[key]){state.guides[key]=await api('/api/body-pose',{points:POSES[key],aspect:'portrait'});await save();}item.request.reference=state.guides[key].name;}
 state.requests[name]={...item,request:{...item.request,requestId:randomUUID()}};await save();
}
const saved=state.requests[name];let job=(await api('/api/jobs')).find(j=>j.requestId===saved.request.requestId);if(!job)job=await api('/api/jobs',saved.request);
state.jobs[name]={id:job.id,status:job.status};await save();console.log(name,job.id,job.status);let last;const began=Date.now();
while(['processing','uploading','submitting','submitted','running','verifying'].includes(job.status)){
 if(Date.now()-began>30*60*1000)throw Error('Monitor deadline. Resume this saved request; do not duplicate it.');if(job.status!==last){last=job.status;console.log(name,last);}await new Promise(r=>setTimeout(r,2500));job=(await api('/api/jobs')).find(j=>j.id===job.id);
}
state.jobs[name]={id:job.id,status:job.status,technicalPass:job.report?.technicalPass===true,error:job.error??null};await save();await writeFile(new URL(name+'.json',folder),JSON.stringify(job,null,2));console.log(name,job.status,job.error??'');
