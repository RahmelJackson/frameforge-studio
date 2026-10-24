import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {normalizeImage,buildImageWorkflow,ANGLE_MODEL} from '../lib/images.mjs';
import {normalizeVideoTool,buildVideoToolWorkflow} from '../lib/video-tools.mjs';
import {normalizeSegmentPoints,SEGMENT_MODEL} from '../lib/segmentation.mjs';
import {normalizeAudio} from '../lib/audio.mjs';
const asset=randomUUID()+'.png',sourceJob=randomUUID();
test('Trained angle requests retain the original and reject unsupported geometry or adapter strength',()=>{
 const input={tool:'views',asset,prompt:'Retain the original subject.',seed:12,view:{azimuth:'back-right quarter view',elevation:'eye-level shot',distance:'medium shot'}};
 const r=normalizeImage(input),g=buildImageWorkflow(r,{asset:'original.png'},'test');
 assert.equal(g['21'].inputs.lora_name,ANGLE_MODEL);assert.deepEqual(g['10'].inputs.model,['21',0]);assert.deepEqual(g['21'].inputs.model,['9',0]);assert.equal(g['21'].inputs.strength_model,.9);assert.match(JSON.stringify(g),/<sks> back-right quarter view eye-level shot medium shot/);assert.equal(r.asset,asset);
 for(const change of [{view:{azimuth:'arbitrary'}},{viewStrength:2},{viewStrength:NaN}])assert.throws(()=>normalizeImage({...input,...change}));
});
test('Neural video selections require explicit points, avoid text detection and bind checked reuse',()=>{
 const points=[{x:.4,y:.6,label:1},{x:.6,y:.2,label:0}],r=normalizeVideoTool({tool:'segment',sourceJob,segmentPoints:points});
 const g=buildVideoToolWorkflow({...r,prepared:{size:[512,288],fps:16}},{video:'prepared.mp4'},'test');
 assert.equal(g['3'].inputs.ckpt_name,SEGMENT_MODEL);assert.deepEqual(g['6'].inputs.initial_mask,['5',0]);assert.equal(g['6'].inputs.conditioning,undefined);assert.equal(g['5'].inputs.conditioning,undefined);assert.equal(JSON.parse(g['5'].inputs.positive_coords)[0].x,204);assert.equal(g['6'].inputs.max_objects,1);
 for(const bad of [undefined,[],[{x:.5,y:.5,label:0}],[{x:2,y:0,label:1}],[...points,{...points[0],label:0}]])assert.throws(()=>normalizeSegmentPoints(bad));
 assert.throws(()=>normalizeVideoTool({tool:'segment',sourceJob}));
 assert.throws(()=>normalizeVideoTool({tool:'masked',sourceJob,prompt:'Change garment',selectionMode:'segment'}));
 const reuse=normalizeVideoTool({tool:'masked',sourceJob,prompt:'Change garment',selectionMode:'segment',segmentationJob:randomUUID()});assert.ok(reuse.segmentationJob);assert.equal(reuse.segmentPoints,undefined);
});
test('Neural mask previews reconstruct exactly and refuse changed masks, sources, ranges and crops',()=>{
 const r=spawnSync(path.join(process.cwd(),'runtime/engine-env/Scripts/python.exe'),['tests/round12_check.py'],{encoding:'utf8',timeout:30000,windowsHide:true});assert.equal(r.status,0,r.stdout+r.stderr);
});
test('Speech upgrades preserve old defaults, reject unsupported event tags and freeze actual Turbo controls',()=>{
 const speech={requestId:randomUUID(),tool:'expressive',text:'We made it. [chuckle] Let us begin.',speechEngine:'turbo'};
 assert.equal(normalizeAudio(speech).exaggeration,0);assert.equal(normalizeAudio(speech).cfgWeight,0);
 assert.throws(()=>normalizeAudio({...speech,speechEngine:'original'}));assert.throws(()=>normalizeAudio({...speech,text:'[invented event] Hello.'}));
 const transcript={requestId:randomUUID(),tool:'transcribe',source:{kind:'audio',id:randomUUID()}};assert.equal(normalizeAudio(transcript).asrModel,'small');assert.equal(normalizeAudio({...transcript,asrModel:'turbo'}).asrModel,'turbo');assert.throws(()=>normalizeAudio({...transcript,asrModel:'cloud'}));
 const dialogue={requestId:randomUUID(),tool:'dialogue',speechEngine:'turbo',dialogueEngine:'expressive',speakers:[{id:'host',name:'Host',voice:'af_heart',targetVoice:{kind:'audio',id:randomUUID()}}],lines:[{speaker:'host',text:'Hello. [sigh]',exaggeration:.9,cfgWeight:.7}]};assert.equal(normalizeAudio(dialogue).lines[0].exaggeration,0);assert.throws(()=>normalizeAudio({...dialogue,dialogueEngine:'preset'}));
});
test('Detected body guides stay local, retain framing and cannot silently submit a diffusion graph',()=>{
 const r=normalizeVideoTool({tool:'pose-guide',sourceJob,poseFraming:'upper'});assert.equal(r.poseFraming,'upper');assert.throws(()=>normalizeVideoTool({...r,poseFraming:'invent-legs'}));assert.throws(()=>normalizeVideoTool({...r,audio:randomUUID()}));assert.throws(()=>buildVideoToolWorkflow(r,{},'test'),/locally/);
});
