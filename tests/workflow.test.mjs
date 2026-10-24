import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRequest,buildWorkflow,readiness,MODELS,PRESETS,SIZES,LENGTHS } from '../lib/workflow.mjs';
import { ComfyClient,findVideos } from '../lib/comfy.mjs';
const input={asset:'11111111-1111-1111-1111-111111111111.png',prompt:'A knight breathes.',preset:'push-in',aspect:'landscape',length:'preview',seed:42,quality:'draft'};
test('Every preset produces a connected image-to-video graph and preserves user intent',()=>{
  for(const preset of PRESETS){
    const request=normalizeRequest({...input,preset:preset.id});const graph=buildWorkflow(request,'reference.png','test/output');
    assert.match(graph['5'].inputs.text,/A knight breathes/);assert.ok(graph['5'].inputs.text.includes(preset.prompt));
    assert.deepEqual(graph['7'].inputs.start_image,['4',0]);
    assert.equal(graph['12'].class_type,'SaveVideo');assert.equal(graph['9'].inputs.seed,42);
    for(const node of Object.values(graph))for(const value of Object.values(node.inputs))if(Array.isArray(value))assert.ok(graph[value[0]],'All graph links must resolve');
  }
});
test('All formats and lengths use compatible video dimensions and temporal compression',()=>{
  for(const aspect of Object.keys(SIZES))for(const length of Object.keys(LENGTHS)){
    const graph=buildWorkflow(normalizeRequest({...input,aspect,length}),'reference.png','test');
    assert.equal(graph['7'].inputs.width%16,0);assert.equal(graph['7'].inputs.height%16,0);assert.equal((graph['7'].inputs.length-1)%4,0);
  }
});
test('Reject invalid parameters and paths before accessing engine',()=>{
  for(const change of [{asset:'../../secret.png'},{preset:'unknown'},{aspect:'bad'},{length:'toString'},{prompt:''},{seed:-1},{seed:1.5},{seed:'NaN'},{prompt:'a'.repeat(2501)}])assert.throws(()=>normalizeRequest({...input,...change}));
});
test('Readiness requires both node implementations and actual models',()=>{
  const graph=buildWorkflow(normalizeRequest(input),'test.png','test');
  const info=Object.fromEntries(Object.values(graph).map(x=>[x.class_type,{input:{required:{}}}]));
  assert.equal(readiness(info).ready,false);
  info.UNETLoader.input.required.unet_name=[[MODELS.diffusion]];info.CLIPLoader.input.required.clip_name=[[MODELS.encoder]];info.VAELoader.input.required.vae_name=[[MODELS.vae]];
  assert.equal(readiness(info).ready,true);delete info.SaveVideo;assert.equal(readiness(info).ready,false);
});
test('Only saved video outputs qualify, not PNG previews or temporary clips',()=>{
  assert.deepEqual(findVideos({'1':{images:[{filename:'preview.png',type:'output'},{filename:'tmp.mp4',type:'temp'},{filename:'final.mp4',type:'output'}]}}),[{filename:'final.mp4',type:'output'}]);
});
test('Local connector rejects external or non-HTTP endpoints',()=>{
  assert.throws(()=>new ComfyClient('https://example.com'));assert.throws(()=>new ComfyClient('http://169.254.169.254'));assert.doesNotThrow(()=>new ComfyClient('http://127.0.0.1:8188'));
});
