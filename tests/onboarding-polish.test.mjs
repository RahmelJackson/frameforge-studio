import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';import path from 'node:path';import {tmpdir} from 'node:os';import {fileURLToPath} from 'node:url';import {execFileSync} from 'node:child_process';
import {configuredStudioAddress} from '../scripts/frameforge-mcp.mjs';
import {setupDoctor} from '../lib/setup-doctor.mjs';import {enginePresentation} from '../public/studio-chrome.js';
import {nativePacket,NATIVE_WORKFLOWS} from '../lib/native-workflows.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
test('Doctor distinguishes optional browsing software from local execution blockers without inference',async()=>{
 const options={root,python:'unused',comfy:{request(){throw Error('Unexpected request');}},checkMedia:async()=>({available:false}),checkEngine:async()=>({connected:false})};
 const browsing=await setupDoctor(options);assert.equal(browsing.blocking,0);assert.equal(browsing.canBrowse,true);assert.equal(browsing.checks.find(c=>c.id==='engine').state,'optional');
 const local=await setupDoctor({...options,mode:'local'});assert.equal(local.blocking,1);assert.equal(local.checks.find(c=>c.id==='media').state,'optional');assert.match(local.actions,/No installs/);
});
test('Engine labels reflect the connection and explain per-workflow requirements',()=>{
 assert.equal(enginePresentation().label,'Get set up');assert.equal(enginePresentation({quickstartComplete:true}).label,'Engine offline');assert.equal(enginePresentation({},true).label,'Online mode');
 const ready=enginePresentation({connected:true});assert.equal(ready.label,'Engine ready');assert.match(ready.hint,/Each workflow/);assert.match(ready.hint,/optional media/);
});
test('Plugin honors a saved nondefault port; an explicit address takes precedence',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'ff-connection-'));
 try{assert.equal(await configuredStudioAddress({directory:dir,env:{}}),'http://127.0.0.1:4317');await writeFile(path.join(dir,'config.local.json'),JSON.stringify({port:4322}));assert.equal(await configuredStudioAddress({directory:dir,env:{}}),'http://127.0.0.1:4322');assert.equal(await configuredStudioAddress({directory:dir,env:{STUDIO_URL:'http://127.0.0.1:4324'}}),'http://127.0.0.1:4324');await writeFile(path.join(dir,'config.local.json'),JSON.stringify({port:-1}));await assert.rejects(()=>configuredStudioAddress({directory:dir,env:{}}),/Invalid Studio port/);}
 finally{assert.ok(dir.startsWith(path.resolve(tmpdir())+path.sep));await rm(dir,{recursive:true,force:true});}
});
test('Desktop extension installer accepts its user custom_nodes folder without main.py',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'ff-desktop-user-'));
 try{assert.throws(()=>execFileSync(process.execPath,[path.join(root,'scripts/install-comfy-bridge.mjs'),dir],{stdio:'pipe'}));await mkdir(path.join(dir,'custom_nodes'));execFileSync(process.execPath,[path.join(root,'scripts/install-comfy-bridge.mjs'),dir],{stdio:'pipe'});assert.match(await readFile(path.join(dir,'custom_nodes/comfyui-frameforge/__init__.py'),'utf8'),/Frameforge/);}
 finally{assert.ok(dir.startsWith(path.resolve(tmpdir())+path.sep));await rm(dir,{recursive:true,force:true});}
});
test('Every local LTX export removes online validation paths and prompt-helper weights, preserving nested sockets',async()=>{
 for(const w of NATIVE_WORKFLOWS.filter(w=>w.id.startsWith('ltx-'))){const p=await nativePacket(root,w.id);assert.ok(!p.models.some(m=>/gemma4_e2b|transformer-bf16|proj-ltx-2.5-bf16/.test(m.name)),w.id);assert.ok(p.models.some(m=>m.name.includes('transformer-comfy-int8')));
  for(const sub of [p.graph,...p.graph.definitions.subgraphs]){const ids=new Map(sub.nodes.map(n=>[n.id,n]));assert.ok(!sub.nodes.some(n=>['GemmaAPITextEncode','TextGenerateLTX2Prompt','StringContains'].includes(n.type)),w.id);for(const row of sub.links){const l=Array.isArray(row)?{id:row[0],origin_id:row[1],origin_slot:row[2],target_id:row[3],target_slot:row[4]}:row;
   if(l.origin_id===-10)assert.ok(sub.inputs[l.origin_slot],w.id+' input boundary');else assert.ok(ids.get(l.origin_id)?.outputs?.[l.origin_slot],w.id+' source');
   if(l.target_id===-20)assert.ok(sub.outputs[l.target_slot],w.id+' output boundary');else assert.equal(ids.get(l.target_id)?.inputs?.[l.target_slot]?.link,l.id,w.id+' destination');
  }}
 }
});
