import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {Productions,clipLength,remixPlan,shotDirection,shotPrompt,SHOT_FRAMING,highlightCaptions} from '../lib/productions.mjs';
import {normalizeFilm} from '../lib/film.mjs';
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
  const film=studio.project.film;assert.ok(film.texts.length>=1&&film.texts.every(t=>t.style==='highlight'&&t.words.length));assert.equal(film.texts.flatMap(t=>t.words).length,p.frames.map(f=>f.narration).join(' ').split(/\s+/).filter(Boolean).length);assert.equal(film.tracks.filter(t=>t.label==='Produce narration').length,1);
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
 const clips=[0,1,2,3,4].map(i=>shotDirection(p,i,'clip'));assert.equal(new Set(clips).size,5);assert.ok(clips.every(c=>/clearly visible motion/.test(c)&&!/handheld|whip/.test(c)));
 assert.match(shotDirection(calm,0,'clip'),/slow/);assert.doesNotMatch(shotDirection(p,0,'clip'),/slow/);
});

test('Motion level flows into clips and a motion change in Remix remakes clips only',()=>{
 const src={subject:'s',look:'l',aspect:'landscape',quality:'draft',voice:'af_heart',motion:null,castAsset:null,frames:[{id:'a',title:'A',prompt:'p',image:{done:true},clip:{done:true},narration:''}],narrationJob:null};
 const r=remixPlan(src,{motion:'dynamic'});assert.equal(r.summary.keyframes,0);assert.equal(r.summary.clips,1);assert.ok(r.summary.reasons.includes('new motion'));
 assert.equal(remixPlan(src,{}).summary.clips,0);assert.throws(()=>remixPlan(src,{motion:'turbo'}),/calm, natural or dynamic/);
 assert.match(shotDirection({format:'explainer',motion:'dynamic'},0,'clip'),/tracking/);assert.match(shotDirection({format:'small-story',motion:'calm'},0,'clip'),/slow/);
});

test('Highlight captions time every word across the narration and group short phrases',()=>{
 const lines=['A red car crosses the desert.','It never stops, not even for the storm.','Then the road ends.'];
 const caps=highlightCaptions(lines,{duration:9,total:15});const words=caps.flatMap(c=>c.words);
 assert.equal(words.length,lines.join(' ').split(' ').length);assert.ok(caps.every(c=>c.words.length<=5&&c.style==='highlight'));
 assert.ok(words.every((w,i)=>i===0||w.start>=words[i-1].start));assert.ok(words.at(-1).end<=9.001);
 for(let i=1;i<caps.length;i++)assert.ok(caps[i].start>=caps[i-1].start);
 assert.deepEqual(highlightCaptions(['',' '],{duration:5,total:5}),[]);
 assert.ok(highlightCaptions(Array.from({length:60},()=>'one two three four five six'),{duration:100,total:120}).length<=22);
});

