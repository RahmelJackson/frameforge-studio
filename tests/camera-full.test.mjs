import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeRequest,buildWorkflow,cameraReadiness,CAMERA_MODELS,MODELS} from '../lib/workflow.mjs';
import {normalizeProduction,compileShot,requestSignature} from '../lib/director.mjs';
const base={asset:'11111111-1111-1111-1111-111111111111.png',engine:'camera',preset:'directed',aspect:'landscape',length:'preview',seed:71226,prompt:'A stable cathedral.',cameraPose:'Pan Right',cameraMirror:true};
test('Full camera sampling bypasses acceleration and retains native pose, reference, seed and both model stages',()=>{
 const request=normalizeRequest({...base,cameraSampling:'full'}),g=buildWorkflow(request,'original.png','full');
 assert.equal(request.steps,20);assert.equal(g['3'],undefined);assert.equal(g['4'],undefined);
 assert.deepEqual(g['12'].inputs.model,['1',0]);assert.deepEqual(g['13'].inputs.model,['2',0]);
 for(const key of ['14','15']){assert.equal(g[key].inputs.steps,20);assert.equal(g[key].inputs.cfg,3.5);}
 assert.equal(g['14'].inputs.end_at_step,10);assert.equal(g['15'].inputs.start_at_step,10);assert.equal(g['15'].inputs.add_noise,'disable');assert.equal(g['15'].inputs.end_at_step,20);
 assert.equal(g['14'].inputs.noise_seed,base.seed);assert.equal(g['11'].inputs.camera_pose,'Pan Left');assert.deepEqual(g['17'].inputs.images,['22',0]);
 for(const node of Object.values(g))for(const v of Object.values(node.inputs))if(Array.isArray(v))assert.ok(g[v[0]]);
 assert.deepEqual(normalizeRequest(request),request);assert.equal(normalizeRequest(base).steps,4);assert.throws(()=>normalizeRequest({...base,cameraSampling:'unknown'}));
});
test('Director persists camera sampling and distinguishes full from accelerated takes without invalidating legacy fast takes',()=>{
 const plan=normalizeProduction({name:'Test',bible:{scene:'Cathedral'},shots:[{id:'22222222-2222-2222-2222-222222222222',title:'Track',action:'The knight breathes.',recipe:'track-right',asset:base.asset,seed:base.seed,cameraSampling:'full'}]});
 const request=compileShot(plan,plan.shots[0]);assert.equal(request.cameraSampling,'full');
 assert.notEqual(requestSignature(request),requestSignature({...request,cameraSampling:'fast'}));
 const {cameraSampling,...legacy}=request;assert.equal(requestSignature(legacy),requestSignature({...legacy,cameraSampling:'fast'}));
 assert.throws(()=>normalizeProduction({...plan,shots:[{...plan.shots[0],cameraSampling:'bad'}]}));
});
test('Full-sampling readiness does not require optional acceleration adapters',()=>{
 const info=Object.fromEntries(Object.values(buildWorkflow(normalizeRequest({...base,cameraSampling:'full'}),'x.png','x')).map(n=>[n.class_type,{}]));info.ImageFlip={};
 info.UNETLoader={input:{required:{unet_name:[[CAMERA_MODELS.high,CAMERA_MODELS.low]]}}};info.CLIPLoader={input:{required:{clip_name:[[MODELS.encoder]]}}};info.VAELoader={input:{required:{vae_name:[[CAMERA_MODELS.vae]]}}};
 assert.equal(cameraReadiness(info,'full').ready,true);assert.equal(cameraReadiness(info).ready,false);
 assert.ok(cameraReadiness(info).missingModels.includes(CAMERA_MODELS.highLora));
});
