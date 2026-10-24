import {createHash,randomUUID} from 'node:crypto';
import {filmSignature,normalizeFilmShots} from './film.mjs';
const uuid=v=>typeof v==='string'&&/^[a-f0-9-]{36}$/.test(v);
const text=(v,max)=>{if(typeof v!=='string'||v.length>max)throw Error('Shorten the script or shot notes.');return v.trim();};
export function storyPlan(project){return structuredClone(project.story??{script:project.description??'',frames:project.shots.length?project.shots.map(s=>({id:s.id,title:s.title,prompt:s.notes??'',imageJobId:null,takeJobId:s.jobId})):[{id:randomUUID(),title:'Opening',prompt:'',imageJobId:null,takeJobId:null}],silent:false,noCaptions:false});}
export function normalizeShortFilm(input){
 if(!input||!Array.isArray(input.frames)||input.frames.length<1||input.frames.length>20)throw Error('Plan 1–20 shots.');
 const frames=input.frames.map(f=>{if(!uuid(f.id))throw Error('Invalid storyboard frame.');for(const k of ['imageJobId','takeJobId'])if(f[k]!=null&&!uuid(f[k]))throw Error('Choose saved studio media.');const title=text(f.title,100);if(!title)throw Error('Give each shot a title.');return {id:f.id,title,prompt:text(f.prompt??'',2500),imageJobId:f.imageJobId??null,takeJobId:f.takeJobId??null};});
 if(new Set(frames.map(f=>f.id)).size!==frames.length)throw Error('Each storyboard frame needs a unique identifier.');
 for(const k of ['silent','noCaptions'])if(input[k]!==undefined&&typeof input[k]!=='boolean')throw Error('Choose sound and caption preferences.');
 return {script:text(input.script??'',20000),frames,silent:input.silent??false,noCaptions:input.noCaptions??false};
}
// Missing plans have a stable signature; default frame IDs are created only for editing.
export const shortFilmSignature=p=>createHash('sha256').update(JSON.stringify({story:p.story??null,composition:filmSignature(p)})).digest('hex');
export const storyOrderSignature=plan=>JSON.stringify(plan.frames.map(f=>[f.id,f.takeJobId,f.title]));
const checked=(j,type)=>!!(j?.[type]&&j.report?.technicalPass&&j.review?.verdict!=='rejected');
const approved=j=>j?.review?.verdict==='approved'&&j.review.sha256===j.report?.sha256;
export function shortFilmStatus(project,jobs){
 const list=Array.isArray(jobs)?jobs:[...jobs.values()],plan=project.story,frames=plan?.frames??[],job=id=>list.find(j=>j.id===id);
 const images=frames.length>0&&frames.every(f=>f.imageJobId?checked(job(f.imageJobId),'image'):checked(job(f.takeJobId),'video'));
 const clips=frames.length>0&&frames.every(f=>checked(job(f.takeJobId),'video'));
 const reviewed=clips&&images&&frames.every(f=>approved(job(f.takeJobId))&&(!f.imageJobId||approved(job(f.imageJobId))));
 const timeline=clips&&project.storyTimelineSignature===storyOrderSignature(plan)&&project.shots.length===frames.length&&frames.every(f=>project.shots.some(s=>s.id===f.id&&s.jobId===f.takeJobId));
 const duration=project.shots.reduce((sum,s,i)=>sum+((s.trimEnd??job(s.jobId)?.report?.duration??0)-(s.trimStart??0))-(i&&s.transition==='crossfade'?(s.transitionSeconds??.5):0),0);
 const film=project.film??{},sound=!!plan&&(plan.silent||film.tracks?.some(t=>t.volume>0&&t.start<duration&&t.end>0)),captions=!!plan&&(plan.noCaptions||film.texts?.some(t=>t.position==='bottom'&&t.start<duration&&t.end>0));
 const exported=timeline&&project.lastExport?.report?.technicalPass&&project.lastExport.compositionSignature===filmSignature(project);
 const stages=[{id:'script',label:'Save the script',done:!!plan?.script.trim()},{id:'frames',label:'Choose storyboard images or clip previews',done:images},{id:'clips',label:'Choose a clip for every shot',done:clips},{id:'review',label:'Manually approve the chosen media',done:reviewed},{id:'timeline',label:'Put selected clips on the timeline',done:timeline},{id:'sound',label:plan?.silent?'Silent film chosen':'Add narration or music',done:sound},{id:'captions',label:plan?.noCaptions?'No captions chosen':'Add captions',done:captions},{id:'export',label:'Export the current saved edit',done:!!exported}];
 return {stages,next:stages.find(s=>!s.done)?.id??'watch',reviewed,exported:!!exported,timeline,canAssemble:clips,canExport:timeline&&!!plan?.script.trim()&&sound&&captions,signature:shortFilmSignature(project)};
}
export function storyShots(project,jobs){
 const plan=normalizeShortFilm(project.story),status=shortFilmStatus(project,jobs);if(!status.canAssemble)throw Error('Choose a checked, unrejected clip for every shot.');
 return normalizeFilmShots(plan.frames.map(f=>({...project.shots.find(s=>s.id===f.id&&s.jobId===f.takeJobId),id:f.id,jobId:f.takeJobId,title:f.title,scene:'Short film',notes:f.prompt})));
}
