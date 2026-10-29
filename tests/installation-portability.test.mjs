import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import net from 'node:net';
import {once} from 'node:events';
import {tmpdir} from 'node:os';
import {spawn,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {readFile,mkdtemp,mkdir,copyFile,rm,writeFile} from 'node:fs/promises';
import {sourceInventory} from '../scripts/package-source.mjs';
import {configuredModelRoot,resolveSetupPaths} from '../lib/workspace-paths.mjs';
import {modelRegistry} from '../lib/tool-requirements.mjs';
import {createMCPServer} from '../scripts/frameforge-mcp.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
test('Model manifests resolve against the selected installation and preserve remote source filenames',async()=>{
 const selected=path.join(tmpdir(),'custom-comfy-models');
 const resolved=resolveSetupPaths({path:'models/checkpoints/example.safetensors',runtime:'runtime/example/file',remote:'split_files/example.safetensors',url:'https://example.com/models/file'},{root,modelRoot:selected});
 assert.equal(resolved.path,path.join(selected,'checkpoints/example.safetensors'));
 assert.equal(resolved.runtime,'runtime/example/file');
 assert.equal(resolved.remote,'split_files/example.safetensors');
 assert.equal(resolved.url,'https://example.com/models/file');
 assert.equal(configuredModelRoot(root,{modelRoot:selected}),path.resolve(selected));
 const registry=await modelRegistry(root);
 for(const group of ['vace14','photomaker','sdxl','canny']){
  const model=registry.find(item=>item.group===group);
  assert.ok(model,group);assert.equal(model.installRoot,'models');assert.ok(model.installPath&&!path.isAbsolute(model.installPath));
  assert.ok(!model.destination.includes('FrameforgeModels'));
 }
});

test('An exact public source download starts without private files and remembers a custom model folder',async()=>{
 const directory=await mkdtemp(path.join(tmpdir(),'ff-clean-install-'));let child;
 try{
  const files=await sourceInventory();
  for(const forbidden of ['scripts/move-storage-to-d.ps1','scripts/move-desktop-models-to-d.ps1','scripts/research-reference-mode.mjs'])assert.ok(!files.some(file=>file.name===forbidden));
  for(const file of files.filter(file=>/^(scripts|lib|setup)\//.test(file.name)&&/\.(py|mjs|json|ps1)$/.test(file.name)))assert.doesNotMatch(await readFile(file.file,'utf8'),/D:\/FrameforgeModels\/storybuilder|C:\/Windows\/Fonts\/segoeui\.ttf/,file.name);
  await Promise.all(files.map(async file=>{const target=path.join(directory,file.name);await mkdir(path.dirname(target),{recursive:true});await copyFile(file.file,target);}));
  const socket=net.createServer();socket.listen(0,'127.0.0.1');await once(socket,'listening');const port=socket.address().port;await new Promise(resolve=>socket.close(resolve));
  const env={...process.env,PORT:String(port),STUDIO_DATA:path.join(directory,'data'),COMFY_URL:'http://127.0.0.1:1'};delete env.FRAMEFORGE_MODEL_ROOT;
  child=spawn(process.execPath,['server.mjs'],{cwd:directory,env,windowsHide:true,stdio:['ignore','pipe','pipe']});
  await new Promise((resolve,reject)=>{let errors='';const timer=setTimeout(()=>reject(Error('Fresh install did not start: '+errors)),15000);child.stderr.on('data',chunk=>errors+=chunk);child.once('exit',()=>{clearTimeout(timer);reject(Error(errors));});child.stdout.once('data',()=>{clearTimeout(timer);resolve();});});
  const base='http://127.0.0.1:'+port;
  let response=await fetch(base+'/api/storage');assert.equal(response.status,200);const initial=await response.json();
  assert.equal(initial.extraModels,null);assert.equal(initial.locations.backups.exists,false);assert.equal(initial.locations.runtime.exists,false);assert.equal(initial.locations.data.exists,true);
  for(const endpoint of ['/','/images','/create','/audio','/library','/advanced','/setup','/api/audio-catalog','/api/model-downloads'])assert.equal((await fetch(base+endpoint)).status,200,endpoint);
  assert.equal((await(await fetch(base+'/api/audio-catalog')).json()).ready,false);
  const models=path.join(directory,'a different ComfyUI','models');await mkdir(models,{recursive:true});
  response=await fetch(base+'/api/model-downloads/storage',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({models,kind:'shared'})});assert.equal(response.status,200,await response.text());
  assert.equal((await(await fetch(base+'/api/storage')).json()).extraModels,models);
  assert.equal(JSON.parse(await readFile(path.join(directory,'config.local.json'),'utf8')).modelRoot,models);assert.equal((await(await fetch(base+'/api/model-downloads')).json()).storageMode,'shared');const invalid=await fetch(base+'/api/model-downloads/storage',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({models,kind:'unsupported'})});assert.equal(invalid.status,400);
 }finally{
  if(child&&child.exitCode===null){const stopped=once(child,'exit');child.kill();await stopped;}
  assert.ok(path.resolve(directory).startsWith(path.resolve(tmpdir())+path.sep));await rm(directory,{recursive:true,force:true});
 }
});

test('Previous v11 MCP panels receive the current visual resource',async()=>{
 const handle=createMCPServer(),reply=await handle({jsonrpc:'2.0',id:1,method:'resources/read',params:{uri:'ui://frameforge/studio-v11.html'}});
 assert.equal(reply.error,undefined);assert.equal(reply.result.contents[0].uri,'ui://frameforge/studio-v11.html');assert.match(reply.result.contents[0].text,/Frameforge · Creative studio/);
});

let config={};try{config=JSON.parse(await readFile(path.join(root,'config.local.json'),'utf8'));}catch{}
test('Python processor paths and caption fonts work without a developer drive',{skip:!config.python},async()=>{
 const directory=await mkdtemp(path.join(tmpdir(),'ff-python-paths-'));
 try{
  const modelRoot=path.join(directory,'chosen models');await writeFile(path.join(directory,'config.local.json'),'\uFEFF'+JSON.stringify({modelRoot}));
  const script="import sys,json;from pathlib import Path;from workspace_paths import resolve_paths;from studio_fonts import studio_font;root=Path(sys.argv[1]);p=resolve_paths({'path':'models/loras/test.safetensors','runtime':'runtime/test'},root);assert p['path']==str(root/'chosen models/loras/test.safetensors');assert p['runtime']==str(root/'runtime/test');assert studio_font(20).getbbox('Frameforge')[2]>0;print('portable processor paths and font ready')";
  const env={...process.env,PYTHONPATH:path.join(root,'scripts'),FRAMEFORGE_FONT:path.join(directory,'missing-font.ttf')};delete env.FRAMEFORGE_MODEL_ROOT;
  const run=spawnSync(config.python,['-c',script,directory],{encoding:'utf8',windowsHide:true,env,timeout:30000});
  assert.equal(run.status,0,run.stdout+run.stderr);
 }finally{assert.ok(path.resolve(directory).startsWith(path.resolve(tmpdir())+path.sep));await rm(directory,{recursive:true,force:true});}
});
