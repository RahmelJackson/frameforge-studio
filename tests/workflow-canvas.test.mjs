import {NATIVE_WORKFLOWS} from '../lib/native-workflows.mjs';
import test from 'node:test';import assert from 'node:assert/strict';import {fileURLToPath} from 'node:url';
import {WORKFLOWS,workflowPacket,modelDependencies} from '../lib/workflow-catalog.mjs';
import {validateGraph,connect,rebuildLinks,apiToCanvas} from '../public/workflow-graph.js';
const root=fileURLToPath(new URL('../',import.meta.url));
test('All shipped workflows have valid links and accurate local or paid requirements',async()=>{
 assert.equal(WORKFLOWS.length,18+NATIVE_WORKFLOWS.length);
 for(const w of WORKFLOWS){const p=await workflowPacket(root,w.id);validateGraph(p.graph);assert.equal(p.graph.version,0.4);assert.ok(p.graph.nodes.length);if(w.execution==='local'){assert.ok(p.models.length>=1);for(const m of p.models){assert.match(m.url,/^https:\/\/huggingface.co\/[^/]+\/[^/]+\/resolve\/[a-f0-9]{40}\//);assert.match(m.sha256,/^[a-f0-9]{64}$/);assert.match(m.destination,/^models\//);}}else{assert.equal(p.models.length,0);assert.match(w.cloudUrl,/^https:\/\/cloud.comfy.org\/\?template=api_/);assert.match(w.requirements,/credits/);assert.match(w.status,/not tested/);}}
 await assert.rejects(()=>workflowPacket(root,'../../config.local.json'),/Unknown/);
 const seedance=await workflowPacket(root,'seedance-i2v');assert.ok(seedance.graph.nodes.some(n=>n.type==='ByteDance2ReferenceNodeV2'&&n.widgets_values[0]==='Seedance 2.5'));
 const local=await workflowPacket(root,'wan-i2v'),save=local.graph.nodes.find(n=>n.type==='SaveVideo');assert.deepEqual(save.widgets_values,['Frameforge/video','mp4','h264']);assert.deepEqual(save.inputs.map(i=>i.name),['video']);
 assert.deepEqual(local.missingDownloads,[]);const unknown=modelDependencies({nodes:[{widgets_values:['subfolder/private.safetensors','derived.bin']}]},[]);assert.deepEqual(unknown.missingDownloads,['private.safetensors','derived.bin']);assert.deepEqual(unknown.models,[]);
});
test('Graph editing replaces input links, rejects type mismatches and cycles without mutating source',async()=>{
 const {graph}=await workflowPacket(root,'wan-i2v');const before=JSON.stringify(graph);const link=graph.links[0];const updated=connect(graph,link[1],link[2],link[3],link[4]);assert.equal(JSON.stringify(graph),before);assert.equal(updated.links.length,graph.links.length);assert.equal(updated.nodes.find(n=>n.id===link[3]).inputs[link[4]].link,updated.links.at(-1)[0]);
 const image=graph.nodes.find(n=>n.type==='LoadImage'),sampler=graph.nodes.find(n=>n.type==='KSampler');assert.throws(()=>connect(graph,image.id,0,sampler.id,0),/Cannot connect/);
 const cyclic={nodes:[{id:1,type:'A',pos:[0,0],inputs:[{type:'MODEL'}],outputs:[{type:'MODEL'}]},{id:2,type:'B',pos:[10,10],inputs:[{type:'MODEL'}],outputs:[{type:'MODEL'}]}],links:[[1,1,0,2,0,'MODEL']]};assert.throws(()=>connect(cyclic,2,0,1,0),/cycle/);
 assert.throws(()=>validateGraph({processor:'ffmpeg'}),/canvas JSON/);
});
test('API conversion retains links, widget order, seeds and native metadata',()=>{
 const api={'21':{class_type:'Source',inputs:{seed:42,text:'hello'}},'99':{class_type:'Output',inputs:{image:['21',0],prefix:'demo'}}};const schema={Source:{input:{required:{text:['STRING'],seed:['INT',{control_after_generate:true}]}},output:['IMAGE']},Output:{input:{required:{image:['IMAGE'],prefix:['STRING']}},output:[]}};
 const g=apiToCanvas(api,schema);assert.deepEqual(g.nodes[0].widgets_values,['hello',42,'fixed']);assert.deepEqual(g.links,[[1,1,0,2,0,'IMAGE']]);assert.equal(g.nodes[1].inputs[0].link,1);assert.deepEqual(g.nodes[0].properties['frameforge.widget_names'],['text','seed','seed control']);assert.throws(()=>apiToCanvas(api,{}),/Missing node schema/);assert.throws(()=>apiToCanvas({processor:'local-video-tool'},schema),/local processor/);
 const copy=structuredClone(g);copy.extra={unknown:'keep'};assert.equal(rebuildLinks(copy).extra.unknown,'keep');
});
