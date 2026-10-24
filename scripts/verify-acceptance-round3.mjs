import {readFile,writeFile,mkdir} from 'node:fs/promises';import {randomUUID,createHash} from 'node:crypto';
const root=new URL('../',import.meta.url),folder=new URL('evidence/acceptance-round3/',root),base='http://127.0.0.1:4317';await mkdir(folder,{recursive:true});let state={jobs:{},requests:{},budget:{maximumInterpolation:4,maximumRecolor:4},creativeApproval:'pending'};try{state=JSON.parse(await readFile(new URL('state.json',folder),'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
const save=()=>writeFile(new URL('state.json',folder),JSON.stringify(state,null,2));
async function api(route,body,raw){const r=await fetch(base+route,raw??(body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})),v=await r.json();if(!r.ok)throw Error(v.error??JSON.stringify(v));return v;}
async function run(label,input){if(!state.requests[label]){state.requests[label]={...input,requestId:randomUUID()};await save();}let job=state.jobs[label]?(await api('/api/jobs')).find(j=>j.id===state.jobs[label]):await api('/api/jobs',state.requests[label]);state.jobs[label]=job.id;await save();console.log(label,job.id,job.status);for(let i=0;i<500&&!['review-ready','technical-failed','failed','cancelled','needs-attention','verification-blocked'].includes(job.status);i++){await new Promise(r=>setTimeout(r,1500));job=(await api('/api/jobs')).find(j=>j.id===job.id);}if(!job.report?.technicalPass)throw Error(label+': '+(job.error??job.status));return job;}
if(process.argv.includes('--render')){
 if(!state.mask){state.mask=(await api('/api/assets',null,{method:'POST',headers:{'Content-Type':'image/png'},body:await readFile(new URL('jacket-mask.png',folder))})).name;await save();}
 if(!state.footage){state.footage=(await api('/api/footage',null,{method:'POST',headers:{'Content-Type':'video/mp4','X-File-Name':'Motion%20and%20cut%20fixture'},body:await readFile(new URL('motion-cut-source.mp4',folder))})).id;await save();}
 const jacket={kind:'video-tool',tool:'recolor',sourceJob:'850cf011-0100-4027-b54f-42368d8ff78d',start:0,end:1.8125,mask:state.mask,trackMask:true,feather:6,materialColor:'#244b80',materialStrength:1,seed:202610300};
 await run('navy-jacket',jacket);await run('zero-color',{...jacket,materialStrength:0});await run('burgundy-jacket',{...jacket,materialColor:'#7c2540'});
 await run('rowan-interpolation',{kind:'video-tool',tool:'interpolate',sourceJob:'850cf011-0100-4027-b54f-42368d8ff78d'});
 await run('motion-cut-interpolation',{kind:'video-tool',tool:'interpolate',footage:state.footage});
 await run('mara-interpolation',{kind:'video-tool',tool:'interpolate',sourceJob:'b1dde788-8d8e-454e-8cdf-d125cab9991e'});
 for(const label of ['refined-navy-jacket','ui-interpolation'])if(state.requests[label])await run(label,state.requests[label]);
}
for(const key of ['navy-jacket','zero-color','burgundy-jacket','rowan-interpolation','motion-cut-interpolation','mara-interpolation'])if(!state.jobs[key])throw Error('Missing saved case '+key);
for(const [label,id] of Object.entries(state.jobs)){const j=(await api('/api/jobs')).find(j=>j.id===id);if(!j?.report?.technicalPass)throw Error(label+' failed');const hash=x=>createHash('sha256').update(x).digest('hex');if(hash(await readFile(new URL('data/jobs/'+id+'/output.mp4',root)))!==j.report.sha256)throw Error('Changed output '+label);await writeFile(new URL(label+'.json',folder),JSON.stringify(j,null,2));console.log('checked',label,j.report.frames,j.report.fps,j.report.duration);}
await save();
