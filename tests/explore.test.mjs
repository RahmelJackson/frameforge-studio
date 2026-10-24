import test from 'node:test';import assert from 'node:assert/strict';
import {civitaiItem,civitaiQuery,CommunityGallery} from '../lib/explore.mjs';
import {availableCloud} from '../public/workflow-panel.js';
import {RECIPES} from '../public/explore-recipes.js';import {TASKS,taskURL} from '../public/studio-journeys.js';import {WORKFLOWS} from '../lib/workflow-catalog.mjs';
const example={id:123,type:'image',url:'https://image.civitai.com/a/original=true/example.jpeg',browsingLevel:1,nsfw:false,nsfwLevel:'None',username:'Creator & friend',modelVersionIds:[789],meta:{prompt:'An original scene'}};
const response=v=>new Response(JSON.stringify(v),{headers:{'content-type':'application/json'}});
test('Public discovery admits only explicitly PG media from the Civitai CDN and preserves attribution',()=>{
 assert.equal(civitaiItem(null),null);const item=civitaiItem(example);assert.match(item.image,/width=640,quality=85/);assert.equal(item.sourceUrl,'https://civitai.com/images/123');assert.equal(item.creatorUrl,'https://civitai.com/user/Creator%20%26%20friend');assert.deepEqual(item.versions,[{id:789}]);
 for(const changed of [{browsingLevel:2},{nsfw:true},{nsfwLevel:'X'},{browsingLevel:undefined,nsfw:undefined},{url:'https://image.civitai.com.evil.test/a'},{url:'https://user:pass@image.civitai.com/a'},{url:'http://image.civitai.com/a'},{url:'javascript:alert(1)'},{type:'audio'},{id:-1}])assert.equal(civitaiItem({...example,...changed}),null);
 assert.ok(civitaiItem({...example,browsingLevel:undefined}));const video=civitaiItem({...example,type:'video',url:'https://image.civitai.com/video.mp4',thumbnail:{url:'https://image.civitai.com/poster.jpeg'}});assert.equal(video.url,'https://image.civitai.com/video.mp4');assert.equal(video.image,'https://image.civitai.com/poster.jpeg');
});
test('Discovery accepts an opaque cursor without following remote pagination URLs or changing the PG filter',()=>{
 const u=civitaiQuery(new URLSearchParams({type:'video',sort:'newest',cursor:'https://evil.test/?x=1&b=2',browsingLevel:'31'}));assert.equal(u.origin,'https://civitai.com');assert.equal(u.pathname,'/api/v1/images');assert.equal(u.searchParams.get('browsingLevel'),'1');assert.equal(u.searchParams.get('cursor'),'https://evil.test/?x=1&b=2');assert.equal(u.searchParams.get('sort'),'Newest');
 for(const input of [{type:'audio'},{sort:'arbitrary'},{cursor:'a'.repeat(2049)},{cursor:'x\ny'}])assert.throws(()=>civitaiQuery(new URLSearchParams(input)));
});
test('Discovery coalesces concurrent reads, caches metadata, labels stale data and never follows nextPage',async()=>{
 let calls=0,now=0,fail=false;const gallery=new CommunityGallery({now:()=>now,fetcher:async u=>{calls++;assert.equal(new URL(u).origin,'https://civitai.com');await Promise.resolve();if(fail)throw Error('offline');return response({items:[example,{...example,id:124,browsingLevel:2}],metadata:{nextCursor:'next-safe-token',nextPage:'https://evil.test'}});}}),params=new URLSearchParams();
 const [a,b]=await Promise.all([gallery.get(params),gallery.get(params)]);assert.equal(calls,1);assert.deepEqual(a,b);assert.equal(a.items.length,1);assert.equal(a.nextCursor,'next-safe-token');assert.equal((await gallery.get(params)).cached,true);assert.equal(calls,1);now=300001;fail=true;assert.equal((await gallery.get(params)).stale,true);assert.equal(calls,2);
 await assert.rejects(()=>gallery.get(new URLSearchParams({type:'video'})),/temporarily unavailable/);
});
test('Model links resolve the real parent model id rather than confusing version ids with model ids',async()=>{
 let calls=0;const gallery=new CommunityGallery({fetcher:async u=>{calls++;assert.equal(u,'https://civitai.com/api/v1/model-versions/789');return response({modelId:456,name:'v2',model:{name:'Example model'}});}});const model=await gallery.modelVersion(789);assert.equal(model.url,'https://civitai.com/models/456?modelVersionId=789');assert.equal(model.title,'Example model · v2');await gallery.modelVersion(789);assert.equal(calls,1);await assert.rejects(()=>gallery.modelVersion(-1),/valid model/);
});
test('Every discovery recipe routes to an existing studio task and real ComfyUI workflow',()=>{
 assert.equal(new Set(RECIPES.map(r=>r.id)).size,RECIPES.length);for(const r of RECIPES){const task=TASKS.find(t=>t.id===r.task);assert.ok(task,r.id);assert.ok(taskURL(task).includes('start='+r.task));const route=new URL(taskURL(task),'http://localhost'),input=Object.fromEntries(route.searchParams);assert.ok(availableCloud(route.pathname.slice(1),input).includes(r.cloudWorkflow),r.id+' compatible Cloud route');assert.ok(r.inputs&&r.output&&r.steps.length>=3&&r.limits);if(r.workflow)assert.ok(WORKFLOWS.some(w=>w.id===r.workflow),r.workflow);assert.ok(WORKFLOWS.some(w=>w.id===r.cloudWorkflow),r.cloudWorkflow);}
});
