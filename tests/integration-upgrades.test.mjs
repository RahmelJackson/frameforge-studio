import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,rm,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {ModelDownloads} from '../lib/model-downloads.mjs';
import {prepareProviderPlan,assertProviderPlan,executableProvider} from '../lib/provider-execution.mjs';
import {toolRequirements} from '../lib/tool-requirements.mjs';
import {agentMCPConfig} from '../lib/assistant-connection.mjs';
import {WorkflowPlans} from '../lib/workflow-plans.mjs';
import {WorkflowExports} from '../lib/workflow-exports.mjs';
import {mcpNativePrompt} from '../public/mcp-workflow-inputs.js';
const root=fileURLToPath(new URL('../',import.meta.url));
const digest=b=>createHash('sha256').update(b).digest('hex');
const settled=async queue=>{for(let i=0;i<100&&queue.running;i++)await new Promise(r=>setTimeout(r,10));assert.equal(queue.running,false);};
test('Reviewed provider plans bind image, prompt, seed and reject graph mutation',async()=>{
 const directory=await mkdtemp(path.join(tmpdir(),'frameforge-providers-'));try{await mkdir(path.join(directory,'assets'));const asset='11111111-1111-4111-8111-111111111111.png';await writeFile(path.join(directory,'assets',asset),'fixture');
 for(const [workflow,context] of [['ltx-vfx','create'],['minimax-h3-local','create'],['flux3-image','images']]){
  const p=await prepareProviderPlan({root,data:directory,input:{asset,prompt:'A fixed test prompt',seed:42},workflow,context,engines:[],inspectImage:async()=>({width:1024,height:768})});
  assert.ok(p.graph.nodes.length>20);assert.equal(p.execution,'local');assert.ok(Object.values(p.api).some(n=>Object.values(n.inputs).includes('A fixed test prompt')));assert.ok(Object.values(p.api).filter(n=>n.class_type==='LoadImage').every(n=>n.inputs.image===asset));assert.deepEqual(assertProviderPlan(p,p.graph),p.api);
  const bad=structuredClone(p.graph);bad.nodes[0].widgets_values[0]='Changed';assert.throws(()=>assertProviderPlan(p,bad),/new provider workflow/);
  assert.ok(p.models.every(m=>m.url&&m.destination&&m.licenseUrl&&m.sha256));
  assert.deepEqual(mcpNativePrompt(p.graph),p.api);
  await assert.rejects(()=>prepareProviderPlan({root,data:directory,input:{asset,prompt:'Edit',seed:42,mask:asset},workflow,context,engines:[],inspectImage:async()=>({width:1024,height:768})}),workflow==='flux3-image'?/valid mask/:/one starting image/);
 }
 await assert.rejects(()=>executableProvider(root,'not-a-model'),/supported/);
 }finally{await rm(directory,{recursive:true,force:true});}
});
test('Model downloader resumes a bounded file, checks checksum and installs only a manifest destination',async()=>{
 const directory=await mkdtemp(path.join(tmpdir(),'frameforge-download-'));try{
  const bytes=Buffer.from('known pinned fixture'),model={name:'test.safetensors',destination:'models/vae/test.safetensors',url:'https://huggingface.co/test/repo/resolve/'+'a'.repeat(40)+'/test.safetensors',sha256:digest(bytes),bytes:bytes.length};
  await mkdir(path.join(directory,'models/vae'),{recursive:true});await writeFile(path.join(directory,'models/vae/test.safetensors.frameforge-part'),bytes.subarray(0,5));
  const queue=await new ModelDownloads({directory:path.join(directory,'jobs'),roots:{models:path.join(directory,'models')},resolveModels:async()=>[model],fetcher:async(url,options)=>{assert.equal(url,model.url);assert.equal(options.headers.Range,'bytes=5-');return new Response(bytes.subarray(5),{status:206,headers:{'Content-Range':'bytes 5-'+(bytes.length-1)+'/'+bytes.length}});}}).init();
  await assert.rejects(()=>queue.enqueue({selection:{workflow:'test'}}),/terms/);
  await queue.enqueue({selection:{workflow:'test'},acceptTerms:true});await assert.rejects(()=>queue.enqueue({selection:{workflow:'test'},acceptTerms:true}),/already running/);await settled(queue);assert.equal(queue.jobs[0].status,'completed',queue.jobs[0].error);assert.deepEqual(await readFile(path.join(directory,'models/vae/test.safetensors')),bytes);
  assert.throws(()=>queue.target({...model,destination:'models/../escape.safetensors'}),/Invalid/);
  await writeFile(path.join(directory,'models/vae/test.safetensors'),'different');await queue.enqueue({selection:{workflow:'test'},acceptTerms:true});await settled(queue);assert.equal(queue.jobs[0].status,'failed');assert.equal(await readFile(path.join(directory,'models/vae/test.safetensors'),'utf8'),'different');
 }finally{await rm(directory,{recursive:true,force:true});}
});
test('Native provider exports retain executable API fields instead of guessing native widget order',async()=>{
 const directory=await mkdtemp(path.join(tmpdir(),'frameforge-native-export-'));try{
  const asset='22222222-2222-4222-8222-222222222222.png';await mkdir(path.join(directory,'assets'));await writeFile(path.join(directory,'assets',asset),'bound fixture');
  const plans=await new WorkflowPlans({root,data:directory,comfy:{url:'http://127.0.0.1:8188'},providerEngines:[],inspectImage:async()=>({width:1024,height:768})}).open();const exports=await new WorkflowExports({data:directory,plans}).open();
  for(const [task,context] of [['ltx-vfx','create'],['minimax-h3-local','create'],['flux3-image','images']]){const plan=await plans.prepare({context,provider:'local',task,input:{asset,prompt:'Exact export instruction',seed:42}}),result=await exports.create(plan.id),native=JSON.parse(await readFile(path.join(directory,'workflow-exports',result.id,'workflow.json'),'utf8'));assert.deepEqual(native,(await plans.compile(plan.id)).api);assert.ok(Object.values(native).some(n=>n.class_type==='LoadImage'&&n.inputs.image===asset));}
  await assert.rejects(()=>plans.prepare({context:'create',provider:'local',task:'ltx-typo',input:{}}),/Unknown local workflow/);
 }finally{await rm(directory,{recursive:true,force:true});}
});
test('Gated and corrupt model responses never become installed weights',async()=>{
 const directory=await mkdtemp(path.join(tmpdir(),'frameforge-gated-'));try{
  for(const response of [()=>new Response('',{status:403}),()=>new Response('wrong')]){const q=await new ModelDownloads({directory:path.join(directory,'jobs'),roots:{models:path.join(directory,'models')},resolveModels:async()=>[{name:'x.safetensors',destination:'models/vae/x.safetensors',url:'https://huggingface.co/test/repo/resolve/'+'b'.repeat(40)+'/x.safetensors',bytes:5,sha256:digest('right')}],fetcher:async()=>response()}).init();await q.enqueue({selection:{},acceptTerms:true});await settled(q);assert.equal(q.jobs[0].status,'failed');await assert.rejects(()=>stat(path.join(directory,'models/vae/x.safetensors')));}
 }finally{await rm(directory,{recursive:true,force:true});}
});
test('Dependency lists need no uploads; Codex configuration uses TOML',async()=>{
 for(const [context,tool] of [['video-tools','interpolate'],['video-tools','restyle'],['audio','speech'],['audio','lipsync'],['images','style-board']]){const p=await toolRequirements(root,{context,tool});assert.ok(p.models.length,context+tool);assert.ok(p.models.every(m=>m.name&&m.name!=='undefined'&&m.url&&m.sha256&&m.bytes));}
 const p=agentMCPConfig({client:'codex',root:'C:/Frameforge',base:'http://127.0.0.1:4317'});assert.equal(p.format,'toml');assert.match(p.text,/\[mcp_servers.frameforge\]/);assert.ok(!p.text.includes('--allow-writes'));
});

