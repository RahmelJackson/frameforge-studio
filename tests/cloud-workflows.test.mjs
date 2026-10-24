import test from 'node:test';import assert from 'node:assert/strict';
import {cloudWorkflow,executableGraph} from '../lib/cloud-workflow.mjs';import {canvasToApi,validateGraph,rebuildLinks} from '../public/workflow-graph.js';
const asset='11111111-1111-4111-8111-111111111111.png';
test('External Cloud graphs compile actual Seedance, Seedream and Seed Audio fields and preserve graph edits',()=>{
 for(const task of ['seedance-t2v','seedance-i2v','seedance-frames','seedance-reference','seedance-edit','seedance-extend','seedream-create','seedream-edit','seed-audio']){
  const p=cloudWorkflow(task,{prompt:'Speak or show a quiet observatory.',asset,endAsset:'last.png',video:'source.mp4',aspect:'landscape',seed:42,cloudDuration:5});validateGraph(p.graph);assert.deepEqual(canvasToApi(p.graph),p.api);
  const compiled=executableGraph(p.graph,{api:p.api,files:[{name:asset},{name:'last.png'},{name:'source.mp4'}]});assert.ok(Object.values(compiled).some(n=>n.class_type.startsWith('ByteDance')));
 }
 const p=cloudWorkflow('seedance-i2v',{prompt:'test',asset,cloudDuration:5});const model=p.graph.nodes.find(n=>n.type==='ByteDance2ReferenceNodeV2'),names=model.properties['frameforge.widget_names'];model.widgets_values[names.indexOf('model.prompt')]='Edited prompt';assert.equal(canvasToApi(p.graph)[model.id].inputs['model.prompt'],'Edited prompt');
 model.widgets_values[names.indexOf('model.duration')]=90;assert.throws(()=>executableGraph(p.graph,{api:p.api,files:[{name:asset}]}),/duration/);
 const broken=structuredClone(p.graph);broken.links=[];rebuildLinks(broken);assert.throws(()=>executableGraph(broken,{api:p.api,files:[{name:asset}]}),/required inputs/);
 assert.throws(()=>cloudWorkflow('seedance-i2v',{prompt:'test',cloudDuration:5}),/reference/);assert.throws(()=>cloudWorkflow('kling-unmapped',{prompt:'test'}),/adapter/);
});
