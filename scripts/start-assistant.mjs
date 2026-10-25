import {readFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {normalizeAssistantConnection,describeAssistantConnection} from '../lib/assistant-connection.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));let config={};try{config=JSON.parse(await readFile(path.join(root,'config.local.json'),'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
let selected=normalizeAssistantConnection();try{selected=normalizeAssistantConnection(JSON.parse(await readFile(path.join(process.env.STUDIO_DATA??path.join(root,'data'),'assistant-connection.json'),'utf8')));}catch(error){if(error.code!=='ENOENT')throw error;}
if(selected.provider!=='ollama'){console.log('Selected '+describeAssistantConnection(selected).name+' at '+selected.baseUrl+'. Start its API server in that application, then use Connect & list models in Frameforge. Ollama is optional and will not be started.');process.exit(0);}
try{const response=await fetch(selected.baseUrl+'/api/tags',{redirect:'error',signal:AbortSignal.timeout(1500)});if(response.ok){console.log('Ollama is already running. Refresh models in Studio guide.');process.exit(0);}}catch{}
if(selected.baseUrl!=='http://127.0.0.1:11434'){console.log('Start your selected Ollama server at '+selected.baseUrl+', then refresh models. The default Ollama service will not be started for a custom address.');process.exit(0);}
const env={...process.env};if(config.ollamaModels&&!env.OLLAMA_MODELS)env.OLLAMA_MODELS=config.ollamaModels;
const child=spawn('ollama',['serve'],{env,stdio:'inherit',windowsHide:true});child.on('error',()=>{console.error('Install Ollama from https://ollama.com/download, then try again.');process.exitCode=1;});child.on('exit',code=>{process.exitCode=code??1;});
