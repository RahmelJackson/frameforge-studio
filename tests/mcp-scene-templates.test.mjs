import test from 'node:test';
import assert from 'node:assert/strict';
import {createMCPTools} from '../lib/studio-mcp-tools.mjs';
import {normalizeScene,sceneFromPreset} from '../lib/scenes.mjs';
import {SCENE_PRESETS} from '../public/scene-presets.js';
import {handoff,footageCredits} from '../lib/productions.mjs';
test('stock credits name each author once',()=>{assert.equal(footageCredits([{author:'A',license:'CC BY'},{author:'B',license:'CC0'},{author:'A',license:'CC BY'}]),'Footage: A (CC BY); B (CC0)');});

const base='http://127.0.0.1:4317',id='11111111-2222-4333-8444-555555555555';
test('every 3D preset becomes a valid scene, with its tracked camera kept',()=>{
 for(const p of SCENE_PRESETS){const s=normalizeScene(sceneFromPreset(p));assert.equal(s.objects.length,p.objects.length);if(p.track)assert.ok(s.objects.some(o=>o.id===s.camera.track.object));}
});
test('MCP creates a scene from a preset and lists templates with where they open',async()=>{
 const posted=[];const fetcher=async(url,o={})=>{if(url.endsWith('/api/scenes')&&o.method==='POST'){posted.push(JSON.parse(o.body));return Response.json({id,...JSON.parse(o.body)});}if(url.endsWith('/api/scenes'))return Response.json([{id,name:'A',objects:[]}]);if(url.includes('/api/setup'))return Response.json({ready:true,models:[],missingNodes:[]});throw Error(url);};
 const tools=createMCPTools({base,fetcher,allowWrites:true});
 const made=await tools.call('studio_scene',{operation:'create',input:{preset:SCENE_PRESETS[0].id,name:'Chase'}});
 assert.equal(made.open,base+'/scene?scene='+id);assert.equal(posted[0].name,'Chase');
 const list=await tools.call('studio_scene',{operation:'list'});assert.equal(list.presets.length,SCENE_PRESETS.length);
 const templates=await tools.call('studio_templates',{});assert.ok(templates.length>10);assert.ok(templates.every(t=>t.title&&(t.studio||t.comfyui||t.cloud||t.produce)));
 const one=await tools.call('studio_templates',{id:templates.find(t=>t.workflows.length).id,check:true});assert.ok(one.readiness.every(r=>r.ready));
});
test('productions carry one-click handoff links for every place they continue',async()=>{
 const p={id,name:'Bees',projectId:id,frames:[{image:{jobId:'a'},clip:{jobId:'b'}},{image:{jobId:'c'}}]};
 const h=handoff(p);assert.equal(h.studio,'/produce?run='+id);assert.equal(h.graph,'/workflows?job=c');assert.match(h.assistant,/studio_produce get/);
 const tools=createMCPTools({base,allowWrites:true,fetcher:async()=>Response.json({...p,handoff:h})});
 const got=await tools.call('studio_produce',{operation:'get',id});assert.equal(got.open.phone,base+'/produce?run='+id+'#phone');assert.equal(got.open.assistant,undefined);
});
test('caption styles: one word at a time and karaoke are valid film text styles',async()=>{
 const {normalizeFilm}=await import('../lib/film.mjs');const {CAPTION_STYLES}=await import('../lib/productions.mjs');
 assert.deepEqual(CAPTION_STYLES,['highlight','word','karaoke','box','none']);
 for(const style of ['word','karaoke','highlight']){const f=normalizeFilm({texts:[{id:'11111111-2222-4333-8444-555555555555',text:'Every morning',start:0,end:1,style,words:[{text:'Every',start:0,end:.5},{text:'morning',start:.5,end:1}]}]});assert.equal(f.texts[0].style,style);}
 assert.throws(()=>normalizeFilm({texts:[{id:'11111111-2222-4333-8444-555555555555',text:'x',start:0,end:1,style:'wavy'}]}),/caption style/);
});
