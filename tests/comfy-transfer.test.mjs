import test from 'node:test';import assert from 'node:assert/strict';import {createHash,randomUUID} from 'node:crypto';
import {checkTransfer,remapInputs,importWorkflow} from '../assets/comfyui-frameforge/web/workflow-transfer.js';
import {QUICK_TOOLS} from '../assets/comfyui-frameforge/web/quick-tools.js';
const graph={id:randomUUID(),nodes:[{id:1,type:'LoadImage',widgets_values:['source.png','image']},{id:2,type:'CLIPTextEncode',widgets_values:['source.png']}],links:[]};
function payload(){const data=Uint8Array.of(1,2,3).buffer;return {requestId:randomUUID(),name:'A small shot',graph:structuredClone(graph),files:[{name:'source.png',data,sha256:createHash('sha256').update(new Uint8Array(data)).digest('hex')}]};}
test('Direct graph handoff bounds formats, filenames, input sizes and request identity',()=>{
 assert.equal(checkTransfer(payload()).canvas,true);
 assert.equal(checkTransfer({...payload(),graph:{1:{class_type:'LoadImage',inputs:{image:'source.png'}}}}).canvas,false);
 for(const change of [{requestId:'bad'},{graph:[]},{graph:{nodes:[],links:[]}},{graph:{nodes:Array(501).fill({type:'LoadImage'}),links:[]}}])assert.throws(()=>checkTransfer({...payload(),...change}));
 for(const name of ['../source.png','x/source.png','x\\source.png','model.safetensors','source..png']){const p=payload();p.files[0].name=name;assert.throws(()=>checkTransfer(p));}
 const duplicate=payload();duplicate.files.push(duplicate.files[0]);assert.throws(()=>checkTransfer(duplicate));
 const extra=payload();extra.files[0].data=new ArrayBuffer(80*1024**2+1);assert.throws(()=>checkTransfer(extra));
});
test('Handoff copies uniquely named inputs, remaps loaders and opens a separately named tab without queuing',async()=>{
 const value=payload(),requests=[],opened=[];
 const result=await importWorkflow({handleFile:async file=>opened.push({name:file.name,graph:JSON.parse(await file.text())})},{fetchApi:async(url,options)=>{requests.push({url,options});const f=options.body;assert.equal(f.get('overwrite'),'false');assert.equal(f.get('type'),'input');return Response.json({name:f.get('image').name,type:'input',subfolder:f.get('subfolder')});}},value);
 assert.equal(requests.length,1);assert.equal(requests[0].url,'/upload/image');assert.equal(opened.length,1);assert.match(opened[0].name,/Frameforge - A small shot - [a-f0-9]{8}\.json$/);
 assert.equal(opened[0].graph.nodes[0].widgets_values[0],'frameforge-'+value.requestId+'-source.png');assert.equal(opened[0].graph.nodes[1].widgets_values[0],'source.png');assert.notEqual(opened[0].graph.id,value.graph.id);assert.equal(value.graph.nodes[0].widgets_values[0],'source.png');assert.equal(result.files,1);assert.equal(result.nodes,2);
});
test('Modified files and unexpected upload destinations never reach the native graph loader',async()=>{
 let uploads=0,opens=0;const app={handleFile:async()=>opens++},api={fetchApi:async()=>{uploads++;return Response.json({name:'source.png',subfolder:'elsewhere',type:'output'});}};
 const value=payload();value.files[0].sha256='0'.repeat(64);await assert.rejects(()=>importWorkflow(app,api,value),/checksum/);assert.equal(uploads,0);
 await assert.rejects(()=>importWorkflow(app,api,payload()),/destination/);assert.equal(opens,0);
 const original={1:{class_type:'LoadVideo',inputs:{file:'source.mp4'}},2:{class_type:'CLIPTextEncode',inputs:{text:'source.mp4'}}},mapped=remapInputs(original,new Map([['source.mp4','frameforge/new/source.mp4']]));assert.equal(mapped[1].inputs.file,'frameforge/new/source.mp4');assert.equal(mapped[2].inputs.text,'source.mp4');
});
test('Quick tools point at the existing video, image and audio editors using local page paths',()=>{
 assert.deepEqual([...new Set(QUICK_TOOLS.map(t=>t.group))],['Video','Images','Audio']);assert.equal(new Set(QUICK_TOOLS.map(t=>t.path)).size,QUICK_TOOLS.length);for(const t of QUICK_TOOLS){const url=new URL(t.path,'http://localhost');assert.equal(url.origin,'http://localhost');assert.ok(t.name&&t.hint);}assert.ok(QUICK_TOOLS.some(t=>t.path==='/video-tools?tool=interpolate#video-tool-form'));
});
