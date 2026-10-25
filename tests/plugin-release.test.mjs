import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,mkdir,copyFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {sourceInventory} from '../scripts/package-source.mjs';

test('The plugin can launch from a relocated clean source release with its skills, branding and visual MCP resource',async()=>{
 const destination=await mkdtemp(path.join(tmpdir(),'frameforge-plugin-'));
 try{
  const files=await sourceInventory();
  await Promise.all(files.map(async file=>{const target=path.join(destination,file.name);await mkdir(path.dirname(target),{recursive:true});await copyFile(file.file,target);}));
  const read=async name=>JSON.parse(await readFile(path.join(destination,name),'utf8'));
  const manifest=await read('plugin.json'),market=await read('.agents/plugins/marketplace.json'),mcp=await read('mcp.json');
  assert.equal(market.plugins[0].name,manifest.name);
  assert.equal(path.resolve(destination,market.plugins[0].source.path),path.resolve(destination));
  const settings=manifest.extensions['com.openai'];
  const inside=value=>{assert.ok(value.startsWith('./'));const full=path.resolve(destination,value);assert.ok(full.startsWith(path.resolve(destination)+path.sep));return full;};
  for(const name of [settings.interface.logo,settings.interface.composerIcon,settings.onboardingSkill])assert.ok((await readFile(inside(name))).length>0);
  for(const skill of ['setup','frameforge'])assert.match(await readFile(path.join(destination,'skills',skill,'SKILL.md'),'utf8'),/^---\r?\nname: /);
  const launch=mcp.mcpServers.frameforge,expand=value=>value.replaceAll('${PLUGIN_ROOT}',destination);
  assert.equal(launch.type,'stdio');
  assert.equal(launch.command,'node');
  assert.equal(path.resolve(expand(launch.cwd)),path.resolve(destination));
  const env={...process.env,...Object.fromEntries(Object.entries(launch.env).map(([k,v])=>[k,expand(v)]))};
  assert.ok((await readFile(path.join(env.FRAMEFORGE_IMPORT_ROOT,'mcp-observatory.png'))).length>0);
  // Discovery and embedded UI must work without starting a website, model or render.
  const child=spawn(process.execPath,launch.args.filter(a=>a!=='--start-studio').map(expand),{cwd:expand(launch.cwd),env,stdio:['pipe','pipe','pipe'],windowsHide:true});
  let stdout='',stderr='';child.stdout.on('data',b=>stdout+=b);child.stderr.on('data',b=>stderr+=b);
  const timer=setTimeout(()=>child.kill(),15000);
  const exited=once(child,'exit');
  child.stdin.end([
   {id:1,method:'initialize',params:{protocolVersion:'2025-06-18'}},
   {id:2,method:'tools/list'},
   {id:3,method:'resources/read',params:{uri:'ui://frameforge/studio-v1.html'}}
  ].map(m=>JSON.stringify({jsonrpc:'2.0',...m})).join('\n')+'\n');
  const [code]=await exited;clearTimeout(timer);assert.equal(code,0,stderr);
  const messages=stdout.trim().split('\n').map(JSON.parse);assert.equal(messages.length,3);
  assert.ok(messages.every(m=>m.result&&!m.error));assert.equal(messages[1].result.tools.length,17);
  const ui=messages[2].result.contents[0];assert.equal(ui.mimeType,'text/html;profile=mcp-app');assert.ok(ui.text.includes('data:image/png;base64,'));assert.ok(ui.text.includes('data:video/mp4;base64,'));assert.ok(!ui.text.includes('poster="/explore-art/'));assert.ok(Buffer.byteLength(ui.text)<2*1024**2);
 }finally{assert.ok(path.resolve(destination).startsWith(path.resolve(tmpdir())+path.sep));await rm(destination,{recursive:true,force:true});}
});
