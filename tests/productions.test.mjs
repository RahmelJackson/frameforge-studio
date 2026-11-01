import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {Productions,clipLength,remixPlan,shotDirection,SHOT_FRAMING} from '../lib/productions.mjs';
import {storyTemplate} from '../lib/creator-catalog.mjs';

// A small fake of the Studio routes a production uses. Jobs finish on the next
// read, so each tick advances by one observable step.
function fakeStudio(){
 const jobs=new Map(),audio=[],calls=[];let story,project={id:randomUUID(),shots:[],film:{aspect:'portrait',tracks:[],texts:[]},compositionSignature:'c1'},signature='s1',busy=false,timeline=false;
 const call=async(method,route,body)=>{calls.push([method,route,body]);
  if(route==='/api/creator/stories'){const plan=storyTemplate(body);story={...plan,id:randomUUID(),frames:plan.frames.map(f=>({...f,id:randomUUID(),targetDuration:f.duration}))};return story;}
  if(route.endsWith('/project'))return {id:project.id};
  if(route==='/api/short-films/'+project.id&&method==='GET')return {story:{frames:story.frames},workflow:{signature,timeline}};
  if(route==='/api/short-films/'+project.id&&method==='PUT'){assert.equal(body.signature,signature);story.frames=body.story.frames;signature=randomUUID();return {};}
  if(route==='/api/engine-readiness')return {busy};
  if(route==='/api/jobs'&&method==='POST'){const id=randomUUID();jobs.set(id,{id,status:'running',request:body,reads:0});return jobs.get(id);}
  if(route.startsWith('/api/jobs/')&&route.endsWith('/image-asset'))return {name:randomUUID()+'.png'};
  if(route.startsWith('/api/jobs/')){const j=jobs.get(route.split('/')[3]);if(j.reads++>=0){j.status='review-ready';j.report={technicalPass:true,duration:10};if(j.request.kind==='image')j.image='image.png';else j.video='take.mp4';}return j;}
  if(route==='/api/audio-jobs'&&method==='POST'){const j={id:randomUUID(),status:'running',request:body};audio.push(j);return j;}
  if(route==='/api/audio-jobs'){for(const j of audio){j.status='review-ready';j.report={technicalPass:true,duration:12};}return audio;}
  if(route.endsWith('/audio-asset'))return {id:randomUUID()};
  if(route.endsWith('/timeline')){timeline=true;project.shots=story.frames.map(f=>({id:f.id,jobId:f.takeJobId}));return {workflow:{timeline:true}};}
  if(route==='/api/projects')return [project];
  if(route.endsWith('/composition')){project.film=body.film;return project;}
  if(route.endsWith('/export'))return {lastExport:{url:'/films/'+project.id+'/x/movie.mp4',at:'now'}};
  throw Error('Unexpected '+method+' '+route);
 };
 return {call,calls,jobs,setBusy:v=>busy=v,project};
}

test('Clip lengths cover each beat with the shortest Wan length',()=>{assert.equal(clipLength(2),'preview');assert.equal(clipLength(3),'standard');assert.equal(clipLength(5),'extended');assert.equal(clipLength(6),'long');assert.throws(()=>clipLength(11),/ten seconds/);});

