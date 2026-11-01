// Produce: one idea → a finished rough cut. A production is a thin orchestrator
// over the Studio's own routes (story plan, image/video jobs, speech, timeline
// and export), so every step keeps the same validation, checks and records as
// doing it by hand. It renders one job at a time and stops for review between
// stages unless the owner chooses automatic mode.
import {readFile,writeFile,rename,mkdir} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {stockQueries,STOCK_MAX_SECONDS} from './stock-footage.mjs';
import {FORMAT_STYLES,stylePrompt,visualStyle} from './visual-styles.mjs';
// Errors from helper scripts can carry a whole traceback; keep the last meaningful line.
export function shortError(text){const lines=String(text??'').split(/\r?\n/).map(l=>l.trim()).filter(l=>l&&!/^[\^~]+$/.test(l)&&!/^\)?;?$/.test(l));const last=lines.reverse().find(l=>!/^(File |Traceback)/.test(l))??'unknown error';return last.replace(/^\w+(Error|Exception):\s*/,'').slice(0,160);}
import {normalizeMotion} from './motion.mjs';
import path from 'node:path';

// The same production, one click away in every place it can continue: Studio, the ComfyUI
// graph behind its latest shot, the paired phone and a connected assistant (MCP).
// One on-screen credit line, each author and licence named once.
export function footageCredits(credits=[]){return ('Footage: '+[...new Set(credits.map(c=>c.author+' ('+c.license+')'))].join('; ')).slice(0,500);}
// Caption looks: word box, one word at a time, karaoke fill, classic box, or none.
export const CAPTION_STYLES=['highlight','word','karaoke','box','none'];
export function handoff(p){
 const latest=[...p.frames].reverse().map(f=>f.clip?.jobId??f.image?.jobId).find(Boolean)??null;
 return {studio:'/produce?run='+p.id,graph:latest?'/workflows?job='+latest:null,film:p.projectId?'/short-film?project='+p.projectId:null,phone:'/produce?run='+p.id+'#phone',
  assistant:'Continue my Frameforge production '+p.id+' ("'+String(p.name??'').slice(0,60)+'"): use studio_produce get, tell me what needs review, and continue when I approve.'};
}
export const STAGES=['keyframes','review-keyframes','clips','review-clips','sound','cut','done'];
// Every production gets a strong art direction by default; the format picks which one.
export const LOOKS={...Object.fromEntries(Object.entries(FORMAT_STYLES).map(([format,id])=>[format,stylePrompt(id)])),default:stylePrompt('blockbuster')};
const DONE=j=>!!(j?.report?.technicalPass&&(j.image||j.video)&&j.review?.verdict!=='rejected');
const FAILED=new Set(['failed','technical-failed','verification-blocked','cancelled','needs-attention']);
const uuid=v=>typeof v==='string'&&/^[a-f0-9-]{36}$/.test(v);
const now=()=>new Date().toISOString();
// Wan 5B clip lengths in frames at 24 fps (lib/workflow.mjs LENGTHS).
export function clipLength(seconds){for(const [key,frames] of [['preview',49],['standard',81],['extended',121],['long',241]])if(frames/24>=seconds)return key;throw Error('Beats longer than ten seconds need a shorter plan.');}
const beatText=f=>f.prompt.replace(/^Context:[^.]*\.\s*/,'');
// Story beats are written as directions to a writer ("open with the question…"). Image models
// letter those words onto the frame, so shot prompts turn them into wordless visual intent.
const VISUAL_BEATS=[[/open with the question[^.]*?about ([^.]+)/i,'An intriguing opening image that makes the viewer curious about $1'],[/finish with one practical action and the original question answered/i,'A satisfying closing image that shows the finished result'],[/make the problem visible using one simple example/i,'One simple, clear example of the challenge'],[/show the central mechanism without adding unrelated claims/i,'The key process happening, shown clearly up close'],[/demonstrate the idea with a before-and-after or a short comparison/i,'A clear visual contrast that shows the change']];
export function visualBeat(text){let t=String(text);for(const [re,to] of VISUAL_BEATS)t=t.replace(re,to);return t.replace(/\b(questions?|captions?|title cards?|text)\b/gi,'moment');}
// Shot variety and motion. Without these, every keyframe tends to repeat the same
// side-on framing and Wan clips barely move. Each shot gets its own framing for the
// keyframe and its own explicit camera and subject movement for the clip.
const CALM=new Set(['explainer','explainer-sources','satisfying-loop','life-as','duet-stage']);
export const SHOT_FRAMING=['wide establishing shot','low-angle close shot','high aerial view looking down','side tracking shot at eye level','rear three-quarter view','dramatic close-up'];
// Moderate wording on purpose: "handheld camera" or "whip-pan" makes Wan 5B draw a
// camera into the frame or smear it. These keep motion clearly visible but steady.
export const SHOT_MOTION={
 energetic:['smooth tracking shot moving alongside the subject as it travels at speed','steady push-in toward the subject as the action builds','smooth pan following the subject across the frame','low tracking shot close to the ground following the subject','the view pulls back steadily as the subject moves away into the distance','slow arc around the subject while it keeps moving'],
 calm:['slow push-in while the subject moves naturally','gentle sideways glide with soft parallax as the scene comes alive','slow arc around the subject, which keeps moving','smooth pan revealing the scene while the subject acts','the view drifts back as the subject continues the action','slow upward tilt as the subject moves']};
