// Bounded acceptance requests. Reopening this script resumes saved IDs.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
const root=new URL('../',import.meta.url),folder=new URL('evidence/acceptance-round10/',root),base='http://127.0.0.1:4317';
await mkdir(folder,{recursive:true});
let state={started:new Date().toISOString(),budget:{audio:3,image:1,video:2},uploads:{},requests:{},jobs:{},creativeApproval:'pending'};
try{state=JSON.parse(await readFile(new URL('state.json',folder),'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
const save=()=>writeFile(new URL('state.json',folder),JSON.stringify(state,null,2));
async function api(route,body,headers){const response=await fetch(base+route,body?{method:'POST',headers:headers??{'Content-Type':'application/json'},body:headers?body:JSON.stringify(body)}:{});const value=await response.json();if(!response.ok)throw Error(value.error??response.statusText);return value;}
const name=process.argv.find(a=>a.startsWith('--case='))?.slice(7);if(!name){console.log(JSON.stringify(state,null,2));process.exit(0);}
let cases={};try{cases=JSON.parse(await readFile(new URL('cases.json',folder),'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
if(['real-front','real-turn'].includes(name)&&!state.requests[name]){
 const fixture=JSON.parse(await readFile(new URL('prepared-fixtures.json',folder),'utf8'))[name];
 for(const [kind,file,route,type] of [['video',fixture.video,'/api/footage','video/mp4'],['audio',fixture.audio,'/api/audio-assets','audio/wav']]){
  const key=name+'-'+kind;if(!state.uploads[key]){state.uploads[key]=await api(route,await readFile(file),{'Content-Type':type,'X-File-Name':encodeURIComponent(name+'.'+(kind==='video'?'mp4':'wav'))});await save();}
 }
 cases[name]={group:'audio',route:'/api/audio-jobs',request:{tool:'lipsync',lipEngine:'latentsync',source:{kind:'footage',id:state.uploads[name+'-video'].id},audioSource:{kind:'audio',id:state.uploads[name+'-audio'].id},seed:name==='real-front'?2026102201:2026102202,loopVideo:false,lipStability:'stable'}};
}
if(!state.requests[name]){
 const item=cases[name];if(!item)throw Error('Unknown planned case '+name);
 if(Object.values(state.requests).filter(r=>r.group===item.group).length>=state.budget[item.group])throw Error('Budget exhausted: '+item.group);
 state.requests[name]={...item,request:{...item.request,...(item.group==='audio'?{}:{kind:item.group==='image'?'image':'video-tool'}),requestId:randomUUID()}};await save();
}
const saved=state.requests[name];let job=(await api(saved.route)).find(j=>j.requestId===saved.request.requestId);
if(!job)job=await api(saved.route,saved.request);
state.jobs[name]={id:job.id,requestId:job.requestId,route:saved.route,status:job.status};await save();console.log(name,job.id,job.status);
const started=Date.now();let status;
while(['processing','uploading','submitting','submitted','running','verifying'].includes(job.status)){
 if(Date.now()-started>30*60*1000)throw Error('Monitor stopped; resume this saved request without duplicating it.');
 if(status!==job.status){status=job.status;console.log(name,status);}
 await new Promise(r=>setTimeout(r,2500));job=(await api(saved.route)).find(j=>j.id===job.id);
}
state.jobs[name].status=job.status;state.jobs[name].technicalPass=job.report?.technicalPass===true;await save();await writeFile(new URL(name+'.json',folder),JSON.stringify(job,null,2));console.log(name,job.status,job.error??'');
