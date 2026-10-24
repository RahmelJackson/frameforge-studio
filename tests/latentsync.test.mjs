import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {randomUUID} from 'node:crypto';
import {AudioStudio,normalizeAudio} from '../lib/audio.mjs';

test('Saved lip requests retain the existing method by default and reject unknown engines',()=>{
  const request={requestId:randomUUID(),tool:'lipsync',source:{kind:'take',id:randomUUID()},audioSource:{kind:'speech',id:randomUUID()}};
  assert.equal(normalizeAudio(request).lipEngine,'musetalk');
  assert.throws(()=>normalizeAudio({...request,lipEngine:'unknown'}),/method/);
});

test('LatentSync refuses unsupported duration before unloading GPU weights and freezes valid source bindings',async()=>{
  const data=await mkdtemp(path.join(tmpdir(),'frameforge-latentsync-'));let releases=0,duration=4.01;
  try{
    const studio=await new AudioStudio({root:process.cwd(),data,videoBusy:()=>false,releaseGpu:async()=>{releases++;}}).open();
    studio.ready=async()=>({ready:true});studio.latentsyncReady=async()=>true;studio.run=async()=>{};
    studio.resolve=async source=>({kind:source.kind==='take'?'video':'audio',duration:source.kind==='take'?3:duration,path:'retained-'+source.id,sha256:'original-'+source.id});
    const request={requestId:randomUUID(),tool:'lipsync',lipEngine:'latentsync',source:{kind:'take',id:randomUUID()},audioSource:{kind:'speech',id:randomUUID()}};
    await assert.rejects(studio.submit(request),/0.5-4/);assert.equal(releases,0);assert.equal(studio.list().length,0);assert.equal(studio.busy(),false);
    duration=2.2;const job=await studio.submit(request);assert.equal(releases,1);
    const manifest=JSON.parse(await readFile(studio.file(job.id,'manifest.json'),'utf8'));
    assert.equal(manifest.request.lipEngine,'latentsync');assert.equal(manifest.audio.sha256,'original-'+request.audioSource.id);assert.equal(manifest.source.sha256,'original-'+request.source.id);
    assert.equal((await studio.submit(request)).id,job.id);assert.equal(releases,1);
  }finally{assert.ok(path.resolve(data).startsWith(path.resolve(tmpdir())+path.sep));await rm(data,{recursive:true,force:true});}
});
