import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {LTX_EFFECTS,applyLtxEffect} from '../lib/ltx-effects.mjs';
test('LTX effect pack changes only the local positive prompt, preserving the exact nodes, models and bounded profile',async()=>{
 const graph=JSON.parse(await readFile('workflows/bonus/frameforge-ltx-atmosphere.json','utf8')),before=JSON.stringify(graph);assert.equal(LTX_EFFECTS.length,5);
 for(const e of LTX_EFFECTS){const r=applyLtxEffect(graph,e.id);assert.equal(r.effect.profileTested,e.id==='original');if(e.id==='original')assert.deepEqual(r.graph,graph);else {assert.equal(r.graph['398:376'].inputs.value,e.prompt);r.graph['398:376'].inputs.value=graph['398:376'].inputs.value;assert.deepEqual(r.graph,graph);}}
 assert.equal(JSON.stringify(graph),before);assert.throws(()=>applyLtxEffect(graph,'https://arbitrary.test'));assert.throws(()=>applyLtxEffect({},'rain'));
});
