import {mediaTestSkip} from './media-runtime.mjs';
import test from 'node:test';import assert from 'node:assert/strict';
import {normalizeVideoTool,buildVideoToolWorkflow,RIFE_MODEL,DETAIL_VIDEO_MODEL} from '../lib/video-tools.mjs';
import {normalizeImage,buildImageWorkflow} from '../lib/images.mjs';
import {spawnSync} from 'node:child_process';import {fileURLToPath} from 'node:url';
const id='11111111-1111-1111-1111-111111111111',asset=id+'.png',guide='22222222-2222-2222-2222-222222222222.png';
test('Automatic selection rejects unsafe controls and never silently uses an old drawn mask',()=>{
 const r=normalizeVideoTool({tool:'recolor',sourceJob:id,selectionMode:'clothing',clothingPart:'upper',materialSeed:[.7,.6],mask:asset});assert.equal(r.mask,null);assert.deepEqual(r.materialSeed,[.7,.6]);
 for(const patch of [{selectionMode:'all materials'},{clothingPart:'skin'},{materialSeed:[-1,.6]},{materialSeed:[.3,NaN]},{videoModel:'cloud'},{interpolationModel:'unknown'},{keyframeJob:'../bad'},{motionSafety:'invent'},{isolateGarment:'yes'}])assert.throws(()=>normalizeVideoTool({tool:'masked',sourceJob:id,prompt:'red jacket',...patch}));
 assert.equal(normalizeVideoTool({tool:'recolor',sourceJob:id,mask:asset}).mask,asset);
});
test('Automatic clothing masks reject forbidden pixels and modified classification evidence',{skip:mediaTestSkip('engine')},()=>{const result=spawnSync(fileURLToPath(new URL('../runtime/engine-env/Scripts/python.exe',import.meta.url)),['tests/selection_check.py'],{cwd:new URL('..',import.meta.url),windowsHide:true,encoding:'utf8',timeout:30000});assert.equal(result.status,0,result.stdout+result.stderr);});
test('Alternative video models are explicit and preserve reference and mask bindings',()=>{
 const r=normalizeVideoTool({tool:'masked',sourceJob:id,prompt:'red jacket',videoModel:'detail',keyframeJob:id});r.prepared={size:[288,512],frames:29,fps:16};const g=buildVideoToolWorkflow(r,{video:'source.mp4',reference:'appearance.png',maskVideo:'visible.mp4'});
 assert.ok(Object.values(g).some(n=>n.inputs.unet_name===DETAIL_VIDEO_MODEL));assert.deepEqual(g['8'].inputs.reference_image,['13',0]);
 const inter=normalizeVideoTool({tool:'interpolate',sourceJob:id,interpolationModel:'rife'});inter.prepared=r.prepared;assert.equal(buildVideoToolWorkflow(inter,{video:'source.mp4'})['3'].inputs.model_name,RIFE_MODEL);
});
test('Identity guidance keeps the original portrait distinct from the structural guide',()=>{
 assert.throws(()=>normalizeImage({tool:'identity-pose',asset,prompt:'new pose'}),/guide/);
 const r=normalizeImage({tool:'identity-pose',asset,reference:guide,prompt:'new pose',seed:42,poseStrength:.8});const g=buildImageWorkflow(r,{asset:'original.png',reference:'guide.png'});
 assert.equal(r.steps,30);assert.equal(g['4'].inputs.image,'original.png');assert.equal(g['7'].inputs.image,'guide.png');assert.deepEqual(g['5'].inputs.image,['4',0]);assert.equal(g['12'].inputs.strength,.8);assert.equal(g['14'].inputs.seed,42);assert.equal(g['2'].class_type,'LoraLoader');
 assert.throws(()=>normalizeImage({...r,identityStrength:2}));assert.throws(()=>normalizeImage({...r,swapModel:'cloud'}));assert.throws(()=>normalizeImage({...r,includeBeard:'yes'}));
});
