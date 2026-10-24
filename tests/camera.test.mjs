import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeRequest,buildWorkflow,CAMERA_POSES,CAMERA_MODELS,cameraReadiness} from '../lib/workflow.mjs';
const input={asset:'11111111-1111-1111-1111-111111111111.jpg',preset:'locked',aspect:'landscape',length:'preview',prompt:'A stable architectural scene',engine:'camera',seed:17};
test('Every native camera choice builds paired four-step conditioning with the requested geometry',()=>{
  for(const cameraPose of CAMERA_POSES){
    const request=normalizeRequest({...input,cameraPose,cameraSpeed:0.8});const graph=buildWorkflow(request,'reference.jpg','camera');
    assert.equal(graph['11'].inputs.camera_pose,cameraPose);assert.equal(graph['11'].inputs.speed,.8);
    assert.deepEqual(graph['10'].inputs.camera_conditions,['11',0]);
    assert.equal(graph['3'].inputs.lora_name,CAMERA_MODELS.highLora);assert.deepEqual(graph['3'].inputs.model,['1',0]);
    assert.equal(graph['4'].inputs.lora_name,CAMERA_MODELS.lowLora);assert.deepEqual(graph['4'].inputs.model,['2',0]);
    assert.equal(graph['14'].inputs.end_at_step,2);assert.equal(graph['15'].inputs.start_at_step,2);
    assert.equal(graph['15'].inputs.steps,4);assert.equal(graph['15'].inputs.add_noise,'disable');
    assert.deepEqual(graph['15'].inputs.latent_image,['14',0]);assert.equal(graph['17'].inputs.fps,16);
    assert.equal(graph['8'].inputs.text,input.prompt);assert.equal(request.fps,16);
    for(const node of Object.values(graph))for(const value of Object.values(node.inputs))if(Array.isArray(value))assert.ok(graph[value[0]],'Graph link points to an existing node');
  }
});
test('Camera rejects unsupported controls and requires real model and LoRA availability',()=>{
  for(const change of [{cameraPose:'Orbit'},{cameraSpeed:3},{engine:'unknown'},{quality:'ultra'}])assert.throws(()=>normalizeRequest({...input,...change}));
  const info=Object.fromEntries(Object.values(buildWorkflow(normalizeRequest(input),'x.jpg','x')).map(node=>[node.class_type,{}]));
  assert.equal(cameraReadiness(info).ready,false);assert.ok(cameraReadiness(info).missingModels.includes(CAMERA_MODELS.high));
});
test('Text-to-video builds a reference-free latent and rejects camera mode without an image',()=>{
  const request=normalizeRequest({...input,engine:'wan5b',mode:'text',asset:undefined});
  const graph=buildWorkflow(request,null,'text');
  assert.equal(request.asset,null);assert.equal(graph['4'],undefined);assert.equal(graph['7'].inputs.start_image,undefined);
  assert.equal(graph['7'].class_type,'Wan22ImageToVideoLatent');assert.equal(graph['11'].inputs.fps,24);
  assert.throws(()=>normalizeRequest({...input,mode:'text'}));
});
