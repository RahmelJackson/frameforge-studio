import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {normalizeImage,buildImageWorkflow,imageReadiness} from '../lib/images.mjs';
import {normalizeImageSelection} from '../lib/segmentation.mjs';
import {apiToCanvas,canvasToApi} from '../public/workflow-graph.js';
import {assertOpenGraph,assertOpenInput} from '../lib/execution-policy.mjs';
const asset='11111111-1111-4111-8111-111111111111.png';
const info=JSON.parse(await readFile(new URL('../workflows/node-schemas.json',import.meta.url))),models=JSON.parse(await readFile(new URL('../workflows/models.json',import.meta.url)));

test('SAM selection rejects invalid geometry, contradictory points and empty targets',()=>{
 for(const input of [{prompt:''},{prompt:'x',segmentThreshold:0},{segmentMethod:'box',segmentBox:{x:.8,y:.2,width:.4,height:.1}},{segmentMethod:'points',segmentPoints:[{x:.2,y:.3,label:0}]},{segmentMethod:'points',segmentPoints:[{x:.2,y:.3,label:1},{x:.2,y:.3,label:0}]}])assert.throws(()=>normalizeImageSelection(input));
 assert.throws(()=>normalizeImage({tool:'select',asset:'../private.png',prompt:'person'}),/source/);
});

test('Text, point and box graphs preserve native selection inputs through the editable graph round trip',()=>{
 for(const extra of [{segmentMethod:'text'},{segmentMethod:'points',segmentPoints:[{x:1,y:0,label:1},{x:0,y:1,label:0}]},{segmentMethod:'box',segmentBox:{x:.25,y:.125,width:.5,height:.5}}]){
  const request={...normalizeImage({tool:'select',asset,prompt:'the green knob',...extra}),size:[1024,512]},api=buildImageWorkflow(request,{asset},'test/selection');
  const canvas=apiToCanvas(api,info),round=canvasToApi(canvas),detect=Object.values(round).find(n=>n.class_type==='SAM3_Detect');
  assert.equal(detect.inputs.refine_iterations,1);assert.equal(detect.inputs.individual_masks,false);assert.equal(detect.inputs.threshold,extra.segmentMethod==='text'?.65:.5);
  if(extra.segmentMethod==='points'){assert.equal(round[detect.inputs.positive_coords[0]].inputs.value,'[{"x":1023,"y":0}]');assert.equal(round[detect.inputs.negative_coords[0]].inputs.value,'[{"x":0,"y":511}]');}
  if(extra.segmentMethod==='box'){assert.equal(round[detect.inputs.positive_coords[0]].inputs.value,'[{"x":512,"y":192}]');}if(extra.segmentMethod==='box')assert.deepEqual(round[detect.inputs.bboxes[0]].inputs,{x:256,y:64,width:512,height:256});
  if(extra.segmentMethod==='text')assert.equal(round[detect.inputs.conditioning[0]].inputs.text,'the green knob');
  assertOpenInput('images',request);assertOpenGraph(round,models);
 }
});

test('SAM readiness identifies the actual checkpoint and native node dependencies',()=>{
 assert.equal(imageReadiness(info).select.ready,true);
 const missing=structuredClone(info);delete missing.SAM3_Detect;assert.deepEqual(imageReadiness(missing).select.missingNodes,['SAM3_Detect']);
 const noWeights=structuredClone(info);noWeights.CheckpointLoaderSimple.input.required.ckpt_name=[[]];assert.deepEqual(imageReadiness(noWeights).select.missingModels,['sam3.1_multiplex_fp16.safetensors']);
});
