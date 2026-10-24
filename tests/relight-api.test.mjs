import test from 'node:test';import assert from 'node:assert/strict';import {spawn,spawnSync} from 'node:child_process';import {mkdtemp,rm,readFile,appendFile,writeFile} from 'node:fs/promises';import {tmpdir} from 'node:os';import path from 'node:path';import {randomUUID} from 'node:crypto';import {normalizeVideoTool} from '../lib/video-tools.mjs';
test('Lighting adjustments reuse a bound proposal offline, deduplicate and reject changed sources or proposals',async()=>{
 const root=new URL('..',import.meta.url),config=JSON.parse(await readFile(new URL('../config.local.json',import.meta.url),'utf8')),data=await mkdtemp(path.join(tmpdir(),'frameforge-relight-api-')),port=22317+Math.floor(Math.random()*1000),base=`http://127.0.0.1:${port}`,sourceId=randomUUID(),proposalId=randomUUID();let child;
 const request=normalizeVideoTool({tool:'relight',sourceJob:sourceId,prompt:'Gentle neutral light',aspect:'square',seed:92,start:0,end:1,relightMode:'preserve',relightStrength:.6,relightMaxEV:.5});
 const fixture=spawnSync(config.python,['tests/relight_fixture.py',data,sourceId,proposalId,JSON.stringify(request)],{cwd:root,encoding:'utf8',windowsHide:true});
 const post=body=>fetch(base+'/api/jobs',{method:'POST',body:JSON.stringify(body)});const list=async()=> (await fetch(base+'/api/jobs')).json();
 try{
  assert.equal(fixture.status,0,fixture.stdout+fixture.stderr);
  const legacyFile=path.join(data,'jobs',proposalId,'job.json'),legacy=JSON.parse(await readFile(legacyFile,'utf8'));delete legacy.request.videoModel;delete legacy.request.keyframeJob;await writeFile(legacyFile,JSON.stringify(legacy));
  child=spawn(process.execPath,['server.mjs'],{cwd:root,env:{...process.env,PORT:String(port),STUDIO_DATA:data,COMFY_URL:'http://127.0.0.1:1'},windowsHide:true,stdio:['ignore','pipe','pipe']});
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Startup timeout')),10000);child.stdout.once('data',()=>{clearTimeout(timer);resolve();});child.once('error',reject);});
  assert.equal((await post({...request,lightingProposal:proposalId,prompt:'A changed prompt',requestId:randomUUID()})).status,400);
  assert.equal((await post({...request,lightingProposal:proposalId,videoModel:'detail',requestId:randomUUID()})).status,400);
  assert.equal((await post({...request,lightingProposal:proposalId,keyframeJob:randomUUID(),requestId:randomUUID()})).status,400);
  const adjusted={...request,lightingProposal:proposalId,relightStrength:0,requestId:randomUUID()},response=await post(adjusted);assert.equal(response.status,202,await response.clone().text());const saved=await response.json();
  assert.equal((await post(adjusted)).status,200);let result;const deadline=Date.now()+15000;
  do{await new Promise(r=>setTimeout(r,100));result=(await list()).find(j=>j.id===saved.id);}while(['processing','verifying','uploading'].includes(result.status)&&Date.now()<deadline);
  assert.equal(result.status,'review-ready',JSON.stringify(result));assert.equal(result.report.relighting.observedMaximumEV,0);assert.equal(result.report.relighting.proposalJobId,proposalId);assert.equal(result.promptId,undefined);assert.equal(result.review,null);
  assert.equal(result.report.relighting.candidateSha256,(await list()).find(j=>j.id===proposalId).report.relighting.candidateSha256);
  await appendFile(path.join(data,'jobs',proposalId,'raw.mp4'),'tamper');assert.equal((await post({...adjusted,requestId:randomUUID()})).status,400);
 }finally{if(child&&child.exitCode===null){const done=new Promise(r=>child.once('exit',r));child.kill();await done;}await rm(data,{recursive:true,force:true});}
});
