import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {findDesktop,installDesktop,desktopConfigPaths} from '../lib/comfy-desktop.mjs';
test('Finds ComfyUI Desktop from its config and installs or updates the plugin there',async()=>{
 const home=await mkdtemp(path.join(tmpdir(),'ff-desk-')),base=path.join(home,'Documents','ComfyUI'),appdata=path.join(home,'AppData','Roaming');
 await mkdir(path.join(base,'custom_nodes'),{recursive:true});await mkdir(path.join(appdata,'ComfyUI'),{recursive:true});
 await writeFile(path.join(appdata,'ComfyUI','config.json'),JSON.stringify({basePath:base}));
 const source=path.join(home,'src');await mkdir(path.join(source,'web'),{recursive:true});await writeFile(path.join(source,'__init__.py'),'x');await writeFile(path.join(source,'web','a.js'),'1');
 const where={source,env:{APPDATA:appdata},platform:'win32',home};
 assert.deepEqual(desktopConfigPaths({APPDATA:appdata},'win32',home),[path.join(appdata,'ComfyUI','config.json')]);
 let v=await findDesktop(where);assert.equal(v.found,true);assert.equal(v.installed,false);
 v=await installDesktop(where);assert.equal(v.current,true);assert.equal(await readFile(path.join(base,'custom_nodes','comfyui-frameforge','web','a.js'),'utf8'),'1');
 await writeFile(path.join(source,'web','a.js'),'2');assert.equal((await findDesktop(where)).current,false);
 assert.equal((await findDesktop({...where,env:{APPDATA:path.join(home,'none')}})).found,false);
});
