import test from 'node:test';import assert from 'node:assert/strict';
import {OUTCOMES,TOOL_VARIANTS,outcomeCatalog} from '../public/workflow-outcomes.js';
import {WORKFLOWS} from '../lib/workflow-catalog.mjs';
import {IMAGE_TOOLS} from '../lib/images.mjs';import {VIDEO_TOOLS} from '../lib/video-tools.mjs';
const providers=[{id:'ltx-vfx',model:'LTX',execution:'local',featured:{execution:'local',model:'LTX',verification:{model:'LTX'}}},{id:'flux3-video',execution:'partner',model:'FLUX Video',featured:{execution:'local',model:'FLUX Klein'}},{id:'minimax-h3',execution:'partner',model:'H3',featured:{execution:'local',model:'H3'}}];
test('Every portable graph belongs to one distinct task and local/hosted provider graphs keep their input roles',()=>{
 const keys=OUTCOMES.flatMap(t=>t.variants);assert.equal(new Set(keys).size,keys.length);
 for(const w of WORKFLOWS)assert.equal(keys.filter(k=>k===w.id).length,1,w.id);
 const all=outcomeCatalog(WORKFLOWS,providers);assert.equal(all.length,20);
 assert.ok(all.find(t=>t.id==='animate-image').options.some(v=>v.key==='provider:flux3-video:default'));
 assert.ok(!all.find(t=>t.id==='text-video').options.some(v=>v.key.startsWith('provider:flux3')));
 assert.deepEqual(all.find(t=>t.id==='atmosphere-vfx').options[0].verification,{model:'LTX'});
 assert.equal(all.find(t=>t.id==='edit-image').options.length,3);
 assert.ok(all.find(t=>t.id==='animate-image').options.find(v=>v.key==='seedance-draft').label.includes('draft'));
});
test('Search finds model names inside their task and strict filtering retains local provider options',()=>{
 assert.deepEqual(outcomeCatalog(WORKFLOWS,providers,{query:'Klein'}).map(t=>t.id),['edit-image']);
 assert.deepEqual(outcomeCatalog(WORKFLOWS,providers,{query:'LTX'}).map(t=>t.id),['atmosphere-vfx']);
 const local=outcomeCatalog(WORKFLOWS.filter(w=>w.execution==='local'),providers,{openOnly:true});
 assert.ok(local.every(t=>t.options.every(v=>v.execution==='local')));assert.ok(local.some(t=>t.id==='atmosphere-vfx'));assert.ok(local.some(t=>t.id==='animate-image'));assert.ok(!local.some(t=>t.id==='smooth-video'||t.id==='dub'));
 const cloud=outcomeCatalog(WORKFLOWS,providers,{location:'partner'});assert.ok(cloud.every(t=>t.options.every(v=>v.execution==='partner')));
});
test('Configured processors lead to real image/video tool IDs instead of claiming standalone graphs',()=>{
 for(const t of Object.values(TOOL_VARIANTS)){const u=new URL(t.url,'http://localhost');if(u.pathname==='/images')assert.ok(IMAGE_TOOLS.some(x=>x.id===u.searchParams.get('tool')));if(u.pathname==='/video-tools')assert.ok(VIDEO_TOOLS.some(x=>x.id===u.searchParams.get('tool')));}
});