test('A production renders one job at a time, stops for review, records narration and exports a rough cut',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'ff-produce-')),studio=fakeStudio();
 try{
  const productions=await new Productions({directory:dir,call:studio.call,tick:false}).open();
  let p=await productions.create({format:'what-if',duration:15,subject:'a city of glowing canals',name:'Canals'});
  assert.equal(p.stage,'keyframes');assert.equal(p.frames.length,5);
  studio.setBusy(true);await productions.step();assert.equal(studio.jobs.size,0,'waits while another render runs');studio.setBusy(false);
  for(let i=0;i<20&&p.stage==='keyframes';i++){await productions.step();assert.ok([...studio.jobs.values()].filter(j=>j.status==='running').length<=1);}
  assert.equal(p.stage,'review-keyframes');assert.ok(p.frames.every(f=>f.image.done&&f.image.url.startsWith('/outputs/')));
  assert.ok([...studio.jobs.values()].every(j=>j.request.kind==='image'&&j.request.tool==='create'&&j.request.prompt.includes(p.look)));
  await productions.step();assert.equal(p.stage,'review-keyframes','does not continue without approval');
  await assert.rejects(()=>productions.action(p.id,{action:'narration',lines:['too few']}),/each shot/);
  await productions.action(p.id,{action:'continue'});
  for(let i=0;i<20&&p.stage==='clips';i++)await productions.step();
  assert.equal(p.stage,'review-clips');const clips=[...studio.jobs.values()].filter(j=>j.request.kind==='video');assert.equal(clips.length,5);assert.ok(clips.every(j=>j.request.length==='standard'&&j.request.quality==='draft'));
  await productions.action(p.id,{action:'narration',lines:p.frames.map((f,i)=>'Line '+(i+1))});
  await productions.action(p.id,{action:'continue'});
  for(let i=0;i<10&&p.stage!=='done';i++)await productions.step();
  assert.equal(p.stage,'done',p.error??'');assert.match(p.movie.url,/movie\.mp4$/);
  const film=studio.project.film;assert.equal(film.texts.length,5);assert.equal(film.tracks.filter(t=>t.label==='Produce narration').length,1);
  // Remaking one shot sends the production back for just that image and clip.
  const before=studio.jobs.size;p=await productions.action(p.id,{action:'redo',frameId:p.frames[2].id,part:'image'});assert.equal(p.stage,'keyframes');assert.equal(p.movie,null);
  for(let i=0;i<10&&p.stage==='keyframes';i++)await productions.step();assert.equal(studio.jobs.size,before+1);
  const reopened=await new Productions({directory:dir,call:studio.call,tick:false}).open();assert.equal(reopened.find(p.id).stage,'review-keyframes');
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('A failed render pauses the production with a readable reason until retried',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'ff-produce-')),studio=fakeStudio();
 try{
  const productions=await new Productions({directory:dir,call:studio.call,tick:false}).open();
  const p=await productions.create({format:'satisfying-loop',duration:15,subject:'paper boats'});
  await productions.step();const job=[...studio.jobs.values()][0];job.reads=-5;job.status='failed';job.error='Out of memory';
  const original=studio.call;await productions.step();
  assert.match(p.error,/Out of memory/);await productions.step();assert.equal(studio.jobs.size,1,'no new work while stopped');
  await productions.action(p.id,{action:'retry'});assert.equal(p.error,null);assert.equal(p.frames[0].image,null);void original;
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('Remix previews affected stages and reuses unchanged keyframes, clips and narration',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'ff-remix-'));try{
  const studio=fakeStudio(),prods=await new Productions({directory:dir,call:studio.call,tick:false}).open();
  const src=await prods.create({format:'what-if',duration:15,subject:'a city of glowing canals',name:'Canals'});
  src.frames.forEach((f,i)=>{f.image={jobId:randomUUID(),done:true,url:'/outputs/a/i'+i+'.png'};f.clip={jobId:randomUUID(),done:true,url:'/outputs/a/c'+i+'.mp4'};f.narration='Line '+i;});src.narrationJob={jobId:randomUUID(),done:true,audio:randomUUID()};src.stage='done';
  // Nothing changed: everything reused.
  let plan=remixPlan(src,{});assert.equal(plan.summary.keyframes,0);assert.equal(plan.summary.clips,0);assert.equal(plan.summary.narration,false);
  // One rewritten shot remakes only that shot.
  plan=remixPlan(src,{frames:[{id:src.frames[1].id,prompt:'A different second shot'}]});assert.equal(plan.summary.keyframes,1);assert.equal(plan.summary.clips,1);assert.ok(plan.frames[1].image&&!plan.frames[0].image);
  // Quality remakes clips only; voice remakes narration only; a new look remakes everything.
  assert.deepEqual([remixPlan(src,{quality:'standard'}).summary.keyframes,remixPlan(src,{quality:'standard'}).summary.clips],[0,src.frames.length]);
  assert.equal(remixPlan(src,{voice:'bf_emma'}).summary.narration,true);assert.equal(remixPlan(src,{voice:'bf_emma'}).summary.keyframes,0);
  assert.equal(remixPlan(src,{look:'watercolour storybook'}).summary.keyframes,src.frames.length);
  assert.throws(()=>remixPlan(src,{frames:[{id:randomUUID(),prompt:'x'}]}),/not in this production/);
  const preview=await prods.remix(src.id,{preview:true,frames:[{id:src.frames[0].id,prompt:'New opening'}]});assert.equal(preview.preview,true);assert.equal(prods.list.length,1);
  const r=await prods.remix(src.id,{frames:[{id:src.frames[0].id,prompt:'New opening'}]});
  assert.equal(prods.list.length,2);assert.equal(r.remixOf.id,src.id);assert.equal(r.stage,'keyframes');
  assert.equal(r.frames[0].image,null);assert.equal(r.frames[1].image.jobId,src.frames[1].image.jobId);assert.equal(r.frames[1].clip.jobId,src.frames[1].clip.jobId);
  assert.equal(r.frames[0].prompt,'New opening');assert.equal(r.narrationJob.audio,src.narrationJob.audio);
  const put=studio.calls.filter(c=>c[0]==='PUT'&&c[1].startsWith('/api/short-films/')).at(-1)[2];assert.equal(put.story.frames[0].imageJobId,null);assert.equal(put.story.frames[1].takeJobId,src.frames[1].clip.jobId);
  prods.close();
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('Each shot gets its own framing and explicit, visible camera and subject motion',()=>{
 const p={format:'small-story'},calm={format:'explainer'};
 const frames=[0,1,2,3,4].map(i=>shotDirection(p,i,'image'));assert.equal(new Set(frames).size,5);assert.ok(frames[0].startsWith(SHOT_FRAMING[0]));
 const clips=[0,1,2,3,4].map(i=>shotDirection(p,i,'clip'));assert.equal(new Set(clips).size,5);assert.ok(clips.every(c=>/clearly visible motion/.test(c)&&/camera/.test(c)));
 assert.match(shotDirection(calm,0,'clip'),/slowly/);assert.doesNotMatch(shotDirection(p,0,'clip'),/slowly/);
});
