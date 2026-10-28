import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {randomUUID,createHash} from 'node:crypto';
import path from 'node:path';

export const CREATIVE_RECIPES=[
 {id:'performance',title:'Explore a performance',image:'portrait-preview.jpg',category:'video',summary:'One character, three performances. Keep the starting frame, lighting and camera together while changing the action.',input:'A character still',output:'Three short takes to compare',model:'Wan 2.2 5B',steps:['Choose a saved subject or upload a still.','Review three performance prompts and their exact graphs.','Render sequentially, compare the takes, then use the best in your film.']},
 {id:'campaign',title:'Build a product campaign',image:'product-preview.jpg',category:'image',summary:'Carry one product through three visual directions, then animate your chosen still and add narration.',input:'A product photograph',output:'Three product stills with video and speech handoffs',model:'Qwen Image Edit 2511',steps:['Choose a product and describe the campaign.','Compare three reference-based scene edits.','Animate the selected still, make a voiceover and finish the clip.']},
 {id:'reference-story',title:'Turn a reference into a shot plan',image:'observatory-preview.jpg',category:'video',summary:'Extract real frames from a clip, write the action for each shot and save a Director plan you can keep working on.',input:'A reference video and your shot notes',output:'Three source frames and an editable Director plan',model:'Frame extraction + Wan / camera graph handoff',steps:['Choose a saved clip and a short range.','Extract three representative frames. Describe what should happen in each.','Create the Director plan, inspect each graph and generate reviewed shots.']},
 {id:'motion-remix',title:'Reuse a saved motion',image:'portrait-preview.jpg',category:'video',summary:'Choose a driving clip once, inspect its suitability and reuse it with another appearance reference.',input:'A saved motion and a subject still',output:'A reference-guided motion preview',model:'Wan VACE',steps:['Save a short driving motion with framing and visibility notes.','Choose a subject still with matching framing.','Inspect the graph, generate a preview and review identity and motion.']}
];
const uuid=v=>typeof v==='string'&&/^[a-f0-9-]{36}$/.test(v);
const asset=v=>typeof v==='string'&&/^[a-f0-9-]{36}\.(png|jpg|webp)$/.test(v);
const text=(v,max,label,required=false)=>{if(typeof v!=='string'||v.length>max||(required&&!v.trim()))throw Error('Check '+label+'.');return v.trim();};
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
export function motionAdvice(motion,targetFraming){
 const notes=[];
 if(motion.framing!==targetFraming)notes.push('The subject and driving clip use different framing. Match full-body or portrait framing first.');
 if(motion.multiplePeople)notes.push('More than one person is visible. Isolate one subject before motion transfer.');
 if(motion.cuts)notes.push('The reference contains cuts. Save a continuous range instead.');
 if(motion.occluded)notes.push('The subject is partly covered. Hands and face may drift at the obstruction.');
 if(motion.fast)notes.push('Fast movement may lose limb and face detail. Try a slower, shorter reference.');
 if(motion.end-motion.start>3.1)notes.push('This recipe uses a bounded preview of up to 3.1 seconds. Shorten the saved range.');
 return {warnings:notes,measured:['Duration and source identity are checked from the saved clip.'],declared:'Framing, cuts, speed and visibility are user descriptions, not automatic visual detection.'};
}
export class CreativeStore{
 constructor(directory){this.file=path.join(directory,'creative-recipes.json');this.data={subjects:[],motions:[],plans:[]};this.pending=Promise.resolve();}
 async open(){try{this.data=JSON.parse(await readFile(this.file,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}return this;}
 list(){return structuredClone(this.data);}
 mutate(fn){const op=this.pending.catch(()=>{}).then(async()=>{const draft=structuredClone(this.data),value=fn(draft);await mkdir(path.dirname(this.file),{recursive:true});await writeFile(this.file+'.tmp',JSON.stringify(draft,null,2));await rename(this.file+'.tmp',this.file);this.data=draft;return structuredClone(value);});this.pending=op;return op;}
 saveSubject(input,sha256){return this.mutate(d=>{if(!asset(input.asset)||!['character','product','prop'].includes(input.kind)||!/^[a-f0-9]{64}$/.test(sha256))throw Error('Choose a saved subject image and type.');const v={id:randomUUID(),name:text(input.name,100,'subject name',true),notes:text(input.notes??'',700,'subject notes'),kind:input.kind,asset:input.asset,sha256,createdAt:new Date().toISOString()};d.subjects.unshift(v);return v;});}
 saveMotion(input,source){return this.mutate(d=>{if(Boolean(input.footage)===Boolean(input.sourceJob)||!uuid(input.footage??input.sourceJob))throw Error('Choose one saved driving clip.');const start=Number(input.start??0),end=Number(input.end);if(!Number.isFinite(start)||!Number.isFinite(end)||start<0||end<=start||end>source.duration+.001||end-start>30)throw Error('Choose a range of up to 30 seconds inside the driving clip.');if(!['full','half','portrait','other'].includes(input.framing))throw Error('Choose the motion framing.');for(const k of ['cuts','multiplePeople','occluded','fast'])if(input[k]!==undefined&&typeof input[k]!=='boolean')throw Error('Check motion visibility notes.');const v={id:randomUUID(),name:text(input.name,100,'motion name',true),notes:text(input.notes??'',700,'motion notes'),sourceJob:input.sourceJob??null,footage:input.footage??null,start,end,framing:input.framing,cuts:!!input.cuts,multiplePeople:!!input.multiplePeople,occluded:!!input.occluded,fast:!!input.fast,sha256:source.sha256,duration:source.duration,createdAt:new Date().toISOString()};d.motions.unshift(v);return {...v,advice:motionAdvice(v,v.framing)};});}
 savePlan(input){return this.mutate(d=>{const recipe=CREATIVE_RECIPES.find(r=>r.id===input.recipe);if(!recipe)throw Error('Choose a creative recipe.');const subject=d.subjects.find(s=>s.id===input.subjectId);if(recipe.id!=='reference-story'&&!subject)throw Error('Save or choose a subject first.');const motion=input.motionId?d.motions.find(m=>m.id===input.motionId):null;if(['motion-remix','reference-story'].includes(recipe.id)&&!motion)throw Error('Choose a saved motion or reference clip.');const brief=text(input.brief??'',1200,'creative direction',true),seed=Number(input.seed??42);if(!Number.isSafeInteger(seed)||seed<0||seed>2147483644)throw Error('Choose a seed from 0 to 2147483644.');const variants=input.variants??(recipe.id==='performance'?['Restrained breathing. A small glance away, then settle.','A small, warm smile develops, then settles.','A surprised pause, then a gentle recovery.']:recipe.id==='campaign'?['A clean studio composition with soft side lighting. Preserve product shape and markings.','A warm editorial setting with space for a headline. Preserve product shape and markings.','A dramatic close product composition with restrained reflections. Preserve product shape and markings.']:['Establish the place and subject.','Show one clear action.','Finish on a deliberate, quiet moment.']);if(!Array.isArray(variants)||variants.length<1||variants.length>3)throw Error('Write 1–3 variations.');const aspect=input.aspect??'landscape';if(!['landscape','portrait','square'].includes(aspect))throw Error('Choose a format.');const framing=input.framing??'portrait';if(!['full','half','portrait','other'].includes(framing))throw Error('Choose subject framing.');const value={id:randomUUID(),recipe:recipe.id,name:text(input.name??recipe.title,100,'plan name',true),subject:subject??null,motion:motion??null,brief,seed,aspect,framing,variants:variants.map(v=>text(v,600,'variation',true)),createdAt:new Date().toISOString()};value.signature=hash(value);d.plans.unshift(value);return value;});}
 get(id){const p=this.list().plans.find(p=>p.id===id);if(!p)throw Error('Choose a saved creative plan.');return p;}
 attach(id,patch){return this.mutate(d=>{const p=d.plans.find(p=>p.id===id);if(!p)throw Error('Choose a saved creative plan.');p.handoffs={...p.handoffs,...patch};return p;});}
}
export function recipeRequests(plan){
 if(plan.recipe==='reference-story')return [];
 const common=['Shared direction: '+plan.brief,plan.subject.notes&&'Subject: '+plan.subject.notes,'Keep the reference appearance and lighting. One continuous take.'].filter(Boolean).join(' ');
 const variants=plan.recipe==='motion-remix'?plan.variants.slice(0,1):plan.variants;
 return variants.map((v,i)=>{
  const prompt=common+' '+v;
  if(plan.recipe==='campaign')return {kind:'image',tool:'edit',asset:plan.subject.asset,prompt,seed:plan.seed+i,aspect:plan.aspect,quality:'preview'};
  if(plan.recipe==='motion-remix'){
   const advice=motionAdvice(plan.motion,plan.framing);if(plan.motion.end-plan.motion.start>3.1)throw Error('Shorten this motion preview to 3.1 seconds or less.');
   return {kind:'video-tool',tool:'motion',sourceJob:plan.motion.sourceJob,footage:plan.motion.footage,reference:plan.subject.asset,start:plan.motion.start,end:plan.motion.end,aspect:plan.aspect,prompt,seed:plan.seed,videoModel:'preview',motionGuide:'edges',recipeWarnings:advice.warnings};
  }
  return {kind:'video',engine:'wan5b',mode:'image',asset:plan.subject.asset,prompt,preset:'directed',seed:plan.seed+i,aspect:plan.aspect,length:'preview',quality:'draft'};
 });
}
