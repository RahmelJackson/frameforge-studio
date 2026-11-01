import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {nativePacket} from '../lib/native-workflows.mjs';
import {nextStepLinks} from '../public/result-details.js';
import {ModelDownloads} from '../lib/model-downloads.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');

test('Identity swap opens Openjutsu as a pinned API graph without the paid first frame',async()=>{
 const p=await nativePacket(root,'identity-swap');
 assert.equal(p.graphFormat,'api');
 assert.equal(p.graph.anchor_image,undefined);assert.equal(p.graph.anchor_fit,undefined);
 assert.equal(p.graph['803'].inputs.use_anchor,false);assert.equal(p.graph['803'].inputs.anchor,undefined);
 assert.match(p.graph['801'].inputs.prompt,/<Video 1>.*<Picture 1>/);assert.doesNotMatch(p.graph['801'].inputs.prompt,/Picture 2/);
 assert.equal(p.graph['31'].inputs.resolution,480);assert.equal(p.graph.trim.inputs.duration,5);
 // Every link still points at a node that exists.
 for(const n of Object.values(p.graph))for(const v of Object.values(n.inputs))if(Array.isArray(v)&&v.length===2&&typeof v[0]==='string')assert.ok(p.graph[v[0]],v[0]);
 // Each model names its source and the folder it belongs in; the two unpinned LoRAs are manual.
 for(const m of p.models){assert.match(m.url,/^https:\/\/huggingface\.co\/.+\/resolve\/[a-f0-9]{40}\//);assert.match(m.destination,/^models\/(diffusion_models|text_encoders|vae|checkpoints|loras)\//);}
 assert.deepEqual(p.models.filter(m=>m.manual).map(m=>m.directory),['loras','loras']);
 assert.ok(p.missingDownloads.some(s=>/h3_character_swap/.test(s)&&/https:\/\/github\.com\/akatz-labs/.test(s)));
});

test('Every result offers next steps with the media attached',()=>{
 const id='0b6c6d5e-1f62-4c1b-9d9f-6c9a54a1a2b3',image=nextStepLinks(id,'/outputs/'+id+'/output.png'),video=nextStepLinks(id,'/outputs/'+id+'/output.mp4');
 assert.ok(image.some(s=>s.action==='animate')&&image.some(s=>s.action==='animate-vertical'));
 assert.ok(image.some(s=>/workflow=identity-swap&image=%2Foutputs%2F/.test(s.href??'')));
 assert.ok(image.some(s=>/ltx-native-shot/.test(s.href??''))&&image.some(s=>/flux3-references/.test(s.href??'')));
 assert.ok(video.some(s=>/workflow=ltx-outpaint&video=/.test(s.href??'')),'vertical remake');
 assert.ok(video.some(s=>/identity-swap&video=/.test(s.href??''))&&video.some(s=>/ltx-adapter-edit/.test(s.href??'')));
});

test('Download all skips files without a published checksum and lists them as manual',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'ff-dl-'));
 const manual={name:'a.safetensors',url:'https://huggingface.co/x/y/resolve/'+'a'.repeat(40)+'/a.safetensors',destination:'models/loras/a.safetensors',manual:true};
 const only=await new ModelDownloads({directory:dir,roots:{models:dir},resolveModels:async()=>[manual]}).init();
 await assert.rejects(()=>only.enqueue({selection:{workflow:'identity-swap'},acceptTerms:true}),/Manual download/);
 const pinned={name:'b.safetensors',url:'https://huggingface.co/x/y/resolve/'+'b'.repeat(40)+'/b.safetensors',destination:'models/vae/b.safetensors',sha256:'c'.repeat(64),bytes:4};
 const mixed=await new ModelDownloads({directory:dir,roots:{models:dir},resolveModels:async()=>[manual,pinned],fetcher:async()=>{throw Error('offline');}}).init();
 await mixed.enqueue({selection:{workflow:'identity-swap'},acceptTerms:true});
 assert.deepEqual(mixed.jobs[0].files.map(f=>f.name),['b.safetensors']);assert.deepEqual(mixed.jobs[0].manual.map(f=>f.name),['a.safetensors']);
});

test('Missing node types link to the pack that provides them, or to updating ComfyUI',async()=>{
 const {inspectRequirements}=await import('../lib/studio-setup.mjs');
 const report=inspectRequirements(await nativePacket(root,'identity-swap'),{LoadImage:{input:{}}});
 const packs=new Set(report.nodeSources.map(s=>s.pack));
 assert.ok([...packs].some(p=>/h3_character_swap/.test(p)));assert.ok(report.nodeSources.some(s=>s.type==='SAM3_Detect'&&s.update));
 for(const s of report.nodeSources)assert.match(s.url,/^https:\/\//);
});
