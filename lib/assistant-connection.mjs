import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';

export const ASSISTANT_PROVIDERS=[
 {id:'ollama',name:'Ollama',baseUrl:'http://127.0.0.1:11434',download:'https://ollama.com/download',protocol:'ollama',structuredOutput:true},
 {id:'lmstudio',name:'LM Studio',baseUrl:'http://127.0.0.1:1234/v1',download:'https://lmstudio.ai/download',protocol:'openai',structuredOutput:true},
 {id:'llamacpp',name:'llama.cpp',baseUrl:'http://127.0.0.1:8080/v1',download:'https://github.com/ggml-org/llama.cpp',protocol:'openai',structuredOutput:false},
 {id:'vllm',name:'vLLM',baseUrl:'http://127.0.0.1:8000/v1',download:'https://docs.vllm.ai/en/latest/serving/openai_compatible_server/',protocol:'openai',structuredOutput:false},
 {id:'compatible',name:'Other local compatible server',baseUrl:'http://127.0.0.1:1234/v1',download:null,protocol:'openai',structuredOutput:false}
];
export function normalizeAssistantConnection(input={}){
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!['provider','baseUrl','structuredOutput'].includes(k)))throw Error('Choose a provider, local server address and JSON output setting. Keys belong in the studio environment, not this form.');
 const preset=ASSISTANT_PROVIDERS.find(p=>p.id===(input.provider??'ollama'));if(!preset)throw Error('Choose a listed assistant provider.');
 if(input.structuredOutput!=null&&typeof input.structuredOutput!=='boolean')throw Error('Choose a valid JSON output setting.');
 let url;try{url=new URL(input.baseUrl??preset.baseUrl);}catch{throw Error('Enter a local HTTP model-server address.');}
 if(url.protocol!=='http:'||!['127.0.0.1','localhost','[::1]'].includes(url.hostname)||url.username||url.password||url.search||url.hash)throw Error('Use a local HTTP address on 127.0.0.1, localhost or [::1], without credentials, query or fragment.');
 if(url.hostname==='localhost')url.hostname='127.0.0.1';
 let suffix=url.pathname.replace(/\/$/,'');
 if(preset.protocol==='ollama'&&suffix)throw Error('Use the Ollama server root, without /api or /v1.');
 if(preset.protocol==='openai'){
  suffix||='/v1';if(!/^(?:\/[A-Za-z0-9_-]+)*\/v1$/.test(suffix))throw Error('Use the compatible API base ending in /v1, not /chat/completions.');
 }
 return {provider:preset.id,baseUrl:url.origin+suffix,structuredOutput:input.structuredOutput??preset.structuredOutput};
}
export function describeAssistantConnection(input){const connection=normalizeAssistantConnection(input),preset=ASSISTANT_PROVIDERS.find(p=>p.id===connection.provider);return {...connection,name:preset.name,protocol:preset.protocol,download:preset.download,id:createHash('sha256').update(JSON.stringify(connection)).digest('hex').slice(0,16)};}
export class AssistantConnection{
 constructor(file){this.file=file;this.value=normalizeAssistantConnection();}
 async open(){try{this.value=normalizeAssistantConnection(JSON.parse(await readFile(this.file,'utf8')));}catch(error){if(error.code!=='ENOENT')throw error;}return this;}
 describe(){return describeAssistantConnection(this.value);}
 async set(input){if(this.saving)throw Error('Another connection update is being saved. Try again shortly.');const value=normalizeAssistantConnection(input);this.saving=true;try{await mkdir(path.dirname(this.file),{recursive:true});await writeFile(this.file+'.tmp',JSON.stringify(value,null,2)+'\n');await rename(this.file+'.tmp',this.file);this.value=value;return this.describe();}finally{this.saving=false;}}
}
export async function localModelJSON(fetcher,connection,route,{body,timeout=2500}={}){
 const selected=describeAssistantConnection({provider:connection.provider,baseUrl:connection.baseUrl,structuredOutput:connection.structuredOutput}),key=process.env.FRAMEFORGE_ASSISTANT_API_KEY;
 const response=await fetcher(selected.baseUrl+route,{method:body?'POST':'GET',redirect:'error',headers:{...(body?{'Content-Type':'application/json'}:{}),...(key?{Authorization:'Bearer '+key}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(timeout)});
 if(!response.ok)throw Error(response.status===401||response.status===403?'The model server requires authentication. Set FRAMEFORGE_ASSISTANT_API_KEY in the studio environment, then restart the studio.':'The model server rejected the request (HTTP '+response.status+'). Check the model and JSON output setting.');
 let bytes=0,parts=[];for await(const part of response.body){bytes+=part.length;if(bytes>2*1024**2)throw Error('The model server returned too much data.');parts.push(part);}return JSON.parse(Buffer.concat(parts).toString('utf8'));
}
export async function listAssistantModels(fetcher=fetch,input={}){
 const connection=describeAssistantConnection(input);
 try{const value=await localModelJSON(fetcher,connection,connection.protocol==='ollama'?'/api/tags':'/models'),list=connection.protocol==='ollama'?value.models:value.data;if(!Array.isArray(list))throw Error('This address did not return a compatible model list.');
  const models=list.filter(m=>typeof (m.name??m.id)==='string'&&!/:cloud\b/i.test(m.name??m.id)&&!m.remote_host&&!m.remote_model).slice(0,200).map(m=>({name:(m.name??m.id).slice(0,300),...(Number.isFinite(m.size)?{bytes:m.size}:{})}));
  return {connected:true,models,connection,download:connection.download,note:'Visible server models; some servers load a selected model on the first chat request. A local endpoint does not attest model license, residency or server-side proxy behavior.'};
 }catch(error){return {connected:false,models:[],connection,download:connection.download,error:error.message};}
}
export async function detectAssistantServers(fetcher=fetch){const results=await Promise.allSettled(ASSISTANT_PROVIDERS.filter(p=>p.id!=='compatible').map(async p=>{const result=await listAssistantModels(fetcher,{provider:p.id});return result.connected?{...result.connection,models:result.models.length}:null;}));return {found:results.filter(r=>r.status==='fulfilled'&&r.value).map(r=>r.value),note:'Only standard local model-list endpoints were checked. No model was downloaded or chat started.'};}

export function agentMCPConfig({client,root,base,node=process.execPath,writes=false,openWeightsOnly=false}){
 if(!['codex','antigravity','hermes','lmstudio','claude'].includes(client))throw Error('Choose Antigravity, Hermes Agent, LM Studio or Claude.');
 const entry={command:node,args:[path.join(root,'scripts/frameforge-mcp.mjs'),'--start-studio',...(writes?['--allow-writes']:[]),...(openWeightsOnly?['--open-weights-only']:[])],env:{STUDIO_URL:base,FRAMEFORGE_IMPORT_ROOT:path.join(root,'public/explore-art')}};
 const quote=v=>JSON.stringify(v);const text=client==='codex'?'[mcp_servers.frameforge]\ncommand = '+quote(entry.command)+'\nargs = '+JSON.stringify(entry.args)+'\nstartup_timeout_sec = 45\ntool_timeout_sec = 180\n\n[mcp_servers.frameforge.env]\n'+Object.entries(entry.env).map(([key,value])=>key+' = '+quote(value)).join('\n')+'\n':client==='hermes'?'mcp_servers:\n  frameforge:\n    command: '+quote(entry.command)+'\n    args: '+JSON.stringify(entry.args)+'\n    env:\n'+Object.entries(entry.env).map(([key,value])=>'      '+key+': '+quote(value)).join('\n')+'\n':JSON.stringify({mcpServers:{frameforge:entry}},null,2)+'\n';
 return {client,text,format:client==='codex'?'toml':client==='hermes'?'yaml':'json',writes,openWeightsOnly,instructions:{codex:'Merge this block into ~/.codex/config.toml, then reconnect MCP or restart Codex. If you already use the Frameforge plugin, keep that connection instead of adding a duplicate.',antigravity:'Open MCP Servers → Manage MCP Servers → View raw config. Merge this entry into your mcpServers map, then refresh.',hermes:'Merge this mcp_servers entry into ~/.hermes/config.yaml, then reload MCP or restart Hermes.',lmstudio:'Open LM Studio’s MCP configuration editor and merge this entry into mcp.json. Use a model that supports tool calls.',claude:'Merge this entry into Claude Desktop’s local MCP configuration, then restart the app.'}[client],note:'This prepares configuration only. It does not install, register, authenticate or start an agent. Tool and visual-panel support depend on the client. Replace the import root with a folder you authorize before importing personal media.'};
}
