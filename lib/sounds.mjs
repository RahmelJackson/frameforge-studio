import {readFile,writeFile,rename,mkdir} from 'node:fs/promises';import path from 'node:path';import {randomUUID} from 'node:crypto';
export class SoundLibrary{
 constructor(directory){this.file=path.join(directory,'sounds.json');this.items=[];this.pending=Promise.resolve();}
 async open(){try{this.items=JSON.parse(await readFile(this.file,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}return this;}
 list(){return structuredClone(this.items);}
 save(input,metadata){
  if(!/^[a-f0-9-]{36}$/.test(input.audio??'')||typeof input.name!=='string'||!input.name.trim()||input.name.length>100||!['music','ambience','effect'].includes(input.category)||typeof (input.notes??'')!=='string'||(input.notes??'').length>400)throw new Error('Name the sound and choose music, ambience or effect.');
  const task=this.pending.catch(()=>{}).then(async()=>{const next=structuredClone(this.items),old=next.find(s=>s.audio===input.audio),value={id:old?.id??randomUUID(),audio:input.audio,name:input.name.trim(),category:input.category,notes:(input.notes??'').trim(),duration:metadata.duration,sampleRate:metadata.sampleRate,channels:metadata.channels,sha256:metadata.sha256,url:'/audio/'+input.audio+'.wav'};if(old)Object.assign(old,value);else next.unshift(value);await mkdir(path.dirname(this.file),{recursive:true});await writeFile(this.file+'.tmp',JSON.stringify(next,null,2));await rename(this.file+'.tmp',this.file);this.items=next;return structuredClone(value);});this.pending=task;return task;
 }
}
