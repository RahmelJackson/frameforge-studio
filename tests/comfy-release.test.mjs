import test from 'node:test';import assert from 'node:assert/strict';import http from 'node:http';
import {ComfyClient} from '../lib/comfy.mjs';
test('Idle GPU release accepts ComfyUI empty acknowledgment and refuses queued work',async()=>{
  let pending=[],releases=0;
  const server=http.createServer((request,response)=>{
    if(request.url==='/queue'){response.setHeader('Content-Type','application/json');response.end(JSON.stringify({queue_running:[],queue_pending:pending}));}
    else if(request.url==='/free'){releases++;let bytes='';request.on('data',c=>bytes+=c);request.on('end',()=>{assert.deepEqual(JSON.parse(bytes),{unload_models:true,free_memory:true});response.end();});}
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  try{const client=new ComfyClient('http://127.0.0.1:'+server.address().port);await client.releaseIdle();assert.equal(releases,1);pending=[[1,'another-job']];await assert.rejects(client.releaseIdle(),/busy/);assert.equal(releases,1);}finally{await new Promise(r=>server.close(r));}
});
