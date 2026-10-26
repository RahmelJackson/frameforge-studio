import {existsSync,readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
let config={};try{config=JSON.parse(readFileSync(path.join(root,'config.local.json'),'utf8'));}catch{}
export function mediaTestSkip(kind='engine'){
 const python=kind==='configured'?config.python:path.join(root,'runtime',kind+'-env','Scripts','python.exe');
 if(python&&existsSync(python))return false;
 return 'Optional '+kind+' Python runtime is not installed. Run the documented media setup to enable this integration test.';
}
