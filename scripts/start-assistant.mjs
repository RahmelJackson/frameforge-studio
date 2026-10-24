import {readFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));let config={};try{config=JSON.parse(await readFile(path.join(root,'config.local.json'),'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
try{const response=await fetch('http://127.0.0.1:11434/api/tags',{signal:AbortSignal.timeout(1500)});if(response.ok){console.log('Ollama is already running. Refresh models in Studio guide.');process.exit(0);}}catch{}
const env={...process.env};if(config.ollamaModels&&!env.OLLAMA_MODELS)env.OLLAMA_MODELS=config.ollamaModels;
const child=spawn('ollama',['serve'],{env,stdio:'inherit',windowsHide:true});child.on('error',()=>{console.error('Install Ollama from https://ollama.com/download, then try again.');process.exitCode=1;});child.on('exit',code=>{process.exitCode=code??1;});
