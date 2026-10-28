import test from 'node:test';import assert from 'node:assert/strict';import http from 'node:http';import {once} from 'node:events';
import {comfyOrigin,ComfyStudioViews} from '../lib/comfy-studio.mjs';
import {localStudioBase,localStudioPath} from '../assets/comfyui-frameforge/web/studio.js';
import {spawnSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {mediaTestSkip} from './media-runtime.mjs';

test('ComfyUI parent policy allows only the connection origin and survives a stopped Studio',{skip:mediaTestSkip('configured')},async()=>{
 const config=JSON.parse(await readFile(new URL('../config.local.json',import.meta.url),'utf8'));
 const result=spawnSync(config.python,['tests/comfy_studio_check.py'],{cwd:new URL('..',import.meta.url),windowsHide:true,encoding:'utf8',timeout:15000});
 assert.equal(result.status,0,result.stdout+result.stderr);
});
test('ComfyUI connections accept only canonical local origins and safe in-app paths',()=>{
 for(const value of ['http://127.0.0.1:8188','http://localhost:8000'])assert.equal(comfyOrigin(value),value);
 for(const value of ['https://example.com','http://example.com','http://localhost:8188/','http://user:pass@localhost:8188','http://localhost:8188/path','http://localhost:8188?x=1','http://localhost:8188#x','null','*'])assert.throws(()=>comfyOrigin(value));
 assert.equal(localStudioBase('http://127.0.0.1:4317/'),'http://127.0.0.1:4317');for(const value of ['https://example.com','http://localhost:4317/private','http://user:pass@localhost:4317'])assert.throws(()=>localStudioBase(value));
 for(const value of ['/','/library','/audio?tool=transcribe','/images?tool=edit&source=test'])assert.equal(localStudioPath(value),value);
 for(const value of ['https://example.com','//example.com','/'+String.fromCharCode(92)+'example.com','/a'+String.fromCharCode(92)+'b','/a'+String.fromCharCode(10)+'b'])assert.throws(()=>localStudioPath(value),value);
});
test('Full ComfyUI views are reused, narrowly framed and forward local actions and range requests',async()=>{
 const seen=[],backend=http.createServer(async(req,res)=>{let body='';for await(const part of req)body+=part;seen.push({url:req.url,method:req.method,headers:req.headers,body});if(req.url==='/movie'){res.writeHead(206,{'Content-Type':'video/mp4','Content-Range':'bytes 0-3/20'});res.end('film');return;}res.writeHead(200,{'Content-Type':'text/html','Content-Security-Policy':"default-src 'self'; frame-ancestors 'none'"});res.end('<html><head></head><body>Actual Studio route '+req.url+'</body></html>');});backend.listen(0,'127.0.0.1');await once(backend,'listening');const views=new ComfyStudioViews();
 try{const base='http://127.0.0.1:'+backend.address().port,a=await views.open({base,ancestor:'http://127.0.0.1:8188'}),b=await views.open({base,ancestor:'http://127.0.0.1:8188'});assert.equal(a.url,b.url);assert.equal(a.kind,'full-studio');assert.equal(a.writes,true);
 const page=await fetch(a.url+'/images');assert.match(page.headers.get('content-security-policy'),/frame-ancestors 'self' http:\/\/127.0.0.1:8188$/);assert.match(await page.text(),/Actual Studio route \/images/);assert.match((await fetch(base+'/images')).headers.get('content-security-policy'),/frame-ancestors 'none'/);
 const action=await fetch(a.url+'/api/assets',{method:'POST',headers:{Origin:a.url,'Content-Type':'image/png'},body:'image fixture'});assert.equal(action.status,200);assert.equal(seen.at(-1).body,'image fixture');assert.equal(seen.at(-1).headers.origin,base);
 const movie=await fetch(a.url+'/movie',{headers:{Range:'bytes=0-3',Authorization:'private',Cookie:'secret=no; frameforge_navigation=top'}});assert.equal(movie.status,206);assert.equal(await movie.text(),'film');assert.equal(seen.at(-1).headers.authorization,undefined);assert.equal(seen.at(-1).headers.cookie,'frameforge_navigation=top');
 const count=seen.length;assert.equal((await fetch(a.url+'/api/assets',{method:'POST',headers:{Origin:'http://127.0.0.1:8188'},body:'cross origin'})).status,403);assert.equal(seen.length,count);
 for(const ancestor of ['http://localhost:8188','http://127.0.0.1:8189','http://localhost:8000'])await views.open({base,ancestor});await assert.rejects(()=>views.open({base,ancestor:'http://localhost:9000'}),/Four ComfyUI/);
 }finally{await views.close();backend.closeAllConnections();await new Promise(resolve=>backend.close(resolve));}
});
