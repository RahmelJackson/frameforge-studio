import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {WORKSPACES,workspaceFor,workspaceTab} from '../public/studio-map.js';
import {advancedMarkup,ADVANCED_SECTIONS} from '../public/advanced-workspaces.js';
import {studioUIResource} from '../lib/mcp-ui.mjs';
test('Website and self-contained plugin use the same six destinations, with collections and film tools nested',async()=>{
 const html=await readFile(new URL('../public/mcp-app.html',import.meta.url),'utf8'),primary=html.match(/<nav aria-label="Studio workspaces">([\s\S]*?)<\/nav>/)[1];
 assert.deepEqual([...primary.matchAll(/<button[^>]*>([^<]+)<\/button>/g)].map(m=>m[1]),WORKSPACES.map(w=>w.name));
 assert.equal(workspaceFor('recipes').id,'library');for(const page of ['short-film','director','film'])assert.equal(workspaceFor(page).id,'video');
 assert.equal(workspaceTab('advanced',new URLSearchParams('section=training')),'training');assert.equal(workspaceTab('images',new URLSearchParams('tool=select')),'image-select');assert.equal(workspaceTab('video-tools',new URLSearchParams('tool=segment')),'video-select');
 const resource=await studioUIResource('http://127.0.0.1:4317');assert.ok(!resource.text.includes("from './advanced-workspaces.js'"));assert.ok(!resource.text.includes('href="/advanced.css"'));assert.match(resource.text,/data-section/);
 for(const section of ADVANCED_SECTIONS){const markup=advancedMarkup(section.id);assert.match(markup,/class="advanced-hero"/);for(const card of section.cards)assert.ok(markup.includes(card.href.replaceAll('&','&amp;')));}
 const training=advancedMarkup('training');assert.match(training,/training runner is not installed yet/);assert.ok(!training.includes('>Train now<'));
});
