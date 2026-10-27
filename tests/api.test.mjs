import {mediaTestSkip} from './media-runtime.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp,rm,mkdir,writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
test('HTTP app serves UI, rejects unwanted origins and malformed uploads, persists engine failures',{skip:mediaTestSkip('engine')},async()=>{
  const data=await mkdtemp(path.join(tmpdir(),'frameforge-test-'));
  const port=14317+Math.floor(Math.random()*1000);const base=`http://127.0.0.1:${port}`;
  const child=spawn(process.execPath,['server.mjs'],{cwd:root,env:{...process.env,PORT:String(port),STUDIO_DATA:data,COMFY_URL:'http://127.0.0.1:1'},windowsHide:true,stdio:['ignore','pipe','pipe']});
  try{
    await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Test server startup timed out')),10000);child.stdout.once('data',()=>{clearTimeout(timer);resolve();});child.once('error',reject);});
    assert.equal((await fetch(base)).status,200);
    assert.equal((await fetch(base+'/workflows')).status,200);
    assert.match(await(await fetch(base+'/workflows')).text(),/Interactive workflow canvas/);
    const workflows=await(await fetch(base+'/api/workflows')).json();assert.equal(workflows.length,15);
    for(const w of workflows){const response=await fetch(base+'/api/workflows/'+w.id);assert.equal(response.status,200);assert.ok((await response.json()).graph.nodes.length);}
    assert.equal((await fetch(base+'/api/workflows/unknown')).status,404);
    assert.match((await fetch(base+'/workflows?embedded=1')).headers.get('content-security-policy'),/frame-ancestors 'self'/);
    assert.match((await fetch(base+'/images')).headers.get('content-security-policy'),/frame-ancestors 'none'/);
    for(const module of ['/workflow-panel.js','/workflow-panel.css'])assert.equal((await fetch(base+module)).status,200);
    assert.equal((await fetch(base+'/api/cloud/connection',{method:'POST',body:JSON.stringify({apiKey:'test-only'})})).status,410);
    const cloudPlan=await(await fetch(base+'/api/workflow-plans',{method:'POST',body:JSON.stringify({context:'images',provider:'cloud',task:'seedream-create',input:{tool:'create',prompt:'A brass compass',aspect:'square',seed:1}})})).json();assert.equal(cloudPlan.model,'Seedream 5.0 Pro');assert.ok(cloudPlan.graph.nodes.length);
    const refused=await fetch(base+'/api/workflow-plans/'+cloudPlan.id+'/run',{method:'POST',body:JSON.stringify({requestId:'55555555-5555-4555-8555-555555555555',graph:cloudPlan.graph})});assert.equal(refused.status,409);assert.match((await refused.json()).error,/Comfy Cloud/);
    const exported=await(await fetch(base+'/api/workflow-plans/'+cloudPlan.id+'/export',{method:'POST',body:JSON.stringify({graph:cloudPlan.graph})})).json();assert.ok(exported.bundleUrl);assert.equal((await fetch(base+exported.bundleUrl)).status,200);assert.ok((await(await fetch(base+exported.graphUrl)).json()).nodes.length);assert.match(exported.cloudUrl,/template=/);
    const shell=await(await fetch(base+'/images')).text();assert.match(shell,/Setup &amp; settings|Setup & settings/);assert.ok(!shell.includes('id="navigation-layout"'));assert.match(shell,/Top navigation/);assert.match(shell,/Images tools/);assert.ok(!shell.includes('class="workspace-tools"'));assert.equal((await fetch(base+'/workspace.js')).status,200);
    for(const module of ['/app.js','/library.js','/queue.js','/images.js','/video-tools.js','/film.js','/continuity.js','/home.js']){const response=await fetch(base+module);assert.equal(response.status,200);assert.match(response.headers.get('content-type'),/javascript/);}
    for(const page of ['/','/home','/library','/create','/images','/video-tools','/audio','/film','/continuity','/checklist']){const response=await fetch(base+page);assert.equal(response.status,200);const html=await response.text();assert.match(html,/aria-label="Workspace"/);for(const href of ['/library','/images','/create','/audio','/checklist'])assert.ok(html.includes(`href="${href}"`),page+' missing '+href);}
    assert.match(await(await fetch(base+'/create?view=story')).text(),/id="story-script"/);
    assert.match(await(await fetch(base+'/?image=11111111-1111-4111-8111-111111111111.png')).text(),/id="shot-form"/);
    for(const css of ['/home.css','/workspace.css'])assert.match((await fetch(base+css)).headers.get('content-type'),/css/);
    assert.equal((await fetch(base+'/continuity')).status,200);assert.equal((await fetch(base+'/film')).status,200);assert.equal((await fetch(base+'/images')).status,200);assert.equal((await fetch(base+'/api/image-library')).status,200);
    assert.equal((await fetch(base+'/api/library')).status,200);
    assert.equal((await fetch(base+'/api/batches')).status,200);
    assert.equal((await fetch(base+'/api/jobs',{headers:{Origin:'https://unrelated.example'}})).status,403);
    assert.equal((await fetch(base+'/api/assets',{method:'POST',body:'not an image'})).status,400);
    const bytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a2ioAAAAASUVORK5CYII=','base64');
    const uploaded=await(await fetch(base+'/api/assets',{method:'POST',body:bytes})).json();assert.ok(uploaded.name.endsWith('.png'));
    assert.equal((await fetch(base+uploaded.url)).status,200);
    const requestId='22222222-2222-2222-2222-222222222222';
    const payload={requestId,asset:uploaded.name,preset:'locked',aspect:'landscape',length:'preview',prompt:'A still life',seed:1};
    const first=await fetch(base+'/api/jobs',{method:'POST',body:JSON.stringify(payload)});assert.equal(first.status,502);
    const second=await fetch(base+'/api/jobs',{method:'POST',body:JSON.stringify(payload)});assert.equal(second.status,200);
    const jobs=await(await fetch(base+'/api/jobs')).json();assert.equal(jobs.length,1);assert.equal(jobs[0].status,'failed');
    assert.equal((await fetch(base+`/api/jobs/${jobs[0].id}/review`,{method:'POST',body:JSON.stringify({verdict:'approved'})})).status,400);
    assert.equal((await fetch(base+'/api/health')).status,200);
  }finally{child.kill();await new Promise(r=>child.once('exit',r));await rm(data,{recursive:true,force:true});}
});

