import {readFile,writeFile,mkdir} from 'node:fs/promises';import path from 'node:path';import {fileURLToPath} from 'node:url';import {randomUUID} from 'node:crypto';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url))),dir=path.join(root,'evidence/style-board'),file=path.join(dir,'state.json'),base='http://127.0.0.1:4317';
const api=async(route,body,raw)=>{const res=await fetch(base+route,{...(body||raw?{method:'POST',headers:{'Content-Type':raw?'image/jpeg':'application/json'},body:raw??JSON.stringify(body)}:{}),signal:AbortSignal.timeout(120000)}),value=await res.json();if(!res.ok)throw Error(JSON.stringify(value));return value;};
await mkdir(dir,{recursive:true});let state;try{state=JSON.parse(await readFile(file,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
const save=()=>writeFile(file,JSON.stringify(state,null,2));
if(!state){if(!process.argv.includes('--prepare'))throw Error('Prepare the fixed references first.');state={at:new Date().toISOString(),budget:10,criteria:'Two distinct two-card boards, three unrelated subjects, fixed prompt/seed/base/sampler. Inspect requested objects, palette/texture and forbidden reference objects/layout. Verify every card contributes to the mean; source and model bindings stay exact. Technical success never approves image quality.',references:{},boards:{},cases:{}};await save();}
if(process.argv.includes('--prepare')){
 const refs=JSON.parse(await readFile(path.join(dir,'references.json'),'utf8'));for(const name of ['0.jpg','2.jpg','4.jpg','5.jpg'])if(!state.references[name]){const row=refs.find(x=>x.name===name);state.references[name]=await api('/api/assets',null,await readFile(path.join(root,row.file)));await save();}
 for(const [id,names,label] of [['paint',['4.jpg','5.jpg'],'Style study · swirling paint'],['soft',['0.jpg','2.jpg'],'Style study · soft 3D']])if(!state.boards[id]){const cards=names.map((name,i)=>({asset:state.references[name].name,x:i*30,y:0}));state.boards[id]=await api('/api/image-library/boards',{name:label,notes:'Upstream InstantStyle demonstration references, local style/content-leakage evaluation. Reference provenance is retained under evidence/style-board/references.json. These are not original Frameforge artworks.',cards});await save();}
 console.log(JSON.stringify({prepared:true,boards:Object.fromEntries(Object.entries(state.boards).map(([k,b])=>[k,b.id]))}));process.exit(0);
}
const label=process.argv.find(x=>x.startsWith('--case='))?.slice(7),[board,subject]=String(label).split('-');
const override=process.argv.find(x=>x.startsWith('--strength='))?.slice(11);
if(override!==undefined&&(!Number.isFinite(Number(override))||Number(override)<0||Number(override)>1.2))throw Error('Invalid strength override.');
const removal=process.argv.find(x=>x.startsWith('--removal='))?.slice(10),subtract=process.argv.includes('--content');
if(removal!==undefined&&(!Number.isFinite(Number(removal))||Number(removal)<0||Number(removal)>1))throw Error('Invalid content removal.');
const prompts={teapot:'A single silver teapot on a simple wooden table. The handle is on the left, the curved spout is on the right. Simple uncluttered background.',robot:'A small yellow delivery robot with a square head, two blue eyes, short arms and two wheels. Simple uncluttered background.',bicycle:'A red vintage bicycle with exactly two wheels, a brown saddle and curved handlebars. Simple uncluttered background.'};
if(!['baseline','paint','soft'].includes(board)||!prompts[subject])throw Error('Choose baseline|paint|soft and teapot|robot|bicycle.');
if(!state.cases[label]){
 if(!process.argv.includes('--render')&&!process.argv.includes('--via-ui'))throw Error('Use --render once or --via-ui to reserve a browser case, then --resume.');if(Object.keys(state.cases).length>=10)throw Error('Ten-preview fixed budget exhausted.');
 const jobs=await api('/api/jobs');if(jobs.some(j=>['processing','uploading','submitting','submitted','running','cancelling','verifying'].includes(j.status)))throw Error('Existing app render is active.');
 const selected=state.boards[board==='baseline'?'paint':board],request={kind:'image',tool:'style-board',styleImages:selected.cards.map(c=>c.asset),styleLabel:selected.name,styleStrength:board==='baseline'?0:override===undefined?.8:Number(override),prompt:prompts[subject],aspect:'square',seed:20261023};
 if(subtract)Object.assign(request,{styleMode:'subtract',styleContent:board==='soft'?'A rabbit in a coat by a cottage and a puppy in a forest.':'A starry night sky with stars, a moon, mountains and a village.',styleContentStrength:removal===undefined?.5:Number(removal)});
 state.cases[label]={requestId:randomUUID(),request,startedAt:new Date().toISOString()};await save();
 if(process.argv.includes('--via-ui')){state.cases[label].entryPoint='browser';await save();console.log('Browser preview reserved; submit its exact settings in the website, then use --adopt-ui.');process.exit(0);}
 const job=await api('/api/jobs',{...request,requestId:state.cases[label].requestId});state.cases[label].jobId=job.id;await save();
}else if(!process.argv.includes('--resume')&&!process.argv.includes('--adopt-ui'))throw Error('Case recorded; resume it.');
if(process.argv.includes('--adopt-ui')){
 const entry=state.cases[label];if(entry.entryPoint!=='browser')throw Error('Not a reserved browser preview.');
 const matches=(await api('/api/jobs')).filter(j=>new Date(j.createdAt)>=new Date(entry.startedAt)&&Object.entries(entry.request).every(([k,v])=>JSON.stringify(j.request[k])===JSON.stringify(v)));
 if(matches.length!==1)throw Error('Expected exactly one matching browser submission; do not replay.');
 entry.jobId=matches[0].id;entry.requestId=matches[0].requestId;await save();
}
const entry=state.cases[label];if(!entry.jobId){const job=(await api('/api/jobs')).find(j=>j.requestId===entry.requestId);if(!job)throw Error('Ambiguous acknowledgment: inspect saved state/history instead of replaying.');entry.jobId=job.id;await save();}
const deadline=Date.now()+12*60*1000;let last;
while(Date.now()<deadline){const job=(await api('/api/jobs')).find(j=>j.id===entry.jobId);if(job.status!==last){last=job.status;console.log(JSON.stringify({case:label,jobId:job.id,status:last,error:job.error}));}if(['review-ready','technical-failed','failed','cancelled','needs-attention','verification-blocked'].includes(last)){await writeFile(path.join(dir,label+'-result.json'),JSON.stringify({case:label,entry,job},null,2));if(!job.report?.technicalPass)process.exitCode=1;break;}await new Promise(r=>setTimeout(r,2000));}
