import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const child=spawn(process.execPath,[fileURLToPath(new URL('../server.mjs',import.meta.url))],{env:{...process.env,FRAMEFORGE_OPEN_WEIGHTS_ONLY:'1'},stdio:'inherit',windowsHide:true});
child.on('error',error=>{console.error(error.message);process.exitCode=1;});
child.on('exit',code=>process.exitCode=code??1);
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill(signal));
