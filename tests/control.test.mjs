import {mediaTestSkip} from './media-runtime.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {ComfyClient} from '../lib/comfy.mjs';
import {buildWorkflow,MODELS} from '../lib/workflow.mjs';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const listen=server=>new Promise(resolve=>server.listen(0,'127.0.0.1',()=>resolve(`http://127.0.0.1:${server.address().port}`)));
const close=server=>new Promise(resolve=>server.close(resolve));
async function body(req){let s='';for await(const c of req)s+=c;return s?JSON.parse(s):{};}
const send=(res,value={})=>{res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(value));};

test('Targeted cancellation never interrupts an unrelated engine job',async()=>{
  const calls=[];
  let queue={queue_running:[[0,'unrelated']],queue_pending:[]};
  const engine=http.createServer(async(req,res)=>{if(req.method==='GET')return send(res,queue);calls.push({url:req.url,body:await body(req)});res.end();});
  const base=await listen(engine);
  try{
    const client=new ComfyClient(base);
    assert.deepEqual(await client.cancel('ours'),{requested:false});assert.equal(calls.length,0);
    queue={queue_running:[[0,'ours']],queue_pending:[[1,'next']]};
    await client.cancel('ours');assert.deepEqual(calls,[{url:'/interrupt',body:{prompt_id:'ours'}}]);
    calls.length=0;await client.cancel('next');
    assert.deepEqual(calls,[{url:'/queue',body:{delete:['next']}},{url:'/interrupt',body:{prompt_id:'next'}}]);
  }finally{await close(engine);}
});

test('App validates image decoding, cancels owned work, and retries once with preserved settings',{skip:mediaTestSkip('engine')},async()=>{
  const data=await mkdtemp(path.join(tmpdir(),'frameforge-controls-'));
  const calls=[];let submitted=0,running=[];const histories={};
  const info=Object.fromEntries(Object.values(buildWorkflow({aspect:'landscape',length:'preview',preset:'locked',prompt:'test',seed:1,steps:12,fps:24},'x.png','x')).map(n=>[n.class_type,{}]));
  for(const [node,key,value] of [['UNETLoader','unet_name',MODELS.diffusion],['CLIPLoader','clip_name',MODELS.encoder],['VAELoader','vae_name',MODELS.vae]])info[node]={input:{required:{[key]:[[value]]}}};
  const engine=http.createServer(async(req,res)=>{
    if(req.url==='/system_stats')return send(res,{devices:[{name:'Fixture GPU',vram_free:1024,vram_total:2048}]});
    if(req.url==='/object_info')return send(res,info);
    if(req.url==='/upload/image'){for await(const c of req){}return send(res,{name:'fixture.png'});}
    if(req.url==='/prompt'){await body(req);const id='fixture-'+(++submitted);running=[[0,id],[1,'unrelated']];return send(res,{prompt_id:id});}
    if(req.url==='/queue')return send(res,{queue_running:running,queue_pending:[]});
    if(req.url.startsWith('/history/'))return send(res,histories);
    if(req.url==='/interrupt'){
      const input=await body(req);calls.push(input);running=running.filter(x=>x[1]!==input.prompt_id);
      histories[input.prompt_id]={status:{status_str:'error',messages:[['execution_interrupted',{}]]}};return send(res);
    }
    send(res);
  });
  const comfyUrl=await listen(engine),port=18317+Math.floor(Math.random()*1000),base=`http://127.0.0.1:${port}`;
  const child=spawn(process.execPath,['server.mjs'],{cwd:root,env:{...process.env,PORT:String(port),STUDIO_DATA:data,COMFY_URL:comfyUrl},windowsHide:true,stdio:['ignore','pipe','pipe']});
  const post=(route,input)=>fetch(base+route,{method:'POST',body:JSON.stringify(input)});
  try{
    await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Server startup timed out')),10000);child.stdout.once('data',()=>{clearTimeout(timer);resolve();});child.once('error',reject);});
    for(const filename of ['reference.png','reference.jpg','reference.webp','wide.png']){
      const response=await fetch(base+'/api/assets',{method:'POST',body:await readFile(path.join(root,'tests/fixtures',filename))});
      assert.equal(response.status,201);const image=await response.json();assert.ok(image.width>0&&image.height>0);
    }
    assert.equal((await fetch(base+'/api/assets',{method:'POST',body:await readFile(path.join(root,'tests/fixtures/broken.png'))})).status,400);
    assert.equal((await fetch(base+'/api/assets',{method:'POST',body:Buffer.alloc(25*1024*1024+1)})).status,400);
    const asset=await(await fetch(base+'/api/assets',{method:'POST',body:await readFile(path.join(root,'tests/fixtures/reference.png'))})).json();
    const payload={requestId:'55555555-5555-5555-5555-555555555555',asset:asset.name,prompt:'A fixture subject',preset:'locked',aspect:'square',length:'standard',quality:'draft',seed:987};
    const job=await(await post('/api/jobs',payload)).json();assert.ok(job.promptId);
    assert.equal((await post('/api/jobs/66666666-6666-6666-6666-666666666666/cancel',{})).status,404);assert.equal(calls.length,0);
    assert.equal((await post(`/api/jobs/${job.id}/cancel`,{})).status,202);
    assert.deepEqual(calls,[{prompt_id:job.promptId}]);assert.ok(running.some(x=>x[1]==='unrelated'));
    let stopped;
    for(let i=0;i<20;i++){stopped=(await(await fetch(base+'/api/jobs')).json()).find(x=>x.id===job.id);if(stopped.status==='cancelled')break;await new Promise(r=>setTimeout(r,250));}
    assert.equal(stopped.status,'cancelled');
    const retryBody={requestId:'77777777-7777-7777-7777-777777777777'};
    const retry=await(await post(`/api/jobs/${job.id}/retry`,retryBody)).json();
    assert.notEqual(retry.id,job.id);assert.equal(retry.retriedFrom,job.id);assert.deepEqual(retry.request,job.request);
    const duplicate=await(await post(`/api/jobs/${job.id}/retry`,retryBody)).json();assert.equal(duplicate.id,retry.id);assert.equal(submitted,2);
    assert.equal((await post(`/api/jobs/${retry.id}/retry`,{requestId:'88888888-8888-8888-8888-888888888888'})).status,409);
    assert.equal((await(await fetch(base+'/api/health')).json()).gpuMemory.free,1024);
  }finally{
    const done=new Promise(resolve=>child.once('exit',resolve));child.kill();await done;
    await close(engine);await rm(data,{recursive:true,force:true});
  }
});
