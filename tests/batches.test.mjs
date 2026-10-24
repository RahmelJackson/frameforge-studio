import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {BatchQueue} from '../lib/batches.mjs';
const request={prompt:'Test scene',steps:12};
test('Batch dispatch is serial, deduplicated, budgeted and resumes the original job after restart',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'frameforge-batch-'));let jobs=[],calls=0;
 const options={getJobs:()=>jobs,submit:async input=>{calls++;const job={id:randomUUID(),requestId:input.requestId,status:'running'};jobs.push(job);return {code:202,body:job};}};
 try{
  let queue=await new BatchQueue(dir,options).open(),requestId=randomUUID();const batch=await queue.add([request,request],requestId);
  assert.equal((await queue.add([request],requestId)).id,batch.id);assert.equal(queue.list().length,1);
  await assert.rejects(queue.add([request],randomUUID()));
  await Promise.all([queue.tick(),queue.tick()]);assert.equal(calls,1);
  queue=await new BatchQueue(dir,options).open();await queue.tick();assert.equal(calls,1);
  jobs[0].status='review-ready';jobs[0].report={technicalPass:true};await queue.tick();await queue.tick();assert.equal(calls,2);
  jobs[1].status='review-ready';jobs[1].report={technicalPass:true};await queue.tick();await queue.tick();assert.equal(queue.list()[0].status,'completed');
  await assert.rejects(queue.add(Array(5).fill(request),randomUUID()));
  const expired=await queue.add([request],randomUUID());await queue.update(expired.id,b=>b.deadline=0);await queue.tick();assert.equal(calls,2);assert.equal(queue.list()[0].status,'paused');
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('An ambiguous saved dispatch is quarantined, and stopping prevents waiting shots from running',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'frameforge-batch-'));let jobs=[],calls=0;
 const options={getJobs:()=>jobs,submit:async input=>{calls++;const job={id:randomUUID(),requestId:input.requestId,status:'running'};jobs.push(job);return {code:202,body:job};}};
 try{
  let queue=await new BatchQueue(dir,options).open();const batch=await queue.add([request,request],randomUUID());
  await queue.update(batch.id,b=>b.items[0].status='dispatching');queue=await new BatchQueue(dir,options).open();await queue.tick();assert.equal(calls,0);assert.equal(queue.list()[0].status,'paused');
  const second=await queue.add([request,request],randomUUID());await queue.tick();assert.equal(calls,1);await queue.stop(second.id);
  jobs[0].status='review-ready';jobs[0].report={technicalPass:true};await queue.tick();await queue.tick();assert.equal(calls,1);assert.equal(queue.list()[0].items[1].status,'cancelled');
  const failed=await queue.add([request,request],randomUUID());await queue.tick();jobs[1].status='failed';await queue.tick();await queue.tick();assert.equal(calls,2);assert.equal(queue.list()[0].status,'paused');
 }finally{await rm(dir,{recursive:true,force:true});}
});
