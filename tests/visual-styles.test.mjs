import test from 'node:test';
import assert from 'node:assert/strict';
import {VISUAL_STYLES,withStyle,stylePrompt,FORMAT_STYLES} from '../lib/visual-styles.mjs';
import {normalizeRequest} from '../lib/workflow.mjs';
import {normalizeImage} from '../lib/images.mjs';
import {LOOKS} from '../lib/productions.mjs';

test('styles are complete art directions that never ask for lettering',()=>{
 assert.ok(VISUAL_STYLES.length>=12);
 for(const s of VISUAL_STYLES){assert.equal(s.swatch.length,3);if(s.id!=='none'){assert.ok(s.prompt.length>60&&s.prompt.length<=300,s.id);assert.doesNotMatch(s.prompt,/\b(text|letters?|words?|captions?|titles?|logos?)\b/i,s.id);}}
 for(const id of Object.values(FORMAT_STYLES))assert.ok(stylePrompt(id),id);
});
test('withStyle appends once and leaves plain prompts alone',()=>{
 const once=withStyle('A fox in snow','neon');assert.match(once,/^A fox in snow\. Neon noir/);
 assert.equal(withStyle(once,'neon'),once);assert.equal(withStyle('A fox','none'),'A fox');assert.equal(withStyle('A fox','nope'),'A fox');
});
test('video and image requests carry the chosen style',()=>{
 const v=normalizeRequest({mode:'text',prompt:'A fox runs',preset:'directed',aspect:'landscape',length:'standard',style:'anime'});
 assert.equal(v.style,'anime');assert.match(v.prompt,/Hand-painted anime/);
 const i=normalizeImage({tool:'create',prompt:'A fox',aspect:'square',style:'clay'});
 assert.equal(i.style,'clay');assert.match(i.prompt,/claymation/);
 assert.doesNotMatch(normalizeImage({tool:'upscale',asset:'0b6c1f1e-1c7e-4c9f-9a43-2f6f5b1c2d3e.png',style:'clay'}).prompt,/claymation/);
});
test('productions default to a strong look per format',()=>{
 assert.equal(LOOKS.explainer,stylePrompt('documentary'));assert.equal(LOOKS.default,stylePrompt('blockbuster'));
});
