import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeRequest,buildWorkflow,keyframeReadiness,KEYFRAME_MODEL,MODELS} from '../lib/workflow.mjs';
const input={engine:'keyframes',mode:'image',asset:'11111111-1111-1111-1111-111111111111.png',endAsset:'22222222-2222-2222-2222-222222222222.png',prompt:'A flower opens slowly.',preset:'locked',aspect:'landscape',length:'preview',seed:77,quality:'standard'};
test('Start/end-frame adapter conditions both endpoints through the compatible 5B model',()=>{
 const request=normalizeRequest(input),graph=buildWorkflow(request,'start.png','test','end.png');
 assert.equal(graph['1'].inputs.unet_name,KEYFRAME_MODEL);assert.equal(graph['3'].inputs.vae_name,MODELS.vae);
 assert.equal(graph['7'].class_type,'WanFunInpaintToVideo');assert.deepEqual(graph['7'].inputs.start_image,['4',0]);assert.deepEqual(graph['7'].inputs.end_image,['13',0]);
 assert.equal(graph['13'].inputs.image,'end.png');assert.deepEqual(graph['9'].inputs.latent_image,['7',2]);assert.equal(graph['9'].inputs.cfg,6);assert.equal(request.endAsset,input.endAsset);
 for(const change of [{endAsset:null},{endAsset:'../../file'},{mode:'text'}])assert.throws(()=>normalizeRequest({...input,...change}));
 assert.equal(normalizeRequest({...input,engine:'wan5b'}).endAsset,null);
 const info=Object.fromEntries(Object.values(graph).map(n=>[n.class_type,{input:{required:{}}}]));
 info.UNETLoader.input.required.unet_name=[[KEYFRAME_MODEL]];info.CLIPLoader.input.required.clip_name=[[MODELS.encoder]];info.VAELoader.input.required.vae_name=[[MODELS.vae]];
 assert.equal(keyframeReadiness(info).ready,true);delete info.WanFunInpaintToVideo;assert.equal(keyframeReadiness(info).ready,false);
});
