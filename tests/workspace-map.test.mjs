import test from 'node:test';import assert from 'node:assert/strict';
import {WORKSPACES,workspaceFor,workspaceTab,filmTabURL} from '../public/studio-map.js';
import {workflowOptions,recommendWorkflow} from '../public/studio-match.js';
import {renderWorkspacePage,workspaceNavigation} from '../lib/workspace.mjs';
const id='3b9f96a0-77cb-471e-bffb-614eabe4ed6c',plan='4b9f96a0-77cb-471e-bffb-614eabe4ed6c';
test('Seven outcome workspaces group every legacy tool and expose its purpose without duplicate primary tabs',()=>{
 assert.equal(WORKSPACES.length,7);assert.equal(workspaceFor('workflows').id,'library');assert.equal(workspaceFor('video-tools').id,'video');for(const page of ['short-film','director','film'])assert.equal(workspaceFor(page).id,'films');assert.equal(workspaceFor('continuity').id,'images');
 const nav=workspaceNavigation('video-tools');assert.equal((nav.match(/class="workspace-link/g)??[]).length,7);assert.equal((nav.match(/aria-current="page"/g)??[]).length,1);assert.ok(!nav.includes('href="/video-tools"'));assert.match(nav,/Generate, edit|Generate|generate, edit/);
 const html=renderWorkspacePage('<html><head></head><body><header>Film</header><main></main></body></html>','film','http://localhost/film?project='+id);assert.match(html,/data-workspace="films"/);assert.match(html,new RegExp('/short-film\\?project='+id));assert.match(html,/How this workspace connects/);assert.match(html,/id="finder-guided"/);
 assert.match(renderWorkspacePage('<head></head><body><header>Audio</header><main></main></body>','audio',null,'top'),/data-navigation="top"/);assert.match(renderWorkspacePage('<head></head><body><header>Audio</header><main></main></body>','audio',null,'invalid'),/data-navigation="side"/);assert.equal(workspaceTab('images',new URLSearchParams('view=boards')),'boards');
});
test('Story, Director and Timeline carry only valid project context and clear stale selections',()=>{
 assert.equal(filmTabURL('/film',{project:id,plan}),'/film?project='+id+'&plan='+plan);assert.equal(filmTabURL('/film?project='+id,{project:null}),'/film');assert.equal(filmTabURL('/film',{project:'../private',plan:'https://evil.test'}),'/film');
});
test('The guided matcher recommends actual input-compatible tools and refuses unsupported run locations',()=>{
 for(const material of ['idea','image','video','audio']){const choices=workflowOptions(material);assert.ok(choices.length>=3);assert.equal(new Set(choices.map(t=>t.id)).size,choices.length);for(const task of choices){const match=recommendWorkflow({material,taskId:task.id});assert.equal(match.task.id,task.id);assert.equal(match.available,true);assert.ok(match.url.includes('start='+task.id));}}
 assert.equal(recommendWorkflow().task.id,'image-animate');const cloud=recommendWorkflow({material:'image',taskId:'image-animate',location:'cloud'});assert.equal(cloud.workflow,'seedance-i2v');assert.ok(cloud.url.includes('provider=cloud'));assert.ok(cloud.setup.includes('collection=workflows'));assert.equal(cloud.available,true);
 assert.equal(recommendWorkflow({material:'audio',taskId:'lipsync',location:'cloud'}).available,false);assert.equal(recommendWorkflow({material:'idea',taskId:'speech',location:'comfy'}).available,false);assert.equal(recommendWorkflow({material:'video',taskId:'video-edit',location:'comfy'}).available,false);assert.equal(recommendWorkflow({material:'video',taskId:'video-smooth',location:'comfy'}).available,true);
 const text=recommendWorkflow({material:'idea',taskId:'video-text',location:'cloud'});assert.equal(text.workflow,'seedance-t2v');assert.equal(text.url,'/online?provider=cloud&workflow=seedance-t2v');assert.equal(recommendWorkflow({material:'image',taskId:'transcribe'}).task.id,'image-animate');
});