test('Stock footage fills explainer shots as trimmed Edit & finish takes, with credits; no result falls back to Wan',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'ff-stock-'));try{
  const studio=fakeStudio(),base=studio.call;let offered=1;
  const call=async(method,route,body)=>{if(route.startsWith('/api/stock-footage?')){studio.calls.push([method,route]);return {results:offered-->0?[{id:'commons:1',title:'Ocean waves',url:'https://upload.wikimedia.org/a.webm',duration:12,author:'A. Person',license:'CC BY 4.0',source:'wikimedia',page:'https://commons.wikimedia.org/wiki/File:a.webm'}]:[]};}
   if(route==='/api/stock-footage/import'){studio.calls.push([method,route,body]);return {id:randomUUID(),duration:12,credit:{}};}return base(method,route,body);};
  const prods=await new Productions({directory:dir,call,tick:false}).open();
  const p=await prods.create({format:'what-if',duration:15,subject:'ocean waves at sunset',name:'Waves',stock:true});
  p.frames.forEach(f=>{f.image={jobId:randomUUID(),done:true,url:'/x.png'};});p.stage='clips';
  for(const f of p.frames.slice(0,2)){await prods.submit(p,f,'clip');}
  const posts=studio.calls.filter(c=>c[0]==='POST'&&c[1]==='/api/jobs').map(c=>c[2]);
  assert.equal(posts[0].kind,'video-tool');assert.equal(posts[0].tool,'finish');assert.ok(posts[0].end<=p.frames[0].targetDuration);
  assert.equal(posts[1].kind,'video');assert.equal(posts[1].engine,'wan5b');
  assert.equal(p.credits.length,1);assert.equal(p.frames[0].stock.author,'A. Person');
  prods.close();
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('Stock search keeps only meaningful words and only downloads from known stock hosts',async()=>{
 const {stockQuery,allowedStockUrl,searchCommons}=await import('../lib/stock-footage.mjs');
 assert.equal(stockQuery('Context: why the sky turns red at sunset. Show the scene'),'why sky turns red sunset');
 assert.ok(allowedStockUrl('https://upload.wikimedia.org/x.webm'));assert.ok(!allowedStockUrl('http://upload.wikimedia.org/x.webm'));assert.ok(!allowedStockUrl('https://evil.example/x.webm'));
 const fetcher=async()=>({ok:true,json:async()=>({query:{pages:{'1':{pageid:1,index:1,title:'File:Sunset sea.webm',videoinfo:[{url:'https://upload.wikimedia.org/o.webm',mime:'video/webm',size:5e8,width:1920,height:1080,duration:20,descriptionurl:'https://commons.wikimedia.org/wiki/File:Sunset_sea.webm',extmetadata:{Artist:{value:'<a>Jo</a>'},LicenseShortName:{value:'CC BY-SA 4.0'}},derivatives:[{src:'https://upload.wikimedia.org/720.webm',type:'video/webm; codecs="vp9"',width:1280,height:720}]}]}}}})});
 const r=await searchCommons('sunset sea',{fetcher});assert.equal(r.length,1);assert.equal(r[0].url,'https://upload.wikimedia.org/720.webm');assert.equal(r[0].author,'Jo');assert.equal(r[0].license,'CC BY-SA 4.0');
});

test('Shot prompts lead with the idea and keep the cast; fruit stories have no humans',()=>{
 const f={prompt:'Context: x. One character takes a small, brave step.'};
 const fruit=shotPrompt({format:'fruit-romance',subject:'a shy pear and a bold strawberry',look:'3D film look'},f,0,'image');
 assert.ok(fruit.startsWith('a shy pear and a bold strawberry.'));assert.match(fruit,/No humans/);assert.doesNotMatch(fruit,/Context:/);
 assert.match(shotPrompt({format:'small-story',subject:'a red car',look:'film'},f,1,'clip'),/no extra people/);
 assert.match(shotPrompt({format:'explainer',subject:'bees',look:'film'},f,4,'image'),/No written words/);
});

test('Remaking a shot uses a fresh seed so the new take differs',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'ff-redo-'));try{
  const studio=fakeStudio(),prods=await new Productions({directory:dir,call:studio.call,tick:false}).open();
  const p=await prods.create({format:'what-if',duration:15,subject:'glowing canals',name:'C'});const f=p.frames[0];
  await prods.submit(p,f,'image');const first=studio.calls.filter(c=>c[1]==='/api/jobs'&&c[0]==='POST').at(-1)[2].seed;
  await prods.action(p.id,{action:'redo',frameId:f.id,part:'image'});await prods.submit(prods.find(p.id),prods.find(p.id).frames[0],'image');
  const second=studio.calls.filter(c=>c[1]==='/api/jobs'&&c[0]==='POST').at(-1)[2].seed;assert.notEqual(first,second);prods.close();
 }finally{await rm(dir,{recursive:true,force:true});}
});
