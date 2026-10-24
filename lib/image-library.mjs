import {readFile,writeFile,rename,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {assetName} from './library.mjs';
export class ImageLibrary{
  constructor(directory){this.file=path.join(directory,'image-library.json');this.data={boards:[],characters:[]};this.pending=Promise.resolve();}
  async open(){try{this.data=JSON.parse(await readFile(this.file,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}return this;}
  list(){return structuredClone(this.data);}
  save(kind,input){const op=this.pending.catch(()=>{}).then(async()=>{
    if(!['boards','characters'].includes(kind))throw new Error('Choose an image collection.');
    if(typeof input.name!=='string'||!input.name.trim()||input.name.length>100)throw new Error('Name this collection in 1–100 characters.');
    if(typeof input.notes!=='string'||input.notes.length>2000)throw new Error('Notes must be at most 2,000 characters.');
    if(!Array.isArray(input.cards)||input.cards.length<1||input.cards.length>16)throw new Error('Choose 1–16 reference cards.');
    const cards=input.cards.map(card=>{
      if(!assetName(card.asset))throw new Error('Choose an uploaded image.');
      const x=Number(card.x??0),y=Number(card.y??0);
      if(!Number.isFinite(x)||!Number.isFinite(y)||x<0||x>80||y<0||y>80)throw new Error('Card position is outside the canvas.');
      return {asset:card.asset,x,y};
    });
    const draft=structuredClone(this.data),existing=input.id?draft[kind].find(v=>v.id===input.id):null;
    if(input.id&&!existing)throw new Error('Collection not found.');
    const value={id:existing?.id??randomUUID(),name:input.name.trim(),notes:input.notes,cards,updatedAt:new Date().toISOString()};
    if(existing)Object.assign(existing,value);else draft[kind].unshift(value);
    await mkdir(path.dirname(this.file),{recursive:true});await writeFile(this.file+'.tmp',JSON.stringify(draft,null,2));await rename(this.file+'.tmp',this.file);this.data=draft;return structuredClone(value);
  });this.pending=op;return op;}
}
