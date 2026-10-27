import {cp,stat,realpath,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const source=fileURLToPath(new URL('../assets/comfyui-frameforge/',import.meta.url));
const directory=process.argv[2];if(!directory||!path.isAbsolute(directory))throw Error('Usage: node scripts/install-comfy-bridge.mjs ABSOLUTE_COMFYUI_FOLDER');
const comfy=await realpath(directory);if(!(await stat(path.join(comfy,'main.py'))).isFile())throw Error('Choose the ComfyUI source folder containing main.py.');
const destination=path.join(comfy,'custom_nodes','comfyui-frameforge');await mkdir(destination,{recursive:true});
const canonical=await realpath(destination),relative=path.relative(comfy,canonical);if(relative.startsWith('..')||path.isAbsolute(relative))throw Error('The destination must stay inside this ComfyUI.');
await cp(source,destination,{recursive:true});console.log('Installed the Frameforge image bridge in '+destination+'. Restart this ComfyUI when its queue is idle.');
