import test from 'node:test';
import assert from 'node:assert/strict';
import {guidedAdvice} from '../lib/studio-assistant.mjs';
import {audioTitle,imageResult} from '../public/workbench.js';
test('Guide routes new specific tasks without substituting ordinary narration or image generation',()=>{
 for(const [question,id] of [['Change the voice in my recording','voice-conversion'],['Generate an image from my style board','style-board'],['Track an object in video with SAM','track-edit'],['Extract a body pose guide','extract-pose'],['Create multi-speaker dialogue','dialogue']])assert.equal(guidedAdvice(question).steps[0].id,id,question);
 for(const [question,id] of [['Make a TRELLIS 3D object','prop-3d'],['Make a seamless H3 loop','h3-loop'],['Style transfer from a reference picture','qwen-style'],['Restore old video with SeedVR2','video-upscale-seedvr2'],['Turn my playblast into a shot with layout to render','ltx-layout'],['Generate music with ACE-Step','music-ace15']])assert.deepEqual(guidedAdvice(question).steps.map(s=>s.id),[id],question);
 {const advice=guidedAdvice('Use Wan Animate');assert.match(advice.answer,/Wan Animate 2/);assert.deepEqual(advice.steps.map(s=>s.id),['wan-animate','wan-animate-fast']);}{const advice=guidedAdvice('Add foley sound effects to my clip');assert.deepEqual(advice.steps.map(s=>s.id),['sound-effects','timeline']);assert.match(advice.answer,/not synced/);}{const advice=guidedAdvice('Replace the person in this video with my character');assert.equal(advice.steps[0].id,'character-replace');}{const advice=guidedAdvice('Train a LoRA');assert.match(advice.answer,/FLUX 3 Klein/);assert.match(advice.answer,/not verified/);assert.deepEqual(advice.steps.map(s=>s.id),['character-dataset','lora-training']);}{const advice=guidedAdvice('How do I make a life as a medieval knight video?');assert.deepEqual(advice.steps.map(s=>s.id),['templates','story-formats']);}
 assert.ok(guidedAdvice('I want to animate a photo with Wan 5B').steps.some(s=>s.id==='image-animate'));
});
test('Recent pictures exclude successful SAM masks and audio titles use actual words',()=>{
 assert.equal(imageResult({image:true,request:{tool:'select'},report:{technicalPass:true}}),false);
 assert.equal(imageResult({image:true,request:{tool:'inpaint'},report:{technicalPass:true}}),true);
 assert.equal(audioTitle({id:'abcdef-123',request:{tool:'transcribe'},transcriptTitle:'The train is leaving.'}),'The train is leaving.');
 assert.match(audioTitle({id:'abcdef-123',request:{tool:'transcribe'}}),/Transcript · abcdef/);
});
