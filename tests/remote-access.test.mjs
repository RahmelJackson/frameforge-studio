import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {fileURLToPath} from 'node:url';
import {RemoteAccess} from '../lib/remote-access.mjs';
import {qrMatrix} from '../public/qr.js';
const root=fileURLToPath(new URL('../',import.meta.url));

test('QR encoder sizes pairing links into versions 1–10',()=>{assert.equal(qrMatrix('hi').length,21);assert.equal(qrMatrix('http://192.168.1.50:4318/remote#t='+'x'.repeat(32)).length,37);assert.throws(()=>qrMatrix('x'.repeat(400)),/too long/);});

test('The phone remote needs the pairing token, exposes only Produce actions and signed production media',async()=>{
 const data=await mkdtemp(path.join(tmpdir(),'ff-remote-')),seen=[];
 const studio=http.createServer((req,res)=>{seen.push(req.url);res.writeHead(200,{'content-type':'image/png'});res.end('png');});await new Promise(r=>studio.listen(0,'127.0.0.1',r));
 const p={id:'11111111-1111-4111-8111-111111111111',name:'Canals',format:'what-if',duration:15,aspect:'portrait',stage:'review-keyframes',frames:[{id:'f1',title:'The familiar',prompt:'x',targetDuration:3,narration:'',image:{done:true,url:'/outputs/22222222-2222-4222-8222-222222222222/image.png',jobId:'j'},clip:null}],events:[],updatedAt:'now'};
 const actions=[];const productions={list:[p],public:x=>({...x,waiting:x.stage.startsWith('review')}),create:async b=>{actions.push(['create',b]);return p;},action:async(id,b)=>{actions.push([id,b]);return p;}};
 const remote=await new RemoteAccess({data,root,port:0,studioPort:studio.address().port,productions,formats:[{id:'what-if',title:'What if…',summary:'s',art:'moon.svg',aspect:'portrait'}]}).open();
 try{
  const paired=await remote.enable();const port=remote.server.address().port,base='http://127.0.0.1:'+port,auth={Authorization:'Bearer '+paired.token};assert.ok(paired.token.length>=32);
  assert.equal((await fetch(base+'/api/remote/state')).status,401);assert.equal((await fetch(base+'/api/remote/state',{headers:{Authorization:'Bearer wrong'}})).status,401);
  const state=await (await fetch(base+'/api/remote/state',{headers:auth})).json();assert.equal(state.productions[0].name,'Canals');const img=state.productions[0].frames[0].image;assert.match(img,/^\/m\/[\w-]{32}\/outputs\//);
  assert.equal(await (await fetch(base+img)).text(),'png');assert.equal((await fetch(base+img.replace(/\/m\/[\w-]{32}/,'/m/'+'a'.repeat(32)))).status,404);
  assert.equal((await fetch(base+'/m/'+remote.sign('/api/jobs')+'/api/jobs')).status,404,'only production media paths can be signed');
  for(const route of ['/api/jobs','/api/setup','/setup','/api/remote-access','/create'])assert.equal((await fetch(base+route,{headers:auth})).status,404,route);
  assert.equal((await fetch(base+'/api/remote/productions/'+p.id+'/action',{method:'POST',headers:{...auth,'Content-Type':'application/json'},body:JSON.stringify({action:'look',look:'x'})})).status,400);
  assert.equal((await fetch(base+'/api/remote/productions/'+p.id+'/action',{method:'POST',headers:{...auth,'Content-Type':'application/json'},body:JSON.stringify({action:'continue'})})).status,200);
  assert.equal((await fetch(base+'/api/remote/produce',{method:'POST',headers:{...auth,'Content-Type':'application/json'},body:JSON.stringify({format:'what-if',subject:'glowing canals',duration:15,aspect:'portrait',quality:'max'})})).status,201);assert.equal(actions.at(-1)[1].quality,'draft');
  const page=await fetch(base+'/remote');assert.match(await page.text(),/Director remote/);assert.match(page.headers.get('content-security-policy'),/script-src 'self'/);
  const old=paired.token;await remote.disable();assert.equal(remote.server,null);await remote.enable();const p2=remote.server.address().port;assert.equal((await fetch('http://127.0.0.1:'+p2+'/api/remote/state',{headers:{Authorization:'Bearer '+old}})).status,401,'re-pairing revokes the old phone');
 }finally{await remote.disable();studio.close();await rm(data,{recursive:true,force:true});}
});
