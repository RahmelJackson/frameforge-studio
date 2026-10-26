import {mediaTestSkip} from './media-runtime.mjs';
import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';import {spawnSync} from 'node:child_process';import path from 'node:path';
import {normalizeImage,buildImageWorkflow} from '../lib/images.mjs';
test('Style generation freezes every card and supports zero influence without a source scene or layout',()=>{
 const styleImages=[randomUUID()+'.png',randomUUID()+'.jpg'],input={tool:'style-board',styleImages,prompt:'A silver teapot.',styleStrength:0};const r=normalizeImage(input);styleImages.push(randomUUID()+'.png');assert.equal(r.styleImages.length,2);assert.equal(r.styleStrength,0);assert.equal(r.asset,null);assert.equal(r.steps,30);assert.equal(r.reference,null);assert.equal(normalizeImage(r).styleImages.length,2);assert.throws(()=>buildImageWorkflow(r),/style processor/);
 for(const bad of [{styleImages:[]},{styleImages:Array(17).fill(randomUUID()+'.png')},{styleImages:[r.styleImages[0],r.styleImages[0]]},{styleImages:['../private.png']},{styleImages:['https://example.com/ref.png']},{styleStrength:NaN},{styleStrength:1.3},{styleLabel:'x'.repeat(121)}])assert.throws(()=>normalizeImage({...input,styleImages:r.styleImages,...bad}));
});
test('Reference-subject subtraction is explicit, bounded and reusable independently of style strength',()=>{
 const input={tool:'style-board',styleImages:[randomUUID()+'.png'],prompt:'A teapot',styleMode:'subtract',styleContent:' A rabbit ',styleContentStrength:0,styleStrength:.8},r=normalizeImage(input);
 assert.equal(r.styleMode,'subtract');assert.equal(r.styleContent,'A rabbit');assert.equal(r.styleContentStrength,0);assert.equal(r.styleStrength,.8);assert.deepEqual(normalizeImage(r),r);
 for(const bad of [{styleMode:'silent'},{styleContent:''},{styleContent:'x'.repeat(501)},{styleContentStrength:-1},{styleContentStrength:NaN},{styleContentStrength:1.1}])assert.throws(()=>normalizeImage({...input,...bad}));
 assert.equal(normalizeImage({...input,styleMode:'layers'}).styleContent,'');
});
test('Whole-board embedding mean is order invariant, includes every card, and never enables layout attention',{skip:mediaTestSkip('engine')},()=>{
 const r=spawnSync(path.join(process.cwd(),'runtime/engine-env/Scripts/python.exe'),['-X','utf8','tests/style_math_check.py'],{encoding:'utf8',timeout:30000,windowsHide:true});assert.equal(r.status,0,r.stdout+r.stderr);
});
test('Style evidence rejects tampered metadata, reference bytes and layout-conditioning routes',{skip:mediaTestSkip('engine')},()=>{
 const r=spawnSync(path.join(process.cwd(),'runtime/engine-env/Scripts/python.exe'),['-X','utf8','tests/style_check_guards.py'],{encoding:'utf8',timeout:30000,windowsHide:true});assert.equal(r.status,0,r.stdout+r.stderr);
});
