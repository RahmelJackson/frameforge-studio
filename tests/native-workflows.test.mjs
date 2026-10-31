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
 for(const w of NATIVE_WORKFLOWS){const p=await nativePacket(root,w.id);validateGraph(p.graph);assert.ok(p.graph.nodes.length);assert.equal(p.nativeEditorRequired,true);assert.equal(p.generationVerified,['prop-3d','background-cutout','flux3-references'].includes(w.id));assert.match(p.source,/^https:\/\/raw.githubusercontent.com\/(Comfy-Org|Lightricks)\//);assert.match(p.upstreamCommit,/^[a-f0-9]{40}$/);assert.ok(p.models.length||p.manualDependencies?.length,w.id);if(p.manualDependencies?.length){assert.equal(p.openWeightsReviewed,false);assert.ok(p.missingDownloads.length);}
 for(const m of p.models){assert.match(m.url,/^https:\/\/huggingface.co\/[^/]+\/[^/]+\/resolve\/[a-f0-9]{40}\//);assert.match(m.sha256,/^[a-f0-9]{64}$/);assert.ok(m.bytes>0);assert.match(m.destination,/^models\/[a-z_]+\//);assert.ok(m.licenseUrl);}
 assert.equal(inspectRequirements(p,{}).ready,false);assert.ok(inspectRequirements(p,{}).missingNodes.length);assert.equal(OPEN_WORKFLOW_IDS.includes(w.id),w.openWeightsReviewed);assert.match(workflowDestination(w.id),/^\/native-workflows\?workflow=/);
 }
});
test('The shared Guide finds requested 3D, music, background and reference workflows',()=>{
 for(const [query,id] of [['TRELLIS','prop-3d'],['MoGe','scene-depth'],['ACE-Step','music-ace15'],['BiRefNet','background-cutout'],['H3 reference','h3-references'],['LTX sheet','ltx-ingredients']])assert.ok(searchTasks(query).some(w=>w.id===id),query);
});
