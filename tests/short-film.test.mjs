import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';import {mkdtemp,rm} from 'node:fs/promises';import path from 'node:path';import {tmpdir} from 'node:os';
import {ProjectStore} from '../lib/projects.mjs';import {FilmExportJournal} from '../lib/film-exports.mjs';import {filmSignature,normalizeFilm} from '../lib/film.mjs';import {normalizeShortFilm,shortFilmSignature,shortFilmStatus,storyOrderSignature} from '../lib/short-film.mjs';
const frame=()=>({id:randomUUID(),title:'Opening',prompt:'A quiet scene',imageJobId:null,takeJobId:randomUUID()}),clip=f=>({id:f.takeJobId,video:'output.mp4',report:{technicalPass:true,sha256:'a'.repeat(64)},review:null});
test('Film plans validate media IDs and retain scripts without inventing creative approval',()=>{
 const f=frame(),p=normalizeShortFilm({script:'A scene',frames:[f]});assert.equal(p.silent,false);assert.equal(p.frames[0].imageJobId,null);
 for(const bad of [{frames:[]},{frames:[f,f]},{frames:[{...f,takeJobId:'../../private'}]},{silent:'true'},{script:'x'.repeat(20001)}])assert.throws(()=>normalizeShortFilm({...p,...bad}));
 const project={shots:[{id:f.id,jobId:f.takeJobId}],story:p,storyTimelineSignature:storyOrderSignature(p),film:{tracks:[],texts:[]}},job=clip(f);
 let s=shortFilmStatus(project,[job]);assert.equal(s.reviewed,false);assert.equal(s.canExport,false);assert.equal(s.timeline,true);
 project.story.silent=true;project.story.noCaptions=true;s=shortFilmStatus(project,[job]);assert.equal(s.canExport,true);assert.equal(s.reviewed,false);
 job.review={verdict:'approved',sha256:'a'.repeat(64)};assert.equal(shortFilmStatus(project,[job]).reviewed,true);job.report.sha256='b'.repeat(64);assert.equal(shortFilmStatus(project,[job]).reviewed,false);job.review.verdict='rejected';assert.equal(shortFilmStatus(project,[job]).canAssemble,false);
});
test('Editor reorder is preserved, new storyboard order needs rebuilding, and edits invalidate old exports',()=>{
 const a=frame(),b=frame(),story=normalizeShortFilm({script:'Two scenes',frames:[a,b],silent:true,noCaptions:true}),p={shots:[a,b].map(f=>({id:f.id,jobId:f.takeJobId})),story,storyTimelineSignature:storyOrderSignature(story)},jobs=[clip(a),clip(b)];
 p.lastExport={report:{technicalPass:true},compositionSignature:filmSignature(p)};assert.equal(shortFilmStatus(p,jobs).exported,true);p.shots.reverse();assert.equal(shortFilmStatus(p,jobs).timeline,true);assert.equal(shortFilmStatus(p,jobs).exported,false);story.frames.reverse();assert.equal(shortFilmStatus(p,jobs).timeline,false);
});
test('Muted or out-of-range layers do not complete the sound/caption steps, and still approval is required separately',()=>{
 const f=frame();f.imageJobId=randomUUID();const story=normalizeShortFilm({script:'A scene',frames:[f]}),p={shots:[{id:f.id,jobId:f.takeJobId}],story,storyTimelineSignature:storyOrderSignature(story),film:normalizeFilm({tracks:[{id:randomUUID(),type:'wav',audio:randomUUID(),volume:0,start:0,end:1}],texts:[{id:randomUUID(),text:'Caption',position:'bottom',start:20,end:21}]})},video={...clip(f),report:{technicalPass:true,sha256:'a'.repeat(64),duration:2},review:{verdict:'approved',sha256:'a'.repeat(64)}},image={id:f.imageJobId,image:'output.png',report:{technicalPass:true,sha256:'b'.repeat(64)}};
 assert.equal(shortFilmStatus(p,[video,image]).canExport,false);assert.equal(shortFilmStatus(p,[video,image]).reviewed,false);p.film.tracks[0].volume=1;p.film.texts[0].start=0;p.film.texts[0].end=1;assert.equal(shortFilmStatus(p,[video,image]).canExport,true);image.review={verdict:'approved',sha256:'b'.repeat(64)};assert.equal(shortFilmStatus(p,[video,image]).reviewed,true);
});
test('Scripts, selected media and film layers reopen after restart with stale-save protection',async()=>{
 const base=tmpdir(),dir=await mkdtemp(path.join(base,'short-film-'));assert.ok(dir.startsWith(base+path.sep));try{
 let store=await new ProjectStore(dir).open(),p=await store.create({name:'Production'}),f=frame();const initial=shortFilmSignature(p);p=await store.saveStory(p.id,{script:'A new story',frames:[f]},initial);await assert.rejects(store.saveStory(p.id,{script:'Stale',frames:[f]},initial),/changed elsewhere/);
 p=await store.assembleStory(p.id,shortFilmSignature(p),[clip(f)]);p=await store.compose(p.id,{shots:p.shots,film:{texts:[{id:randomUUID(),text:'Hello',start:0,end:1}]}},filmSignature(p));
 store=await new ProjectStore(dir).open();const saved=store.list()[0];assert.equal(saved.story.script,'A new story');assert.equal(saved.story.frames[0].takeJobId,f.takeJobId);assert.equal(saved.film.texts[0].text,'Hello');assert.equal(shortFilmStatus(saved,[clip(f)]).timeline,true);
 const demo=await store.createShortDemo(p.id);assert.notEqual(demo.id,p.id);assert.equal((await store.createShortDemo(p.id)).id,demo.id);assert.equal(store.list().find(x=>x.id===p.id).name,'Production');
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('Interrupted film export requests survive a new server instance and refuse duplicate starts',async()=>{
 const base=tmpdir(),dir=await mkdtemp(path.join(base,'film-export-'));assert.ok(dir.startsWith(base+path.sep));try{
 const project=randomUUID(),id=randomUUID();let journal=new FilmExportJournal(dir);await journal.begin(project,id,'saved-edit','draft');journal=new FilmExportJournal(dir);assert.equal((await journal.get(project,id)).status,'processing');await assert.rejects(journal.begin(project,id,'saved-edit','draft'),/exist/i);await journal.finish(project,id,{status:'complete',result:{url:'/film.mp4'}});assert.equal((await new FilmExportJournal(dir).get(project,id)).result.url,'/film.mp4');await assert.rejects(journal.get('../private',id),/identifier/);
 }finally{await rm(dir,{recursive:true,force:true});}
});
