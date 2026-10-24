import {readFile,writeFile,rename,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {normalizeEdit} from './timeline.mjs';
import {normalizeFilm,normalizeFilmShots,filmSignature,shotAudio} from './film.mjs';
import {normalizeShortFilm,shortFilmSignature,storyShots,storyOrderSignature} from './short-film.mjs';
const text=(value,name,max,required=false)=>{if(typeof value!=='string'||value.length>max||(required&&!value.trim()))throw new Error(`${name} must be ${required?'1':'0'}–${max} characters.`);return value.trim();};
export class ProjectStore{
  constructor(directory){this.filename=path.join(directory,'projects.json');this.projects=[];this.pending=Promise.resolve();}
  async open(){try{this.projects=JSON.parse(await readFile(this.filename,'utf8'));if(!Array.isArray(this.projects))throw new Error('Project file is invalid.');}catch(error){if(error.code!=='ENOENT')throw error;}return this;}
  list(){return structuredClone(this.projects);}
  mutate(action){
    const operation=this.pending.catch(()=>{}).then(async()=>{
      const draft=structuredClone(this.projects),result=action(draft);
      await mkdir(path.dirname(this.filename),{recursive:true});
      const temporary=this.filename+'.tmp';await writeFile(temporary,JSON.stringify(draft,null,2));await rename(temporary,this.filename);
      this.projects=draft;return structuredClone(result);
    });this.pending=operation;return operation;
  }
  create(input){return this.mutate(all=>{const project={id:randomUUID(),name:text(input.name,'Project name',100,true),description:text(input.description??'','Description',2000),shots:[],createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};all.unshift(project);return project;});}
  createProduction(input){return this.mutate(all=>{
    if(!/^[a-f0-9]{64}$/.test(input.key??'')||!Array.isArray(input.shots)||!input.shots.length||input.shots.length>24)throw Error('Check the production assembly.');
    const previous=all.find(p=>p.productionKey===input.key);if(previous)return previous;
    const shots=input.shots.map(s=>({id:randomUUID(),jobId:text(s.jobId,'Take',36,true),scene:text(s.scene,'Scene',100,true),title:text(s.title,'Shot title',100,true),notes:text(s.notes,'Shot notes',2000)}));
    const project={id:randomUUID(),name:text(input.name,'Project name',100,true),description:text(input.description,'Description',2000),productionKey:input.key,shots,film:normalizeFilm({aspect:input.aspect??'landscape'}),createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};all.unshift(project);return project;
  });}
  update(id,input){return this.mutate(all=>{const project=this.find(all,id);if(input.name!==undefined)project.name=text(input.name,'Project name',100,true);if(input.description!==undefined)project.description=text(input.description,'Description',2000);project.updatedAt=new Date().toISOString();return project;});}
  saveStory(id,input,signature){return this.mutate(all=>{const p=this.find(all,id);if(shortFilmSignature(p)!==signature)throw Error('This project changed elsewhere. Reopen it before saving; your local draft is retained.');p.story=normalizeShortFilm(input);p.updatedAt=new Date().toISOString();return p;});}
  createShortDemo(sourceId){return this.mutate(all=>{const prior=all.find(p=>p.demoKey==='short-film-workflow-v1');if(prior)return prior;const source=this.find(all,sourceId),p={id:randomUUID(),name:'A small journey · workflow demonstration',description:'Demonstration assembled from existing checked clips. Creative review remains pending.',shots:source.shots.map(s=>({...s,id:randomUUID()})),film:normalizeFilm(structuredClone(source.film)),demoKey:'short-film-workflow-v1',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};p.story=normalizeShortFilm({script:'A SMALL JOURNEY\n\n'+p.shots.map((s,i)=>`${i+1}. ${s.title}\n${s.notes||'A short scene from the existing studio library.'}`).join('\n\n'),frames:p.shots.map(s=>({id:s.id,title:s.title,prompt:s.notes??'',imageJobId:null,takeJobId:s.jobId}))});all.unshift(p);return p;});}
  assembleStory(id,signature,jobs){return this.mutate(all=>{const p=this.find(all,id);if(shortFilmSignature(p)!==signature)throw Error('This project changed elsewhere. Reopen it before building the timeline.');p.shots=storyShots(p,jobs);p.film=normalizeFilm(p.film);p.storyTimelineSignature=storyOrderSignature(p.story);p.updatedAt=new Date().toISOString();return p;});}
  add(id,input){return this.mutate(all=>{const project=this.find(all,id);if(project.shots.some(s=>s.jobId===input.jobId))throw new Error('That take is already in this project.');project.shots.push({id:randomUUID(),jobId:input.jobId,scene:text(input.scene??'Scene 1','Scene',100,true),title:text(input.title??`Shot ${project.shots.length+1}`,'Shot title',100,true),notes:text(input.notes??'','Shot notes',2000)});project.updatedAt=new Date().toISOString();return project;});}
  updateShot(id,shotId,input){return this.mutate(all=>{const project=this.find(all,id),shot=project.shots.find(s=>s.id===shotId);if(!shot)throw new Error('Shot not found.');Object.assign(shot,normalizeEdit({...shot,...input}),shotAudio({...shot,...input}));if(input.scene!==undefined)shot.scene=text(input.scene,'Scene',100,true);if(input.title!==undefined)shot.title=text(input.title,'Shot title',100,true);if(input.notes!==undefined)shot.notes=text(input.notes,'Shot notes',2000);project.updatedAt=new Date().toISOString();return project;});}
  compose(id,input,signature){return this.mutate(all=>{const project=this.find(all,id);if(filmSignature(project)!==signature)throw new Error('The film changed elsewhere. Reload it before saving.');project.shots=normalizeFilmShots(input.shots);project.film=normalizeFilm(input.film);project.updatedAt=new Date().toISOString();return project;});}
  saveExport(id,result){return this.mutate(all=>{const project=this.find(all,id);project.lastExport=result;return project;});}
  reorder(id,ids){return this.mutate(all=>{const project=this.find(all,id);if(!Array.isArray(ids)||ids.length!==project.shots.length||new Set(ids).size!==ids.length||ids.some(id=>!project.shots.some(s=>s.id===id)))throw new Error('The new order must contain every shot exactly once.');const byId=new Map(project.shots.map(s=>[s.id,s]));project.shots=ids.map(id=>byId.get(id));project.updatedAt=new Date().toISOString();return project;});}
  find(all,id){const project=all.find(p=>p.id===id);if(!project)throw new Error('Project not found.');return project;}
}
