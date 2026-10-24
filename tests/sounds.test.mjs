import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import path from 'node:path';import {SoundLibrary} from '../lib/sounds.mjs';
test('Sound library preserves WAV identity, categories and metadata without duplicate entries after restart',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'frameforge-sounds-'));try{const sounds=await new SoundLibrary(dir).open(),audio='11111111-1111-1111-1111-111111111111',metadata={sha256:'a'.repeat(64),duration:2,sampleRate:48000,channels:2};
  const original=await sounds.save({audio,name:'Soft bell',category:'effect',notes:'Original synthesis'},metadata);await sounds.save({audio,name:'Renamed bell',category:'effect'},metadata);
  const restored=await new SoundLibrary(dir).open();assert.equal(restored.list().length,1);assert.equal(restored.list()[0].id,original.id);assert.equal(restored.list()[0].sha256,metadata.sha256);assert.equal(restored.list()[0].name,'Renamed bell');
  assert.throws(()=>sounds.save({audio:'../file',name:'Bad path',category:'effect'},metadata));assert.throws(()=>sounds.save({audio,name:'Missing category'},metadata));
 }finally{await rm(dir,{recursive:true,force:true});}
});
