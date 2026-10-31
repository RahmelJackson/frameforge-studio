import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {EventEmitter} from 'node:events';
import {LoraTrainer,parseProgress,trainingArgs} from '../lib/lora-trainer.mjs';
import {trainerPaths,TRAINER_REQUIREMENTS} from '../scripts/setup-trainer.mjs';

test('Progress parsing reads the latest tqdm step and training arguments match the exported dataset',()=>{
 assert.deepEqual(parseProgress('Steps:   1%|  | 10/1500 [00:10]\rSteps:  42%|####  | 630/1500 [10:00]'),{step:630,total:1500});assert.equal(parseProgress('Loading'),null);
 const args=trainingArgs({script:'s.py',dataset:'d/train',output:'o',trigger:'mira_pear',steps:1500,resolution:768});
 for(const a of ['--pretrained_model_name_or_path=black-forest-labs/flux-3-image-klein-base','--dataset_name=d/train','--caption_column=text','--instance_prompt=mira_pear','--resolution=768','--max_train_steps=1500'])assert.ok(args.includes(a),a);
 assert.ok(!TRAINER_REQUIREMENTS.some(r=>/^torch/.test(r)),'never reinstalls Torch');
});

test('A training run exports the dataset, holds the GPU, copies the LoRA and reports failures plainly',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'ff-train-root-')),data=await mkdtemp(path.join(tmpdir(),'ff-train-data-')),loras=path.join(data,'loras');
 try{
  const paths=trainerPaths(root);for(const f of [paths.python,paths.script,paths.receipt]){await mkdir(path.dirname(f),{recursive:true});await writeFile(f,'x');}
  await mkdir(path.join(data,'assets'));const images=Array.from({length:6},(_,i)=>({asset:randomUUID()+'.png',caption:'mira_pear view '+i,split:i===5?'holdout':'train'}));for(const [i,v] of images.entries())await writeFile(path.join(data,'assets',v.asset),'img '+i);
  const character={id:randomUUID(),name:'Mira',trigger:'mira_pear',images,rightsConfirmed:true};
  let child,spawned;const spawnProcess=(cmd,args,opts)=>{spawned={cmd,args,opts};child=new EventEmitter();child.stdout=new EventEmitter();child.stderr=new EventEmitter();child.pid=1;return child;};
  let busy=true;const trainer=await new LoraTrainer({root,data,loras,busy:()=>busy,spawnProcess,signedIn:async()=>true}).open();
  await assert.rejects(()=>trainer.start({character}),/render is running/);busy=false;
  await assert.rejects(()=>trainer.start({character,steps:50}),/200–4000/);
  const run=await trainer.start({character,steps:800,resolution:512});assert.equal(spawned.cmd,paths.python);assert.ok(spawned.args.includes('--max_train_steps=800'));
  const meta=(await readFile(path.join(data,'training',run.id,'dataset','train','metadata.jsonl'),'utf8')).trim().split('\n');assert.equal(meta.length,5);
  assert.ok(trainer.running());await assert.rejects(()=>trainer.start({character}),/already training/);
  child.stderr.emit('data','Steps:  50%|#####| 400/800 [01:00]');assert.equal(run.step,400);
  const out=path.join(data,'training',run.id,'output');await mkdir(out,{recursive:true});await writeFile(path.join(out,'pytorch_lora_weights.safetensors'),'lora');
  child.emit('close',0);await new Promise(r=>setTimeout(r,20));assert.equal(run.status,'completed');assert.equal(await readFile(path.join(loras,run.lora.name),'utf8'),'lora');
  const second=await trainer.start({character,steps:800});child.stderr.emit('data','torch.OutOfMemoryError: CUDA out of memory');child.emit('close',1);await new Promise(r=>setTimeout(r,20));assert.equal(second.status,'failed');assert.match(second.error,/out of memory/);
  const reopened=await new LoraTrainer({root,data,loras,spawnProcess,signedIn:async()=>false}).open();assert.equal(reopened.runs.length,2);await assert.rejects(()=>reopened.start({character}),/hf auth login/);
 }finally{await rm(root,{recursive:true,force:true});await rm(data,{recursive:true,force:true});}
});
