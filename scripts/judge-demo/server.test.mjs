import test from 'node:test';import assert from 'node:assert/strict';import http from 'node:http';import {mkdtemp,readFile,mkdir,writeFile,rm} from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import {randomUUID} from 'node:crypto';import {createJudgeServer} from './server.mjs';
test('Judge access, origin checks, private routing, bounded jobs and retry deduplication',async()=>{
 const tmp=await mkdtemp(path.join(os.tmpdir(),'frameforge-judge-test-'));const data=new Map();let calls=0;
 const fake=http.createServer(async(req,res)=>{res.setHeader('Content-Type','application/json');if(req.url==='/api/health')return res.end(JSON.stringify({connected:true}));if(req.method==='POST'){assert.equal(req.headers['x-frameforge-open-weights-only'],'1');let body='';for await(const b of req)body+=b;const r=JSON.parse(body);calls++;const id=randomUUID();data.set(id,{id,status:'review-ready',report:{technicalPass:true,size:[768,768]},privatePath:'C:/private/never-disclose'});res.statusCode=202;return res.end(JSON.stringify({id,status:'submitted'}));}res.end(JSON.stringify([...data.values()]));});await new Promise(r=>fake.listen(0,'127.0.0.1',r));
 const app=await createJudgeServer({stateDir:tmp,backend:'http://127.0.0.1:'+fake.address().port,limit:2});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+app.server.address().port;
 try{
  assert.equal((await fetch(base+'/api/status')).status,401);const badHost=await new Promise(resolve=>http.get(base+'/api/status',{headers:{Host:'evil.example'}},r=>{r.resume();resolve(r.statusCode);}));assert.equal(badHost,403);
  const state=JSON.parse(await readFile(app.stateFile));let r=await fetch(base+'/api/login',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify({code:state.code})});assert.equal(r.status,200);const cookie=r.headers.get('set-cookie').split(';')[0];assert.match(r.headers.get('set-cookie'),/HttpOnly; SameSite=Strict/);
  const headers={'Content-Type':'application/json',Cookie:cookie,Origin:base};const run={requestId:randomUUID(),task:'image',prompt:'an original lighthouse'};
  r=await fetch(base+'/api/run',{method:'POST',headers:{...headers,Origin:'https://evil.example'},body:JSON.stringify(run)});assert.equal(r.status,403);
  r=await fetch(base+'/api/run',{method:'POST',headers,body:JSON.stringify({...run,graph:{}})});assert.equal(r.status,400);
  r=await fetch(base+'/api/run',{method:'POST',headers,body:JSON.stringify(run)});assert.equal(r.status,202);const first=await r.json();assert.ok(first.id);assert.equal(calls,1);
  r=await fetch(base+'/api/run',{method:'POST',headers,body:JSON.stringify(run)});assert.equal(r.status,202);assert.equal(calls,1);
  assert.equal((await fetch(base+'/api/run',{method:'POST',headers,body:JSON.stringify({...run,prompt:'changed'})})).status,409);
  const checked=await (await fetch(base+'/api/job/'+run.requestId,{headers})).json();assert.equal(checked.technicalPass,true);assert.equal('privatePath' in checked,false);
  assert.equal((await fetch(base+'/api/job/'+randomUUID(),{headers})).status,404);assert.equal((await fetch(base+'/api/jobs',{headers})).status,404);assert.equal((await fetch(base+'/api/assistant/connection',{headers})).status,404);assert.equal((await fetch(base+'/result/'+randomUUID()+'/output.png',{headers})).status,404);
  const second={requestId:randomUUID(),task:'speech',prompt:'Hello from the studio.'};assert.equal((await fetch(base+'/api/run',{method:'POST',headers,body:JSON.stringify(second)})).status,202);await fetch(base+'/api/job/'+second.requestId,{headers});
  assert.equal((await fetch(base+'/api/run',{method:'POST',headers,body:JSON.stringify({...run,requestId:randomUUID()})})).status,429);const status=await(await fetch(base+'/api/status',{headers})).json();assert.equal(status.remaining,0);assert.equal(status.jobs.length,2);assert.equal(calls,2);
 }finally{await new Promise(r=>app.server.close(r));await new Promise(r=>fake.close(r));await rm(tmp,{recursive:true,force:true});}
});
test('35 shared runs persist; simultaneous judges submit only one job and waiting costs no run',async()=>{
 const tmp=await mkdtemp(path.join(os.tmpdir(),'frameforge-judge-concurrency-'));
 const rows=[];let calls=0,ambiguous=false;
 const fake=http.createServer(async(req,res)=>{res.setHeader('Content-Type','application/json');if(req.url==='/api/health')return res.end(JSON.stringify({connected:true}));if(req.method==='POST'){for await(const chunk of req){}calls++;if(ambiguous)return res.end('{}');const id=randomUUID();rows.push({id,status:'running',report:{}});res.statusCode=202;return res.end(JSON.stringify({id,status:'submitted'}));}res.end(JSON.stringify(rows));});
 await new Promise(r=>fake.listen(0,'127.0.0.1',r));
 let app=await createJudgeServer({stateDir:tmp,backend:'http://127.0.0.1:'+fake.address().port});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
 let base='http://127.0.0.1:'+app.server.address().port;
 const state=JSON.parse(await readFile(app.stateFile));assert.equal(state.limit,35);
 const login=await fetch(base+'/api/login',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify({code:state.code})});
 const cookie=login.headers.get('set-cookie').split(';')[0];
 const headers=()=>({'Content-Type':'application/json',Cookie:cookie,Origin:base});
 const run=()=>fetch(base+'/api/run',{method:'POST',headers:headers(),body:JSON.stringify({requestId:randomUUID(),task:'image',prompt:'A judge concurrency check'})});
 const status=async()=>await(await fetch(base+'/api/status',{headers:headers()})).json();
 try{
  const results=await Promise.all([run(),run(),run()]);assert.deepEqual(results.map(r=>r.status).sort(),[202,409,409]);assert.equal(calls,1);
  const waiting=results.filter(r=>r.status===409);for(const r of waiting){assert.equal(r.headers.get('retry-after'),'5');assert.equal((await r.json()).code,'ENGINE_BUSY');}
  let s=await status();assert.equal(s.busy,true);assert.equal(s.remaining,34);assert.equal(s.jobs.length,1);assert.match(s.busyMessage,/Another judge/);
  rows[0].status='review-ready';rows[0].report.technicalPass=true;s=await status();assert.equal(s.busy,false);assert.equal(s.remaining,34);
  await new Promise(r=>app.server.close(r));
  app=await createJudgeServer({stateDir:tmp,backend:'http://127.0.0.1:'+fake.address().port});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+app.server.address().port;
  s=await status();assert.equal(s.limit,35);assert.equal(s.remaining,34);assert.equal(s.jobs.length,1);
  ambiguous=true;assert.equal((await run()).status,202);s=await status();assert.equal(s.busy,true);assert.equal(s.remaining,33);assert.match(s.busyMessage,/creator to check/);
  assert.equal((await run()).status,409);assert.equal(calls,2);assert.equal((await status()).remaining,33);
 }finally{await new Promise(r=>app.server.close(r));await new Promise(r=>fake.close(r));await rm(tmp,{recursive:true,force:true});}
});
