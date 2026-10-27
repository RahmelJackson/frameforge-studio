import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {canvasExtension,canvasRectangle,checkedSize,layerHistory} from '../public/canvas-state.js';
import {checkedMedia,mediaDestination,readMediaDrop} from '../public/my-work.js';
import {normalizeImage,buildImageWorkflow} from '../lib/images.mjs';
import {imageToolSetup} from '../lib/image-tool-setup.mjs';
import {inspectRequirements} from '../lib/studio-setup.mjs';
const source='11111111-1111-4111-8111-111111111111.png',mask='22222222-2222-4222-8222-222222222222.png';
test('Outpainting geometry keeps original offset and respects the server four-megapixel boundary',()=>{
 assert.deepEqual(canvasExtension(768,512,{left:'128',right:64,top:32,bottom:0}),{width:960,height:544,left:128,top:32,right:64,bottom:0});
 assert.deepEqual(checkedSize(2000,2000),{width:2000,height:2000});
 for(const edges of [{left:2048},{left:-1},{left:0},{left:1.5},{left:Infinity}])assert.throws(()=>canvasExtension(2000,2000,edges));
 assert.throws(()=>checkedSize(10,400));assert.throws(()=>checkedSize(2001,2000));
});
test('Reversed and off-canvas drag boxes are clamped in image pixel coordinates',()=>{
 assert.deepEqual(canvasRectangle([700,400],[100,50],768,512),{x:100,y:50,width:600,height:350});
 assert.deepEqual(canvasRectangle([-20,-50],[900,600],768,512),{x:0,y:0,width:768,height:512});
 assert.throws(()=>canvasRectangle([NaN,0],[1,2],768,512));
});
test('Layer history is bounded and only stores reusable asset identities',()=>{
 const layers=[{name:source,label:'Original'}],next=layerHistory(layers,{name:mask,label:'Edit',jobId:'not-a-job',html:'<script>'});assert.equal(layers.length,1);assert.equal(next.length,2);assert.deepEqual(Object.keys(next[1]),['name','label','jobId','comparisonAsset']);assert.equal(next[1].jobId,null);
 assert.equal(layerHistory(next,{name:source,label:'Original'}).length,2);assert.throws(()=>layerHistory([],{name:'../../private.png'}));
});
test('Saved-media drops accept identities rather than remote URLs or file paths',()=>{
 const media={kind:'image',jobId:source.slice(0,-4)};assert.deepEqual(checkedMedia({...media,url:'https://evil.test/payload'}),media);assert.equal(mediaDestination(media),'/images?job='+media.jobId);
 assert.throws(()=>checkedMedia({kind:'image',jobId:'../../config'}));assert.throws(()=>checkedMedia({kind:'file',jobId:media.jobId}));assert.equal(readMediaDrop({getData:()=>''}),null);assert.throws(()=>readMediaDrop({getData:()=>'{bad'}));
});
test('Canvas masked requests retain an actual masked ComfyUI graph, never a full-image Cloud replacement',()=>{
 const r=normalizeImage({kind:'image',tool:'inpaint',asset:source,mask,prompt:'Replace the selected object',seed:12});r.size=[768,768];const graph=buildImageWorkflow(r,{asset:source,mask},'test');
 assert.ok(Object.values(graph).some(n=>n.class_type==='LoadImageMask'&&n.inputs.image===mask));assert.ok(Object.values(graph).some(n=>n.class_type==='SetLatentNoiseMask'));assert.equal(r.mask,mask);
});
test('Canvas, compact execution options and shared media controls are included in portable pages',async()=>{
 const [html,map,panel,interactions]=await Promise.all(['public/images.html','public/studio-map.js','public/workflow-panel.js','public/studio-interactions.js'].map(f=>readFile(f,'utf8')));
 assert.match(html,/data-section="canvas"/);assert.match(map,/panel:'canvas'/);assert.match(html,/More settings · seed/);assert.match(panel,/createElement\('details'\)/);assert.match(interactions,/requestSubmit\(button\)/);assert.match(interactions,/frameforge:use-media/);
});
test('A fresh installation can find the exact missing image models before uploading any input',async()=>{
 const masked=await imageToolSetup(process.cwd(),'inpaint'),upscale=await imageToolSetup(process.cwd(),'upscale'),create=await imageToolSetup(process.cwd(),'create');
 assert.ok(masked.models.some(m=>m.name==='qwen_image_edit_2511_fp8mixed.safetensors'));assert.ok(masked.graph.nodes.some(n=>n.type==='LoadImageMask'));
 assert.deepEqual(upscale.models.map(m=>m.name),['RealESRGAN_x4plus.safetensors']);assert.ok(create.models.some(m=>m.name==='z_image_turbo_bf16.safetensors'));assert.equal(upscale.execution,'local');
 assert.deepEqual(checkedMedia({kind:'image',asset:source}),{kind:'image',asset:source});assert.equal(mediaDestination({kind:'image',asset:source}),'/images?tool=edit&source='+source);await assert.rejects(imageToolSetup(process.cwd(),'fake-provider'));
});
test('Setup accepts modern ComfyUI COMBO options and classic model lists without false missing-file prompts',()=>{
 const packet={execution:'local',graph:{nodes:[{type:'Loader'}]},models:[{name:'model.safetensors'},{name:'old.pth'},{name:'absent.bin'}]};
 const info={Loader:{input:{required:{modern:['COMBO',{options:['subfolder/model.safetensors']}],classic:[['old.pth']]}}}},report=inspectRequirements(packet,info);
 assert.deepEqual(report.models.map(m=>m.state),['available','available','missing']);assert.deepEqual(report.missingNodes,[]);assert.equal(inspectRequirements({...packet,models:packet.models.slice(0,2)},info).ready,true);
});