// The idea leads every shot prompt, so models keep the right cast and place instead of
// inventing a generic person; formats whose cast isn't human say so explicitly.
// Formats whose shots join into one continuous move: each keyframe grows from the last and
// each clip ends exactly on the next keyframe.
export const CONTINUOUS=new Set(['dive']);
export const CAST_NOTES={'dive':'Keep the same place and palette; each view sits inside the previous one.','fruit-romance':'The characters are the fruit, pets or objects themselves: cute, expressive, with faces and small limbs. No humans anywhere in the scene.','satisfying-loop':'No people unless the idea names them.'};
// Captions and titles are added at the cut, so frames never draw (garbled) lettering.
export const NO_TEXT='No written words, letters, titles, signs or captions anywhere in the frame.';
export function shotPrompt(p,f,index,part){const cast=CAST_NOTES[p.format]??'Only the characters and objects from the idea appear; no extra people.';return `${f.visual?f.visual:p.subject+'. '+visualBeat(beatText(f))} ${shotDirection(p,index,part)}. ${cast} ${NO_TEXT} ${p.look}.`.replace(/\s+/g,' ').trim();}
export function shotDirection(p,index,part){const i=index%6;if(part==='image')return SHOT_FRAMING[i]+', the subject captured mid-action';const moves=SHOT_MOTION[(p.motion?p.motion==='calm':CALM.has(p.format))?'calm':'energetic'];return moves[i]+'. Smooth, steady and clearly visible motion of the subject throughout the clip';}

