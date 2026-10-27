import test from 'node:test';import assert from 'node:assert/strict';
import {TASKS,STARTS,searchTasks,taskURL,workflowDestination} from '../public/studio-journeys.js';
import {navigationMode} from '../public/workspace.js';import {renderWorkspacePage} from '../lib/workspace.mjs';
import {WORKFLOWS} from '../lib/workflow-catalog.mjs';import {IMAGE_TOOLS} from '../lib/images.mjs';import {VIDEO_TOOLS} from '../lib/video-tools.mjs';
test('Navigation accepts exactly top or side and migrates the previous combined preference safely',()=>{
 assert.equal(navigationMode('top'),'top');assert.equal(navigationMode('side'),'side');for(const value of ['both','',null,'invalid'])assert.equal(navigationMode(value),'side');
 const html=renderWorkspacePage('<html><head></head><body><header>Voice</header><main></main></body></html>','audio');assert.ok(!html.includes('value="both"'));assert.match(html,/Open studio navigation/);assert.ok(!html.includes('id="navigation-layout"'));assert.match(html,/id="tool-finder"/);
});
test('Guided journeys choose valid tools, preserve route parameters and route each starter to the right kind of work',()=>{
 assert.equal(new Set(TASKS.map(t=>t.id)).size,TASKS.length);for(const start of STARTS)assert.ok(searchTasks('',start.id).length>=3,start.id);
 for(const t of TASKS){const u=new URL(taskURL(t),'http://localhost');assert.equal(u.searchParams.get('start'),t.id);assert.ok(t.input&&t.output&&t.steps.length>=2);if(u.pathname==='/images'&&u.searchParams.has('tool'))assert.ok(IMAGE_TOOLS.some(x=>x.id===u.searchParams.get('tool')));if(u.pathname==='/video-tools'&&u.searchParams.has('tool'))assert.ok(VIDEO_TOOLS.some(x=>x.id===u.searchParams.get('tool')));}
 for(const w of WORKFLOWS)assert.ok(workflowDestination(w.id),w.id);assert.match(workflowDestination('seedance-extend'),/tool=extend/);assert.match(workflowDestination('seedance-frames'),/engine=keyframes/);assert.equal(workflowDestination('unknown'),null);
 assert.ok(searchTasks('subtitles').some(t=>t.id==='transcribe'));assert.ok(searchTasks('saved work').some(t=>t.id==='library'));assert.ok(searchTasks('how do I add subtitles').some(t=>t.id==='transcribe'));assert.ok(searchTasks('remove background').some(t=>t.id==='image-edit'));assert.equal(searchTasks('zzzzzzzz').length,0);
});
