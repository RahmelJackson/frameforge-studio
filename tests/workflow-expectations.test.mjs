import test from 'node:test';
import assert from 'node:assert/strict';
import {applyWorkflowSettings} from '../lib/workflow-expectations.mjs';
const video=()=>({'1':{class_type:'CLIPTextEncode',inputs:{text:'Original direction'}},'2':{class_type:'ConditioningZeroOut',inputs:{conditioning:['1',0]}},'3':{class_type:'KSampler',inputs:{positive:['2',0],seed:42,steps:8}},'4':{class_type:'Wan22ImageToVideoLatent',inputs:{width:512,height:288,length:33}},'5':{class_type:'CreateVideo',inputs:{fps:16}}});
test('Edited graph settings update saved requests and verification expectations instead of checking stale form values',()=>{
 const original=video(),edited=structuredClone(original);edited['1'].inputs.text='Edited tracking shot';edited['3'].inputs.seed=123;edited['3'].inputs.steps=10;Object.assign(edited['4'].inputs,{width:640,height:360,length:49});edited['5'].inputs.fps=24;
 const request=applyWorkflowSettings({kind:'video',prompt:'Form text',preset:'dolly',fps:16},edited,original);
 assert.equal(request.prompt,'Edited tracking shot');assert.equal(request.preset,'directed');assert.equal(request.seed,123);assert.equal(request.steps,10);assert.deepEqual(request.workflowExpected,{size:[640,360],frames:49,fps:24});
 const unchanged=applyWorkflowSettings({kind:'video',prompt:'Form text',preset:'dolly',fps:16},original,original);assert.equal(unchanged.prompt,'Form text');assert.equal(unchanged.preset,'dolly');
 edited['4'].inputs.length=['7',0];assert.throws(()=>applyWorkflowSettings({kind:'video'},edited,original),/constant frame count/);
});
test('Image graph geometry and Qwen semantic edits are reflected in the checked image request',()=>{
 const original={'1':{class_type:'TextEncodeQwenImageEditPlus',inputs:{prompt:'Change the coat'}},'2':{class_type:'KSampler',inputs:{positive:['1',0],seed:1,steps:4}},'3':{class_type:'EmptySD3LatentImage',inputs:{width:768,height:768}}},edited=structuredClone(original);edited['1'].inputs.prompt='A red coat';edited['3'].inputs.width=512;
 const request=applyWorkflowSettings({kind:'image',prompt:'Form text'},edited,original);assert.equal(request.prompt,'A red coat');assert.deepEqual(request.size,[512,768]);assert.equal(request.workflowExpected,undefined);
});
