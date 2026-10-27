import {readFile} from 'node:fs/promises';
import test from 'node:test';import assert from 'node:assert/strict';
import {WORKSPACES,workspaceFor,workspaceTab,filmTabURL} from '../public/studio-map.js';
import {workflowOptions,recommendWorkflow} from '../public/studio-match.js';
import {renderWorkspacePage,workspaceNavigation} from '../lib/workspace.mjs';
import {groupedImageTools} from '../public/studio-map.js';
import {IMAGE_TOOLS} from '../lib/images.mjs';
const id='3b9f96a0-77cb-471e-bffb-614eabe4ed6c',plan='4b9f96a0-77cb-471e-bffb-614eabe4ed6c';

test('Every image and video panel has one labelled tab, with navigation and local execution controls available in either layout',async()=>{
 const raw='<head></head><body><aside class="rail"><button data-view="old">Old hidden menu</button></aside><header>Old breadcrumb</header><main></main></body>';
 const images=renderWorkspacePage(raw,'images','http://localhost/images?view=sets');
 for(const label of ['Create &amp; edit','Saved images','Moodboards','Characters','Photo sets','Scene references'])assert.ok(images.includes(label),label);
 assert.ok(!images.includes('Old hidden menu'));assert.ok(!images.includes('workspace-tools'));assert.equal((images.match(/data-open-weights-toggle/g)??[]).length,2);assert.equal((images.match(/data-navigation-layout/g)??[]).length,2);assert.match(images,/Local only/);assert.ok(!images.includes('id="navigation-layout"'));
 const video=renderWorkspacePage(await readFile(new URL('../public/index.html',import.meta.url),'utf8'),'create','http://localhost/create?view=queue');
 for(const view of ['studio','gallery','compare','queue','assets','checks','projects','guide'])assert.equal((video.match(new RegExp('data-view="'+view+'"','g'))??[]).length,1,view);
 assert.match(video,/Takes & clip tools/);assert.match(video,/id="view-story"/);assert.match(video,/id="library-count"/);
 assert.equal(workspaceTab('images',new URLSearchParams('view=collection')),'image-library');assert.equal(workspaceTab('video-tools',new URLSearchParams('view=story')),'storyboard');
 const setup=renderWorkspacePage('<head></head><body><header>Setup</header><main><div class="setup-columns"></div></main></body>','setup');
 assert.equal((setup.match(/id="navigation-layout"/g)??[]).length,1);assert.equal((setup.match(/data-open-weights-toggle/g)??[]).length,1);
});
test('Image tool groups start with common tasks and retain every existing tool exactly once',()=>{
 const groups=groupedImageTools(IMAGE_TOOLS);assert.deepEqual(groups[0].tools.map(t=>t.id),['create','cinema']);assert.deepEqual(groups.flatMap(g=>g.tools.map(t=>t.id)).sort(),IMAGE_TOOLS.map(t=>t.id).sort());
 assert.ok(groups.find(g=>g.label.startsWith('Labs')).tools.some(t=>t.id==='face-neural'));assert.ok(groupedImageTools([...IMAGE_TOOLS,{id:'future',name:'Future tool'}]).at(-1).tools.some(t=>t.id==='future'));
});
test('Five outcome workspaces group every legacy tool and expose its purpose without duplicate primary tabs',()=>{
 assert.equal(WORKSPACES.length,5);assert.equal(workspaceFor('workflows').id,'library');assert.equal(workspaceFor('video-tools').id,'video');for(const page of ['short-film','director','film'])assert.equal(workspaceFor(page).id,'video');assert.equal(workspaceFor('continuity').id,'images');
 const nav=workspaceNavigation('video-tools');assert.equal((nav.match(/class="workspace-link/g)??[]).length,5);assert.equal((nav.match(/aria-current="page"/g)??[]).length,1);assert.ok(!nav.includes('href="/video-tools"'));assert.match(nav,/Shots, edits/);
 const html=renderWorkspacePage('<html><head></head><body><header>Film</header><main></main></body></html>','film','http://localhost/film?project='+id);assert.match(html,/data-workspace="video"/);assert.match(html,new RegExp('/short-film\\?project='+id));assert.match(html,/How this workspace connects/);assert.ok(!html.includes('id="tool-finder"'));assert.match(html,/assistant.js/);
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
