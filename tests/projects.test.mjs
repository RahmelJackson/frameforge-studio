import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {ProjectStore} from '../lib/projects.mjs';
import {normalizeEdit,editSignature} from '../lib/timeline.mjs';
test('Projects preserve shot order, notes and edits across restart, rejecting duplicate or incomplete orders',async()=>{
  const directory=await mkdtemp(path.join(tmpdir(),'frameforge-project-'));
  try{
    let store=await new ProjectStore(directory).open();const p=await store.create({name:'First film',description:'A two-shot sequence'});
    await Promise.all([store.add(p.id,{jobId:'take-one',title:'Opening'}),store.add(p.id,{jobId:'take-two',title:'Reveal'})]);
    const [a,b]=store.list()[0].shots;
    await store.updateShot(p.id,b.id,{notes:'Hold for two seconds',title:'The reveal',scene:'Scene 2',trimStart:0.25,trimEnd:2,transition:'crossfade',transitionSeconds:0.5});
    const before=store.list();await assert.rejects(store.updateShot(p.id,b.id,{trimEnd:0.1}));assert.deepEqual(store.list(),before);
    await store.update(p.id,{name:'A better film'});
    await store.reorder(p.id,[b.id,a.id]);
    await assert.rejects(store.reorder(p.id,[a.id,a.id]));await assert.rejects(store.reorder(p.id,[a.id]));
    await assert.rejects(store.add(p.id,{jobId:'take-one'}));
    await assert.rejects(store.create({name:''}));
    store=await new ProjectStore(directory).open();const saved=store.list()[0];
    assert.equal(saved.name,'A better film');assert.deepEqual(saved.shots.map(s=>s.jobId),['take-two','take-one']);
    assert.equal(saved.shots[0].notes,'Hold for two seconds');assert.equal(saved.shots[0].title,'The reveal');
    assert.equal(saved.shots[0].scene,'Scene 2');
    assert.equal(saved.shots[0].trimStart,0.25);assert.equal(saved.shots[0].trimEnd,2);assert.equal(saved.shots[0].transition,'crossfade');
    const external=store.list();external[0].shots.length=0;assert.equal(store.list()[0].shots.length,2);
  }finally{await rm(directory,{recursive:true,force:true});}
});
test('Timeline edits reject invalid source ranges and stale export signatures detect edits',()=>{
  for(const edit of [{trimStart:-1},{trimStart:3},{trimEnd:4},{trimStart:1,trimEnd:1},{trimStart:NaN},{trimEnd:'2'},{transition:'wipe'},{transitionSeconds:3},{transitionSeconds:0}])assert.throws(()=>normalizeEdit(edit,3));
  assert.equal(normalizeEdit({trimStart:1},3).trimEnd,null);
  const shots=[{id:'a',jobId:'one'},{id:'b',jobId:'two'}],original=editSignature(shots);
  assert.equal(original,editSignature(shots.map(s=>({...s,...normalizeEdit(s)}))));
  assert.notEqual(original,editSignature(shots.toReversed()));
  assert.notEqual(original,editSignature(shots.map(s=>({...s,trimStart:.1}))));
});
