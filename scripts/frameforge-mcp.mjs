#!/usr/bin/env node
import {createInterface} from 'node:readline';
import {spawn} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
import {studioAddress} from './studio-mcp.mjs';
import {createMCPTools} from '../lib/studio-mcp-tools.mjs';
import {STUDIO_UI_URI,PREVIOUS_STUDIO_UI_URI,LEGACY_STUDIO_UI_URI,STUDIO_UI_MIME,studioUIResource} from '../lib/mcp-ui.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const documents=[{uri:'frameforge://guide',name:'MCP setup and safe creation loop',file:'MCP-GUIDE.md'},{uri:'frameforge://open-weights',name:'Open weights profile and model terms',file:'OPEN-WEIGHTS.md'},{uri:'frameforge://submission',name:'Challenge submission checklist',file:'CHALLENGE-CHECKLIST.md'}];
const prompts=[{name:'make-with-frameforge',description:'Plan and verify a creative workflow using local ComfyUI.',arguments:[{name:'goal',description:'What you want to make',required:true}]}];
export function createMCPServer(options={}){
 const base=studioAddress(options.base??process.env.STUDIO_URL),tools=createMCPTools({...options,base});
 const handle=async message=>{
  if(message?.jsonrpc!=='2.0'||typeof message.method!=='string')return {jsonrpc:'2.0',id:message?.id??null,error:{code:-32600,message:'Invalid JSON-RPC request.'}};
  if(!Object.hasOwn(message,'id'))return null;
  const reply=result=>({jsonrpc:'2.0',id:message.id,result});
  try{
   if(message.method==='initialize')return reply({protocolVersion:['2025-06-18','2025-03-26','2024-11-05'].includes(message.params?.protocolVersion)?message.params.protocolVersion:'2025-06-18',capabilities:{tools:{},resources:{},prompts:{}},serverInfo:{name:'frameforge-studio',version:'0.8.1'},instructions:'Discover recipes and check requirements, import authorized local media, prepare and inspect a graph, then run with an explicit requestId UUID. Poll the saved job and inspect its preview/report. Technical checks never grant creative approval. Read-only by default; local writes require --allow-writes. Open-weights connections enforce their profile server-side. No paid submissions, shell execution, automatic model installation or creative approval tools.'});
   if(message.method==='ping')return reply({});
   if(message.method==='tools/list')return reply({tools:tools.list()});
   if(message.method==='tools/call'){try{const args=message.params?.arguments??{};let value=await tools.call(message.params?.name,args);if(message.params?.name==='studio_workflows')value={...value,studioUrl:base,connection:{allowWrites:options.allowWrites===true,openWeightsOnly:options.openWeightsOnly===true},policy:await tools.call('studio_library',{collection:'policy'})};return reply(value?.content?value:{content:[{type:'text',text:JSON.stringify(value)}],...(!Array.isArray(value)&&value&&typeof value==='object'?{structuredContent:value}:{})});}catch(error){return reply({isError:true,content:[{type:'text',text:error.message}]});}}
   if(message.method==='resources/list')return reply({resources:[...documents.map(({file,...d})=>({...d,mimeType:'text/markdown'})),{uri:STUDIO_UI_URI,name:'Frameforge visual studio',description:'Native creative workspaces: visual workflows, editable graphs, local generation, speech, film projects and results. No nested website.',mimeType:STUDIO_UI_MIME}]});
   if(message.method==='resources/read'){if([STUDIO_UI_URI,PREVIOUS_STUDIO_UI_URI,LEGACY_STUDIO_UI_URI,'ui://frameforge/studio-v9.html','ui://frameforge/studio-v8.html','ui://frameforge/studio-v7.html','ui://frameforge/studio-v6.html','ui://frameforge/studio-v5.html','ui://frameforge/studio-v4.html','ui://frameforge/studio-v2.html'].includes(message.params?.uri))return reply({contents:[{...await studioUIResource(base),uri:message.params.uri}]});const doc=documents.find(d=>d.uri===message.params?.uri);if(!doc)throw Error('Unknown resource.');return reply({contents:[{uri:doc.uri,mimeType:'text/markdown',text:await readFile(path.join(root,doc.file),'utf8')}]});}
   if(message.method==='prompts/list')return reply({prompts});
   if(message.method==='prompts/get'){if(message.params?.name!=='make-with-frameforge'||typeof message.params?.arguments?.goal!=='string')throw Error('Choose make-with-frameforge and supply a goal.');return reply({description:'A reviewable local creative workflow',messages:[{role:'user',content:{type:'text',text:'Help me make: '+message.params.arguments.goal.slice(0,4000)+'\nUse studio_workflows to explain the best matching recipe. Check comfy_status and workflow_requirements. With creation enabled, prepare and inspect the graph before running; import only media I authorize. Reuse requestId after ambiguous responses. Poll and preview results, distinguish technical checks from visual/motion quality, and leave creative approval to me. Explain missing dependencies; do not install models or spend credits automatically.'}}]});}
   return {jsonrpc:'2.0',id:message.id,error:{code:-32601,message:'Method not found.'}};
  }catch(error){return {jsonrpc:'2.0',id:message.id,error:{code:-32602,message:error.message}};}
 };
 handle.close=async()=>{};return handle;
}
export async function ensureStudio({base,openWeightsOnly=false,env=process.env}={}){
 const address=studioAddress(base);const alive=async()=>{try{const response=await fetch(address+'/api/execution-policy',{signal:AbortSignal.timeout(1000)});if(!response.ok)return false;const value=await response.json();return Array.isArray(value.reviewedWorkflows)&&typeof value.openWeightsOnly==='boolean';}catch{return false;}};
 if(await alive())return null;
 const child=spawn(process.execPath,[path.join(root,'server.mjs')],{cwd:root,env:{...env,PORT:new URL(address).port||'80',...(openWeightsOnly?{FRAMEFORGE_OPEN_WEIGHTS_ONLY:'1'}:{})},stdio:['ignore','ignore','pipe'],windowsHide:true});
 child.stderr.on('data',chunk=>process.stderr.write(chunk));let failed;child.on('error',error=>failed=error);child.on('exit',code=>failed??=Error('Studio exited ('+code+').'));
 const deadline=Date.now()+30000;while(Date.now()<deadline){if(failed)throw failed;if(await alive())return child;await new Promise(resolve=>setTimeout(resolve,250));}child.kill();throw Error('Studio did not become ready. Start it normally and check its setup page.');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const flags=new Set(process.argv.slice(2)),known=['--start-studio','--allow-writes','--open-weights-only'];for(const flag of flags)if(!known.includes(flag))throw Error('Unknown option: '+flag);
 const base=studioAddress(process.env.STUDIO_URL),openWeightsOnly=flags.has('--open-weights-only')||process.env.FRAMEFORGE_OPEN_WEIGHTS_ONLY==='1';
 const owned=flags.has('--start-studio')?await ensureStudio({base,openWeightsOnly}):null;
 const handle=createMCPServer({base,allowWrites:flags.has('--allow-writes'),openWeightsOnly,importRoot:process.env.FRAMEFORGE_IMPORT_ROOT??process.cwd()});
 const lines=createInterface({input:process.stdin,crlfDelay:Infinity});
 try{for await(const line of lines){if(!line.trim())continue;let response;try{if(Buffer.byteLength(line)>4*1024**2)throw Error();response=await handle(JSON.parse(line));}catch{response={jsonrpc:'2.0',id:null,error:{code:-32700,message:'Invalid or oversized JSON.'}};}if(response)process.stdout.write(JSON.stringify(response)+'\n');}}finally{await handle.close();if(owned)owned.kill();}
}
