// Minimal CPU media inspection/verification environment; no models or Torch.
import {access,readFile,writeFile,mkdir} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url)),configuration=path.join(root,'config.local.json');let config={};try{config=JSON.parse(await readFile(configuration,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
function run(command,args){return new Promise((resolve,reject)=>{const child=spawn(command,args,{stdio:'inherit',windowsHide:true});child.once('error',reject);child.once('close',code=>code===0?resolve():reject(Error('Media setup failed. Install Python 3.12, or set PYTHON to its executable, and try again.')));});}
const target=path.resolve(process.env.STUDIO_MEDIA_ENV??path.join(root,'runtime','media-env')),python=path.join(target,process.platform==='win32'?'Scripts/python.exe':'bin/python');
try{await access(python);}catch{await mkdir(path.dirname(target),{recursive:true});const base=process.env.PYTHON??(process.platform==='win32'?'py':'python3');await run(base,[...(process.platform==='win32'&&!process.env.PYTHON?['-3.12']:[]),'-m','venv',target]);}
await run(python,['-m','pip','install','--only-binary=:all:','-r',path.join(root,'setup','requirements-media.lock.txt')]);
await run(python,['-c','import av, numpy, PIL; print("CPU media tools ready.")']);
config.python=python;await writeFile(configuration,JSON.stringify(config,null,2)+'\n');console.log('Media tools configured. Restart the studio, then check Setup & models. No ComfyUI, GPU libraries or model weights were installed.');
