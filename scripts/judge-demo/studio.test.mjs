import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {createJudgeServer} from './server.mjs';
import {boundedInput,cleanStudioJSON} from './studio-gateway.mjs';

test('Full judge studio uses the real site, isolates visitors and meters studio submissions under the same seven-run gate',async t=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'ff-full-judge-')),sessions=new Map();let calls=0,jobStatus='running';
 const local=http.createServer(async(req,res)=>{
  res.setHeader('Content-Type','application/json');
  if(req.url==='/api/judge-readiness')return res.end(JSON.stringify({connected:true,busy:false}));
  if(req.url.startsWith('/site/')){res.setHeader('Content-Type','text/html');return res.end('<html><head><title>Frameforge | Images</title></head><body><main><h1>Exact studio image workspace</h1></main></body></html>');}
  const owner=req.url.split('/')[1],rows=sessions.get(owner)??[];sessions.set(owner,rows);
  if(req.method==='POST'){let text='';for await(const c of req)text+=c;const input=JSON.parse(text);calls++;const row={id:randomUUID(),requestId:input.requestId,status:jobStatus,request:input,privatePath:'C:/Users/private/library.png'};rows.push(row);res.statusCode=202;return res.end(JSON.stringify(row));}
  if(req.url.endsWith('/api/execution-policy'))return res.end(JSON.stringify({openWeightsOnly:false,locked:false}));
  res.end(JSON.stringify(rows));
 });await new Promise(r=>local.listen(0,'127.0.0.1',r));const baseEngine='http://127.0.0.1:'+local.address().port;
 // A fake session pool supplies genuinely separate backing stores without GPU work.
 const pool={get:async owner=>baseEngine+'/'+owner+'/',close(){}};
 // Prefix routing via a dedicated session proxy preserves the production gateway URLs.
 const proxies=[];pool.get=async owner=>{let p=proxies.find(p=>p.owner===owner);if(p)return p.url;const proxy=http.createServer(async(req,res)=>{const r=await fetch(baseEngine+'/'+owner+req.url,{method:req.method,headers:{'Content-Type':req.headers['content-type']??'application/json'},...(req.method==='GET'?{}:{body:await new Response(req).text()})});res.writeHead(r.status,{'Content-Type':r.headers.get('content-type')});res.end(await r.text());});await new Promise(r=>proxy.listen(0,'127.0.0.1',r));p={owner,proxy,url:'http://127.0.0.1:'+proxy.address().port};proxies.push(p);return p.url;};
 const site=http.createServer((req,res)=>{if(req.url==='/api/judge-readiness'){res.setHeader('Content-Type','application/json');return res.end('{"connected":true,"busy":false}');}res.setHeader('Content-Type','text/html');res.end('<html><head><title>Frameforge | Images</title></head><body><main><h1>Exact studio image workspace</h1></main></body></html>');});await new Promise(r=>site.listen(0,'127.0.0.1',r));
 const app=await createJudgeServer({stateDir:dir,backend:'http://127.0.0.1:'+site.address().port,sessionPool:pool});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+app.server.address().port,code=JSON.parse(await readFile(app.stateFile)).code;
 t.after(async()=>{await new Promise(r=>app.server.close(r));for(const p of proxies)await new Promise(r=>p.proxy.close(r));await new Promise(r=>site.close(r));await new Promise(r=>local.close(r));await rm(dir,{recursive:true,force:true});});
 const login=async()=>{const r=await fetch(base+'/api/login',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({code})});return r.headers.get('set-cookie').split(';')[0];};
 const a=await login(),b=await login(),get=(route,cookie=a)=>fetch(base+route,{headers:{Cookie:cookie}}),post=(route,input,cookie=a)=>fetch(base+route,{method:'POST',headers:{Origin:base,Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify(input)});
 assert.match(await(await fetch(base+'/')).text(),/Judge access code/);
 assert.equal((await fetch(base+'/api/jobs')).status,401);
 const page=await(await get('/images')).text();assert.match(page,/Exact studio image workspace/);assert.match(page,/judge-studio.js/);assert.match(page,/judge-studio.css/);
 assert.equal((await post('/api/setup/connection',{url:'http://evil.example'})).status,403);assert.equal((await get('/api/storage')).status,403);assert.equal((await get('/data/judge-demo/state.json')).status,403);
 const input={requestId:randomUUID(),kind:'image',tool:'create',prompt:'An original lighthouse',aspect:'square',quality:'preview'};
 assert.equal((await post('/api/jobs',{...input,kind:'video',length:'long'})).status,422);assert.equal(calls,0);
 const parallel=await Promise.all([post('/api/jobs',input),post('/api/jobs',{...input,requestId:randomUUID()},b)]);assert.deepEqual(parallel.map(r=>r.status).sort(),[202,409]);assert.equal(calls,1);
 const first=await parallel[0].json();assert.equal('privatePath' in first,false);assert.equal((await(await get('/api/jobs',b)).json()).length,0);
 const own=await(await get('/api/jobs')).json();assert.equal(own.length,1);assert.equal('privatePath' in own[0],false);
 assert.equal((await post('/api/jobs',input)).status,202);assert.equal(calls,1);
 for(const rows of sessions.values())for(const row of rows){row.status='review-ready';row.report={technicalPass:true};}jobStatus='review-ready';
 await get('/api/status');for(let n=1;n<7;n++){assert.equal((await post('/api/jobs',{...input,requestId:randomUUID()})).status,202);await get('/api/status');}
 assert.equal((await post('/api/jobs',{...input,requestId:randomUUID()})).status,429);const status=await(await get('/api/status')).json();assert.equal(status.remaining,0);assert.equal(status.sharedRemaining,28);assert.equal(calls,7);
 assert.equal((await get('/library')).status,200);assert.equal((await get('/api/assistant/models')).status,200);assert.equal((await post('/api/batches',{requests:[input]})).status,403);
});

test('Hosted preview limits reject expensive settings and redact creator machine details',()=>{
 assert.throws(()=>boundedInput('create',{length:'long'}),/two-second/);assert.throws(()=>boundedInput('images',{scale:4}),/2×/);assert.throws(()=>boundedInput('video-tools',{start:0,end:30}),/3 seconds/);assert.throws(()=>boundedInput('audio',{text:'a'.repeat(301)}),/300/);
 assert.equal(boundedInput('create',{length:'preview'}).length,'preview');assert.deepEqual(cleanStudioJSON({privatePath:'secret',python:'secret',path:'D:/private/data/file.png',url:'/outputs/safe/output.png'}),{path:'[creator-local file]',url:'/outputs/safe/output.png'});
});

test('Judge privacy filtering preserves community media, model downloads and external source links',()=>{
 const item={image:'https://image.civitai.com/example/width=640,quality=85/picture.jpeg',url:'https://image.civitai.com/example/video.mp4',sourceUrl:'https://civitai.com/images/123',model:{url:'https://huggingface.co/Comfy-Org/sam3.1/resolve/main/model.safetensors'},cloud:'https://cloud.comfy.org/?template=example'};
 assert.deepEqual(cleanStudioJSON(item),item);
 assert.equal(cleanStudioJSON('Source: D:\\private\\library.png'),'Source: [creator-local file]');
 assert.equal(cleanStudioJSON('c:/private/source.png'),'[creator-local file]');
 assert.equal(cleanStudioJSON('http://127.0.0.1:8188'),'[creator-local engine]');
 assert.deepEqual(cleanStudioJSON({nested:{token:'secret',privatePath:'secret',url:item.sourceUrl}}),{nested:{url:item.sourceUrl}});
});
