import test from 'node:test';
import assert from 'node:assert/strict';
import {pickWriterModel,parseShots,createShotWriter,writerMessages} from '../lib/shot-writer.mjs';
import {Productions,shotPrompt} from '../lib/productions.mjs';
import {mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';

const frames=[{title:'Ask a question',targetDuration:3,prompt:'Context: bees. Open with the question your audience has about bees.'},{title:'Give the takeaway',targetDuration:4,prompt:'Context: bees. Finish with one practical action and the original question answered.'}];

test('picks a small Gemma first and skips embedding models',()=>{
 assert.equal(pickWriterModel([{name:'nomic-embed-text'},{name:'qwen2.5:7b'},{name:'gemma3:12b'},{name:'gemma3:4b'}]),'gemma3:4b');
 assert.equal(pickWriterModel(['llama3.2:3b','mistral:7b']),'llama3.2:3b');
 assert.equal(pickWriterModel(['qwen2.5:7b','gemma3:4b'],'qwen2.5:7b'),'qwen2.5:7b');
 assert.equal(pickWriterModel([{name:'nomic-embed-text'}]),null);
});

test('cleans the shot list: no lettering words, narration fits the shot, stock is nouns',()=>{
 const shots=parseShots({shots:[{visual:'A title card with the question "why?" over a hive',narration:'Ever wondered how bees make honey from the flowers in your garden every single day of summer?',stock:'Honeybee, flower!'},{visual:'A honeybee lands on a white daisy and drinks nectar.',narration:'Plant flowers.',stock:'honeybee daisy nectar extra'}]},frames);
 assert.doesNotMatch(shots[0].visual,/title|question/i);
 assert.ok(shots[0].narration.split(' ').length<=Math.round(3*2.5)+2);
 assert.equal(shots[0].stock,'honeybee flower');
 assert.equal(shots[1].stock,'honeybee daisy nectar');
 assert.throws(()=>parseShots({shots:[{visual:'one',narration:'',stock:''}]},frames),/1 of 2/);
});

test('asks Ollama on the CPU, unloads it, and returns written shots',async()=>{
 const calls=[];
 const reply=(value)=>({ok:true,status:200,body:[Buffer.from(JSON.stringify(value))]});
 const fetcher=async(url,options)=>{calls.push([url,options.body?JSON.parse(options.body):null]);
  if(url.endsWith('/api/tags'))return reply({models:[{name:'gemma3:4b',size:3e9}]});
  if(url.endsWith('/api/show'))return reply({capabilities:['completion']});
  if(url.endsWith('/api/chat'))return reply({message:{content:JSON.stringify({shots:[{visual:'Close-up of a honeybee on a daisy at dawn.',narration:'How do bees make honey?',stock:'honeybee daisy'},{visual:'Golden honey drips from a comb.',narration:'Plant flowers for them.',stock:'honeycomb'}]})}});
  throw Error('unexpected '+url);};
 const write=createShotWriter({fetcher,getConnection:()=>({provider:'ollama'})});
 const result=await write({subject:'bees',format:'explainer',look:'film',frames});
 assert.equal(result.model,'gemma3:4b');
 assert.equal(result.shots[1].visual,'Golden honey drips from a comb.');
 const chat=calls.find(c=>c[0].endsWith('/api/chat'))[1];
 assert.equal(chat.keep_alive,0);assert.equal(chat.options.num_gpu,0);assert.equal(chat.think,undefined);
 assert.match(writerMessages({subject:'bees',format:'explainer',look:'film',frames}).at(-1).content,/exactly 2 shots/);
});

test('no installed model means the built-in rules are used',async()=>{
 const fetcher=async()=>({ok:true,status:200,body:[Buffer.from(JSON.stringify({models:[]}))]});
 assert.equal(await createShotWriter({fetcher})({subject:'x',format:'explainer',look:'film',frames}),null);
});

test('a production uses written visuals, narration drafts and stock keywords',async()=>{
 const directory=await mkdtemp(path.join(tmpdir(),'ff-writer-'));
 const writer=async p=>({model:'gemma3:4b',shots:p.frames.map((f,i)=>({visual:'A honeybee on flower '+i+'.',narration:'Line '+i,stock:'honeybee'}))});
 const prod=new Productions({directory,call:async()=>({}),tick:false,writer});
 const p={id:'x',subject:'bees',format:'explainer',look:'film',frames:structuredClone(frames).map(f=>({...f,narration:''})),events:[]};
 await prod.writeShots(p);
 assert.equal(p.writer.model,'gemma3:4b');
 assert.equal(p.frames[1].narration,'Line 1');assert.equal(p.frames[0].stockQuery,'honeybee');
 assert.match(shotPrompt(p,p.frames[0],0,'image'),/^A honeybee on flower 0\./);
 assert.doesNotMatch(shotPrompt(p,p.frames[0],0,'image'),/question/i);
 const failing=new Productions({directory,call:async()=>({}),tick:false,writer:async()=>{throw Error('boom');}});
 const q={...p,writer:undefined,frames:structuredClone(frames),events:[]};await failing.writeShots(q);
 assert.equal(q.writer.skipped,'error');assert.match(shotPrompt(q,q.frames[0],0,'image'),/^bees\./);
});
