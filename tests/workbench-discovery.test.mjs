import test from 'node:test';
import assert from 'node:assert/strict';
import {guidedAdvice} from '../lib/studio-assistant.mjs';
import {audioTitle,imageResult} from '../public/workbench.js';
test('Guide routes new specific tasks without substituting ordinary narration or image generation',()=>{
 for(const [question,id] of [['Change the voice in my recording','voice-conversion'],['Generate an image from my style board','style-board'],['Track an object in video with SAM','track-edit'],['Extract a body pose guide','extract-pose'],['Create multi-speaker dialogue','dialogue']])assert.equal(guidedAdvice(question).steps[0].id,id,question);
 for(const question of ['Make a TRELLIS 3D object','Use Wan Animate','Train a LoRA']){const advice=guidedAdvice(question);assert.match(advice.answer,/not integrated/);assert.deepEqual(advice.steps.map(s=>s.id),['workflows']);}
 assert.ok(guidedAdvice('I want to animate a photo with Wan 5B').steps.some(s=>s.id==='image-animate'));
});
test('Recent pictures exclude successful SAM masks and audio titles use actual words',()=>{
 assert.equal(imageResult({image:true,request:{tool:'select'},report:{technicalPass:true}}),false);
 assert.equal(imageResult({image:true,request:{tool:'inpaint'},report:{technicalPass:true}}),true);
 assert.equal(audioTitle({id:'abcdef-123',request:{tool:'transcribe'},transcriptTitle:'The train is leaving.'}),'The train is leaving.');
 assert.match(audioTitle({id:'abcdef-123',request:{tool:'transcribe'}}),/Transcript · abcdef/);
});
