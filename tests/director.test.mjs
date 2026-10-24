import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,mkdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {DirectorStore,CAMERA_RECIPES,compileShot,normalizeProduction,productionStatus,productionAssembly} from '../lib/director.mjs';
import {normalizeRequest,buildWorkflow} from '../lib/workflow.mjs';
import {ProjectStore} from '../lib/projects.mjs';
const firstFrame='11111111-1111-1111-1111-111111111111.png';
const shot=(recipe='locked')=>({id:randomUUID(),title:'The signal',action:'Mara raises the compass.',recipe,pace:'slow',length:'preview',screenDirection:'neutral',asset:null,seed:7});
const input=()=>({name:'The signal',aspect:'landscape',bible:{scene:'Observatory',character:'Mara wears a blue coat',prop:'A brass compass',lighting:'Soft window light'},shots:[shot('pan-left'),shot('insert')]});
test('Directed recipes reach their selected adapter without competing default motion; sources are explicit',()=>{
  for(const r of CAMERA_RECIPES){
    const p=normalizeProduction({...input(),shots:[{...shot(r.id),asset:firstFrame}]}),request=compileShot(p,p.shots[0]),normalized=normalizeRequest(request),graph=buildWorkflow(normalized,'frame.png','direction');
    assert.equal(request.preset,'directed');assert.match(request.prompt,/Mara wears a blue coat/);
    assert.ok(request.prompt.includes(r.prompt));assert.ok(r.source);assert.match(r.status,/pending/);
    if(r.native){assert.equal(graph['11'].inputs.camera_pose,r.native);assert.equal(graph['8'].inputs.text,request.prompt);}
    else{assert.equal(normalized.engine,'wan5b');assert.equal(graph['5'].inputs.text.trim(),request.prompt+'.');assert.doesNotMatch(graph['5'].inputs.text,/The camera slowly pans to the right/);}
    assert.equal(normalizeRequest(compileShot({...p}, {...p.shots[0],asset:null})).mode,'text');
  }
  for(const bad of [{shots:[]},{shots:[{...shot(),seed:''}]},{shots:[{...shot(),asset:'../../secret.png'}]},{shots:[{...shot(),recipe:'invented'}]},{shots:[{...shot(),screenDirection:'north'}]}])assert.throws(()=>normalizeProduction({...input(),...bad}));
  const s=shot();assert.throws(()=>normalizeProduction({...input(),shots:[s,s]}));
  const p=normalizeProduction({...input(),shots:[{...shot('pan-right'),asset:firstFrame},{...shot('track-right'),asset:firstFrame}]});
  assert.equal(compileShot(p,p.shots[0]).engine,'wan5b');assert.equal(compileShot(p,p.shots[1]).cameraPose,'Pan Right');
});
test('Production snapshots survive restart, reject concurrent edits and retain previous notes',async()=>{
  const folder=await mkdtemp(path.join(tmpdir(),'frameforge-director-'));
  try{
    let store=await new DirectorStore(folder).open();const pack={id:randomUUID(),name:'Mara',revision:3,character:{assets:[firstFrame],notes:'Copper hair'},location:{assets:[],notes:''},prop:{assets:[],notes:''},style:{assets:[],notes:''}};
    const p=await store.save(input(),pack);pack.character.notes='Changed externally';assert.match(compileShot(p,p.shots[0]).prompt,/Copper hair/);assert.equal(p.shots[0].direction.version,2);
    const revised=await store.save({...p,bible:{...p.bible,lighting:'Amber practical lamps'}},p.pack);
    await assert.rejects(store.save(p,p.pack),/changed elsewhere/);assert.equal(store.get(p.id).revision,2);
    assert.equal(revised.history[0].bible.lighting,'Soft window light');
    const snapshot=store.list();snapshot[0].shots.length=0;assert.equal(store.get(p.id).shots.length,2);
    store=await new DirectorStore(folder).open();assert.equal(store.get(p.id).pack.revision,3);assert.equal(store.get(p.id).bible.lighting,'Amber practical lamps');
    const long={...p,bible:Object.fromEntries(['scene','character','location','prop','style','lighting'].map(k=>[k,'x'.repeat(200)])),shots:[{...shot(),action:'x'.repeat(400),start:'x'.repeat(180),end:'x'.repeat(180)}],pack:{character:{notes:'x'.repeat(300)},location:{notes:'x'.repeat(300)}}};assert.throws(()=>compileShot(long,long.shots[0]),/exceeds/);
  }finally{await rm(folder,{recursive:true,force:true});}
});
test('Only current, matching, checksum-approved takes assemble, in order and without duplicate projects',async()=>{
  const folder=await mkdtemp(path.join(tmpdir(),'frameforge-director-approval-'));
  try{
    const store=await new DirectorStore(folder).open(),p=await store.save({...input(),aspect:'portrait'});
    const jobs=p.shots.map((s,i)=>({id:randomUUID(),video:'output.mp4',request:normalizeRequest(compileShot(p,s)),report:{technicalPass:true,sha256:String(i+1).repeat(64)},review:null}));
    let saved=await store.select(p.id,1,p.shots[0].id,jobs[0].id,jobs);
    saved=await store.select(p.id,saved.revision,p.shots[1].id,jobs[1].id,jobs);
    assert.equal(productionStatus(saved,jobs).ready,false);assert.throws(()=>productionAssembly(saved,jobs),/approved/);
    jobs.forEach(j=>j.review={verdict:'approved',sha256:j.report.sha256});assert.equal(productionStatus(saved,jobs).ready,true);
    const projectStore=await new ProjectStore(folder).open(),assembly=productionAssembly(saved,jobs);
    const [a,b]=await Promise.all([projectStore.createProduction(assembly),projectStore.createProduction(assembly)]);assert.equal(a.id,b.id);assert.equal(projectStore.list().length,1);assert.equal(a.film.aspect,'portrait');assert.deepEqual(a.shots.map(s=>s.jobId),jobs.map(j=>j.id));
    jobs[0].review.sha256='f'.repeat(64);assert.throws(()=>productionAssembly(saved,jobs),/checksum/);jobs[0].review.sha256=jobs[0].report.sha256;
    jobs[0].request.seed++;assert.equal(productionStatus(saved,jobs).shots[0].takes.length,0);await assert.rejects(store.select(saved.id,saved.revision,saved.shots[0].id,jobs[0].id,jobs),/matching/);
    jobs[0].request.seed--;const edited=await store.save({...saved,bible:{...saved.bible,prop:'A silver compass'}});assert.equal(productionStatus(edited,jobs).approvedCount,0);
  }finally{await rm(folder,{recursive:true,force:true});}
});
test('Production API serves the connected workspace, preserves plans and rejects stale assembly',async()=>{
  const folder=await mkdtemp(path.join(tmpdir(),'frameforge-director-api-')),port=23000+Math.floor(Math.random()*1000),base=`http://127.0.0.1:${port}`;
  const draft=input(),fixtureJobs=draft.shots.map(s=>({id:randomUUID(),requestId:randomUUID(),createdAt:new Date().toISOString(),status:'review-ready',video:'output.mp4',request:normalizeRequest(compileShot(draft,s)),report:{technicalPass:true,sha256:'a'.repeat(64)},review:{verdict:'approved',sha256:'a'.repeat(64),notes:'Synthetic API fixture only.'}}));
  for(const job of fixtureJobs){const directory=path.join(folder,'jobs',job.id);await mkdir(directory,{recursive:true});await writeFile(path.join(directory,'job.json'),JSON.stringify(job));await writeFile(path.join(directory,'report.json'),JSON.stringify(job.report));}
  const root=path.dirname(path.dirname(fileURLToPath(import.meta.url))),child=spawn(process.execPath,['server.mjs'],{cwd:root,env:{...process.env,PORT:String(port),STUDIO_DATA:folder,COMFY_URL:'http://127.0.0.1:1'},windowsHide:true,stdio:['ignore','pipe','pipe']});
  const post=(url,body)=>fetch(base+url,{method:'POST',body:JSON.stringify(body)});
  try{
    await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Production test server timed out')),10000);child.stdout.once('data',()=>{clearTimeout(timer);resolve();});child.once('error',reject);});
    const page=await(await fetch(base+'/director')).text();assert.match(page,/href="\/director"[^>]*aria-label="Director"[^>]*aria-current="page"/);assert.match(page,/director.js/);
    assert.equal((await(await fetch(base+'/api/director-catalog')).json()).recipes.length,18);
    const created=await post('/api/director',draft);assert.equal(created.status,201);const p=await created.json();
    const request=await(await fetch(base+`/api/director/${p.id}/shots/${p.shots[0].id}/prepare`)).json();assert.equal(request.request.preset,'directed');assert.equal(request.request.seed,7);assert.equal(request.request.quality,'draft');
    const packet=await fetch(base+`/api/director/${p.id}/packet`);assert.match(packet.headers.get('content-disposition'),/attachment/);assert.equal((await packet.json()).format,'frameforge-production-v1');
    assert.equal((await post(`/api/director/${p.id}/assemble`,{})).status,400);assert.equal((await post(`/api/director/${p.id}/assemble`,{revision:0})).status,400);assert.equal((await post(`/api/director/${p.id}/assemble`,{revision:1})).status,400);
    let revision=p.revision;for(let i=0;i<p.shots.length;i++){const selected=await post(`/api/director/${p.id}/shots/${p.shots[i].id}/select`,{revision,jobId:fixtureJobs[i].id});assert.equal(selected.status,200);revision=(await selected.json()).revision;}
    const first=await(await post(`/api/director/${p.id}/assemble`,{revision})).json(),second=await(await post(`/api/director/${p.id}/assemble`,{revision})).json();assert.ok(first.id);assert.equal(first.id,second.id);assert.deepEqual(first.shots.map(s=>s.jobId),fixtureJobs.map(j=>j.id));
    const latest=await(await fetch(base+`/api/director/${p.id}`)).json();const saved=await post('/api/director',{...latest,bible:{...p.bible,lighting:'Moonlight'},keepPack:true});assert.equal(saved.status,201);assert.equal((await post('/api/director',p)).status,400);
    assert.equal((await(await fetch(base+'/api/jobs')).json()).length,fixtureJobs.length);assert.equal((await(await fetch(base+'/api/projects')).json()).length,1);
  }finally{const closed=new Promise(resolve=>child.once('exit',resolve));if(child.exitCode===null){child.kill();await closed;}await rm(folder,{recursive:true,force:true});}
});
