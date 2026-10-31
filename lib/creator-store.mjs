import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import path from 'node:path';
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
export const isID=id=>typeof id==='string'&&UUID.test(id);
const text=(v,max,required=false)=>{if(typeof v!=='string'||v.length>max||(required&&!v.trim()))throw Error('Check the name, notes or caption length.');return v.trim();};
const number=(v,min,max)=>{if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)throw Error('Keep the canvas position and size within range.');return v;};
export function safeMediaURL(url,kind){
 if(typeof url!=='string')return false;
 if(kind==='model')return /^\/creator-files\/models\/[a-f0-9-]{36}\.glb$/.test(url);
 if(kind==='image')return /^\/assets\/[a-f0-9-]{36}\.(png|jpg|webp)$/.test(url)||/^\/outputs\/[a-f0-9-]{36}\/output\.png$/.test(url)||/^\/api\/jobs\/[a-f0-9-]{36}\/thumbnail$/.test(url)||/^\/explore-art\/(observatory|product|portrait)-(concept\.png|preview\.jpg)$/.test(url);
 return kind==='video'&&(/^\/outputs\/[a-f0-9-]{36}\/output\.mp4$/.test(url)||/^\/footage\/[a-f0-9-]{36}\/source\.(mp4|webm)$/.test(url)||url==='/explore-art/observatory-motion.mp4');
}
export function normalizeBoard(input){
 if(!Array.isArray(input.cards)||input.cards.length>100)throw Error('Use up to 100 canvas cards.');
 const cards=input.cards.map(c=>{if(!isID(c.id)||!['image','video','model','note'].includes(c.kind))throw Error('Check the canvas card.');if(c.kind!=='note'&&!safeMediaURL(c.url,c.kind))throw Error('Use media saved in this Studio.');let camera;if(c.kind==='model'&&c.camera){camera={};for(const key of ['position','target']){if(!Array.isArray(c.camera[key])||c.camera[key].length!==3)throw Error('Check the saved 3D camera.');camera[key]=c.camera[key].map(v=>number(v,-1000000,1000000));}}return {id:c.id,kind:c.kind,title:text(c.title??'',100),note:text(c.note??'',3000),url:c.kind==='note'?null:c.url,x:number(c.x,-100000,100000),y:number(c.y,-100000,100000),width:number(c.width??320,180,1200),height:number(c.height??280,140,1200),...(camera?{camera}:{}),...(c.sourceJob&&isID(c.sourceJob)?{sourceJob:c.sourceJob}:{})};});
 if(new Set(cards.map(c=>c.id)).size!==cards.length)throw Error('Each canvas card needs a unique identifier.');
 const view=input.view??{x:60,y:50,zoom:1};return {name:text(input.name??'Untitled canvas',100,true),cards,view:{x:number(view.x,-200000,200000),y:number(view.y,-200000,200000),zoom:number(view.zoom,.1,3)}};
}
export class CreatorStore {
 constructor(directory){this.file=path.join(directory,'creator-workspace.json');this.data={boards:[],characters:[],stories:[]};this.pending=Promise.resolve();}
 async open(){try{this.data=JSON.parse(await readFile(this.file,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}return this;}
 list(){return structuredClone(this.data);}
 mutate(fn){const op=this.pending.catch(()=>{}).then(async()=>{const draft=structuredClone(this.data),value=fn(draft);await mkdir(path.dirname(this.file),{recursive:true});await writeFile(this.file+'.tmp',JSON.stringify(draft,null,2));await rename(this.file+'.tmp',this.file);this.data=draft;return structuredClone(value);});this.pending=op;return op;}
 saveBoard(input){return this.mutate(d=>{const value=normalizeBoard(input);if(input.id&&!isID(input.id))throw Error('Choose a saved canvas.');const old=d.boards.find(v=>v.id===input.id);if(input.id&&!old)throw Error('Canvas not found.');if(old&&input.revision!==old.revision)throw Error('This canvas changed elsewhere. Reload before saving.');const result={...value,id:old?.id??randomUUID(),revision:(old?.revision??0)+1,updatedAt:new Date().toISOString()};if(old)d.boards[d.boards.indexOf(old)]=result;else d.boards.unshift(result);return result;});}
 saveStory(value){return this.mutate(d=>{const story={...value,id:randomUUID(),createdAt:new Date().toISOString()};d.stories.unshift(story);return story;});}
 saveCharacter(input){return this.mutate(d=>{
  if(input.id&&!isID(input.id))throw Error('Choose a saved character.');const old=d.characters.find(c=>c.id===input.id);if(input.id&&!old)throw Error('Character not found.');if(old&&input.revision!==old.revision)throw Error('This character changed elsewhere. Reload before saving.');
  const token=text(input.trigger??'',48,true);if(!/^[a-zA-Z][a-zA-Z0-9_]{2,47}$/.test(token))throw Error('Use a unique trigger with 3–48 letters, numbers or underscores.');
  if(!Array.isArray(input.images)||input.images.length<1||input.images.length>40)throw Error('Choose 1–40 saved reference images.');
  const images=input.images.map(i=>{if(!/^[a-f0-9-]{36}\.(png|jpg|webp)$/.test(i.asset??''))throw Error('Choose saved uploaded reference images.');if(!['train','holdout'].includes(i.split))throw Error('Choose training or held-out review for every image.');return {asset:i.asset,caption:text(i.caption??'',1500),split:i.split};});if(new Set(images.map(i=>i.asset)).size!==images.length)throw Error('Keep each reference image once.');
  const value={id:old?.id??randomUUID(),revision:(old?.revision??0)+1,name:text(input.name??'',100,true),trigger:token,notes:text(input.notes??'',2000),images,rightsConfirmed:input.rightsConfirmed===true,updatedAt:new Date().toISOString()};if(old)d.characters[d.characters.indexOf(old)]=value;else d.characters.unshift(value);return value;
 });}
}

export function validateGLB(bytes){
 if(bytes.length<24||bytes.length>80*1024**2||bytes.readUInt32LE(0)!==0x46546c67||bytes.readUInt32LE(4)!==2||bytes.readUInt32LE(8)!==bytes.length)throw Error('Upload a self-contained GLB 2 model of at most 80 MiB.');
 const length=bytes.readUInt32LE(12);if(bytes.readUInt32LE(16)!==0x4e4f534a||length>bytes.length-20)throw Error('The GLB scene is invalid.');
 let doc;try{doc=JSON.parse(bytes.subarray(20,20+length).toString('utf8').trim());}catch{throw Error('The GLB scene is invalid.');}
 for(const v of [...(doc.buffers??[]),...(doc.images??[])])if(v.uri&&!/^data:(application\/octet-stream|image\/(png|jpeg));base64,/.test(v.uri))throw Error('Embed textures and buffers in the GLB before uploading. External files are not loaded.');
 if(doc.extensionsRequired?.some(e=>['KHR_draco_mesh_compression','EXT_meshopt_compression','KHR_texture_basisu'].includes(e)))throw Error('Export an uncompressed GLB so it can be viewed offline.');return doc;
}
