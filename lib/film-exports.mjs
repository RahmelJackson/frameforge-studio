import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import path from 'node:path';
const valid=id=>typeof id==='string'&&/^[a-f0-9-]{36}$/.test(id);
export class FilmExportJournal{
 constructor(directory){this.directory=path.join(directory,'film-requests');}
 file(project,id){if(!valid(project)||!valid(id))throw Error('Invalid film export identifier.');return path.join(this.directory,project,id+'.json');}
 async get(project,id){try{return JSON.parse(await readFile(this.file(project,id),'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;return null;}}
 async begin(project,id,signature,release){const file=this.file(project,id);await mkdir(path.dirname(file),{recursive:true});const value={project,id,signature,release,status:'processing',at:new Date().toISOString()};await writeFile(file,JSON.stringify(value,null,2),{flag:'wx'});return value;}
 async finish(project,id,fields){const value=await this.get(project,id);if(!value)throw Error('Export recovery record is missing.');const file=this.file(project,id);await writeFile(file+'.tmp',JSON.stringify({...value,...fields,updatedAt:new Date().toISOString()},null,2));await rename(file+'.tmp',file);}
}
