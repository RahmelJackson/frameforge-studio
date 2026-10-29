import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,rm} from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {modelInstallLocation,comfyFolderConfiguration} from '../public/model-downloads.js';
import {ModelDownloads} from '../lib/model-downloads.mjs';

test('The file list reports ComfyUI and standalone processor destinations separately',()=>{
 const roots={models:'D:\\Shared weights',runtime:'D:\\Studio\\runtime'};
 assert.equal(modelInstallLocation({destination:'models/loras/example.safetensors'},roots),'D:/Shared weights/loras/example.safetensors');
 assert.equal(modelInstallLocation({installRoot:'runtime',installPath:'audio-models/kokoro/model.onnx'},roots),'D:/Studio/runtime/audio-models/kokoro/model.onnx');
 assert.equal(modelInstallLocation({destination:'models/vae/vae.safetensors'},{}),'models/vae/vae.safetensors');
});

test('Shared-folder configuration supports another drive, spaces and common ComfyUI folder aliases',()=>{
 const yaml=comfyFolderConfiguration('D:\\Shared weights\\model library');assert.match(yaml,/base_path: "D:\/Shared weights\/model library"/);assert.match(yaml,/diffusion_models: \|\n        diffusion_models\n        unet/);assert.match(yaml,/text_encoders: \|\n        text_encoders\n        clip/);assert.match(yaml,/loras: loras/);assert.match(yaml,/Keep your existing entries/);
 assert.match(comfyFolderConfiguration('/Users/example/shared models'),/base_path: "\/Users\/example\/shared models"/);
 for(const folder of ['', 'relative/folder','D:/bad\nfolder'])assert.throws(()=>comfyFolderConfiguration(folder));
});

test('Standalone processor weights download without a ComfyUI model folder; native weights still require one',async()=>{
 const directory=await mkdtemp(path.join(tmpdir(),'ff-processor-storage-'));
 try{
  const bytes=Buffer.from('pinned processor fixture'),runtime=path.join(directory,'runtime');await mkdir(runtime);
  const model={name:'voice.onnx',installRoot:'runtime',installPath:'audio-models/voice.onnx',destination:'runtime/audio-models/voice.onnx',bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),url:'https://huggingface.co/example/repo/resolve/'+'a'.repeat(40)+'/voice.onnx'};
  const downloads=await new ModelDownloads({directory:path.join(directory,'downloads'),roots:{models:null,runtime},resolveModels:async()=>[model],fetcher:async()=>new Response(bytes)}).init();
  await downloads.enqueue({selection:{context:'audio',tool:'speech'},acceptTerms:true});
  for(let i=0;i<100&&downloads.running;i++)await new Promise(resolve=>setTimeout(resolve,10));
  assert.equal(downloads.jobs[0].status,'completed');assert.equal(await readFile(path.join(runtime,'audio-models/voice.onnx'),'utf8'),bytes.toString());
  assert.throws(()=>downloads.target({...model,installRoot:'models',installPath:'loras/voice.safetensors'}),/model storage folder/);
 }finally{assert.ok(path.resolve(directory).startsWith(path.resolve(tmpdir())+path.sep));await rm(directory,{recursive:true,force:true});}
});
