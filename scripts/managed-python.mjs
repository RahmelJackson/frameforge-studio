import {createHash,randomUUID} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {readFile,mkdir,writeFile,rename,stat,realpath,chmod} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const defaultRoot=fileURLToPath(new URL('../',import.meta.url));
export const run=(command,args,{env=process.env}={})=>new Promise((resolve,reject)=>{const child=spawn(command,args,{stdio:'inherit',windowsHide:true,env});child.once('error',reject);child.once('close',code=>code===0?resolve():reject(Error('Setup stopped (exit '+code+'). Existing ComfyUI software was not changed.')));});
const digest=async file=>{const hash=createHash('sha256');for await(const chunk of createReadStream(file))hash.update(chunk);return hash.digest('hex');};
export async function managedUV(root=defaultRoot){
 const lock=JSON.parse(await readFile(path.join(root,'setup/quickstart-runtime.lock.json'),'utf8')),spec=lock.uv.artifacts[process.platform+'-'+process.arch];
 if(!spec)throw Error('Automatic Python setup is unavailable on this platform. Install Python 3.12 and use the documented processor setup.');
 const runtime=path.join(root,'runtime');await mkdir(runtime,{recursive:true});const canonicalRuntime=await realpath(runtime);
 const folder=path.join(runtime,'bootstrap','uv-'+lock.uv.version);await ensureDirectory(folder);const relative=path.relative(canonicalRuntime,await realpath(folder));
 if(relative==='..'||relative.startsWith('..'+path.sep)||path.isAbsolute(relative))throw Error('Setup runtime escaped this installation.');
 const executable=path.join(folder,process.platform==='win32'?'uv.exe':'uv');
 const receiptFile=path.join(folder,'receipt.json');
 try{const receipt=JSON.parse(await readFile(receiptFile,'utf8'));if(receipt.archiveSha256!==spec.sha256||await digest(executable)!==receipt.executableSha256)throw Error('The cached setup runtime changed. Inspect it before reinstalling.');return executable;}catch(error){if(error.code!=='ENOENT')throw error;}
 console.log('Downloading the verified '+lock.uv.version+' Python setup helper. It stays inside Frameforge.');
 const response=await fetch('https://github.com/astral-sh/uv/releases/download/'+lock.uv.version+'/'+spec.file,{signal:AbortSignal.timeout(300000)});
 if(!response.ok)throw Error('Python setup download failed (HTTP '+response.status+').');
 const archive=path.join(folder,spec.file),handle=await import('node:fs/promises').then(fs=>fs.open(archive+'.part','w'));
 const hash=createHash('sha256');let size=0;
 try{for await(const chunk of response.body){size+=chunk.length;if(size>80*1024**2)throw Error('Setup runtime exceeded its size limit.');hash.update(chunk);await handle.write(chunk);}}finally{await handle.close();}
 if(hash.digest('hex')!==spec.sha256)throw Error('Python setup checksum did not match. Nothing downloaded was executed.');
 await rename(archive+'.part',archive);
 const stage=path.join(folder,'unpack-'+randomUUID());await mkdir(stage);
 if(process.platform==='win32'){
  await run('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',path.join(root,'scripts/extract-runtime.ps1'),archive,stage]);
 }else await run('tar',['-xzf',archive,'-C',stage]);
 const source=process.platform==='win32'?path.join(stage,'uv.exe'):path.join(stage,spec.file.replace(/\.tar\.gz$/,''),'uv');
 await rename(source,executable);if(process.platform!=='win32')await chmod(executable,0o755);
 await writeFile(receiptFile,JSON.stringify({archiveSha256:spec.sha256,executableSha256:await digest(executable)},null,2));
 return executable;
}
async function ensureDirectory(folder){await mkdir(folder,{recursive:true});return folder;}
export async function installManagedProfile({root=defaultRoot,profile,spec}){
 const uv=await managedUV(root),runtime=path.join(root,'runtime'),target=path.join(runtime,spec.directory),python=path.join(target,process.platform==='win32'?'Scripts/python.exe':'bin/python');
 const env={...process.env,UV_PYTHON_INSTALL_DIR:path.join(runtime,'managed-python'),UV_CACHE_DIR:path.join(runtime,'uv-cache'),UV_NO_MODIFY_PATH:'1',UV_PYTHON_DOWNLOADS:'automatic'};
 let exists=true;try{await stat(python);}catch{exists=false;}
 if(!exists)await run(uv,['venv','--python','3.12','--python-preference','only-managed',target],{env});
 await run(uv,['pip','install','--python',python,'--index-url','https://pypi.org/simple','--only-binary',':all:','--no-deps','-r',path.join(root,'setup',spec.requirements)],{env});
 await run(python,['-c','import '+spec.modules+'; print("'+profile+' CPU software is ready.")']);
 return python;
}
