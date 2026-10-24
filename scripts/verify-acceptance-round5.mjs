import {readFile,writeFile,mkdir} from 'node:fs/promises';import {randomUUID,createHash} from 'node:crypto';
const root=new URL('../',import.meta.url),folder=new URL('evidence/acceptance-round5/',root),base='http://127.0.0.1:4317';await mkdir(folder,{recursive:true});let state={jobs:{},requests:{},budget:{dialogue:3,transcribe:3,caption:3},creativeApproval:'pending'};
try{state=JSON.parse(await readFile(new URL('state.json',folder),'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
const save=()=>writeFile(new URL('state.json',folder),JSON.stringify(state,null,2));
async function api(route,body){const r=await fetch(base+route,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{}),v=await r.json();if(!r.ok)throw Error(v.error??JSON.stringify(v));return v;}
const label=process.argv.find(x=>x.startsWith('--case='))?.slice(7),speakers=[{id:'host',name:'Host',voice:'af_heart'},{id:'guest',name:'Guest',voice:'am_michael'}];
const cases={
 'english-dialogue':{tool:'dialogue',speakers,lines:['Welcome back. The garden opens at nine.','Great. I will bring the camera.','Please meet me by the gate.','I will see you there.'].map((text,i)=>({speaker:i%2?'guest':'host',text,speed:1,pauseBefore:i?.3:0}))},
 'spanish-dialogue':{tool:'dialogue',speakers:[{id:'guide',name:'Guide',voice:'ef_dora'},{id:'visitor',name:'Visitor',voice:'em_alex'}],lines:[{speaker:'guide',text:'Buenos días. El jardín abre a las nueve.',speed:1,pauseBefore:0},{speaker:'visitor',text:'Perfecto. Nos vemos junto a la puerta.',speed:1,pauseBefore:.4}]},
};
if(label){
 if(label==='english-asr')cases[label]={tool:'transcribe',source:{kind:'speech',id:state.jobs['english-dialogue']},sourceLanguage:'en'};
 if(label==='spanish-asr')cases[label]={tool:'transcribe',source:{kind:'speech',id:state.jobs['spanish-dialogue']},sourceLanguage:'es'};
 if(label==='video-asr'){if(!state.captionFootage){state.captionFootage=(await api('/api/audio-jobs/'+state.jobs['spanish-caption']+'/video-footage',{})).id;await save();}cases[label]={tool:'transcribe',source:{kind:'footage',id:state.captionFootage},sourceLanguage:'es'};}
 if(['english-caption','spanish-caption'].includes(label)){
  if(!state.videoSource){const jobs=await api('/api/jobs');const source=jobs.find(j=>j.video&&j.report?.technicalPass&&j.request.prompt?.startsWith('A quiet cinematic observatory'));if(!source)throw Error('Missing saved observatory take.');state.videoSource=source.id;await save();}
  if(label==='spanish-caption'){const source=(await api('/api/jobs')).find(j=>j.video&&j.report?.technicalPass&&j.request.prompt?.startsWith('Flowers gradually open into full bloom'));if(source)state.spanishVideoSource=source.id;await save();}
  cases[label]={tool:'caption',source:{kind:'take',id:label==='spanish-caption'?(state.spanishVideoSource??state.videoSource):state.videoSource},burnCaptions:label!=='spanish-caption',transcriptJob:state.jobs[label==='english-caption'?'english-dialogue':'spanish-dialogue'],captionMode:'narrate',loopVideo:true,fontSize:24,speakerLabels:true,sourceVolume:0,speechVolume:1};
 }
 let input=cases[label];if(!input)throw Error('Unknown case.');
 if(!state.requests[label]){if(Object.values(state.requests).filter(r=>r.tool===input.tool).length>=state.budget[input.tool])throw Error('Preview budget exhausted.');state.requests[label]={...input,requestId:randomUUID()};await save();}
 let job=state.jobs[label]?(await api('/api/audio-jobs')).find(j=>j.id===state.jobs[label]):await api('/api/audio-jobs',state.requests[label]);state.jobs[label]=job.id;await save();console.log(label,job.id,job.status);
 for(let i=0;i<600&&!['review-ready','technical-failed','failed','cancelled','needs-attention'].includes(job.status);i++){await new Promise(r=>setTimeout(r,1500));job=(await api('/api/audio-jobs')).find(j=>j.id===job.id);}
 await writeFile(new URL(label+'.json',folder),JSON.stringify(job,null,2));if(!job.report?.technicalPass)throw Error(label+': '+(job.error??job.status));console.log('checked',label,job.id);
}else{
 const jobs=await api('/api/audio-jobs');for(const [label,id] of Object.entries(state.jobs)){let job=jobs.find(j=>j.id===id);if(!job?.report?.technicalPass)throw Error(label+': '+job?.status);if(process.argv.includes('--recheck')){job=await api('/api/audio-jobs/'+id+'/reverify',{});for(let i=0;i<120&&job.status==='processing';i++){await new Promise(r=>setTimeout(r,500));job=(await api('/api/audio-jobs')).find(j=>j.id===id);}if(!job.report?.technicalPass||job.status!=='review-ready')throw Error(label+': '+(job.error??job.status));}for(const [file,sha] of Object.entries(job.report.files)){const bytes=await readFile(new URL('data/audio-jobs/'+id+'/'+file,root));if(createHash('sha256').update(bytes).digest('hex')!==sha)throw Error('Changed output '+label+'/'+file);}await writeFile(new URL(label+'.json',folder),JSON.stringify(job,null,2));console.log('checked',label,id);}
}
if(!label){
 const clean=text=>text.toLowerCase().replace(/\b9\b/g,'nine').replace(/[^\p{L}\p{N}]+/gu,' ').trim();const comparisons=[];
 for(const [transcribed,original] of [['english-asr','english-dialogue'],['spanish-asr','spanish-dialogue'],['video-asr','spanish-dialogue']]){const read=key=>readFile(new URL('data/audio-jobs/'+state.jobs[key]+'/transcript.json',root),'utf8').then(JSON.parse),a=await read(transcribed),b=await read(original),match=clean(a.text)===clean(b.text);comparisons.push({case:transcribed,sourceCase:original,recognized:a.text,script:b.text,normalization:'Lowercase, punctuation/whitespace, English spoken nine and numeral 9.',match});if(!match)throw Error('Known-script words differ: '+transcribed);}
 for(const tool of Object.keys(state.budget))if(Object.values(state.requests).filter(r=>r.tool===tool).length>state.budget[tool])throw Error('Preview budget exceeded: '+tool);
 await writeFile(new URL('latest-verification.json',folder),JSON.stringify({at:new Date().toISOString(),status:'pass',checkedJobs:Object.keys(state.jobs).length,comparisons,budget:state.budget,creativeApproval:'pending',limits:'Three short clean-script ASR checks; no diarization, noisy-speech, emotion or phoneme acceptance.'},null,2));console.log('Three known-script comparisons pass; creative approval remains pending.');
}
