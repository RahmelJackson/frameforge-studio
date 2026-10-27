import {assertOpenProvider} from '../lib/provider-policy.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import net from 'node:net';
import http from 'node:http';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {PROVIDER_WORKFLOWS,providerPacket,providerReadiness} from '../lib/provider-workflows.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
test('Provider examples retain their real core models, original upstream provenance and safe preview wiring',async()=>{
 assert.deepEqual(PROVIDER_WORKFLOWS.map(w=>w.id),['ltx-vfx','flux3-video','minimax-h3']);
 const required={'ltx-vfx':'LTXVDualCFGGuider','flux3-video':'Flux3ImageToVideoNode','minimax-h3':'MinimaxHailuo03FirstLastFrameNode'};
 const manifests=JSON.parse(await readFile(path.join(root,'workflows/bonus/manifest.json')));
 for(const w of PROVIDER_WORKFLOWS){const p=await providerPacket(root,w.id);assert.ok(p.nodeTypes.includes(required[w.id]));assert.equal(p.generationVerified,false);assert.equal(p.nativeEditorRequired,true);assert.ok(p.steps.length>=3);assert.match(p.upstreamCommit,/^[a-f0-9]{40}$/);assert.equal(p.sha256,createHash('sha256').update(await readFile(path.join(root,'workflows/bonus',p.file))).digest('hex'));
  const upstream=manifests.find(m=>m.id===w.manifestId);assert.equal(createHash('sha256').update(await readFile(path.join(root,'workflows/bonus',upstream.id+'.json'))).digest('hex'),upstream.sha256);
 }
 const ltx=await providerPacket(root,'ltx-vfx');assert.equal(ltx.graphFormat,'api');assert.equal(ltx.graph['398:362'].inputs.value,5);assert.equal(ltx.graph['398:372'].inputs.value,640);assert.equal(ltx.graph['398:360'].inputs.value,384);assert.ok(!Object.values(ltx.graph).some(n=>n.inputs.clip_name==='gemma4_e2b_it_int8_convrot.safetensors'));assert.equal(ltx.models.length,5);assert.ok(ltx.models.every(m=>m.sha256&&/\/resolve\/[a-f0-9]{40}\//.test(m.url)));
 const h3=await providerPacket(root,'minimax-h3','local');assert.ok(h3.nodeTypes.includes('MiniMaxH3ImageToVideo'));assert.equal(h3.models.length,5);assert.ok(h3.models.every(m=>m.sha256&&m.bytes&&/\/resolve\/[a-f0-9]{40}\//.test(m.url)));assert.equal(PROVIDER_WORKFLOWS.find(w=>w.id==='flux3-video').model,'FLUX 3 Video');assert.match(PROVIDER_WORKFLOWS.find(w=>w.id==='flux3-video').relatedModel.url,/flux-3-image-klein-comfy/);assert.match(h3.input,/One starting image/);assert.match(h3.steps.join(' '),/territorial availability/);await assert.rejects(()=>providerPacket(root,'../../config.local.json'),/Unknown/);await assert.rejects(()=>providerPacket(root,'flux3-video','invalid'),/Unknown/);const klein=await providerPacket(root,'flux3-video','local');assert.equal(klein.model,'FLUX 3 Image Klein');assert.equal(klein.execution,'local');assert.equal(klein.models.length,4);assert.ok(klein.models.every(m=>m.sha256&&m.bytes));assert.ok(!klein.nodeTypes.includes('Flux3ImageToVideoNode'));assert.match(klein.output,/edited image/);for(const n of klein.graph.nodes.filter(n=>['Flux3LayoutPrompt','CreateBoundingBoxes','KSampler'].includes(n.type)))assert.deepEqual(Object.values(n.widgets_values_named),n.widgets_values);const upstream=manifests.find(m=>m.id==='image_flux3_klein_distilled_image_edit');assert.equal(createHash('sha256').update(await readFile(path.join(root,'workflows/bonus',upstream.id+'.json'))).digest('hex'),upstream.sha256);
});
test('Provider HTTP downloads preserve exact native graphs and strict profile permits only reviewed local provider graphs',async()=>{
 const directory=await mkdtemp(path.join(tmpdir(),'ff-provider-http-'));const socket=net.createServer();socket.listen(0,'127.0.0.1');await once(socket,'listening');const port=socket.address().port;await new Promise(r=>socket.close(r));
 const child=spawn(process.execPath,['server.mjs'],{cwd:root,env:{...process.env,PORT:String(port),STUDIO_DATA:directory,COMFY_URL:'http://127.0.0.1:1',FRAMEFORGE_OPEN_WEIGHTS_ONLY:'0'},windowsHide:true,stdio:['ignore','pipe','pipe']});let errors='';child.stderr.on('data',c=>errors+=c);
 try{
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Provider test server timed out: '+errors)),15000);child.stdout.once('data',()=>{clearTimeout(timer);resolve();});child.once('exit',()=>{clearTimeout(timer);reject(Error(errors));});});
  const base='http://127.0.0.1:'+port;const response=await fetch(base+'/api/provider-workflows');assert.equal(response.status,200);const list=await response.json();assert.equal(list.length,3);
  assert.deepEqual(list.map(w=>[w.featured.model,w.featured.execution,w.featured.variant]),[['LTX 2.5','local','default'],['FLUX 3 Image Klein','local','local'],['MiniMax H3','local','local']]);
  assert.ok(list.every(w=>w.featured.verification===null&&!w.featured.graph));
  assert.match(list[1].featured.cloudUrl,/template=image_flux3_klein_distilled_image_edit$/);assert.match(list[2].featured.cloudUrl,/template=video_minimax_h3_i2v$/);
  for(const w of list){const p=await(await fetch(base+'/api/provider-workflows/'+w.id)).json();const download=await fetch(base+'/api/provider-workflows/'+w.id+'/download');assert.equal(download.status,200);assert.match(download.headers.get('content-disposition'),/attachment/);assert.equal(createHash('sha256').update(Buffer.from(await download.arrayBuffer())).digest('hex'),p.sha256);assert.equal((await fetch(base+w.art)).status,200);}
  for(const route of ['/provider-workflows.js','/provider-workflows.css','/library?collection=workflows'])assert.equal((await fetch(base+route)).status,200);
  const html=await(await fetch(base+'/library?collection=workflows')).text();
  assert.match(html,/data-provider-detail-only hidden/);assert.ok(!html.includes('id="studio-recipes"'));assert.ok(html.indexOf('class="workflow-browser"')<html.indexOf('id="provider-workflows"'));
  const home=await(await fetch(base+'/')).text();assert.match(home,/data-provider-compact/);assert.ok(home.indexOf('id="provider-workflows"')>home.indexOf('class="home-resume"'));
  for(const [id,variant] of [['ltx-vfx','default'],['flux3-video','default'],['minimax-h3','default'],['flux3-video','local'],['minimax-h3','local']]){
   const response=await fetch(base+'/api/provider-workflows/'+id+'/export?variant='+variant,{method:'POST'});assert.equal(response.status,200);const bundle=await response.json();assert.equal(bundle.generationExecuted,false);
   const download=await fetch(base+bundle.bundleUrl);assert.equal(download.status,200);const entries=unzipStored(Buffer.from(await download.arrayBuffer()));
   assert.deepEqual([...entries.keys()].sort(),['README.txt','inputs/'+(id==='flux3-video'?'product-concept.png':'observatory-concept.png'),'models.json','workflow.json']);
   const graph=JSON.parse(entries.get('workflow.json'));assert.ok(graph.nodes?.length||Object.keys(graph).length);for(const n of (graph.nodes??Object.values(graph)).filter(n=>(n.type??n.class_type)==='LoadImage')){const image=n.inputs?.image??n.widgets_values[0];assert.equal(image,id==='flux3-video'?'product-concept.png':'observatory-concept.png');if(n.widgets_values_named)assert.equal(n.widgets_values_named.image,image);}assert.match(entries.get('README.txt').toString(),/Press Run in native ComfyUI/);assert.ok(entries.get('inputs/'+(id==='flux3-video'?'product-concept.png':'observatory-concept.png')).length>1000);
   assert.equal((await fetch(base+bundle.bundleUrl,{headers:{'X-Frameforge-Open-Weights-Only':'1'}})).status,id==='ltx-vfx'||variant==='local'?200:403);
  }
  const cloud=await(await fetch(base+'/api/provider-workflows/flux3-video/readiness')).json();assert.equal(cloud.execution,'partner');assert.equal(cloud.ready,false);
  const proofFolder=path.join(directory,'provider-verifications','ltx-vfx');await mkdir(proofFolder,{recursive:true});
  await writeFile(path.join(proofFolder,'report.json'),JSON.stringify({state:'completed',model:'LTX 2.5',duration:2,frames:49,fps:24,size:[640,384],blackFrames:0,hasAudio:true,creativeApproval:false,scope:'One short local test'}));await writeFile(path.join(proofFolder,'result.mp4'),'preview-fixture');
  const verified=await(await fetch(base+'/api/provider-workflows/ltx-vfx')).json();assert.equal(verified.generationVerified,true);assert.equal(verified.verification.creativeApproval,false);assert.equal(await(await fetch(base+verified.verification.videoUrl)).text(),'preview-fixture');assert.equal((await fetch(base+'/api/provider-workflows/not-a-workflow/preview')).status,404);
  const imageFolder=path.join(directory,'provider-verifications','flux3-video-local');await mkdir(imageFolder,{recursive:true});
  const imageProof={state:'completed',mediaType:'image',model:'FLUX 3 Image Klein',size:[1248,832],creativeApproval:false,scope:'One product edit'};
  await writeFile(path.join(imageFolder,'report.json'),JSON.stringify(imageProof));await writeFile(path.join(imageFolder,'result.png'),'image-preview-fixture');
  const imageResult=await(await fetch(base+'/api/provider-workflows/flux3-video?variant=local')).json();assert.equal(imageResult.verification.mediaType,'image');assert.equal(imageResult.verification.videoUrl,undefined);assert.equal(imageResult.verification.duration,undefined);
  const imageResponse=await fetch(base+imageResult.verification.imageUrl);assert.equal(imageResponse.headers.get('content-type'),'image/png');assert.equal(await imageResponse.text(),'image-preview-fixture');
  const featured=await(await fetch(base+'/api/provider-workflows')).json();assert.equal(featured[1].featured.verification.imageUrl,imageResult.verification.imageUrl);assert.equal(featured[0].featured.verification.mediaType,'video');
  await writeFile(path.join(imageFolder,'report.json'),JSON.stringify({...imageProof,mediaType:'html'}));assert.equal((await fetch(base+imageResult.verification.imageUrl)).status,404);await writeFile(path.join(imageFolder,'report.json'),JSON.stringify(imageProof));
  const strict={'X-Frameforge-Open-Weights-Only':'1'};assert.equal((await fetch(base+verified.verification.videoUrl,{headers:strict})).status,200);assert.equal((await fetch(base+imageResult.verification.imageUrl,{headers:strict})).status,200);assert.equal((await(await fetch(base+'/api/provider-workflows',{headers:strict})).json()).length,3);
  for(const id of ['flux3-video','minimax-h3']){
   assert.equal((await fetch(base+'/api/provider-workflows/'+id+'/download',{headers:strict})).status,403);
   assert.equal((await fetch(base+'/api/provider-workflows/'+id+'/readiness',{headers:strict})).status,403);
   assert.equal((await fetch(base+'/api/provider-workflows/'+id+'/export',{method:'POST',headers:strict})).status,403);
  }
  assert.equal((await fetch(base+'/api/provider-workflows/flux3-video/export?variant=invalid',{method:'POST'})).status,404);
  assert.equal((await fetch(base+'/api/provider-workflows/not-a-workflow/download')).status,404);
 }finally{child.kill();await once(child,'exit');await rm(directory,{recursive:true,force:true});}
});

// Read the central directory of our uncompressed ZIP format, including data descriptors.
function unzipStored(bytes){
 const end=bytes.length-22;assert.equal(bytes.readUInt32LE(end),0x06054b50);let at=bytes.readUInt32LE(end+16);const entries=new Map();
 for(let i=0;i<bytes.readUInt16LE(end+10);i++){
  assert.equal(bytes.readUInt32LE(at),0x02014b50);assert.equal(bytes.readUInt16LE(at+10),0);const size=bytes.readUInt32LE(at+24),n=bytes.readUInt16LE(at+28),extra=bytes.readUInt16LE(at+30),comment=bytes.readUInt16LE(at+32),local=bytes.readUInt32LE(at+42),name=bytes.subarray(at+46,at+46+n).toString();
  const start=local+30+bytes.readUInt16LE(local+26)+bytes.readUInt16LE(local+28);entries.set(name,bytes.subarray(start,start+size));at+=46+n+extra+comment;
 }return entries;
}
test('Local setup checks choose a compatible engine and never submit a generation',async()=>{
 const packet=await providerPacket(root,'ltx-vfx'),types=packet.nodeTypes.filter(t=>!(packet.graph.definitions?.subgraphs??[]).some(s=>s.id===t));const missing=packet.models[0];const requests=[];
 const info=Object.fromEntries(types.map(t=>[t,{input:{}}]));info.UNETLoader={input:{required:{unet_name:[packet.models.filter(m=>m!==missing).map(m=>m.name)]}}};
 const engine=http.createServer((req,res)=>{requests.push([req.method,req.url]);res.setHeader('Content-Type','application/json');res.end(JSON.stringify(info));});engine.listen(0,'127.0.0.1');await once(engine,'listening');
 try{
  const base='http://127.0.0.1:'+engine.address().port,result=await providerReadiness({root,id:'ltx-vfx',engines:['http://127.0.0.1:1',base,base]});assert.equal(result.engineUrl,base);assert.equal(result.ready,false);assert.deepEqual(result.missingNodes,[]);assert.deepEqual(result.missingModels.map(m=>m.name),[missing.name]);
  info.UNETLoader.input.required.unet_name[0].push(missing.name);const ready=await providerReadiness({root,id:'ltx-vfx',engines:[base]});assert.equal(ready.ready,true);assert.match(ready.verification,/generation quality are separate/);
  const partner=await providerReadiness({root,id:'flux3-video',engines:[base]});assert.equal(partner.execution,'partner');assert.deepEqual(requests,[['GET','/object_info'],['GET','/object_info']]);
  const h3=await providerPacket(root,'minimax-h3','local');assert.match(h3.licenseNotice,/excludes the USA/);
 }finally{engine.closeAllConnections();await new Promise(r=>engine.close(r));}
});

test('Strict provider policy pins exact reviewed local graphs and rejects edited or partner graphs',async()=>{
 for(const [id,variant] of [['ltx-vfx','default'],['flux3-video','local'],['minimax-h3','local']]){
  const p=await providerPacket(root,id,variant);assert.equal(assertOpenProvider(p),true);
  const edited=structuredClone(p);edited.graph.injected={class_type:'PartnerBilling',inputs:{}};assert.throws(()=>assertOpenProvider(edited),/not been reviewed/);
 }
 const partner=await providerPacket(root,'flux3-video');assert.throws(()=>assertOpenProvider({...partner,execution:'local'}),/not been reviewed/);
});
