import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {studioUIResource} from '../lib/mcp-ui.mjs';

async function panel({openResult={isError:true}}={}){
 const elements=Object.fromEntries(['studio','opening','status','connection-notice','connection-message','direct-link','browser','fallback','retry','retry-frame'].map(id=>[id,{hidden:['studio','connection-notice','retry'].includes(id),textContent:'',contentWindow:{}}]));
 const events=[],requests=[],timeouts=new Map();let next=0;
 const parent={postMessage(message){if(message.id){requests.push(message);queueMicrotask(()=>events.forEach(fn=>fn({source:parent,origin:'https://host.example',data:{jsonrpc:'2.0',id:message.id,result:message.method==='ui/open-link'?openResult:{}}})));}}};
 const window={parent,addEventListener(name,handler){if(name==='message')events.push(handler);}};
 const document={querySelector(selector){return elements[selector.slice(1)];},body:{classList:{add(){}}}};
 const context=vm.createContext({document,window,location:{origin:'https://component.example',ancestorOrigins:['https://host.example']},STUDIO_ORIGIN:'http://127.0.0.1:4317',STUDIO_EMBED_ORIGIN:'http://127.0.0.1:4399',URL,innerHeight:800,setTimeout(fn,delay){const id=++next;timeouts.set(id,{fn,delay});return id;},clearTimeout(id){timeouts.delete(id);}});
 vm.runInContext(await readFile(new URL('../public/mcp-studio.js',import.meta.url),'utf8'),context);
 const flush=()=>new Promise(resolve=>setImmediate(resolve));await flush();
 return {elements,requests,flush,events,timeouts};
}

test('The complete editor becomes visible after registration without waiting behind the splash',async()=>{
 const {elements,requests}=await panel();assert.equal(elements.studio.src,'http://127.0.0.1:4399/');assert.equal(elements.studio.hidden,false);assert.equal(elements.opening.hidden,true);
 assert.ok(requests.some(r=>r.method==='tools/call'&&r.params.name==='studio_workflows'));
});
test('A declined browser action exposes an actual link and never covers the editor again',async()=>{
 const {elements}=await panel();await elements.browser.onclick();assert.equal(elements['connection-notice'].hidden,false);assert.match(elements['connection-message'].textContent,/declined/);assert.match(elements['connection-message'].textContent,/127\.0\.0\.1:4317/);assert.equal(elements['direct-link'].href,'http://127.0.0.1:4317');assert.equal(elements.opening.hidden,true);
});
test('A host acknowledgement still leaves a usable studio link rather than claiming a browser appeared',async()=>{
 const {elements}=await panel({openResult:{}});await elements.browser.onclick();assert.equal(elements['connection-notice'].hidden,false);assert.match(elements['connection-message'].textContent,/If no window appears/);assert.equal(elements['direct-link'].href,'http://127.0.0.1:4317');assert.equal(elements.opening.hidden,true);
});
test('Missing ready notifications produce a non-blocking notice; only the actual studio frame can clear it',async()=>{
 const {elements,timeouts,events}=await panel();[...timeouts.values()].find(t=>t.delay===12000).fn();assert.equal(elements['connection-notice'].hidden,false);assert.equal(elements.opening.hidden,true);
 const ready={type:'frameforge-studio-ready'};events.forEach(fn=>fn({source:{},origin:'http://127.0.0.1:4399',data:ready}));assert.equal(elements['connection-notice'].hidden,false);
 events.forEach(fn=>fn({source:elements.studio.contentWindow,origin:'http://127.0.0.1:4399',data:ready}));assert.equal(elements['connection-notice'].hidden,true);
});
test('Frame and browser permissions use the same exact local origins in standard and legacy client formats',async()=>{
 const base='http://127.0.0.1:4317',frame='http://127.0.0.1:4399',resource=await studioUIResource(base,{embedURL:frame});
 assert.deepEqual(resource._meta.ui.csp.frameDomains,[frame]);assert.deepEqual(resource._meta['openai/widgetCSP'],{connect_domains:[],resource_domains:[],frame_domains:[frame],redirect_domains:[base]});
});
