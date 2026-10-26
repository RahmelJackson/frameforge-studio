import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import net from 'node:net';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {PROVIDER_WORKFLOWS,providerPacket} from '../lib/provider-workflows.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
test('Provider examples retain their real core models, original upstream provenance and safe preview wiring',async()=>{
 assert.deepEqual(PROVIDER_WORKFLOWS.map(w=>w.id),['ltx-vfx','flux3-video','minimax-h3']);
 const required={'ltx-vfx':'LTXVDualCFGGuider','flux3-video':'Flux3ImageToVideoNode','minimax-h3':'MinimaxHailuo03FirstLastFrameNode'};
 const manifests=JSON.parse(await readFile(path.join(root,'workflows/bonus/manifest.json')));
 for(const w of PROVIDER_WORKFLOWS){const p=await providerPacket(root,w.id);assert.ok(p.nodeTypes.includes(required[w.id]));assert.equal(p.generationVerified,false);assert.equal(p.nativeEditorRequired,true);assert.ok(p.steps.length>=3);assert.match(p.upstreamCommit,/^[a-f0-9]{40}$/);assert.equal(p.sha256,createHash('sha256').update(await readFile(path.join(root,'workflows/bonus',p.file))).digest('hex'));
  const upstream=manifests.find(m=>m.id===w.manifestId);assert.equal(createHash('sha256').update(await readFile(path.join(root,'workflows/bonus',upstream.id+'.json'))).digest('hex'),upstream.sha256);
 }
 const ltx=await providerPacket(root,'ltx-vfx'),wrapper=ltx.graph.nodes.find(n=>n.id===398);assert.equal(wrapper.widgets_values[2],2);assert.deepEqual(wrapper.widgets_values.slice(3,5),[640,384]);assert.ok(wrapper.inputs.filter(i=>['value_3','value_4'].includes(i.name)).every(i=>i.link===null));assert.ok(!ltx.graph.links.some(l=>[783,784].includes(l[0])));assert.equal(ltx.models.length,5);assert.ok(ltx.models.every(m=>m.sha256&&/\/resolve\/[a-f0-9]{40}\//.test(m.url)));
 const h3=await providerPacket(root,'minimax-h3','local');assert.ok(h3.nodeTypes.includes('MiniMaxH3ImageToVideo'));assert.ok(h3.models.length>=4);assert.match(h3.input,/One starting image/);assert.match(h3.steps.join(' '),/territorial availability/);await assert.rejects(()=>providerPacket(root,'../../config.local.json'),/Unknown/);await assert.rejects(()=>providerPacket(root,'flux3-video','local'),/Unknown/);
});
test('Provider HTTP downloads preserve exact native graphs and strict profile blocks provider access',async()=>{
 const directory=await mkdtemp(path.join(tmpdir(),'ff-provider-http-'));const socket=net.createServer();socket.listen(0,'127.0.0.1');await once(socket,'listening');const port=socket.address().port;await new Promise(r=>socket.close(r));
 const child=spawn(process.execPath,['server.mjs'],{cwd:root,env:{...process.env,PORT:String(port),STUDIO_DATA:directory,COMFY_URL:'http://127.0.0.1:1',FRAMEFORGE_OPEN_WEIGHTS_ONLY:'0'},windowsHide:true,stdio:['ignore','pipe','pipe']});let errors='';child.stderr.on('data',c=>errors+=c);
 try{
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Provider test server timed out: '+errors)),15000);child.stdout.once('data',()=>{clearTimeout(timer);resolve();});child.once('exit',()=>{clearTimeout(timer);reject(Error(errors));});});
  const base='http://127.0.0.1:'+port;const response=await fetch(base+'/api/provider-workflows');assert.equal(response.status,200);const list=await response.json();assert.equal(list.length,3);
  for(const w of list){const p=await(await fetch(base+'/api/provider-workflows/'+w.id)).json();const download=await fetch(base+'/api/provider-workflows/'+w.id+'/download');assert.equal(download.status,200);assert.match(download.headers.get('content-disposition'),/attachment/);assert.equal(createHash('sha256').update(Buffer.from(await download.arrayBuffer())).digest('hex'),p.sha256);assert.equal((await fetch(base+w.art)).status,200);}
  for(const route of ['/provider-workflows.js','/provider-workflows.css','/library?collection=workflows'])assert.equal((await fetch(base+route)).status,200);
  assert.match(await(await fetch(base+'/library?collection=workflows')).text(),/id="provider-workflows"/);
  const strict={'X-Frameforge-Open-Weights-Only':'1'};assert.deepEqual(await(await fetch(base+'/api/provider-workflows',{headers:strict})).json(),[]);
  for(const id of ['flux3-video','minimax-h3','ltx-vfx'])assert.equal((await fetch(base+'/api/provider-workflows/'+id+'/download',{headers:strict})).status,403);
  assert.equal((await fetch(base+'/api/provider-workflows/not-a-workflow/download')).status,404);
 }finally{child.kill();await once(child,'exit');await rm(directory,{recursive:true,force:true});}
});
