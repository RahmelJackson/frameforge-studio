// 3D blocking scenes: tagged stand-in objects and a shot camera path. Saved as
// plain JSON so Studio, the assistant and later renders all read the same scene.
import {readFile,writeFile,rename,mkdir} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import path from 'node:path';

export const SCENE_KINDS=['building','house','character','car','tree','box','sphere','wall','glb'];
const num=(v,min,max,name)=>{const n=Number(v);if(!Number.isFinite(n)||n<min||n>max)throw Error(name+' is out of range.');return Math.round(n*1000)/1000;};
const text=(v,max,name,required=false)=>{const s=String(v??'').trim();if(s.length>max||required&&!s)throw Error(name+' must be '+(required?'1–':'up to ')+max+' characters.');return s;};
const vec=(v,min,max,name)=>{if(!Array.isArray(v)||v.length!==3)throw Error(name+' needs three numbers.');return v.map(n=>num(n,min,max,name));};
// Object motion: up to 8 keys after time 0 (the object's own position is time 0).
function motion(keys){if(keys==null||Array.isArray(keys)&&!keys.length)return {};if(!Array.isArray(keys)||keys.length>8)throw Error('Use up to 8 motion keys per object.');return {motion:keys.map(k=>({time:num(k.time,.1,20,'Motion time'),position:vec(k.position,-200,200,'Motion position'),rotation:num(k.rotation??0,-720,720,'Motion rotation')})).sort((a,b)=>a.time-b.time)};}
export function normalizeScene(input={}){
 const name=text(input.name??'Untitled scene',100,'Scene name',true);
 const aspect=input.aspect??'landscape';if(!['landscape','portrait','square'].includes(aspect))throw Error('Choose a frame shape.');
 const objects=input.objects??[];if(!Array.isArray(objects)||objects.length>40)throw Error('Use up to 40 objects.');
 const seen=new Set();
 const out=objects.map(o=>{if(typeof o.id!=='string'||!/^[a-z0-9-]{4,40}$/.test(o.id)||seen.has(o.id))throw Error('Each object needs a unique ID.');seen.add(o.id);if(!SCENE_KINDS.includes(o.kind))throw Error('Choose a supported object type.');
  const color=String(o.color??'#9aa4a0');if(!/^#[0-9a-f]{6}$/i.test(color))throw Error('Use a hex colour.');
  return {id:o.id,kind:o.kind,tag:text(o.tag,40,'Tag'),description:text(o.description,160,'Description'),position:vec(o.position??[0,0,0],-200,200,'Position'),rotation:num(o.rotation??0,-360,360,'Rotation'),scale:vec(o.scale??[1,1,1],.05,100,'Scale'),color,...(o.kind==='glb'?{file:text(o.file,160,'Model name')}:{}),...motion(o.motion)};});
 const keys=input.camera?.keys??[];if(!Array.isArray(keys)||keys.length<1||keys.length>8)throw Error('Set 1–8 camera keys.');
 const camera={keys:keys.map((k,i)=>({time:num(k.time??i*2,0,20,'Key time'),position:vec(k.position,-300,300,'Camera position'),target:vec(k.target,-300,300,'Camera target'),fov:num(k.fov??40,10,100,'Field of view')})).sort((a,b)=>a.time-b.time)};
 if(camera.keys[0].time!==0)camera.keys[0].time=0;
 const track=input.camera?.track;if(track!=null&&track!==''){if(typeof track!=='object'||!out.some(o=>o.id===track.object)||!['look','follow'].includes(track.mode))throw Error('Choose an object for the camera to track.');camera.track={object:track.object,mode:track.mode};}
 return {name,aspect,style:text(input.style,300,'Look'),objects:out,camera};
}
export class SceneStore{
 constructor(directory){this.file=path.join(directory,'scenes.json');this.list=[];this.pending=Promise.resolve();}
 async open(){await mkdir(path.dirname(this.file),{recursive:true});try{this.list=JSON.parse(await readFile(this.file,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}return this;}
 mutate(fn){const run=this.pending.then(async()=>{const v=await fn();const tmp=this.file+'.tmp';await writeFile(tmp,JSON.stringify(this.list,null,1));await rename(tmp,this.file);return v;});this.pending=run.catch(()=>{});return run;}
 get(id){const s=this.list.find(s=>s.id===id);if(!s)throw Error('Scene not found.');return s;}
 save(input){return this.mutate(()=>{const value=normalizeScene(input),now=new Date().toISOString();
  if(input.id){const old=this.get(input.id);if(input.revision!==old.revision)throw Error('This scene changed in another window. Reload it before saving.');Object.assign(old,value,{revision:old.revision+1,updatedAt:now});return old;}
  const scene={id:randomUUID(),...value,revision:1,createdAt:now,updatedAt:now};this.list.unshift(scene);this.list=this.list.slice(0,100);return scene;});}
 remove(id){return this.mutate(()=>{this.get(id);this.list=this.list.filter(s=>s.id!==id);return {deleted:id};});}
}
// Layout prompt for FLUX 3: the grey render is <ref_image_0>, each tagged box is <obj_N>.
export function layoutPrompt(scene,boxes){
 const parts=boxes.map((b,i)=>`<obj_${i+1}> is ${b.desc}.`);
 return (`Turn <ref_image_0>, a grey 3D layout render, into a finished image${scene.style?' in this look: '+scene.style:''}. Keep the camera angle, composition, scale and position of every object exactly. `+parts.join(' ')+' Replace the grey stand-ins with real materials, light and detail. Fill untagged areas with a fitting environment.').slice(0,4000);
}
