import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {WORKSPACES,workspaceTabGroups,workspaceFor,filmTabURL} from '../public/studio-map.js';
import {storyWithTake,shotGenerationInput,checkedSelectedTake} from '../public/video-project.js';
import {ProjectStore} from '../lib/projects.mjs';import {shortFilmSignature} from '../lib/short-film.mjs';import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import path from 'node:path';
const project='3b9f96a0-77cb-471e-bffb-614eabe4ed6c',shot='4b9f96a0-77cb-471e-bffb-614eabe4ed6c',other='5b9f96a0-77cb-471e-bffb-614eabe4ed6c',take='6b9f96a0-77cb-471e-bffb-614eabe4ed6c';
test('Five primary destinations retain all clip tools and present the same five video steps in order',()=>{
 assert.deepEqual(WORKSPACES.map(w=>w.name),['Home','Library','Images','Video','Audio']);assert.equal(workspaceFor('explore').id,'home');
 for(const page of ['create','video-tools','short-film','director','film']){const rows=workspaceTabGroups(workspaceFor(page),page);assert.deepEqual(rows[0].tabs.map(t=>t.id),['create','video-tools','short-film','director','film']);assert.equal(new Set(rows.flatMap(r=>r.tabs.map(t=>t.id))).size,rows.reduce((n,r)=>n+r.tabs.length,0));}
 assert.equal(workspaceTabGroups(workspaceFor('create'),'create').length,1);const utilities=workspaceFor('create').tabs;for(const id of ['queue','compare','checks','assets','projects','story-plan'])assert.ok(utilities.some(t=>t.id===id));
 assert.equal(filmTabURL('/video-tools?sourceJob='+take,{project,shot}),'/video-tools?sourceJob='+take+'&project='+project+'&shot='+shot);
 assert.equal(filmTabURL('/create?project='+project+'&shot='+shot,{project:null,shot:'../bad'}),'/create');
});
test('Attaching a take changes only the chosen saved-story frame and never mutates the prior plan',()=>{
 const original={script:'A short film',silent:false,noCaptions:true,frames:[{id:shot,title:'Opening',prompt:'Slow camera approach',imageJobId:other,takeJobId:null},{id:other,title:'Ending',prompt:'Hold',takeJobId:other}]};
 const saved=storyWithTake(original,shot,take);assert.equal(saved.frames[0].takeJobId,take);assert.equal(original.frames[0].takeJobId,null);assert.deepEqual(saved.frames[1],original.frames[1]);assert.equal(saved.frames[0].imageJobId,other);assert.equal(saved.script,original.script);
 assert.throws(()=>storyWithTake(original,take,take),/no longer exists/);assert.throws(()=>storyWithTake(original,shot,'bad'),/valid/);
});
test('Shot setup prefers saved notes, falls back to the actual take and never treats an arbitrary path as an input asset',()=>{
 const asset=other+'.png',jobs=[{id:take,request:{prompt:'A slow camera approach',asset,preset:'push-in'}}];
 const variation=shotGenerationInput({takeJobId:take,prompt:''},jobs);assert.equal(variation.prompt,'A slow camera approach');assert.equal(variation.asset,asset);assert.equal(variation.fromTake,true);
 const fresh=shotGenerationInput({takeJobId:take,prompt:'A new action',imageJobId:project},jobs);assert.equal(fresh.prompt,'A new action');assert.equal(fresh.asset,null);assert.equal(fresh.preset,null);
 assert.equal(shotGenerationInput({takeJobId:take},[{id:take,request:{asset:'../private.png'}}]).asset,null);assert.equal(shotGenerationInput({prompt:''}).prompt,'');
});
test('Project take selection uses a checked result, never an input field or a rejected/unfinished render',()=>{
 assert.equal(checkedSelectedTake({id:take,video:'output.mp4',report:{technicalPass:true}}),take);
 assert.equal(checkedSelectedTake({id:take,video:'output.mp4',report:{technicalPass:true},review:{verdict:'rejected'}}),null);
 assert.equal(checkedSelectedTake({id:take,video:'output.mp4',report:{technicalPass:false}}),null);
 assert.equal(checkedSelectedTake({sourceJob:take}),null);assert.equal(checkedSelectedTake({id:take,image:'output.png',report:{technicalPass:true}}),null);
});
test('Take handoffs persist on the chosen project and reject a stale second-tab selection',async()=>{
 const folder=await mkdtemp(path.join(tmpdir(),'ff-shot-handoff-'));try{let store=await new ProjectStore(folder).open(),p=await store.create({name:'Handoff test'});p=await store.saveStory(p.id,{script:'Two shots',frames:[{id:shot,title:'Opening',prompt:'Slow approach',imageJobId:null,takeJobId:null},{id:other,title:'Ending',prompt:'Hold',imageJobId:null,takeJobId:null}]},shortFilmSignature(p));const signature=shortFilmSignature(p),next=storyWithTake(p.story,shot,take);await store.saveStory(p.id,next,signature);await assert.rejects(store.saveStory(p.id,storyWithTake(p.story,other,take),signature),/changed elsewhere/);store=await new ProjectStore(folder).open();const saved=store.list()[0];assert.equal(saved.story.frames[0].takeJobId,take);assert.equal(saved.story.frames[1].takeJobId,null);assert.equal(saved.story.script,'Two shots');}finally{await rm(folder,{recursive:true,force:true});}
});
test('Home has one starting box and the complete inspiration browser; all help entry points use one non-modal panel',async()=>{
 const home=await readFile(new URL('../public/home.html',import.meta.url),'utf8'),assistant=await readFile(new URL('../public/assistant.js',import.meta.url),'utf8'),shell=await readFile(new URL('../lib/workspace.mjs',import.meta.url),'utf8');
 for(const id of ['home-guide-form','provider-workflows','inspiration','community-type','community-sort','community-detail'])assert.ok(home.includes('id="'+id+'"'),id);
 assert.ok(!home.includes('class="home-resume"'));assert.ok(!home.includes('id="recent-work"'));const homeScript=await readFile(new URL('../public/home.js',import.meta.url),'utf8');for(const route of ['/api/jobs','/api/audio-jobs','/api/projects'])assert.ok(!homeScript.includes(route));assert.ok(home.indexOf('id="provider-workflows"')<home.indexOf('id="inspiration"'));
 assert.ok(!home.includes('id="start-choices"'));assert.ok(!shell.includes('id="tool-finder"'));assert.ok(!shell.includes('class="workspace-find"'));
 assert.match(assistant,/aria-modal','false/);assert.match(assistant,/searchTasks\(query\)/);assert.match(assistant,/frameforge:open-guide/);assert.match(assistant,/frameforge.guideOpen/);
});
