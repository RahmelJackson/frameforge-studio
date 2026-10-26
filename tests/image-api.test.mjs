import {mediaTestSkip} from './media-runtime.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {spawn,spawnSync} from 'node:child_process';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {buildImageWorkflow,normalizeImage} from '../lib/images.mjs';
test('Real app image lifecycle shares the video lock, deduplicates, decodes PNGs and binds reviews to output',{skip:mediaTestSkip('configured')},async()=>{
  const root=new URL('..',import.meta.url),config=JSON.parse(await readFile(new URL('../config.local.json',import.meta.url),'utf8'));
  const data=await mkdtemp(path.join(tmpdir(),'frameforge-image-api-'));
  const image=spawnSync(config.python,['-c',"import sys,numpy as np;from PIL import Image;Image.fromarray(np.random.default_rng(1).integers(0,256,(768,768,3),dtype=np.uint8)).save(sys.stdout.buffer,format='PNG')"],{windowsHide:true,maxBuffer:5e6});assert.equal(image.status,0);
  const graph=buildImageWorkflow(normalizeImage({tool:'create',prompt:'Fixture image',seed:1})),info={};let submissions=0,finished=false;
  for(const n of Object.values(graph)){info[n.class_type]??={input:{required:{}}};for(const [key,value] of Object.entries(n.inputs))if(['unet_name','clip_name','vae_name'].includes(key))info[n.class_type].input.required[key]=[[value]];}
  const editGraph=buildImageWorkflow(normalizeImage({tool:'continuity',prompt:'Fixture reference',asset:'11111111-1111-1111-1111-111111111111.png'}),{asset:'source.png',reference:'reference.png',reference2:'board.png'});for(const n of Object.values(editGraph)){info[n.class_type]??={input:{required:{}}};for(const [key,value] of Object.entries(n.inputs))if(['unet_name','clip_name','vae_name','lora_name'].includes(key)){const existing=info[n.class_type].input.required[key]?.[0]??[];info[n.class_type].input.required[key]=[[...new Set([...existing,value])]];}}
  info.VAEEncode??={input:{required:{}}};
  const send=(res,value)=>{res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(value));};
  const engine=http.createServer(async(req,res)=>{
    if(req.url==='/system_stats')return send(res,{devices:[{name:'Fixture'}]});
    if(req.url==='/object_info')return send(res,info);
    if(req.url==='/upload/image'){for await(const c of req){}return send(res,{name:'uploaded.png',subfolder:''});}
    if(req.url==='/prompt'){for await(const c of req){}submissions++;return send(res,{prompt_id:'image-fixture'});}
    if(req.url==='/queue')return send(res,{queue_running:finished?[]:[[0,'image-fixture']],queue_pending:[]});
    if(req.url.startsWith('/history/'))return send(res,finished?{'image-fixture':{status:{completed:true,status_str:'success'},outputs:{'20':{images:[{type:'output',filename:'fixture.png'}]}}}}:{});
    if(req.url.startsWith('/view?')){res.writeHead(200,{'Content-Type':'image/png'});return res.end(image.stdout);}
    res.writeHead(404);res.end();
  });
  await new Promise(r=>engine.listen(0,'127.0.0.1',r));const port=18317+Math.floor(Math.random()*1000),base=`http://127.0.0.1:${port}`;
  const child=spawn(process.execPath,['server.mjs'],{cwd:root,env:{...process.env,PORT:String(port),STUDIO_DATA:data,COMFY_URL:`http://127.0.0.1:${engine.address().port}`},windowsHide:true,stdio:['ignore','pipe','pipe']});
  try{
    await new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(new Error('Startup timed out')),10000);child.stdout.once('data',()=>{clearTimeout(t);resolve();});child.once('error',reject);});
    const request={kind:'image',tool:'create',prompt:'Fixture image',seed:1,requestId:randomUUID()},post=(url,body)=>fetch(base+url,{method:'POST',body:JSON.stringify(body)});
    const first=await post('/api/jobs',request);assert.equal(first.status,202);const job=await first.json();
    assert.equal((await post('/api/jobs',request)).status,200);assert.equal(submissions,1);
    assert.equal((await post('/api/jobs',{...request,requestId:randomUUID()})).status,409);
    assert.equal((await post('/api/jobs',{requestId:randomUUID(),mode:'text',preset:'locked',aspect:'square',length:'preview',prompt:'A video'})).status,409);
    finished=true;let result;const deadline=Date.now()+12000;
    do{await new Promise(r=>setTimeout(r,250));result=(await(await fetch(base+'/api/jobs')).json()).find(j=>j.id===job.id);}while(result.status!=='review-ready'&&Date.now()<deadline);
    assert.equal(result.status,'review-ready',JSON.stringify(result));assert.equal(result.image,'output.png');assert.equal(result.video,undefined);assert.equal(result.report.technicalPass,true);assert.equal(result.review,null);
    assert.equal((await fetch(base+`/outputs/${job.id}/output.png`)).headers.get('content-type'),'image/png');
    const asset=await(await post(`/api/jobs/${job.id}/image-asset`,{})).json();assert.equal((await fetch(base+asset.url)).status,200);
    assert.equal((await(await post(`/api/jobs/${job.id}/image-asset`,{})).json()).name,asset.name);
    const reviewed=await(await post(`/api/jobs/${job.id}/review`,{verdict:'approved',notes:'Synthetic fixture only'})).json();assert.equal(reviewed.review.sha256,result.report.sha256);
    const black=spawnSync(config.python,['-c',"import sys;from PIL import Image;Image.new('RGB',(768,768),'black').save(sys.stdout.buffer,format='PNG')"],{windowsHide:true});assert.equal(black.status,0);
    const emptyMask=await(await fetch(base+'/api/assets',{method:'POST',body:black.stdout})).json();
    const invalidMask=await post('/api/jobs',{kind:'image',tool:'inpaint',asset:asset.name,mask:emptyMask.name,prompt:'Replace this region',requestId:randomUUID()});assert.equal(invalidMask.status,400);assert.match((await invalidMask.json()).error,/Paint part/);
    assert.equal((await(await fetch(base+'/api/jobs')).json()).length,1);
    assert.equal(submissions,1);
    const packInput={name:'Fixture continuity',character:{assets:[asset.name],notes:'Original identity'},location:{assets:[asset.name],notes:'Original place'},prop:{assets:[asset.name],notes:'Original prop'},style:{assets:[asset.name],notes:'Original look'}};
    const pack=await(await post('/api/continuity/packs',packInput)).json();assert.ok(pack.id);const runInput={requestId:randomUUID(),packId:pack.id,revision:pack.revision,briefs:['Same person in another pose'],aspect:'square',seed:91,quality:'precise'};
    const runResponse=await post('/api/continuity/runs',runInput);assert.equal(runResponse.status,201,JSON.stringify(await runResponse.clone().json()));const run=await runResponse.json();assert.equal((await(await post('/api/continuity/runs',runInput)).json()).id,run.id);
    const referenceDeadline=Date.now()+20000;let referenceJob;do{await new Promise(r=>setTimeout(r,250));referenceJob=(await(await fetch(base+'/api/jobs')).json()).find(j=>j.request.continuity?.runId===run.id);}while(referenceJob?.status!=='review-ready'&&!['failed','technical-failed','needs-attention'].includes(referenceJob?.status)&&Date.now()<referenceDeadline);assert.equal(referenceJob?.report?.technicalPass,true,JSON.stringify(referenceJob));assert.equal(submissions,2);assert.ok(referenceJob.report.provenance.reference2);assert.equal(referenceJob.request.quality,'precise');assert.equal(referenceJob.request.steps,40);const preciseGraph=await(await fetch(base+`/outputs/${referenceJob.id}/workflow.json`)).json();assert.equal(preciseGraph['9'],undefined);assert.equal(preciseGraph['10'].inputs.cfg,4);
    const comparison=await(await post(`/api/continuity/jobs/${referenceJob.id}/assessment`,{criteria:{identity:'uncertain',prop:'fail'},notes:'Synthetic fixture only'})).json();assert.equal(comparison.continuityReview.sha256,comparison.report.sha256);assert.equal(comparison.review,null);
    await post('/api/continuity/packs',{...pack,name:'New revision'});const originalRun=(await(await fetch(base+'/api/continuity')).json()).runs.find(r=>r.id===run.id);assert.equal(originalRun.pack.name,'Fixture continuity');assert.equal(originalRun.pack.revision,1);assert.equal((await(await post('/api/continuity/runs',runInput)).json()).id,run.id);assert.equal(submissions,2);
  }finally{const done=new Promise(r=>child.once('exit',r));child.kill();await done;await new Promise(r=>engine.close(r));await rm(data,{recursive:true,force:true});}
});