test('Restart preserves review evidence and quarantines an ambiguous submission',async()=>{
  const data=await mkdtemp(path.join(tmpdir(),'frameforge-recovery-'));
  const port=16317+Math.floor(Math.random()*1000),base=`http://127.0.0.1:${port}`;
  const readyId='33333333-3333-3333-3333-333333333333',unknownId='44444444-4444-4444-4444-444444444444';
  for(const [id,status] of [[readyId,'review-ready'],[unknownId,'submitting']]){
    const directory=path.join(data,'jobs',id);await mkdir(directory,{recursive:true});
    await writeFile(path.join(directory,'job.json'),JSON.stringify({id,requestId:id,status,createdAt:new Date().toISOString(),request:{},review:null}));
    if(id===readyId)await writeFile(path.join(directory,'report.json'),JSON.stringify({technicalPass:true,sha256:'a'.repeat(64)}));
  }
  let child;
  async function start(){
    child=spawn(process.execPath,['server.mjs'],{cwd:root,env:{...process.env,PORT:String(port),STUDIO_DATA:data,COMFY_URL:'http://127.0.0.1:1'},windowsHide:true,stdio:['ignore','pipe','pipe']});
    await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Recovery server timed out')),10000);child.stdout.once('data',()=>{clearTimeout(timer);resolve();});child.once('error',reject);});
  }
  async function stop(){if(child&&child.exitCode===null){const done=new Promise(resolve=>child.once('exit',resolve));child.kill();await done;}}
  try{
    await start();
    const jobs=await(await fetch(base+'/api/jobs')).json();
    assert.equal(jobs.find(x=>x.id===unknownId).status,'needs-attention');
    const duplicate=await(await fetch(base+'/api/jobs',{method:'POST',body:JSON.stringify({requestId:unknownId})})).json();
    assert.equal(duplicate.id,unknownId);assert.equal(duplicate.status,'needs-attention');
    const review=await fetch(base+`/api/jobs/${readyId}/review`,{method:'POST',body:JSON.stringify({verdict:'approved',notes:'Synthetic test fixture only'})});
    assert.equal(review.status,200);assert.equal((await review.json()).review.sha256,'a'.repeat(64));
    await stop();await start();
    const recovered=await(await fetch(base+'/api/jobs')).json();
    assert.equal(recovered.length,2);
    assert.equal(recovered.find(x=>x.id===readyId).review.notes,'Synthetic test fixture only');
    assert.equal(recovered.find(x=>x.id===readyId).review.verdict,'approved');
    assert.equal(recovered.find(x=>x.id===unknownId).status,'needs-attention');
  }finally{await stop();await rm(data,{recursive:true,force:true});}
});
