// Produce: one idea → a finished rough cut. A production is a thin orchestrator
// over the Studio's own routes (story plan, image/video jobs, speech, timeline
// and export), so every step keeps the same validation, checks and records as
// doing it by hand. It renders one job at a time and stops for review between
// stages unless the owner chooses automatic mode.
import {readFile,writeFile,rename,mkdir} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import path from 'node:path';

export const STAGES=['keyframes','review-keyframes','clips','review-clips','sound','cut','done'];
export const LOOKS={
 'fruit-romance':'bright 3D animated film look, soft studio lighting, expressive faces, clean background',
 'satisfying-loop':'clean, colourful, smooth satisfying motion, soft even lighting',
 default:'cinematic photograph, natural light, shallow depth of field'
};
const DONE=j=>!!(j?.report?.technicalPass&&(j.image||j.video)&&j.review?.verdict!=='rejected');
const FAILED=new Set(['failed','technical-failed','verification-blocked','cancelled','needs-attention']);
const uuid=v=>typeof v==='string'&&/^[a-f0-9-]{36}$/.test(v);
const now=()=>new Date().toISOString();
// Wan 5B clip lengths in frames at 24 fps (lib/workflow.mjs LENGTHS).
export function clipLength(seconds){for(const [key,frames] of [['preview',49],['standard',81],['extended',121],['long',241]])if(frames/24>=seconds)return key;throw Error('Beats longer than ten seconds need a shorter plan.');}
const beatText=f=>f.prompt.replace(/^Context:[^.]*\.\s*/,'');

