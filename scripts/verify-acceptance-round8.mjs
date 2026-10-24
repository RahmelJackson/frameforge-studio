import {readFile,writeFile,mkdir} from 'node:fs/promises';import {createHash,randomUUID} from 'node:crypto';
const root=new URL('../',import.meta.url),dir=new URL('evidence/acceptance-round8/',root),base='http://127.0.0.1:4317';await mkdir(dir,{recursive:true});
let state={budget:{separate:3,asr:6},probe:{separate:1,asr:2,path:'data/benchmarks/acceptance-round8/'},requests:{},jobs:{},creativeApproval:'pending'};try{state=JSON.parse(await readFile(new URL('state.json',dir),'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
const save=()=>writeFile(new URL('state.json',dir),JSON.stringify(state,null,2));
const api=async(route,body)=>{const r=await fetch(base+route,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{});const j=await r.json();if(!r.ok)throw Error(j.error??r.statusText);return j;};
async function run(name,group,request){
 if(!state.requests[name]){if(Object.values(state.requests).filter(x=>x.group===group).length+state.probe[group]>=state.budget[group])throw Error('Bounded preview budget exhausted: '+group);state.requests[name]={group,request:{...request,requestId:randomUUID()}};await save();}
 const stored=state.requests[name];let job=(await api('/api/audio-jobs')).find(j=>j.requestId===stored.request.requestId);if(!job)job=await api('/api/audio-jobs',stored.request);state.jobs[name]={id:job.id};await save();console.log(name,job.id,job.status);
 for(let i=0;i<200&&job.status==='processing';i++){await new Promise(r=>setTimeout(r,1500));job=(await api('/api/audio-jobs')).find(j=>j.id===job.id);}
 await writeFile(new URL(name+'.json',dir),JSON.stringify(job,null,2));if(!job.report?.technicalPass)throw Error('Inspect retained result before retrying: '+name+' '+(job.error??job.status));return job;
}
const action=process.argv.find(a=>a.startsWith('--case='))?.slice(7);
if(action==='heldout'){
 if(!state.heldout){const r=await fetch(base+'/api/audio-assets',{method:'POST',body:await readFile(new URL('data/benchmarks/acceptance-round8/spanish-overlap.wav',root))});const j=await r.json();if(!r.ok)throw Error(j.error);state.heldout=j;await save();}
 await run('heldout','separate',{tool:'separate',source:{kind:'audio',id:state.heldout.id}});
}else if(action==='prepare-ui'){
 if(!state.uiSource){const r=await fetch(base+'/api/audio-assets',{method:'POST',body:await readFile(new URL('data/benchmarks/acceptance-round8/ui-overlap.wav',root))});const j=await r.json();if(!r.ok)throw Error(j.error);state.uiSource=j;await save();}console.log('UI source:',state.uiSource.id);
}else if(action==='collect-ui'){
 const jobs=(await api('/api/audio-jobs')).filter(j=>j.request.tool==='separate'&&j.request.source.kind==='audio'&&j.request.source.id===state.uiSource?.id);if(jobs.length!==1)throw Error('Expected one UI-created mixture job; inspect before retrying.');const job=jobs[0];state.requests['ui-overlap']={group:'separate',request:{...job.request,requestId:job.requestId}};state.jobs['ui-overlap']={id:job.id};await save();console.log('Collected UI request',job.id);
}else if(action?.startsWith('transcribe-')){
 const name=action.slice(11),parent=state.jobs[name];if(!parent)throw Error('Choose an existing separation job.');
 for(const track of [1,2]){const key=name+'-'+track;if(!state.assets)state.assets={};if(!state.assets[key]){state.assets[key]=await api('/api/audio-jobs/'+parent.id+'/audio-asset',{track});await save();}await run(key,'asr',{tool:'transcribe',source:{kind:'audio',id:state.assets[key].id},sourceLanguage:name==='heldout'?'es':'en'});}
}else if(action)throw Error('Unknown case');
else{
 const fixtures=JSON.parse(await readFile(new URL('fixture-hashes.json',dir),'utf8'));for(const [file,hash] of Object.entries(fixtures)){if(!file.startsWith('data/benchmarks/acceptance-round8/')||file.includes('..'))throw Error('Invalid fixture path');if(createHash('sha256').update(await readFile(new URL(file,root))).digest('hex')!==hash)throw Error('Changed frozen fixture '+file);}
 const records=[];for(const [name,record] of Object.entries(state.jobs)){const job=(await api('/api/audio-jobs')).find(j=>j.id===record.id);if(!job?.report?.technicalPass)throw Error('Incomplete saved result '+name);for(const [file,hash] of Object.entries(job.report.files)){const bytes=await readFile(new URL('data/audio-jobs/'+job.id+'/'+file,root));if(createHash('sha256').update(bytes).digest('hex')!==hash)throw Error('Changed '+name+'/'+file);}records.push({name,id:job.id,technicalPass:true,creativeReview:job.review??'pending'});}
 const used=Object.fromEntries(Object.entries(state.budget).map(([group,limit])=>{const used=state.probe[group]+Object.values(state.requests).filter(x=>x.group===group).length;if(used>limit)throw Error('Budget exceeded');return [group,used];}));await writeFile(new URL('saved-verification.json',dir),JSON.stringify({status:'pass',at:new Date().toISOString(),records,used,creativeApproval:'pending'},null,2));console.log(JSON.stringify({records:records.length,used}));
}