test('Model download reuses a verified destination without a network request and leaves other models alone',async()=>{const directory=await mkdtemp(path.join(tmpdir(),'frameforge-installed-'));try{const bytes=Buffer.from('already here'),model={name:'installed.safetensors',destination:'models/vae/installed.safetensors',url:'https://huggingface.co/test/repo/resolve/'+'a'.repeat(40)+'/installed.safetensors',sha256:digest(bytes),bytes:bytes.length};await mkdir(path.join(directory,'models/vae'),{recursive:true});await writeFile(path.join(directory,'models/vae/installed.safetensors'),bytes);await writeFile(path.join(directory,'models/vae/unrelated.safetensors'),'keep me');let calls=0;const q=await new ModelDownloads({directory:path.join(directory,'jobs'),roots:{models:path.join(directory,'models')},resolveModels:async selection=>{assert.deepEqual(selection,{workflow:'one'});return [model];},fetcher:async()=>{calls++;throw Error('Must not redownload');}}).init();await q.enqueue({selection:{workflow:'one'},acceptTerms:true});await settled(q);assert.equal(q.jobs[0].status,'completed');assert.equal(calls,0);assert.equal(q.jobs[0].files[0].status,'verified');assert.equal(await readFile(path.join(directory,'models/vae/unrelated.safetensors'),'utf8'),'keep me');}finally{await rm(directory,{recursive:true,force:true});}});
