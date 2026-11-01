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
test('continuous dive: each keyframe edits the last and each clip ends on the next keyframe',async()=>{
 const {Productions}=await import('../lib/productions.mjs');const {mkdtemp}=await import('node:fs/promises');const {tmpdir}=await import('node:os');const path=await import('node:path');
 const posted=[];const call=async(method,route,body)=>{if(route==='/api/engine-readiness')return {busy:false};if(route.endsWith('/image-asset'))return {name:route.split('/')[3].slice(0,8)+'-0000-4000-8000-000000000000.png'};if(route==='/api/jobs'){posted.push(body);return {id:'aaaaaaaa-bbbb-4ccc-8ddd-'+String(posted.length).padStart(12,'0')};}return {};};
 const prod=new Productions({directory:await mkdtemp(path.join(tmpdir(),'ff-dive-')),call,tick:false});prod.persist=async()=>{};prod.save=async()=>{};
 const f=(n,img)=>({id:'f'+n,title:'S'+n,prompt:'Context: reef. Beat '+n,targetDuration:3,image:img?{jobId:'1111111'+n+'-2222-4333-8444-555555555555',done:true}:null,clip:null});
 const p={id:'p',format:'dive',subject:'A reef',look:'film',aspect:'landscape',quality:'draft',seed:1,frames:[f(1,true),f(2,false)],events:[]};
 await prod.submit(p,p.frames[1],'image');assert.equal(posted[0].tool,'edit');assert.match(posted[0].asset,/^11111111/);assert.match(posted[0].prompt,/Zoom in much closer/);
 p.frames[1].image={jobId:'11111112-2222-4333-8444-555555555555',done:true};await prod.submit(p,p.frames[0],'clip');
 assert.equal(posted[1].engine,'keyframes');assert.match(posted[1].asset,/^11111111/);assert.match(posted[1].endAsset,/^11111112/);
});
test('setup doctor warns about synced, long and non-English install folders',async()=>{
 const {folderWarnings,setupDoctor}=await import('../lib/setup-doctor.mjs');
 assert.equal(folderWarnings('C:\\Frameforge','win32').length,0);
 assert.match(folderWarnings('C:\\Users\\me\\OneDrive\\Frameforge','win32')[0],/synced/);
 assert.match(folderWarnings('C:\\'+'a'.repeat(120),'win32')[0],/very long/);
 assert.match(folderWarnings('C:\\Users\\José\\Frameforge','win32').join(' '),/non-English/);
 const r=await setupDoctor({root:process.cwd(),python:'none',comfy:{},checkEngine:async()=>({connected:false}),checkMedia:async()=>({available:false}),checkWriter:async()=>({connected:true,model:'gemma3:4b'})});
 assert.equal(r.checks.find(c=>c.id==='writer').state,'ready');
});
