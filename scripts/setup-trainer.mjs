// Isolated LoRA trainer for FLUX 3 Klein: the official diffusers DreamBooth
// LoRA script at a pinned commit, in runtime/trainer-env. It reuses the GPU
// Torch already installed for the local engine (through a .pth file) and pins
// torch to that version, so ComfyUI's own environment is never changed.
import {access,mkdir,readFile,writeFile,rename} from 'node:fs/promises';
import {spawn,spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {DIFFUSERS_COMMIT,TRAINER_SCRIPT,TRAINER_REQUIREMENTS,trainerPaths} from '../lib/trainer-paths.mjs';
export {DIFFUSERS_COMMIT,TRAINER_SCRIPT,TRAINER_REQUIREMENTS,trainerPaths};
const root=fileURLToPath(new URL('../',import.meta.url));
const run=(command,args,options={})=>new Promise((resolve,reject)=>{const child=spawn(command,args,{stdio:'inherit',windowsHide:true,...options});child.once('error',reject);child.once('close',code=>code===0?resolve():reject(Error('Trainer setup stopped (exit '+code+'). ComfyUI and the engine environment were not changed.')));});
async function main(){
 const paths=trainerPaths();let config={};try{config=JSON.parse((await readFile(path.join(root,'config.local.json'),'utf8')).replace(/^﻿/,''));}catch(e){if(e.code!=='ENOENT')throw e;}
 const base=process.env.FRAMEFORGE_TRAINER_BASE_PYTHON??config.trainerBasePython??path.join(root,'runtime','engine-env',process.platform==='win32'?'Scripts/python.exe':'bin/python');
 try{await access(base);}catch{throw Error('No GPU Python was found at '+base+'. Finish the local engine setup first, or set trainerBasePython in config.local.json to a Python that has CUDA Torch.');}
 const probe=spawnSync(base,['-c','import json,site,torch;print(json.dumps({"torch":torch.__version__,"cuda":torch.cuda.is_available(),"site":site.getsitepackages()}))'],{encoding:'utf8',windowsHide:true});
 if(probe.status!==0)throw Error('The engine Python could not import Torch: '+probe.stderr.slice(-400));
 const info=JSON.parse(probe.stdout.trim().split('\n').at(-1));if(!info.cuda)throw Error('Torch in the engine environment cannot see a CUDA GPU. LoRA training needs one.');
 console.log('Using engine Torch '+info.torch+' with CUDA.');
 try{await access(paths.python);}catch{await run(base,['-m','venv',paths.env]);}
 const own=spawnSync(paths.python,['-c','import site;print(site.getsitepackages()[-1])'],{encoding:'utf8',windowsHide:true}).stdout.trim();
 await writeFile(path.join(own,'frameforge-engine.pth'),info.site.filter(p=>/site-packages$/.test(p)).join('\n')+'\n');
 const constraints=path.join(paths.env,'constraints.txt');await writeFile(constraints,'torch=='+info.torch+'\n');
 await run(paths.python,['-m','pip','install','--upgrade','pip']);
 await run(paths.python,['-m','pip','install','-c',constraints,`https://github.com/huggingface/diffusers/archive/${DIFFUSERS_COMMIT}.zip`,...TRAINER_REQUIREMENTS]);
 await mkdir(path.dirname(paths.script),{recursive:true});
 const response=await fetch(`https://raw.githubusercontent.com/huggingface/diffusers/${DIFFUSERS_COMMIT}/examples/dreambooth/${TRAINER_SCRIPT}`,{signal:AbortSignal.timeout(120000)});
 if(!response.ok)throw Error('Could not download the training script (HTTP '+response.status+').');
 const text=await response.text();await writeFile(paths.script+'.part',text);await rename(paths.script+'.part',paths.script);
 await run(paths.python,['-c','import diffusers,peft,accelerate,datasets,torch;from diffusers.loaders import Flux3LoraLoaderMixin;assert torch.cuda.is_available();print("Trainer ready: diffusers",diffusers.__version__)']);
 await writeFile(paths.receipt,JSON.stringify({diffusers:DIFFUSERS_COMMIT,script:TRAINER_SCRIPT,scriptSha256:createHash('sha256').update(text).digest('hex'),torch:info.torch,installedAt:new Date().toISOString()},null,2));
 console.log('LoRA trainer installed in runtime/trainer-env. No model weights were downloaded; the gated FLUX 3 Klein base downloads on the first training run after you accept its terms and sign in to Hugging Face.');
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){if(!process.argv.includes('--install')){console.log('Installs the FLUX 3 Klein LoRA trainer into runtime/trainer-env. Run with --install.');}else main().catch(error=>{console.error(error.message);process.exit(1);});}
