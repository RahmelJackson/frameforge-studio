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
