import {mediaTestSkip} from './media-runtime.mjs';
import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';import {spawnSync} from 'node:child_process';import path from 'node:path';
import {normalizeAudio} from '../lib/audio.mjs';import {normalizeVideoTool,buildVideoToolWorkflow} from '../lib/video-tools.mjs';
test('Expressive dialogue binds references per speaker and bounds individual delivery and total scope',()=>{
 const r={tool:'dialogue',requestId:randomUUID(),dialogueEngine:'expressive',speakers:[{id:'host',name:'Host',voice:'af_heart',targetVoice:{kind:'audio',id:randomUUID()}}],lines:[{speaker:'host',text:'Hello.',exaggeration:.8,cfgWeight:.3}]};
 const n=normalizeAudio(r);assert.equal(n.lines[0].exaggeration,.8);assert.equal(n.speakers[0].targetVoice.id,r.speakers[0].targetVoice.id);
 for(const patch of [{dialogueEngine:'cloud'},{speakers:[{...r.speakers[0],targetVoice:null}]},{lines:[{...r.lines[0],exaggeration:2}]},{lines:[{...r.lines[0],cfgWeight:NaN}]},{lines:Array(9).fill(r.lines[0])}])assert.throws(()=>normalizeAudio({...r,...patch}));
});
test('Dubbing keeps explicit target-language voice assignments and rejects mismatched voices/names',()=>{
 const r={tool:'dub',requestId:randomUUID(),transcriptJob:randomUUID(),language:'es',voice:'ef_dora',segmentVoices:['ef_dora','em_alex'],speakerNames:['Host','Guest']};
 assert.deepEqual(normalizeAudio(r).segmentVoices,r.segmentVoices);
 for(const patch of [{segmentVoices:['af_heart']},{speakerNames:['<script>']},{lipStability:'magic'}])assert.throws(()=>normalizeAudio({...r,...patch}));
});
test('Generated borders require temporal masks and forbid unrelated finishing options',()=>{
 const r=normalizeVideoTool({tool:'outpaint',sourceJob:randomUUID(),aspect:'portrait',prompt:'Continue the landscape',videoModel:'detail'});r.prepared={size:[288,512],frames:29,fps:16};
 const graph=buildVideoToolWorkflow(r,{video:'source.mp4',maskVideo:'edges.mp4'},'test');assert.deepEqual(graph['8'].inputs.control_masks,['19',0]);assert.equal(graph['8'].inputs.width,288);
 assert.throws(()=>normalizeVideoTool({...r,audio:randomUUID()}));assert.throws(()=>normalizeVideoTool({...r,reframeRecovery:'yes'}));
});
test('Brief track recovery refuses ambiguous/long gaps; generated borders retain every original pixel',{skip:mediaTestSkip('vision')},()=>{
 const r=spawnSync(path.join(process.cwd(),'runtime/vision-env/Scripts/python.exe'),['tests/round7_media_check.py'],{encoding:'utf8',windowsHide:true,timeout:45000});assert.equal(r.status,0,r.stdout+r.stderr);
});
test('Faithful resize is explicitly local and does not silently discard a soundtrack',()=>{const r=normalizeVideoTool({tool:'upscale',sourceJob:randomUUID(),upscaleMode:'faithful'});assert.equal(r.upscaleMode,'faithful');assert.throws(()=>buildVideoToolWorkflow(r,{video:'source.mp4'},'test'));assert.throws(()=>normalizeVideoTool({...r,audio:randomUUID()}));assert.throws(()=>normalizeVideoTool({...r,upscaleMode:'magic'}));});