// Remix: what changes when you swap the idea, cast, look, voice, shape, quality,
// narration or individual shot descriptions of a finished production. Only the
// stages that depend on a change are remade; everything else is reused.
export function remixPlan(src,input={}){
 const text=(v,max,name)=>{const t=String(v).trim();if(!t||t.length>max)throw Error(name+' must be 1–'+max+' characters.');return t;};
 const subject=input.subject==null?src.subject:text(input.subject,500,'The idea');
 const look=input.look==null?src.look:text(input.look,300,'The look');
 const aspect=input.aspect??src.aspect;if(!['portrait','landscape','square'].includes(aspect))throw Error('Choose a frame shape.');
 const quality=input.quality??src.quality;if(!['draft','standard'].includes(quality))throw Error('Choose draft or standard quality.');
 const motion=input.motion===undefined?(src.motion??null):(input.motion?normalizeMotion(input.motion):null);
 const voice=input.voice??src.voice;if(!/^[a-z]{2}_[a-z]{2,20}$/.test(voice))throw Error('Choose a narration voice.');
 if(input.frames!=null&&(!Array.isArray(input.frames)||input.frames.length>src.frames.length))throw Error('Send one change per shot at most.');
 const edits=new Map((input.frames??[]).map(f=>{if(!src.frames.some(x=>x.id===f.id))throw Error('That shot is not in this production.');return [f.id,text(f.prompt,2500,'A shot description')];}));
 const lines=input.narration??src.frames.map(f=>f.narration??'');if(!Array.isArray(lines)||lines.length!==src.frames.length||lines.some(l=>typeof l!=='string'||l.length>400))throw Error('Write one narration line (up to 400 characters) per shot.');
 const cast='characterId' in input?(input.characterId?'new':(src.castAsset?'none':'keep')):'keep';
 const changed={subject:subject!==src.subject,look:look!==src.look,aspect:aspect!==src.aspect,quality:quality!==src.quality,motion:motion!==(src.motion??null),voice:voice!==src.voice,cast:cast!=='keep'};
 const everyShot=changed.subject||changed.look||changed.aspect||changed.cast;
 const frames=src.frames.map(f=>{const edited=edits.has(f.id)&&edits.get(f.id)!==f.prompt;const image=everyShot||edited||!f.image?.done;const clip=image||changed.quality||changed.motion||!f.clip?.done;return {id:f.id,title:f.title,edited,image,clip};});
 const narration=changed.voice||lines.some((l,i)=>l.trim()!==(src.frames[i].narration??''))||!!lines.join('').trim()&&!src.narrationJob?.done;
 const reasons=Object.entries(changed).filter(([,v])=>v).map(([k])=>({subject:'new idea',look:'new look',aspect:'new shape',quality:'new quality',motion:'new motion',voice:'new voice',cast:'new cast'}[k]));if(edits.size)reasons.push(frames.filter(f=>f.edited).length+' shot'+(frames.filter(f=>f.edited).length===1?'':'s')+' rewritten');
 return {subject,look,aspect,quality,motion,voice,lines:lines.map(l=>l.trim()),edits,cast,changed,frames,narration,summary:{shots:frames.length,keyframes:frames.filter(f=>f.image).length,clips:frames.filter(f=>f.clip).length,narration,reasons}};
}
// Word-highlight captions. Kokoro reads all narration lines as one recording, so
// word times are estimated across its measured duration (longer words and
// punctuation pauses take longer), then grouped into short phrases of up to five
// words the way short-form captions read on a phone.
export function highlightCaptions(lines,{duration,total,maxItems=22,phrase=5}){
 const words=[];lines.forEach(line=>{for(const w of String(line??'').split(/\s+/).filter(Boolean))words.push(w);});if(!words.length)return [];
 const weight=w=>w.replace(/[^\p{L}\p{N}]/gu,'').length+2+(/[.!?]$/.test(w)?5:/[,;:]$/.test(w)?2.5:0);
 const span=Math.max(1,Math.min(total,duration??total)),lead=Math.min(.2,span*.02),unit=(span-lead)/words.reduce((a,w)=>a+weight(w),0);
 let t=lead;const timed=words.map(w=>{const start=t;t+=weight(w)*unit;return {text:w.slice(0,40),start:Math.round(start*1000)/1000,end:Math.round(Math.min(t,total)*1000)/1000};});
 const size=Math.max(phrase,Math.ceil(timed.length/maxItems)),chunks=[];let cur=[];
 for(const w of timed){cur.push(w);if(cur.length>=size||/[.!?]$/.test(w.text)&&cur.length>=2){chunks.push(cur);cur=[];}}if(cur.length)chunks.push(cur);
 return chunks.slice(0,maxItems).map((c,i,all)=>{const end=Math.min(total,i+1<all.length?all[i+1][0].start:c.at(-1).end+.35);return {text:c.map(w=>w.text).join(' ').slice(0,500),start:c[0].start,end:Math.max(end,c[0].start+.1),position:'bottom',fontSize:28,style:'highlight',words:c.map(w=>({...w,end:Math.min(w.end,end)}))};});
}
export class Productions{
 constructor({directory,call,tick=true,interval=4000,writer=null}){this.file=path.join(directory,'productions.json');this.call=call;this.writer=writer;this.list=[];this.pending=Promise.resolve();this.busy=false;this.tickEnabled=tick;this.interval=interval;}
 async open(){await mkdir(path.dirname(this.file),{recursive:true});try{this.list=JSON.parse(await readFile(this.file,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}if(this.tickEnabled){this.timer=setInterval(()=>this.step().catch(()=>{}),this.interval);this.timer.unref?.();}return this;}
 close(){clearInterval(this.timer);}
 async persist(){const tmp=this.file+'.tmp';await writeFile(tmp,JSON.stringify(this.list,null,1));await rename(tmp,this.file);}
 find(id){const p=this.list.find(p=>p.id===id);if(!p)throw Error('Production not found.');return p;}
 log(p,message){p.events=[...(p.events??[]),{at:now(),message}].slice(-40);p.updatedAt=now();}
 mutate(fn){const run=this.pending.then(async()=>{const value=await fn();await this.persist();return value;});this.pending=run.catch(()=>{});return run;}

 async create(input={}){
  const quality=input.quality??'draft';if(!['draft','standard'].includes(quality))throw Error('Choose draft or standard quality.');
  const look=String(input.look||(input.style&&visualStyle(input.style).prompt)||LOOKS[input.format]||LOOKS.default).trim().slice(0,300);
  const story=await this.call('POST','/api/creator/stories',{format:input.format,duration:Number(input.duration??15),subject:input.subject,name:input.name,aspect:input.aspect,sources:input.sources,characterId:input.characterId||undefined});
  const project=await this.call('POST','/api/creator/stories/'+story.id+'/project',{});
  const film=await this.call('GET','/api/short-films/'+project.id);
  for(const f of film.story.frames)clipLength(f.targetDuration);
  const p={id:randomUUID(),name:story.name,format:story.format,subject:story.subject,aspect:story.aspect,duration:story.duration,quality,look,motion:input.motion?normalizeMotion(input.motion):null,captionStyle:CAPTION_STYLES.includes(input.captionStyle)?input.captionStyle:'highlight',stock:input.stock===true,credits:[],auto:input.auto===true,voice:input.voice??'af_heart',storyId:story.id,projectId:project.id,stage:'keyframes',paused:false,error:null,seed:Math.floor(Math.random()*2**31),castAsset:story.character?.referenceAsset??null,sources:story.sources??null,frames:film.story.frames.map(f=>({id:f.id,title:f.title,prompt:f.prompt,targetDuration:f.targetDuration,image:null,clip:null,narration:''})),narrationJob:null,movie:null,events:[],createdAt:now(),updatedAt:now()};
  this.log(p,'Plan created with '+p.frames.length+' shots. Making keyframes next.');
  return this.mutate(()=>{this.list.unshift(p);return p;});
 }


 async remix(id,input={}){
  const src=this.find(id),plan=remixPlan(src,input);
  if(input.preview)return {preview:true,source:src.id,summary:plan.summary,frames:plan.frames};
  if(!src.frames.some(f=>f.image?.done))throw Error('Remix a production once it has at least one finished keyframe.');
  const name=('Remix · '+String(input.name??src.name)).slice(0,80);
  const story=await this.call('POST','/api/creator/stories',{format:src.format,duration:src.duration,subject:plan.subject,name,aspect:plan.aspect,sources:src.sources??input.sources,characterId:input.characterId||undefined});
  const project=await this.call('POST','/api/creator/stories/'+story.id+'/project',{});
  const film=await this.call('GET','/api/short-films/'+project.id);
  if(film.story.frames.length!==src.frames.length)throw Error('The remix plan came out with a different number of shots. Keep the same format and length.');
  const castAsset=plan.cast==='keep'?src.castAsset:plan.cast==='new'?story.character?.referenceAsset??null:null;
  const storyCopy=structuredClone(film.story);
  const frames=src.frames.map((f,i)=>{const pf=storyCopy.frames[i],decision=plan.frames[i];
   const prompt=plan.edits.get(f.id)??(plan.changed.subject?pf.prompt:f.prompt);
   Object.assign(pf,{title:f.title,prompt,targetDuration:f.targetDuration,imageJobId:decision.image?null:f.image.jobId,takeJobId:decision.clip?null:f.clip.jobId});
   return {id:pf.id,title:f.title,prompt,targetDuration:f.targetDuration,image:decision.image?null:{...f.image},clip:decision.clip?null:{...f.clip},narration:plan.lines[i],remixed:decision.image?'image':decision.clip?'clip':null};});
  await this.call('PUT','/api/short-films/'+project.id,{story:storyCopy,signature:film.workflow.signature});
  const stage=frames.some(f=>!f.image)?'keyframes':frames.some(f=>!f.clip)?'clips':'sound';
  const p={id:randomUUID(),name:story.name,format:src.format,subject:plan.subject,aspect:plan.aspect,duration:src.duration,quality:plan.quality,look:plan.look,motion:plan.motion,auto:input.auto===false?false:true,voice:plan.voice,storyId:story.id,projectId:project.id,stage,paused:false,error:null,seed:src.seed,castAsset,sources:src.sources??null,frames,narrationJob:plan.narration?null:src.narrationJob?{...src.narrationJob}:null,movie:null,remixOf:{id:src.id,name:src.name},events:[],createdAt:now(),updatedAt:now()};
  const s=plan.summary;this.log(p,`Remix of “${src.name}”: remaking ${s.keyframes} of ${s.shots} keyframes and ${s.clips} clips${s.narration?', new narration':', narration reused'}.`);
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
  else if(a==='redo'){const f=p.frames.find(f=>f.id===input.frameId);if(!f)throw Error('Choose a shot.');f.attempt=(f.attempt??0)+1;if(input.part==='image'){f.image=null;f.clip=null;if(STAGES.indexOf(p.stage)>STAGES.indexOf('keyframes'))p.stage='keyframes';}else if(input.part==='clip'){f.clip=null;if(!f.stock)f.stockTried=false;if(STAGES.indexOf(p.stage)>STAGES.indexOf('clips'))p.stage='clips';}else throw Error('Choose image or clip.');if(input.prompt!=null){const text=String(input.prompt).trim();if(!text||text.length>2500)throw Error('Describe the shot in 1–2500 characters.');f.prompt=text;f.visual=null;f.stockQuery=null;}p.movie=null;p.paused=false;p.error=null;this.log(p,'Remaking '+input.part+' for “'+f.title+'”.');}
  else if(a==='retry'){for(const f of p.frames)for(const k of ['image','clip'])if(f[k]?.failed)f[k]=null;if(p.narrationJob?.failed)p.narrationJob=null;p.error=null;p.paused=false;this.log(p,'Retrying.');}
  else throw Error('Unknown production action.');
  return p;});}

