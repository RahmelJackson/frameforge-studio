import {mediaTestSkip} from './media-runtime.mjs';
import test from 'node:test';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';import path from 'node:path';import {randomUUID} from 'node:crypto';
import {normalizeAudio} from '../lib/audio.mjs';import {normalizeVideoTool,buildVideoToolWorkflow} from '../lib/video-tools.mjs';import {parseLipHolds,formatLipHolds} from '../public/lip-holds.js';
test('Covered-mouth ranges accept explicit timing, reject unsafe/overlapping inputs and restore precision',()=>{
  const request={tool:'lipsync',requestId:randomUUID(),source:{kind:'footage',id:randomUUID()},audioSource:{kind:'audio',id:randomUUID()}};
  const holds=parseLipHolds('0.80-1.28\n1.60–1.80');assert.deepEqual(parseLipHolds(formatLipHolds(holds)),holds);assert.deepEqual(normalizeAudio({...request,lipHolds:holds}).lipHolds,holds);
  for(const ranges of [[{start:-1,end:1}],[{start:0,end:9}],[{start:1,end:1.01}],[{start:0,end:1},{start:.5,end:2}],Array(9).fill({start:0,end:1})])assert.throws(()=>normalizeAudio({...request,lipHolds:ranges}));
  assert.deepEqual(parseLipHolds(formatLipHolds([{start:.805,end:1.285}])),[{start:.805,end:1.285}]);assert.throws(()=>parseLipHolds('<script>'));assert.throws(()=>parseLipHolds('one-second'));
});
test('Still-guided borders require a selected guide and preserve the VACE mask/reference wiring',()=>{
 const base={tool:'outpaint',sourceJob:randomUUID(),prompt:'Continuous sky',aspect:'landscape',outpaintInset:.1};
 assert.throws(()=>normalizeVideoTool({...base,outpaintGuide:true}),/guide/);assert.throws(()=>normalizeVideoTool({...base,outpaintInset:.4}),/padding/);
 const request=normalizeVideoTool({...base,outpaintGuide:true,keyframeJob:randomUUID()});request.prepared={size:[512,288],frames:13};
 const graph=buildVideoToolWorkflow(request,{video:'input.mp4',maskVideo:'mask.mp4',reference:'guide.png'},'test');assert.deepEqual(graph['8'].inputs.reference_image,['13',0]);assert.deepEqual(graph['8'].inputs.control_masks,['19',0]);
});
test('Real encoded border fixtures preserve source pixels, bind the still and reject guide tampering',{skip:mediaTestSkip('audio')},()=>{
 const result=spawnSync(path.join(process.cwd(),'runtime/audio-env/Scripts/python.exe'),['tests/round10_check.py'],{encoding:'utf8',windowsHide:true,timeout:30000});assert.equal(result.status,0,result.stdout+result.stderr);
});
