// Isolated CPU dependencies only. Model downloads stay workflow-specific in Studio.
import {access,mkdir,readFile,writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const profiles={media:{directory:'media-env',requirements:'requirements-media.lock.txt',modules:'av,numpy,PIL',configKey:'python'},vision:{directory:'vision-env',requirements:'requirements-vision.lock.txt',modules:'cv2,mediapipe,numpy,PIL'}};
const profile=process.argv[2],install=process.argv.includes('--install');if(!profiles[profile])throw Error('Choose media or vision. Example: node scripts/setup-processor.mjs vision --check. Add --install only when you want its isolated CPU packages installed. GPU speech/lip-sync processors keep their separate source guides.');
const spec=profiles[profile],configuration=path.join(root,'config.local.json');let config={};try{config=JSON.parse(await readFile(configuration,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
const env=path.join(root,'runtime',spec.directory),python=path.join(env,process.platform==='win32'?'Scripts/python.exe':'bin/python');
const run=(command,args)=>new Promise((resolve,reject)=>{const child=spawn(command,args,{stdio:'inherit',windowsHide:true});child.on('error',reject);child.on('close',code=>code===0?resolve():reject(Error('Software setup/check failed. The existing ComfyUI environment was not changed.')));});
let exists=true;try{await access(python);}catch{exists=false;}
if(!install){if(!exists){console.log('Not installed: '+profile+'. Review setup/'+spec.requirements+', then use --install. No files downloaded.');process.exitCode=2;}else await run(python,['-c','import '+spec.modules+'; print("'+profile+' CPU imports ready. Model files are checked separately per workflow.")']);}
else{if(!exists){await mkdir(path.dirname(env),{recursive:true});const base=process.env.PYTHON??config.comfyPython??(process.platform==='win32'?'py':'python3');await run(base,[...(base==='py'?['-3.12']:[]),'-m','venv',env]);}
 await run(python,['-m','pip','install','--index-url','https://pypi.org/simple','--only-binary=:all:','--no-deps','-r',path.join(root,'setup',spec.requirements)]);
 await run(python,['-c','import '+spec.modules+'; print("CPU software ready")']);
 if(spec.configKey){config[spec.configKey]=python;await writeFile(configuration,JSON.stringify(config,null,2)+'\n');}
 console.log('Installed only the '+profile+' CPU profile in '+env+'. No weights or GPU libraries downloaded. Restart Studio when idle.');}
