import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {LOOKS,normalizeLook,lookPrompt} from '../lib/looks.mjs';
import {normalizeRequest,buildWorkflow} from '../lib/workflow.mjs';
import {breakDownScript} from '../lib/story.mjs';
import {LibraryStore} from '../lib/library.mjs';
const input={mode:'text',prompt:'Mara carries a brass compass.',preset:'locked',aspect:'landscape',length:'preview',seed:4,quality:'draft'};
test('Film looks preserve neutral prompts and reach both real generation adapters',()=>{
  const neutral=buildWorkflow(normalizeRequest(input),null,'test');assert.equal(lookPrompt(), '');assert.equal(neutral['5'].inputs.text.includes('undefined'),false);
  for(const [category,options] of Object.entries(LOOKS))for(const option of options){
    const look={[category]:option.id},r=normalizeRequest({...input,look});assert.equal(r.look[category],option.id);
    const graph=buildWorkflow(r,null,'test');assert.ok(graph['5'].inputs.text.includes(option.prompt));
    const camera=buildWorkflow({...r,mode:'image',engine:'camera',cameraPose:'Static',cameraSpeed:1},'image.png','test');assert.ok(camera['8'].inputs.text.includes(option.prompt));
  }
  for(const look of [null,[],{style:'unknown'},{madeUp:'natural'}])assert.throws(()=>normalizeLook(look));
});
const script='INT. OBSERVATORY - NIGHT\nMara enters carrying a brass compass.\n\nMARA\nThe signal is here.\n\nEXT. RIDGE - DAWN\nMara walks toward the antenna with the same compass.';
test('Script breakdown preserves scene order, source wording and dialogue names without rendering',()=>{
  const plan=breakDownScript(script);assert.equal(plan.briefs.length,3);assert.deepEqual(plan.characters,['MARA']);
  assert.match(plan.briefs[0].scene,/OBSERVATORY/);assert.match(plan.briefs[2].scene,/RIDGE/);
  assert.equal(plan.briefs[1].source,'MARA\nThe signal is here.');assert.equal(plan.briefs[1].preset,'locked');assert.equal(plan.briefs[2].preset,'pan');
  assert.match(plan.briefs[1].notes,/silent/);assert.match(plan.briefs[2].prompt,/same compass/);
  for(const text of ['', 'INT. ROOM - DAY','a'.repeat(2300),Array(25).fill('A new beat.').join('\n\n')])assert.throws(()=>breakDownScript(text));
});
test('Saved plans, reference collections and evidence-linked recipes survive restart; failed edits preserve originals',async()=>{
  const folder=await mkdtemp(path.join(tmpdir(),'frameforge-library-'));
  try{
    let store=await new LibraryStore(folder).open();const p=await store.addPlan({name:'Signal',script}),brief=p.briefs[0];
    await store.editBrief(p.id,brief.id,{...brief,prompt:'Mara raises the brass compass.',notes:'Keep the same coat.'});
    const before=store.list();await assert.rejects(store.editBrief(p.id,brief.id,{...brief,prompt:''}));assert.deepEqual(store.list(),before);
    const assets=['11111111-1111-1111-1111-111111111111.png','22222222-2222-2222-2222-222222222222.jpg'];
    await store.addReference({name:'Mara',kind:'character',notes:'White coat and brass compass.',assets});
    await assert.rejects(store.addReference({name:'Bad',kind:'character',notes:'',assets:['../../secret']}));
    await store.addRecipe({name:'Observatory',request:normalizeRequest(input),evidenceJobId:'saved-take'});
    store=await new LibraryStore(folder).open();const saved=store.list();
    assert.equal(saved.plans[0].briefs[0].source,brief.source);assert.match(saved.plans[0].briefs[0].prompt,/raises/);
    assert.deepEqual(saved.references[0].assets,assets);assert.equal(saved.recipes[0].evidenceJobId,'saved-take');
    saved.references.length=0;assert.equal(store.list().references.length,1);
  }finally{await rm(folder,{recursive:true,force:true});}
});
