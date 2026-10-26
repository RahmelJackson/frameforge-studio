import {mediaTestSkip} from './media-runtime.mjs';
import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {spawnSync} from 'node:child_process';
import {normalizeVideoTool,buildVideoToolWorkflow,videoToolReadiness} from '../lib/video-tools.mjs';
const sourceJob='11111111-1111-1111-1111-111111111111';
test('Video requests reject invalid ranges, sources, oversized storyboards and masks',()=>{
  assert.throws(()=>normalizeVideoTool({tool:'finish',sourceJob:'../bad'}),/source|footage|take/);assert.throws(()=>normalizeVideoTool({sourceJob,start:2,end:1}),/end/);assert.throws(()=>normalizeVideoTool({sourceJob,tool:'masked',prompt:'replace',region:[.9,.9,.8,.8]}),/region/);assert.throws(()=>normalizeVideoTool({tool:'story',cards:[]}),/scenes/);
  const r=normalizeVideoTool({tool:'restyle',sourceJob,prompt:'Change the armor to red',seed:42});r.prepared={size:[512,288],frames:33};const graph=buildVideoToolWorkflow(r,{video:'test.mp4'},'test');assert.equal(graph['8'].class_type,'WanVaceToVideo');assert.deepEqual(graph['8'].inputs.control_video,['2',0]);assert.equal(graph['10'].inputs.seed,42);assert.deepEqual(graph['11'].inputs.trim_amount,['8',3]);assert.equal(graph['21'].class_type,'SaveVideo');
  r.tool='masked';const masked=buildVideoToolWorkflow(r,{video:'test.mp4',reference:'ref.png'},'test');assert.equal(masked['18'].inputs.amount,33);assert.deepEqual(masked['8'].inputs.control_masks,['19',0]);assert.deepEqual(masked['8'].inputs.reference_image,['13',0]);assert.equal(videoToolReadiness({}).temporal.ready,false);
});
test('Video processor preserves timing and audio, obeys crop trajectories and keeps storyboard order',{skip:mediaTestSkip('configured')},async()=>{const config=JSON.parse(await readFile(new URL('../config.local.json',import.meta.url),'utf8'));const result=spawnSync(config.python,['tests/video_tool_check.py'],{cwd:new URL('..',import.meta.url),encoding:'utf8',windowsHide:true,timeout:30000});assert.equal(result.status,0,result.stdout+result.stderr);});
test('Masked replacement removes stale contents while old repaint requests retain their graph',()=>{
  const request=normalizeVideoTool({tool:'masked',sourceJob,prompt:'Change jacket',seed:42,maskedContent:'replace'});request.prepared={size:[288,512],frames:29};
  const graph=buildVideoToolWorkflow(request,{video:'source.mp4',maskVideo:'mask.mp4'},'test');
  assert.equal(graph['25'].class_type,'ImageCompositeMasked');assert.deepEqual(graph['25'].inputs.destination,['2',0]);assert.deepEqual(graph['8'].inputs.control_video,['25',0]);assert.equal(graph['23'].inputs.value,.5);assert.deepEqual(graph['8'].inputs.control_masks,['22',0]);
  const legacy=buildVideoToolWorkflow({...request,maskedContent:undefined},{video:'source.mp4',maskVideo:'mask.mp4'},'test');assert.deepEqual(legacy['8'].inputs.control_video,['2',0]);assert.equal(legacy['25'],undefined);
  for(const settings of [{maskedContent:'invent'},{relightMode:'invent'},{relightStrength:-1},{relightStrength:1.1},{relightMaxEV:0},{relightMaxEV:3}])assert.throws(()=>normalizeVideoTool({sourceJob,...settings}));
});