export class Productions{
 constructor({directory,call,tick=true,interval=4000}){this.file=path.join(directory,'productions.json');this.call=call;this.list=[];this.pending=Promise.resolve();this.busy=false;this.tickEnabled=tick;this.interval=interval;}
 async open(){await mkdir(path.dirname(this.file),{recursive:true});try{this.list=JSON.parse(await readFile(this.file,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}if(this.tickEnabled){this.timer=setInterval(()=>this.step().catch(()=>{}),this.interval);this.timer.unref?.();}return this;}
 close(){clearInterval(this.timer);}
 async persist(){const tmp=this.file+'.tmp';await writeFile(tmp,JSON.stringify(this.list,null,1));await rename(tmp,this.file);}
 find(id){const p=this.list.find(p=>p.id===id);if(!p)throw Error('Production not found.');return p;}
 log(p,message){p.events=[...(p.events??[]),{at:now(),message}].slice(-40);p.updatedAt=now();}
 mutate(fn){const run=this.pending.then(async()=>{const value=await fn();await this.persist();return value;});this.pending=run.catch(()=>{});return run;}

 async create(input={}){
  const quality=input.quality??'draft';if(!['draft','standard'].includes(quality))throw Error('Choose draft or standard quality.');
  const look=String(input.look??LOOKS[input.format]??LOOKS.default).trim().slice(0,300);
  const story=await this.call('POST','/api/creator/stories',{format:input.format,duration:Number(input.duration??15),subject:input.subject,name:input.name,aspect:input.aspect,sources:input.sources,characterId:input.characterId||undefined});
  const project=await this.call('POST','/api/creator/stories/'+story.id+'/project',{});
  const film=await this.call('GET','/api/short-films/'+project.id);
  for(const f of film.story.frames)clipLength(f.targetDuration);
  const p={id:randomUUID(),name:story.name,format:story.format,subject:story.subject,aspect:story.aspect,duration:story.duration,quality,look,auto:input.auto===true,voice:input.voice??'af_heart',storyId:story.id,projectId:project.id,stage:'keyframes',paused:false,error:null,seed:Math.floor(Math.random()*2**31),castAsset:story.character?.referenceAsset??null,frames:film.story.frames.map(f=>({id:f.id,title:f.title,prompt:f.prompt,targetDuration:f.targetDuration,image:null,clip:null,narration:''})),narrationJob:null,movie:null,events:[],createdAt:now(),updatedAt:now()};
  this.log(p,'Plan created with '+p.frames.length+' shots. Making keyframes next.');
  return this.mutate(()=>{this.list.unshift(p);return p;});
 }

 // Owner actions. Each one changes state only; the ticker does the work.
 async action(id,input={}){return this.mutate(async()=>{const p=this.find(id);const a=input.action;
  if(a==='pause'){p.paused=true;this.log(p,'Paused.');}
  else if(a==='resume'){p.paused=false;p.error=null;this.log(p,'Resumed.');}
  else if(a==='auto'){p.auto=input.value===true;this.log(p,p.auto?'Automatic mode: stages continue without stopping.':'Review mode: stops after keyframes and clips.');}
  else if(a==='continue'){if(p.stage==='review-keyframes'){p.stage='clips';this.log(p,'Keyframes approved. Animating each shot.');}else if(p.stage==='review-clips'){p.stage='sound';this.log(p,'Clips approved. Adding narration and captions.');}else throw Error('Nothing is waiting for your review.');p.paused=false;p.error=null;}
  else if(a==='narration'){const lines=input.lines;if(!Array.isArray(lines)||lines.length!==p.frames.length||lines.some(l=>typeof l!=='string'||l.length>400))throw Error('Write one line (up to 400 characters) for each shot.');if(lines.join(' ').length>2000)throw Error('Keep the whole narration under 2000 characters.');p.frames.forEach((f,i)=>f.narration=lines[i].trim());p.narrationJob=null;this.log(p,'Narration saved.');}
  else if(a==='look'){const look=String(input.look??'').trim();if(!look||look.length>300)throw Error('Describe the look in 1–300 characters.');p.look=look;this.log(p,'Look updated for new renders.');}
  else if(a==='redo'){const f=p.frames.find(f=>f.id===input.frameId);if(!f)throw Error('Choose a shot.');if(input.part==='image'){f.image=null;f.clip=null;if(STAGES.indexOf(p.stage)>STAGES.indexOf('keyframes'))p.stage='keyframes';}else if(input.part==='clip'){f.clip=null;if(STAGES.indexOf(p.stage)>STAGES.indexOf('clips'))p.stage='clips';}else throw Error('Choose image or clip.');if(input.prompt!=null){const text=String(input.prompt).trim();if(!text||text.length>2500)throw Error('Describe the shot in 1–2500 characters.');f.prompt=text;}p.movie=null;p.paused=false;p.error=null;this.log(p,'Remaking '+input.part+' for “'+f.title+'”.');}
  else if(a==='retry'){for(const f of p.frames)for(const k of ['image','clip'])if(f[k]?.failed)f[k]=null;if(p.narrationJob?.failed)p.narrationJob=null;p.error=null;p.paused=false;this.log(p,'Retrying.');}
  else throw Error('Unknown production action.');
  return p;});}

 // One step of work across all productions. Only one render runs at a time.
 async step(){if(this.busy)return;this.busy=true;try{for(const p of this.list.filter(p=>!p.paused&&!p.error&&!['done','review-keyframes','review-clips'].includes(p.stage))){await this.advance(p);if(this.rendering)break;}}finally{this.busy=false;}}
 async advance(p){
  this.rendering=false;
  try{
   if(p.stage==='keyframes'||p.stage==='clips'){
    const part=p.stage==='keyframes'?'image':'clip';
    for(const f of p.frames){
     if(f[part]?.jobId){const job=await this.call('GET','/api/jobs/'+f[part].jobId);if(DONE(job)){if(!f[part].done){f[part].done=true;f[part].url=part==='image'?`/outputs/${job.id}/${job.image}`:`/outputs/${job.id}/${job.video}`;f[part].poster=part==='clip'?`/outputs/${job.id}/poster.jpg`:null;await this.bind(p,f,part,job.id);await this.save(p,'“'+f.title+'” '+(part==='image'?'keyframe':'clip')+' ready.');}continue;}
      if(FAILED.has(job.status)){f[part].failed=true;return await this.fail(p,'“'+f.title+'” '+part+' render stopped: '+(job.error??job.status)+'. Retry or remake it.');}
      this.rendering=true;return;}
     return await this.submit(p,f,part);
    }
    if(p.stage==='keyframes'){p.stage=p.auto?'clips':'review-keyframes';return await this.save(p,p.auto?'All keyframes ready. Animating.':'All keyframes ready. Review them, remake any you don’t like, then continue.');}
    p.stage=p.auto?'sound':'review-clips';return await this.save(p,p.auto?'All clips ready. Adding sound.':'All clips ready. Write the narration and continue.');
   }
   if(p.stage==='sound')return await this.sound(p);
   if(p.stage==='cut')return await this.cut(p);
  }catch(error){return await this.fail(p,error.message);}
 }
 async submit(p,f,part){
  const readiness=await this.call('GET','/api/engine-readiness');if(readiness.busy){this.rendering=true;return;}
  const index=p.frames.indexOf(f),requestId=randomUUID(),seed=(p.seed+index*7919)%2**31,scene=beatText(f)+' '+p.look+'.';
  let body;
  if(part==='image')body=p.castAsset?{kind:'image',tool:'edit',asset:p.castAsset,prompt:'Keep this exact character. '+scene,aspect:p.aspect,seed}:{kind:'image',tool:'create',prompt:scene+' Context: '+p.subject,aspect:p.aspect,seed};
  else{const still=await this.call('POST','/api/jobs/'+f.image.jobId+'/image-asset',{});body={kind:'video',mode:'image',engine:'wan5b',asset:still.name,prompt:scene,preset:'directed',aspect:p.aspect,length:clipLength(f.targetDuration),quality:p.quality,seed};}
  f[part]={requestId,jobId:null};await this.persist();
  let job;try{job=await this.call('POST','/api/jobs',{...body,requestId});}catch(error){if(error.status===409){f[part]=null;this.rendering=true;return;}f[part]=null;throw error;}
  if(!uuid(job?.id)){f[part]=null;this.rendering=true;return;}
  f[part]={requestId,jobId:job.id};this.rendering=true;return await this.save(p,'Rendering '+(part==='image'?'keyframe':'clip')+' '+(index+1)+' of '+p.frames.length+'.');
 }
 async bind(p,f,part,jobId){const film=await this.call('GET','/api/short-films/'+p.projectId);const story=structuredClone(film.story);const frame=story.frames.find(x=>x.id===f.id);if(!frame)throw Error('The film project no longer has this shot.');frame[part==='image'?'imageJobId':'takeJobId']=jobId;await this.call('PUT','/api/short-films/'+p.projectId,{story,signature:film.workflow.signature});}
 async sound(p){
  const text=p.frames.map(f=>f.narration).filter(Boolean).join(' ');
  if(text&&!p.narrationJob?.done){
   if(!p.narrationJob){const readiness=await this.call('GET','/api/engine-readiness');if(readiness.busy){this.rendering=true;return;}const requestId=randomUUID();p.narrationJob={requestId,jobId:null};await this.persist();const job=await this.call('POST','/api/audio-jobs',{tool:'speech',text,voice:p.voice,language:p.voice.startsWith('e')?'es':'en',requestId});p.narrationJob={requestId,jobId:job.id};this.rendering=true;return await this.save(p,'Recording narration.');}
   const jobs=await this.call('GET','/api/audio-jobs'),job=jobs.find(j=>j.id===p.narrationJob.jobId);
   if(job?.report?.technicalPass){const asset=await this.call('POST','/api/audio-jobs/'+job.id+'/audio-asset',{});p.narrationJob={...p.narrationJob,done:true,audio:asset.id,duration:job.report.duration??null};await this.save(p,'Narration recorded.');}
   else if(job&&FAILED.has(job.status)){p.narrationJob.failed=true;return await this.fail(p,'Narration stopped: '+(job.error??job.status)+'.');}
   else{this.rendering=true;return;}
  }
  p.stage='cut';return await this.save(p,'Building the timeline and exporting the rough cut.');
 }
 async cut(p){
  let film=await this.call('GET','/api/short-films/'+p.projectId);
  if(!film.workflow.timeline)film=await this.call('POST','/api/short-films/'+p.projectId+'/timeline',{signature:film.workflow.signature});
  const project=(await this.call('GET','/api/projects')).find(x=>x.id===p.projectId);
  let start=0;const texts=[];for(const f of p.frames){const end=start+f.targetDuration;if(f.narration&&texts.length<24)texts.push({id:randomUUID(),text:f.narration.slice(0,500),start:Math.round(start*1000)/1000,end:Math.round(end*1000)/1000,position:'bottom',fontSize:28});start=end;}
  const total=Math.min(120,start),own=new Set(p.captionIds??[]),tracks=(project.film?.tracks??[]).filter(t=>t.label!=='Produce narration');
  if(p.narrationJob?.audio)tracks.push({id:randomUUID(),type:'wav',label:'Produce narration',audio:p.narrationJob.audio,start:0,end:Math.max(1,Math.min(total,p.narrationJob.duration??total)),volume:1});
  const keep=(project.film?.texts??[]).filter(t=>!own.has(t.id)).slice(0,24-texts.length);p.captionIds=texts.map(t=>t.id);
  const composed=await this.call('PUT','/api/projects/'+p.projectId+'/composition',{shots:project.shots,film:{...project.film,aspect:p.aspect,tracks,texts:[...keep,...texts]},signature:project.compositionSignature});
  const exported=await this.call('POST','/api/projects/'+p.projectId+'/export',{requestId:randomUUID(),release:'draft'},900000);
  const last=exported.lastExport??composed.lastExport;if(!last?.url)throw Error('The export finished without a movie.');
  p.movie={url:last.url,poster:last.url.replace('movie.mp4','poster.jpg'),subtitles:last.url.replace('movie.mp4','subtitles.srt'),at:last.at};p.stage='done';return await this.save(p,'Rough cut ready.');
 }
 async save(p,message){this.log(p,message);await this.persist();}
 async fail(p,message){p.error=message;this.log(p,message);await this.persist();}
 public(p){return {...p,stageIndex:STAGES.indexOf(p.stage),stages:STAGES,waiting:['review-keyframes','review-clips'].includes(p.stage)};}
}
