import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {once} from 'node:events';
import {embedAncestors,startStudioEmbed} from '../lib/studio-embed.mjs';
import {createMCPServer} from '../scripts/frameforge-mcp.mjs';
import {STUDIO_UI_URI} from '../lib/mcp-ui.mjs';

test('Embed access uses exact MCP-supplied ancestors, never wildcard or credentialed/path origins',()=>{
 assert.deepEqual(embedAncestors(['https://web-sandbox.oaiusercontent.com','app://codex','http://127.0.0.1:4390']),['https://web-sandbox.oaiusercontent.com','app://codex','http://127.0.0.1:4390']);
 for(const value of [[],['*'],['https://*.example.com'],['https://a.example/path'],['https://a.example; frame-src *'],['file:///'],['null'],['http://example.com'],['https://user:password@example.com']])assert.throws(()=>embedAncestors(value));
});

test('Full studio view preserves assets, ranges and navigation while isolating frame permissions and read-only access',async()=>{
 const seen=[],backend=http.createServer((req,res)=>{seen.push({url:req.url,headers:req.headers,method:req.method});if(req.url==='/movie'){res.writeHead(206,{'Content-Type':'video/mp4','Content-Range':'bytes 0-3/20'});return res.end('film');}res.writeHead(200,{'Content-Type':'text/html','Content-Security-Policy':"default-src 'self'; frame-ancestors 'none'"});res.end('<html><head></head><body><a href="/images">Images</a></body></html>');});
 backend.listen(0,'127.0.0.1');await once(backend,'listening');let view;
 try{
  const base='http://127.0.0.1:'+backend.address().port;view=await startStudioEmbed({base});
  assert.equal((await fetch(view.url+'/')).status,403);view.setAncestors(['https://web-sandbox.oaiusercontent.com']);
  const page=await fetch(view.url+'/');assert.equal(page.status,200);assert.match(page.headers.get('content-security-policy'),/frame-ancestors 'self' https:\/\/web-sandbox.oaiusercontent.com$/);assert.match(await page.text(),/__frameforge_embed\/bridge.js/);
  assert.match((await fetch(base)).headers.get('content-security-policy'),/frame-ancestors 'none'/);
  const before=seen.length;assert.equal((await fetch(view.url+'/api/jobs',{method:'POST',body:'test'})).status,403);assert.equal((await fetch(view.url+'/',{headers:{Origin:'https://other.example'}})).status,403);assert.equal(seen.length,before);
  const movie=await fetch(view.url+'/movie',{headers:{Range:'bytes=0-3',Cookie:'private=secret; frameforge_navigation=top',Authorization:'Bearer private'}});assert.equal(movie.status,206);assert.equal(await movie.text(),'film');assert.equal(seen.at(-1).headers.range,'bytes=0-3');assert.equal(seen.at(-1).headers.authorization,undefined);assert.equal(seen.at(-1).headers.cookie,'frameforge_navigation=top');
  const script=await fetch(view.url+'/__frameforge_embed/bridge.js');assert.equal(script.status,200);assert.match(await script.text(),/frameforge-studio-ready/);
 }finally{if(view)await view.close();backend.closeAllConnections();await new Promise(resolve=>backend.close(resolve));}
});

test('Write-enabled view forwards authorized local actions and enforces a locked open-weights connection',async()=>{
 const seen=[],backend=http.createServer(async(req,res)=>{let text='';for await(const chunk of req)text+=chunk;seen.push({url:req.url,headers:req.headers,text});res.setHeader('Content-Type','application/json');res.end(JSON.stringify({ok:true}));});backend.listen(0,'127.0.0.1');await once(backend,'listening');let view;
 try{view=await startStudioEmbed({base:'http://127.0.0.1:'+backend.address().port,allowWrites:true,openWeightsOnly:true});view.setAncestors(['https://claude.ai']);
  const result=await fetch(view.url+'/api/workflow-plans',{method:'POST',headers:{Origin:view.url,'Content-Type':'application/json'},body:'{"context":"images"}'});assert.equal(result.status,200);assert.equal(seen.at(-1).headers['x-frameforge-open-weights-only'],'1');assert.equal(seen.at(-1).text,'{"context":"images"}');assert.notEqual(seen.at(-1).headers.origin,view.url);
  const profile=await(await fetch(view.url+'/api/execution-policy')).json();assert.equal(profile.locked,true);assert.equal(profile.openWeightsOnly,true);
  const count=seen.length;assert.equal((await fetch(view.url+'/api/execution-policy',{method:'POST',body:'{"openWeightsOnly":false}'})).status,403);assert.equal(seen.length,count);
 }finally{if(view)await view.close();backend.closeAllConnections();await new Promise(resolve=>backend.close(resolve));}
});

test('MCP resource authorizes only its connection view, rejects invalid ancestors and closes its listener',async()=>{
 let calls=0;const handle=createMCPServer({base:'http://127.0.0.1:1',fetcher:async()=>{calls++;return Response.json({workflows:[],tasks:[]});}}),request=(method,params)=>handle({jsonrpc:'2.0',id:1,method,params});let origin;
 try{const ui=(await request('resources/read',{uri:STUDIO_UI_URI})).result.contents[0];origin=ui._meta.ui.csp.frameDomains[0];assert.equal((await fetch(origin)).status,403);assert.equal(calls,0);
  const bad=(await request('tools/call',{name:'studio_workflows',arguments:{embedAncestors:['*']}})).result;assert.equal(bad.isError,true);assert.equal(calls,0);
  const ready=(await request('tools/call',{name:'studio_workflows',arguments:{embedAncestors:['https://web-sandbox.oaiusercontent.com']}})).result;assert.equal(ready.isError,undefined);assert.equal((await fetch(origin)).status,502);
 }finally{await handle.close();}await assert.rejects(()=>fetch(origin));
});
