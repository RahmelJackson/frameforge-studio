import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {CreativeStore,recipeRequests,motionAdvice} from '../lib/creative-recipes.mjs';
import {normalizeImage} from '../lib/images.mjs';
import {normalizeRequest} from '../lib/workflow.mjs';
import {normalizeVideoTool} from '../lib/video-tools.mjs';
import {createMCPTools} from '../lib/studio-mcp-tools.mjs';
const asset=randomUUID()+'.png',sha256='a'.repeat(64);
test('Recipes freeze the original subject and shared direction, keep explicit seeds and survive restart',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'ff-creative-'));try{const store=await new CreativeStore(dir).open(),subject=await store.saveSubject({kind:'product',name:'Original prop',asset,notes:'Keep the green knob'},sha256);
 const p=await store.savePlan({recipe:'campaign',subjectId:subject.id,brief:'Quiet studio',seed:0});const requests=recipeRequests(p);
 assert.equal(requests.length,3);assert.deepEqual(requests.map(r=>r.seed),[0,1,2]);for(const r of requests){assert.equal(normalizeImage(r).asset,asset);assert.match(r.prompt,/green knob/);assert.match(r.prompt,/Quiet studio/);}
 subject.notes='mutated';assert.equal(store.get(p.id).subject.notes,'Keep the green knob');await store.attach(p.id,{batchId:randomUUID()});assert.equal((await new CreativeStore(dir).open()).get(p.id).signature,p.signature);
 await assert.rejects(store.savePlan({recipe:'performance',subjectId:randomUUID(),brief:'A scene'}),/subject/);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('Performance and motion recipes compile supported local requests and disclose declared risks',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'ff-motion-'));try{const store=await new CreativeStore(dir).open(),subject=await store.saveSubject({kind:'character',name:'Actor',asset},sha256),motion=await store.saveMotion({footage:randomUUID(),name:'Walk',start:1,end:3,framing:'full',fast:true,cuts:true},{duration:4,sha256});
 assert.equal(motionAdvice(motion,'portrait').warnings.length,3);
 const p=await store.savePlan({recipe:'performance',subjectId:subject.id,brief:'Slow daylight'});for(const r of recipeRequests(p))assert.equal(normalizeRequest(r).asset,asset);
 const m=await store.savePlan({recipe:'motion-remix',subjectId:subject.id,motionId:motion.id,brief:'Walk slowly',framing:'full'});const r=normalizeVideoTool(recipeRequests(m)[0]);assert.equal(r.reference,asset);assert.equal(r.footage,motion.footage);assert.equal(r.start,1);assert.equal(r.end,3);
 await assert.rejects(store.saveMotion({name:'Outside',footage:randomUUID(),end:5,framing:'full'},{duration:4,sha256}),/range/);
 await assert.rejects(store.saveMotion({name:'Ambiguous',footage:randomUUID(),sourceJob:randomUUID(),end:2,framing:'full'},{duration:4,sha256}),/one saved/);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('MCP exposes shared recipes without enabling writes in read-only connections',async()=>{
 const calls=[],fetcher=async(url,options)=>{calls.push({url,options});return new Response(JSON.stringify({recipes:[],subjects:[],motions:[],plans:[]}));};
 const read=createMCPTools({base:'http://localhost',fetcher});assert.ok(read.list().some(t=>t.name==='studio_recipe_library'));assert.ok(!read.list().some(t=>t.name==='studio_recipe'));
 await read.call('studio_recipe_library');assert.equal(calls[0].url,'http://localhost/api/creative-library');await assert.rejects(read.call('studio_recipe',{operation:'save_plan',input:{}}),/read-only/);
 const write=createMCPTools({base:'http://localhost',fetcher,allowWrites:true,openWeightsOnly:true});await write.call('studio_recipe',{operation:'prepare',planId:randomUUID(),input:{signature:'x'}});assert.equal(calls.at(-1).options.headers['X-Frameforge-Open-Weights-Only'],'1');
 await assert.rejects(write.call('studio_recipe',{operation:'queue',planId:randomUUID(),input:{signature:'x'}}),/UUID/);
});
test('The judge gateway permits scoped recipe planning and refuses unmetered batches',async()=>{
 const s=await readFile(new URL('../scripts/judge-demo/studio-gateway.mjs',import.meta.url),'utf8').catch(()=>null);if(s===null)return;assert.ok(s.includes("'/recipes'"));assert.match(s,/creative-plans\(\?:\/\$\{id\}\/\(\?:prepare\|frames\|director\)\)/);assert.ok(!s.includes('prepare|queue|frames'));
});
