import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {parseChecklist} from '../lib/checklist.mjs';
test('Every open goal has its own explicit next approach and proof, without changing acceptance counts',async()=>{
 const source=await readFile(new URL('../REMAINING-CHECKLIST.md',import.meta.url),'utf8'),data=parseChecklist(source),open=data.remaining.filter(x=>!x.done);
 assert.equal(open.length,15);assert.ok(open.every(x=>x.plan?.state&&x.plan.route&&x.plan.gate));assert.ok(data.remaining.filter(x=>x.done).every(x=>!x.plan));
 assert.equal(data.researchParked,true);assert.ok(open.every(x=>x.parked));assert.equal(data.production.length,8);
 assert.match(data.remaining.find(x=>x.id==='9').plan.gate,/roll worsens/);
 assert.match(data.remaining.find(x=>x.id==='18').plan.state,/failed/);
 const row=source.split(/\r?\n/).find(x=>/^\| 1 \|/.test(x));assert.throws(()=>parseChecklist(source.replace(row,row+'\n'+row)),/resolution plan/);
 assert.throws(()=>parseChecklist(source.replace(row,row.replace('| 1 |','| 11 |'))),/open goal/);
 assert.throws(()=>parseChecklist(source.replace(row,'| 1 | incomplete |')),/resolution plan/);
});
