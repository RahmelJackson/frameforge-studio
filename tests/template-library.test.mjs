import test from 'node:test';
import assert from 'node:assert/strict';
import {readdir} from 'node:fs/promises';
import {TEMPLATES,TEMPLATE_GROUPS,cloudUrl} from '../public/template-library.js';
import {STORY_FORMATS,storyTemplate} from '../lib/creator-catalog.mjs';
import catalog from '../workflows/native/catalog.json' with {type:'json'};

// A Cloud route must name an official Comfy-Org template that this repo already
// pins: the source of a reviewed native graph, or a partner template file.
const comfyTemplates=new Set([...catalog.filter(e=>/^https:\/\/raw\.githubusercontent\.com\/Comfy-Org\/workflow_templates\//.test(e.source)).map(e=>e.source.split('/').at(-1).replace(/\.json$/,'')),...(await readdir(new URL('../workflows/upstream/',import.meta.url))).filter(f=>f.endsWith('.json')).map(f=>f.replace(/\.json$/,''))]);

test('Templates name real groups, reviewed local graphs, pinned Cloud templates and existing story formats',()=>{
 assert.equal(new Set(TEMPLATES.map(t=>t.id)).size,TEMPLATES.length);
 for(const t of TEMPLATES){
  assert.ok(TEMPLATE_GROUPS.some(g=>g.id===t.group),t.id);assert.ok(t.provide.length&&t.get,t.id);
  if(t.cloud){assert.ok(comfyTemplates.has(t.cloud.template),t.id+' → '+t.cloud.template);assert.equal(cloudUrl(t),'https://cloud.comfy.org/?template='+t.cloud.template);}
  if(t.format){const f=STORY_FORMATS.find(f=>f.id===t.format);assert.ok(f,t.id);for(const id of f.workflows??[])assert.ok(catalog.some(e=>e.id===id),t.id+' uses '+id);const plan=storyTemplate({format:t.format,...t.sample});assert.equal(plan.frames.at(-1).end,t.sample.duration);}
  else{assert.ok(t.title&&t.summary&&t.art,t.id);for(const id of t.workflows)assert.ok(catalog.some(e=>e.id===id),t.id+' uses '+id);assert.ok(catalog.some(e=>e.id===t.local.workflow));}
 }
 for(const id of ['explainer-sources','life-as','micro-drama','fruit-romance','what-if','transformation','satisfying-loop'])assert.ok(TEMPLATES.some(t=>t.format===id),id);
 assert.ok(TEMPLATES.filter(t=>t.group==='basics').length>=8);
 assert.ok(TEMPLATES.filter(t=>t.group==='experimental').every(t=>t.format?STORY_FORMATS.find(f=>f.id===t.format).experimental:t.localNote));
});

import {normalizeScene,layoutPrompt} from '../lib/scenes.mjs';
import {guidedAdvice} from '../lib/studio-assistant.mjs';
test('3D scenes validate tagged objects and camera keys, and build a layout prompt with numbered objects',()=>{
 const scene=normalizeScene({name:'Street',style:'rainy night',objects:[{id:'bakery1',kind:'building',tag:'Bakery',description:'a brick bakery',position:[1,0,2],scale:[6,10,6]},{id:'mira01',kind:'character',tag:'Mira',description:'a woman in a yellow raincoat'}],camera:{keys:[{time:3,position:[0,2,10],target:[0,1,0]},{time:0,position:[2,2,12],target:[0,1,0]}]}});
 assert.equal(scene.camera.keys[0].time,0);assert.equal(scene.objects[1].scale.join(),'1,1,1');
 assert.throws(()=>normalizeScene({objects:[{id:'x',kind:'dragon'}],camera:{keys:[{position:[0,0,0],target:[0,0,0]}]}}),/unique ID|supported/);
 assert.throws(()=>normalizeScene({objects:[],camera:{keys:[]}}),/1–8 camera keys/);
 const prompt=layoutPrompt(scene,[{desc:'Bakery, a brick bakery'},{desc:'Mira, a woman in a yellow raincoat'}]);
 assert.match(prompt,/<ref_image_0>/);assert.match(prompt,/<obj_1> is Bakery, a brick bakery\./);assert.match(prompt,/<obj_2> is Mira/);assert.match(prompt,/rainy night/);
 assert.deepEqual(guidedAdvice('How do I block a shot with dummy buildings and characters?').steps.map(s=>s.id),['scene-3d','ltx-layout']);
});
