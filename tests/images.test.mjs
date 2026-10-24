import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {normalizeImage,buildImageWorkflow,imageReadiness,IMAGE_TOOLS,IMAGE_MODELS,LOCAL_IMAGE_TOOLS} from '../lib/images.mjs';
import {findImages} from '../lib/comfy.mjs';
import {ImageLibrary} from '../lib/image-library.mjs';
const asset='11111111-1111-1111-1111-111111111111.png';
test('Image tools condition references, retain seeds and use native local image nodes',()=>{
  for(const tool of IMAGE_TOOLS.filter(t=>!LOCAL_IMAGE_TOOLS.includes(t.id)&&t.id!=='style-board')){const r=normalizeImage({tool:tool.id,prompt:'A brass compass',asset,reference:asset,mask:asset,seed:42});const graph=buildImageWorkflow(r,{asset:'source.png',reference:'ref.png',mask:r.mask?'mask.png':null});assert.equal(graph['20'].class_type,'SaveImage');assert.ok(!Object.values(graph).some(n=>n.class_type==='SaveVideo'));if(tool.id!=='upscale')assert.equal(graph[tool.id==='identity-pose'?'14':'10'].inputs.seed,42);}
  const edit=buildImageWorkflow(normalizeImage({tool:'inpaint',prompt:'Turn the dial blue',asset,mask:asset}),{asset:'source.png',mask:'mask.png'});assert.deepEqual(edit['4'].inputs.image2,['14',0]);assert.match(edit['4'].inputs.prompt,/region indicated in white/);assert.equal(edit['9'].inputs.lora_name,IMAGE_MODELS.lightning);
  assert.equal(edit['16'].class_type,'LoadImageMask');assert.deepEqual(edit['17'].inputs.mask,['16',0]);assert.deepEqual(edit['10'].inputs.latent_image,['17',0]);
  assert.throws(()=>normalizeImage({tool:'face-swap',asset,prompt:'Replace face'}),/replacement reference/);
  assert.throws(()=>normalizeImage({tool:'upscale',asset,scale:8}),/upscale/);
  assert.throws(()=>normalizeImage({tool:'edit',asset:'../x.png',prompt:'edit'}),/source/);
  assert.throws(()=>normalizeImage({tool:'create',prompt:'still',camera:{lens:'magic'}}),/camera/);
  assert.equal(imageReadiness({}).create.ready,false);
  const upscaleInfo={LoadImage:{},ImageUpscaleWithModel:{},ImageScaleBy:{},SaveImage:{},UpscaleModelLoader:{input:{required:{model_name:['COMBO',{options:[IMAGE_MODELS.upscale]}]}}}};
  assert.equal(imageReadiness(upscaleInfo).upscale.ready,true);upscaleInfo.UpscaleModelLoader.input.required.model_name[1].options=[];assert.equal(imageReadiness(upscaleInfo).upscale.ready,false);
  assert.deepEqual(findImages({a:{images:[{type:'temp',filename:'p.png'},{type:'output',filename:'clip.mp4'},{type:'output',filename:'still.png'}]}}),[{type:'output',filename:'still.png'}]);
});
test('Canvas and character collections retain layout and notes across restart; invalid changes preserve originals',async()=>{
  const directory=await mkdtemp(path.join(tmpdir(),'frameforge-image-library-'));
  try{let store=await new ImageLibrary(directory).open();const board=await store.save('boards',{name:'Copper world',notes:'Warm window light',cards:[{asset,x:25,y:10}]});await store.save('characters',{name:'Mara',notes:'Green jacket',cards:[{asset}]});store=await new ImageLibrary(directory).open();assert.equal(store.list().boards[0].cards[0].x,25);assert.equal(store.list().characters[0].name,'Mara');await assert.rejects(store.save('boards',{...board,cards:[{asset:'../../bad',x:0,y:0}]}));assert.equal(store.list().boards[0].name,'Copper world');}finally{await rm(directory,{recursive:true,force:true});}
});
test('Image verification proves exact mask preservation and rejects blank output, wrong sizes and empty masks',async()=>{
  const config=JSON.parse(await readFile(new URL('../config.local.json',import.meta.url),'utf8'));
  const result=spawnSync(config.python,['tests/image_check.py'],{cwd:new URL('..',import.meta.url),encoding:'utf8',windowsHide:true});assert.equal(result.status,0,result.stdout+result.stderr);
});
