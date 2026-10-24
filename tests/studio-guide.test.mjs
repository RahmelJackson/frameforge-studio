import test from 'node:test';import assert from 'node:assert/strict';
import {StudioAssistant,validatedAdvice,guidedAdvice,createAssistantTools,assistantModels} from '../lib/studio-assistant.mjs';
import {inspectRequirements} from '../lib/studio-setup.mjs';
import {handleMCP,studioAddress} from '../scripts/studio-mcp.mjs';
const status={connected:true,running:0,pending:0};
test('Guide chains use supported destinations; LLM output cannot introduce arbitrary links or actions',()=>{
 const guide=guidedAdvice('Animate a photo, add narration and captions');assert.deepEqual(guide.steps.map(s=>s.id),['image-animate','speech','video-edit']);
 const result=validatedAdvice({answer:'Try these tools',steps:[{task:'https://evil.example/'},{task:'shell_exec'},{task:'image-animate',url:'https://evil.example'},{task:'image-animate'}]});assert.equal(result.steps.length,1);assert.ok(result.steps[0].url.startsWith('/create?'));assert.ok(!JSON.stringify(result).includes('evil.example'));
 assert.throws(()=>validatedAdvice({answer:null}));
});
test('Requirement checks distinguish offline, missing nodes, and advertised model availability',()=>{
 const p={execution:'local',models:[{name:'model.safetensors'}],graph:{nodes:[{type:'UNETLoader'},{type:'MarkdownNote'}]},missingDownloads:[]};assert.equal(inspectRequirements(p).models[0].state,'unknown');assert.equal(inspectRequirements(p).ready,false);const ready=inspectRequirements(p,{UNETLoader:{input:{required:{unet_name:[['subfolder/model.safetensors']]}}}});assert.equal(ready.ready,true);assert.equal(ready.models[0].state,'available');assert.equal(inspectRequirements(p,{}).models[0].state,'missing');assert.deepEqual(inspectRequirements(p,{}).missingNodes,['UNETLoader']);
});
test('Real Ollama protocol sends only bounded history and local catalog, uses CPU and unloads the model',async()=>{
 const requests=[],fetcher=async(url,options)=>{requests.push({url,body:options?.body&&JSON.parse(options.body)});if(url.endsWith('/api/tags'))return Response.json({models:[{name:'tiny:latest'},{name:'remote:cloud'}]});if(url.endsWith('/api/show'))return Response.json({capabilities:['completion']});return Response.json({message:{content:JSON.stringify({answer:'Animate, then finish.',steps:[{task:'image-animate',handoff:'Save and review the clip.'},{task:'video-edit',handoff:'Select the saved take in Edit & finish.'}]})}});};
 const assistant=new StudioAssistant({tools:async()=>status,fetcher});const reply=await assistant.ask({message:'Animate a photo',model:'tiny:latest',history:[{role:'system',content:'bad'},{role:'user',content:'hi'}]});assert.equal(reply.mode,'llm');assert.equal(reply.steps[1].id,'video-edit');const body=requests.at(-1).body;assert.equal(body.keep_alive,0);assert.equal(body.options.num_gpu,0);assert.equal(body.messages.length,3);assert.ok(!body.messages.some(m=>m.content==='bad'));assert.equal(body.format.properties.steps.items.properties.task.enum.includes('image-animate'),true);
 await assert.rejects(()=>assistant.ask({message:'Hi',model:'remote:cloud'}),/installed local/);assert.equal((await assistant.ask({message:'Hi'})).mode,'guide');
});
test('Unavailable/remote local AI and unknown MCP mutation tools are refused',async()=>{
 assert.equal((await assistantModels(async()=>{throw Error();})).connected,false);const tools=createAssistantTools({root:'.',comfy:{json:async()=>{throw Error('offline');}}});assert.equal((await tools('comfy_status')).connected,false);await assert.rejects(()=>tools('run_workflow'),/only read/);assert.throws(()=>studioAddress('https://example.com'),/local HTTP/);assert.throws(()=>studioAddress('http://user:password@localhost'),/local HTTP/);
 const initialized=await handleMCP({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-06-18'}});assert.equal(initialized.result.serverInfo.name,'frameforge-studio-guide');assert.equal(await handleMCP({jsonrpc:'2.0',method:'notifications/initialized'}),null);let called=false;const result=await handleMCP({jsonrpc:'2.0',id:2,method:'tools/call',params:{name:'run_workflow'}},{base:'http://127.0.0.1:4317',fetcher:async()=>{called=true;}});assert.ok(result.error);assert.equal(called,false);
});
