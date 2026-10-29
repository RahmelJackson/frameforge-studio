import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter,once} from 'node:events';
import {PassThrough} from 'node:stream';
import {mkdtemp,mkdir,copyFile,readFile,writeFile,rm} from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {SetupInstalls} from '../lib/setup-installs.mjs';
import {launchStudio,stopStudio,installationId} from '../scripts/quickstart.mjs';
import {sourceInventory} from '../scripts/package-source.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));

test('Setup accepts only explicit CPU-profile downloads and prevents concurrent installers',async()=>{
 let child,called=0,completed=0,args;
 const installs=new SetupInstalls({root,onComplete:async profile=>{assert.equal(profile,'media');completed++;},spawnProcess:(command,arguments_)=>{called++;args=arguments_;child=new EventEmitter();child.stdout=new PassThrough();child.stderr=new PassThrough();return child;}});
 for(const input of [{profile:'media'},{profile:'shell',acceptDownload:true},{profile:'vision',acceptDownload:true,args:['anything']},{profile:'media',acceptDownload:'yes'}])await assert.rejects(()=>installs.start(input));
 assert.equal(called,0);
 const result=await installs.start({profile:'media',acceptDownload:true});assert.equal(result.running,true);assert.equal(called,1);assert.deepEqual(args.slice(-3),['media','--managed','--install']);
 await assert.rejects(()=>installs.start({profile:'vision',acceptDownload:true}),/already running/);
 child.stdout.write('Pinned CPU packages');child.emit('close',0);await new Promise(resolve=>setImmediate(resolve));
 assert.equal(installs.running,false);assert.equal(completed,1);assert.equal(installs.describe().jobs[0].status,'completed');assert.match(installs.describe().jobs[0].log,/Pinned CPU packages/);
 await installs.start({profile:'vision',acceptDownload:true});child.stderr.write('No wheel for this platform');child.emit('close',1);await new Promise(resolve=>setImmediate(resolve));assert.equal(installs.running,false);assert.equal(installs.jobs[0].status,'failed');assert.equal(completed,1);
});

test('Runtime downloads are pinned per platform and the source release includes its launchers',async()=>{
 const lock=JSON.parse(await readFile(path.join(root,'setup/quickstart-runtime.lock.json'),'utf8'));
 const shell=await readFile(path.join(root,'scripts/quickstart.sh'),'utf8'),powershell=await readFile(path.join(root,'scripts/quickstart.ps1'),'utf8');
 for(const runtime of ['node','uv'])for(const platform of ['win32-x64','win32-arm64','darwin-x64','darwin-arm64','linux-x64','linux-arm64']){const spec=lock[runtime].artifacts[platform];assert.match(spec.sha256,/^[a-f0-9]{64}$/);assert.ok(spec.file&&!spec.file.includes('latest'));if(runtime==='node'&&!platform.startsWith('win32'))assert.ok(shell.includes(spec.sha256));}
 assert.match(powershell,/Security.Cryptography.SHA256/);assert.match(powershell,/No administrator/);
 const files=await sourceInventory(),names=files.map(file=>file.name);for(const name of ['Start Frameforge.cmd','Stop Frameforge.cmd','Start Frameforge.command','QUICKSTART.md','scripts/managed-python.mjs','scripts/quickstart.sh','public/welcome.html'])assert.ok(names.includes(name),name);
});

test('A clean launcher avoids foreign ports, opens the full onboarding and reuses its own Studio',async()=>{
 let legacy=false,foreignStudio=false;
 const directory=await mkdtemp(path.join(tmpdir(),'ff-quickstart spaced-')),foreign=http.createServer((req,res)=>res.end(foreignStudio&&req.url==='/api/quickstart'?JSON.stringify({app:'frameforge',pid:1,installationId:'another-installation',quickstartComplete:true}):legacy&&req.url==='/api/catalog'?JSON.stringify({images:{},presets:[]}):'different app'));
 foreign.listen(0,'127.0.0.1');await once(foreign,'listening');const port=foreign.address().port;let started;
 try{
  for(const file of await sourceInventory()){const target=path.join(directory,file.name);await mkdir(path.dirname(target),{recursive:true});await copyFile(file.file,target);}
  started=await launchStudio({root:directory,port,openPage:false});assert.equal(started.reused,false);assert.notEqual(new URL(started.url).port,String(port));assert.equal(started.installationId,installationId(directory));
  const response=await fetch(started.url);assert.equal(response.status,200);const html=await response.text();assert.match(html,/Less setup/);assert.match(html,/I have ComfyUI/);assert.match(html,/Install media tools/);assert.ok(response.headers.get('content-security-policy').includes("frame-ancestors 'none'"));
  const base=new URL(started.url).origin;
  assert.equal((await fetch(base+'/api/quickstart/finish',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({complete:true})})).status,200);
  const reused=await launchStudio({root:directory,port:Number(new URL(started.url).port),openPage:false});assert.equal(reused.reused,true);assert.equal(reused.pid,started.pid);assert.equal(new URL(reused.url).pathname,'/');
  const rejected=await fetch(base+'/api/quickstart/install',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({profile:'shell',acceptDownload:true})});assert.equal(rejected.status,400);
  const denied=await fetch(base+'/api/quickstart/install',{method:'POST',headers:{Origin:'https://unrelated.example','Content-Type':'application/json'},body:JSON.stringify({profile:'media',acceptDownload:true})});assert.equal(denied.status,403);
  const checks=await(await fetch(base+'/api/quickstart/check')).json();assert.equal(checks.media.available,false);assert.equal(checks.vision.available,false);
  const config=await(await fetch(base+'/api/assistant/mcp-config?client=claude&writes=1')).json();assert.ok(config.text.includes(base));assert.match(config.text,/--allow-writes/);
  const recordFile=path.join(directory,'runtime/launcher.json'),record=await readFile(recordFile,'utf8');await writeFile(recordFile,JSON.stringify({...JSON.parse(record),pid:1}));await assert.rejects(()=>stopStudio({root:directory}),/different installation/);await writeFile(recordFile,record);
  assert.equal((await stopStudio({root:directory})).stopped,true);started=null;
  foreignStudio=true;started=await launchStudio({root:directory,port,openPage:false});assert.notEqual(new URL(started.url).port,String(port));assert.equal(started.installationId,installationId(directory));await stopStudio({root:directory});started=null;foreignStudio=false;
  legacy=true;await assert.rejects(()=>launchStudio({root:directory,port,openPage:false}),/older Frameforge/);
 }finally{
  if(started)try{await stopStudio({root:directory});}catch{}
  await new Promise(resolve=>foreign.close(resolve));await new Promise(resolve=>setTimeout(resolve,250));assert.ok(path.resolve(directory).startsWith(path.resolve(tmpdir())+path.sep));await rm(directory,{recursive:true,force:true});
 }
});