 // One step of work across all productions. Only one render runs at a time.
 async step(){if(this.busy)return;this.busy=true;try{for(const p of this.list.filter(p=>!p.paused&&!p.error&&!['done','review-keyframes','review-clips'].includes(p.stage))){await this.advance(p);if(this.rendering)break;}}finally{this.busy=false;}}
 async advance(p){
  this.rendering=false;
  try{
   if(p.stage==='keyframes'&&!p.writer&&!p.frames.some(f=>f.image))await this.writeShots(p);
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
 // A small local language model writes each shot's picture description, narration and stock
 // keywords before any rendering. Without one, the built-in rules below are used.
 async writeShots(p){
  if(!this.writer){p.writer={skipped:'none'};return;}
  try{const result=await this.writer(p);
   if(!result){p.writer={skipped:'no-model'};this.log(p,'No local language model installed; using the built-in shot rules. Install a small model such as Gemma in Ollama for better prompts and narration.');}
   else{p.frames.forEach((f,i)=>{const s=result.shots[i];f.visual=s.visual;if(s.stock)f.stockQuery=s.stock;if(!f.narration&&s.narration)f.narration=s.narration;});p.writer={model:result.model,at:now()};this.log(p,'Shots, narration and stock keywords written by '+result.model+'.');}
  }catch(error){p.writer={skipped:'error',error:String(error.message).slice(0,200)};this.log(p,'The local writer model failed ('+String(error.message).slice(0,160)+'); using the built-in shot rules.');}
  await this.persist();
 }
 async submit(p,f,part){
  const readiness=await this.call('GET','/api/engine-readiness');if(readiness.busy){this.rendering=true;return;}
  const index=p.frames.indexOf(f),requestId=randomUUID(),seed=(p.seed+index*7919+(f.attempt??0)*104729)%2**31,scene=shotPrompt(p,f,index,part);
  let body;
  const next=p.frames[index+1],prev=p.frames[index-1],continuous=CONTINUOUS.has(p.format);
  if(part==='image'&&continuous&&prev?.image?.done){const from=await this.call('POST','/api/jobs/'+prev.image.jobId+'/image-asset',{});body={kind:'image',tool:'edit',asset:from.name,prompt:'Zoom in much closer on the centre of this exact image, as one continuous camera move: same place, same light and colours. Now show: '+scene,aspect:p.aspect,seed};}
  else if(part==='image')body=p.castAsset?{kind:'image',tool:'edit',asset:p.castAsset,prompt:'Keep this exact character. '+scene,aspect:p.aspect,seed}:{kind:'image',tool:'create',prompt:scene,aspect:p.aspect,seed};
  else if(continuous&&next?.image?.done){const [a,b]=await Promise.all([f,next].map(x=>this.call('POST','/api/jobs/'+x.image.jobId+'/image-asset',{})));body={kind:'video',mode:'image',engine:'keyframes',asset:a.name,endAsset:b.name,prompt:scene+' One smooth, continuous push-in of the camera from the first frame into the last.',preset:'push-in',aspect:p.aspect,length:clipLength(f.targetDuration),quality:p.quality,seed,...(p.motion?{motion:p.motion}:{})};}
  else if(p.stock&&!continuous&&!f.stockTried&&(body=await this.stockClip(p,f))){/* stock clip found */}
  else{const still=await this.call('POST','/api/jobs/'+f.image.jobId+'/image-asset',{});body={kind:'video',mode:'image',engine:'wan5b',asset:still.name,prompt:scene,preset:'directed',aspect:p.aspect,length:clipLength(f.targetDuration),quality:p.quality,seed,...(p.motion?{motion:p.motion}:{})};}
  f[part]={requestId,jobId:null};await this.persist();
  let job;try{job=await this.call('POST','/api/jobs',{...body,requestId});}catch(error){if(error.status===409){f[part]=null;this.rendering=true;return;}f[part]=null;throw error;}
  if(!uuid(job?.id)){f[part]=null;this.rendering=true;return;}
  f[part]={requestId,jobId:job.id};this.rendering=true;return await this.save(p,'Rendering '+(part==='image'?'keyframe':'clip')+' '+(index+1)+' of '+p.frames.length+'.');
 }
 // Real stock footage for a shot (explainers): search, import with its licence, and trim it
 // to the shot length with the Edit & finish tool so it becomes a normal checked take.
 async stockClip(p,f){f.stockTried=true;try{
  const used=new Set(p.frames.map(x=>x.stock?.id).filter(Boolean)),candidates=[],seen=new Set();
  const fits=r=>!used.has(r.id)&&!seen.has(r.id)&&(!r.duration||(r.duration>=Math.min(3,f.targetDuration)&&r.duration<=STOCK_MAX_SECONDS));
  for(const query of [...new Set([f.stockQuery,...stockQueries(p.subject+' '+beatText(f))].filter(Boolean))]){const found=await this.call('GET','/api/stock-footage?'+new URLSearchParams({query,aspect:p.aspect}));for(const r of found.results??[])if(fits(r)){seen.add(r.id);candidates.push(r);}if(candidates.length>=3)break;}
  if(!candidates.length){this.log(p,'No stock footage for “'+f.title+'”; animating the keyframe instead.');return null;}
  // A clip can still fail to import (too long, unreadable); try the next one before giving up.
  let pick=null,footage=null,reason='';
  for(const c of candidates.slice(0,3)){try{footage=await this.call('POST','/api/stock-footage/import',c);pick=c;break;}catch(error){reason=shortError(error.message);}}
  if(!pick){this.log(p,'Stock footage for “'+f.title+'” could not be imported ('+reason+'); animating the keyframe instead.');return null;}
  const end=Math.max(.5,Math.min(f.targetDuration,(footage.duration??f.targetDuration)-.05));
  f.stock={id:pick.id,title:pick.title,author:pick.author,license:pick.license,source:pick.source,page:pick.page,footage:footage.id};p.credits=[...(p.credits??[]).filter(c=>c.id!==pick.id),f.stock];
  return {kind:'video-tool',tool:'finish',footage:footage.id,start:0,end:Math.round(end*100)/100,aspect:p.aspect,grade:'original'};
 }catch(error){this.log(p,'Stock footage unavailable for “'+f.title+'” ('+shortError(error.message)+'); animating the keyframe instead.');return null;}}
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
  let start=0;let texts=[];for(const f of p.frames){const end=start+f.targetDuration;if(f.narration&&texts.length<24)texts.push({id:randomUUID(),text:f.narration.slice(0,500),start:Math.round(start*1000)/1000,end:Math.round(end*1000)/1000,position:'bottom',fontSize:28});start=end;}
  const captions=p.captionStyle??'highlight';if(captions==='none')texts=[];
  else if(captions!=='box'&&texts.length)texts=highlightCaptions(p.frames.map(f=>f.narration),{duration:p.narrationJob?.duration,total:Math.min(120,start),phrase:p.aspect==='portrait'?3:5}).map(t=>({id:randomUUID(),...t,style:captions}));
  const total=Math.min(120,start),own=new Set(p.captionIds??[]),tracks=(project.film?.tracks??[]).filter(t=>t.label!=='Produce narration');
  if(p.narrationJob?.audio)tracks.push({id:randomUUID(),type:'wav',label:'Produce narration',audio:p.narrationJob.audio,start:0,end:Math.max(1,Math.min(total,p.narrationJob.duration??total)),volume:1});
  if(p.credits?.length&&texts.length<24){const show=Math.min(3,total);texts.push({id:randomUUID(),text:footageCredits(p.credits),start:Math.round((total-show)*1000)/1000,end:Math.round(total*1000)/1000,position:'top',fontSize:16});}
  const keep=(project.film?.texts??[]).filter(t=>!own.has(t.id)).slice(0,24-texts.length);p.captionIds=texts.map(t=>t.id);
  const composed=await this.call('PUT','/api/projects/'+p.projectId+'/composition',{shots:project.shots,film:{...project.film,aspect:p.aspect,tracks,texts:[...keep,...texts]},signature:project.compositionSignature});
  const exported=await this.call('POST','/api/projects/'+p.projectId+'/export',{requestId:randomUUID(),release:'draft'},900000);
  const last=exported.lastExport??composed.lastExport;if(!last?.url)throw Error('The export finished without a movie.');
  p.movie={url:last.url,poster:last.url.replace('movie.mp4','poster.jpg'),subtitles:last.url.replace('movie.mp4','subtitles.srt'),at:last.at};p.stage='done';return await this.save(p,'Rough cut ready.');
 }
 async save(p,message){this.log(p,message);await this.persist();}
 async fail(p,message){p.error=message;this.log(p,message);await this.persist();}
 public(p){return {...p,stageIndex:STAGES.indexOf(p.stage),stages:STAGES,waiting:['review-keyframes','review-clips'].includes(p.stage),handoff:handoff(p)};}
}
