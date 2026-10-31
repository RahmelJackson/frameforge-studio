import test from 'node:test';import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {NATIVE_WORKFLOWS,nativePacket} from '../lib/native-workflows.mjs';
import {validateGraph} from '../public/workflow-graph.js';
import {inspectRequirements} from '../lib/studio-setup.mjs';
import {OPEN_WORKFLOW_IDS} from '../lib/execution-policy.mjs';
import {searchTasks,workflowDestination} from '../public/studio-journeys.js';
const root=fileURLToPath(new URL('..',import.meta.url));
test('Native additions are real pinned graphs with per-workflow pinned model files, terms and honest execution status',async()=>{
 assert.equal(new Set(NATIVE_WORKFLOWS.map(w=>w.id)).size,NATIVE_WORKFLOWS.length);
 for(const w of NATIVE_WORKFLOWS){const p=await nativePacket(root,w.id);validateGraph(p.graph);assert.ok(p.graph.nodes.length);assert.equal(p.nativeEditorRequired,true);assert.equal(p.generationVerified,['prop-3d','background-cutout','flux3-references'].includes(w.id));assert.match(p.source,/^https:\/\/(raw.githubusercontent.com\/(Comfy-Org|Lightricks|pxl-pshr)\/|huggingface.co\/[^/]+\/[^/]+\/resolve\/[a-f0-9]{40}\/)/);assert.match(p.upstreamCommit,/^[a-f0-9]{40}$/);assert.ok(p.models.length||p.manualDependencies?.length,w.id);if(p.manualDependencies?.length){assert.equal(p.openWeightsReviewed,false);assert.ok(p.missingDownloads.length);}
 for(const m of p.models){assert.match(m.url,/^https:\/\/huggingface.co\/[^/]+\/[^/]+\/resolve\/[a-f0-9]{40}\//);assert.match(m.sha256,/^[a-f0-9]{64}$/);assert.ok(m.bytes>0);assert.match(m.destination,/^models\/[a-z_]+\//);assert.ok(m.licenseUrl);}
 assert.equal(inspectRequirements(p,{}).ready,false);assert.ok(inspectRequirements(p,{}).missingNodes.length);assert.equal(OPEN_WORKFLOW_IDS.includes(w.id),w.openWeightsReviewed);assert.match(workflowDestination(w.id),/^\/native-workflows\?workflow=/);
 }
});
test('The shared Guide finds requested 3D, music, background and reference workflows',()=>{
 for(const [query,id] of [['TRELLIS','prop-3d'],['MoGe','scene-depth'],['ACE-Step','music-ace15'],['BiRefNet','background-cutout'],['H3 reference','h3-references'],['LTX sheet','ltx-ingredients'],['seamless loop','h3-loop'],['style transfer','qwen-style'],['SeedVR2','video-upscale-seedvr2'],['Layout to Render','ltx-layout'],['FLUX 3 Klein base','flux3-base']])assert.ok(searchTasks(query).some(w=>w.id===id),query);
});
test('Loops, style transfer, video upscale, FLUX base and Layout to Render keep their pinned sources and intended settings',async()=>{
 const packet=id=>nativePacket(root,id),all=(g)=>[...g.nodes,...(g.definitions?.subgraphs??[]).flatMap(s=>s.nodes)];
 for(const id of ['h3-loop','h3-loop-draft','h3-loop-restyle']){const p=await packet(id);assert.match(p.source,/pxl-pshr\/ComfyUI-MiniMaxH3-Loop\/[a-f0-9]{40}\//);assert.equal(p.openWeightsReviewed,false);assert.ok(p.missingDownloads.some(d=>/MiniMaxH3-Loop/.test(d)));assert.ok(all(p.graph).some(n=>n.type==='MiniMaxH3Loop'));assert.ok(all(p.graph).some(n=>n.type==='MiniMaxH3LoopDecode'));}
 assert.ok((await packet('h3-loop-draft')).models.some(m=>m.name.includes('turbo_8step_v1.1')));
 assert.ok((await packet('h3-loop-restyle')).models.some(m=>m.directory==='model_patches'));
 const style=await packet('qwen-style'),inner=style.graph.definitions.subgraphs[0].nodes,find=i=>inner.find(n=>n.id===i);
 assert.deepEqual(find(153).widgets_values,['style-transfer-1_20.safetensors',0.8]);assert.deepEqual(find(168).widgets_values,[true]);assert.deepEqual(find(165).widgets_values,[40,'fixed']);assert.deepEqual(find(155).widgets_values,[4]);assert.match(find(151).widgets_values[0],/^style transfer/);
 assert.ok(!JSON.stringify(style.graph).includes('Lightning-4steps-V1.0-bf16.safetensors"'));assert.ok(style.models.every(m=>!/Lightning/.test(m.name)));
 const seed=await packet('video-upscale-seedvr2');assert.ok(all(seed.graph).some(n=>n.type==='SeedVR2TemporalChunk'));assert.ok(seed.models.some(m=>m.name==='seedvr2_3b_int8_convrot.safetensors'));
 assert.ok((await packet('flux3-base')).models.some(m=>m.name==='flux3-image-klein-base-int8-convrot.safetensors'));
 const layout=await packet('ltx-layout');assert.match(layout.source,/^https:\/\/huggingface.co\/Lightricks\/LTX-2.5-22b-IC-LoRA-Layout-To-Render\/resolve\/[a-f0-9]{40}\//);
 assert.ok(!all(layout.graph).some(n=>n.type==='GemmaAPITextEncode'));assert.ok(!/transformer-bf16|ltx-2.3-22b-dev/.test(JSON.stringify(layout.graph)));assert.ok(all(layout.graph).some(n=>n.type==='LTXICLoRALoaderModelOnly'&&n.widgets_values[0]==='ltx-2.5-22b-ic-lora-layout-to-render-1.0.safetensors'));
 for(const id of ['qwen-style','video-upscale-seedvr2','video-upscale-esrgan','flux3-base'])assert.ok(OPEN_WORKFLOW_IDS.includes(id),id);
 for(const id of ['h3-loop','ltx-layout'])assert.ok(!OPEN_WORKFLOW_IDS.includes(id),id);
});
