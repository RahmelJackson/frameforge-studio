// Read-only stdio MCP adapter. It never launches a shell or generation job.
import {createInterface} from 'node:readline';
export function studioAddress(value='http://127.0.0.1:4317'){const url=new URL(value);if(url.protocol!=='http:'||!['127.0.0.1','localhost','[::1]'].includes(url.hostname)||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw Error('STUDIO_URL must be a local HTTP origin.');return url.origin;}
export async function handleMCP(message,{base=studioAddress(process.env.STUDIO_URL),fetcher=fetch}={}){
 if(message?.jsonrpc!=='2.0'||typeof message.method!=='string')return {jsonrpc:'2.0',id:message?.id??null,error:{code:-32600,message:'Invalid JSON-RPC request.'}};
 if(!Object.hasOwn(message,'id'))return null;
 const reply=result=>({jsonrpc:'2.0',id:message.id,result});
 try{
  if(message.method==='initialize')return reply({protocolVersion:['2025-06-18','2025-03-26'].includes(message.params?.protocolVersion)?message.params.protocolVersion:'2025-06-18',capabilities:{tools:{}},serverInfo:{name:'frameforge-studio-guide',version:'0.1.0'},instructions:'Read-only workflow and local ComfyUI readiness tools. No job submissions, installations or paid calls.'});
  if(message.method==='ping')return reply({});
  if(message.method==='tools/list'){const response=await fetcher(base+'/api/assistant/tools',{signal:AbortSignal.timeout(4000)});if(!response.ok)throw Error('Start Frameforge before connecting MCP.');return reply({tools:(await response.json()).map(tool=>({...tool,annotations:{readOnlyHint:true,destructiveHint:false,openWorldHint:false}}))});}
  if(message.method==='tools/call'){
   if(!['studio_workflows','comfy_status','workflow_requirements'].includes(message.params?.name))throw Error('Unknown read-only studio tool.');
   const response=await fetcher(base+'/api/assistant/tools',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(message.params),signal:AbortSignal.timeout(20000)}),value=await response.json();return reply({content:[{type:'text',text:JSON.stringify(value)}],isError:!response.ok});
  }
  return {jsonrpc:'2.0',id:message.id,error:{code:-32601,message:'Method not found.'}};
 }catch(error){return {jsonrpc:'2.0',id:message.id,error:{code:-32603,message:error.message}};}
}
if(process.argv[1]&&import.meta.url===(await import('node:url')).pathToFileURL(process.argv[1]).href){
 const base=studioAddress(process.env.STUDIO_URL);const lines=createInterface({input:process.stdin,crlfDelay:Infinity});for await(const line of lines){if(!line.trim())continue;let reply;try{if(line.length>32000)throw Error('Request too large.');reply=await handleMCP(JSON.parse(line),{base});}catch{reply={jsonrpc:'2.0',id:null,error:{code:-32700,message:'Invalid JSON.'}};}if(reply)process.stdout.write(JSON.stringify(reply)+'\n');}
}
