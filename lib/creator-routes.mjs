import {readFile,writeFile,mkdir,stat,copyFile} from 'node:fs/promises';
import {randomUUID,createHash} from 'node:crypto';
import path from 'node:path';
import {CreatorStore,isID,validateGLB} from './creator-store.mjs';
import {STORY_FORMATS,FINISH_RECIPES,TRAINING_PROFILES,storyTemplate,smartApply} from './creator-catalog.mjs';
import {characterDataset} from './character-dataset.mjs';
import {editingTimeline} from './editing-timeline.mjs';
import {writeZip} from './workflow-exports.mjs';
import {shortFilmSignature} from './short-film.mjs';
import {filmSignature} from './film.mjs';
const hash=v=>createHash('sha256').update(v).digest('hex');
export async function creatorRoutes({data,root,jobs,projects,creativeStore,readJson,readBody,json,serveFile,runPython,resolveVideoSource,saveJob,hosted}){
 const store=await new CreatorStore(data).open(),files=path.join(data,'creator-files');await mkdir(files,{recursive:true});let working=false;const pending=new Map();
 const catalog={formats:STORY_FORMATS,finishing:FINISH_RECIPES,training:TRAINING_PROFILES,limits:{cards:100,modelMiB:hosted?12:80,clipSeconds:hosted?3.1:6,concurrentFinishing:1},loopWorkflow:{title:'Animate Diff High Res Loops',url:'/native-workflows?workflow=animated-loops',status:'Native graph; separate models and custom nodes required.'}};
 const packageFile=async(entries,prefix)=>{const id=randomUUID(),directory=path.join(files,id);await mkdir(directory,{recursive:true});await writeZip(entries,path.join(directory,'bundle.zip'));return {id,bundleUrl:'/creator-files/'+id+'/bundle.zip',name:prefix+'.zip'};};
 async function timelinePackage(id,input){
  const project=projects.list().find(p=>p.id===id);if(!project)throw Error('Choose a saved film.');if(input.signature!==filmSignature(project))throw Error('The film changed. Save and reload before exporting.');
  const media=[],audio=[],entries=[];
  for(const jobId of new Set(project.shots.map(s=>s.jobId))){const j=jobs.get(jobId);if(!j?.video||!j.report?.technicalPass)throw Error('Choose checked saved clips.');const file=path.join(data,'jobs',j.id,j.video),bytes=await readFile(file),sha256=hash(bytes);if(sha256!==j.report.sha256)throw Error('A film source changed.');const name='media/'+j.id+'.mp4';media.push({jobId:j.id,file:name,duration:j.report.duration,audio:j.report.audio,sha256});entries.push({name,path:file,sha256});}
  for(const id of new Set((project.film?.tracks??[]).filter(t=>t.type==='wav').map(t=>t.audio))){if(!isID(id))throw Error('Choose a saved WAV.');const file=path.join(data,'audio',id+'.wav'),bytes=await readFile(file),name='media/'+id+'.wav';
   // WAV duration is read from its fmt/data chunks, not a filename or user field.
   let rate=0,align=0,length=0;for(let offset=12;offset+8<=bytes.length;){const type=bytes.toString('ascii',offset,offset+4),size=bytes.readUInt32LE(offset+4);if(offset+8+size>bytes.length)throw Error('The saved WAV is truncated.');if(type==='fmt '&&size>=16){rate=bytes.readUInt32LE(offset+12);align=bytes.readUInt16LE(offset+20);}if(type==='data')length+=size;offset+=8+size+(size%2);}if(!rate||!align||!length)throw Error('The saved WAV has no valid duration.');audio.push({id,file:name,duration:length/(rate*align),sha256:hash(bytes)});entries.push({name,path:file,sha256:hash(bytes)});}
  for(const asset of new Set((project.film?.overlays??[]).map(o=>o.asset))){if(!/^[a-f0-9-]{36}\.(png|jpg|webp)$/.test(asset))throw Error('Choose a saved overlay.');entries.push({name:'overlays/'+asset,path:path.join(data,'assets',asset)});}
  const edit=editingTimeline(project,media,audio),metadata={schema:1,id:project.id,name:project.name,shots:project.shots,film:project.film,media,audio,warnings:edit.warnings};
  entries.unshift({name:'timeline.otio',text:JSON.stringify(edit.timeline,null,2)},{name:'project.json',text:JSON.stringify(metadata,null,2)},{name:'subtitles.srt',text:edit.subtitles},{name:'README.txt',text:'FRAMEFORGE EDITABLE TIMELINE\n\nExtract the entire ZIP. Keep timeline.otio next to media/. Import with an OpenTimelineIO-compatible editor or adapter. The timeline carries source clips, trims, order, cross dissolves and separate WAV tracks. Check your editor’s OTIO import support; this is not a claim of a tested Resolve round trip.\n\n'+edit.warnings.join('\n')+'\n\nOriginal sources are included without re-encoding. No weights, credentials or personal machine paths are included. Save a rendered MP4 as a visual reference for titles, overlays and the audio mix.\n'});
  return {...await packageFile(entries,'frameforge-editable-film'),duration:edit.duration,warnings:edit.warnings};
 }
 async function finish(input){
  if(!isID(input.requestId))throw Error('Give this export a request ID.');const signature=hash(JSON.stringify(input)),id=input.requestId;
  const previous=jobs.get(id);if(previous){if(previous.creatorSignature!==signature)throw Error('This request ID belongs to different edits.');return previous;}
  if(pending.has(id)){if(pending.get(id).signature!==signature)throw Error('This request ID belongs to different edits.');return pending.get(id).promise;}
  if(working)throw Error('A finishing export is already running. Please wait.');working=true;
  const task=(async()=>{try{
   const recipe=FINISH_RECIPES.find(r=>r.id===input.recipe);if(!recipe)throw Error('Choose an included effect, transition or loop.');if(!Array.isArray(input.sources)||input.sources.length!==(recipe.kind==='transition'?2:1))throw Error('Choose the source clips for this recipe.');
   const directory=path.join(data,'jobs',id);await mkdir(directory,{recursive:true});const sources=[];
   for(const [i,value]of input.sources.entries()){
    if(value.sourceJob&&!isID(value.sourceJob)||value.footage&&!isID(value.footage)||!!value.sourceJob===!!value.footage)throw Error('Choose one saved source for each clip.');
    const source=await resolveVideoSource(value),start=Number(value.start??0),end=Number(value.end??Math.min(source.duration,start+Math.min(4,catalog.limits.clipSeconds)));if(!Number.isFinite(start)||!Number.isFinite(end)||start<0||end>source.duration+.001||end-start<.25||end-start>catalog.limits.clipSeconds)throw Error('Choose a range of 0.25–'+catalog.limits.clipSeconds+' seconds inside each clip.');
    const destination=path.join(directory,'source-'+i+'.mp4');await copyFile(source.path,destination);sources.push({path:destination,start,end,sha256:hash(await readFile(destination))});
   }
   const seconds=Number(input.transitionSeconds??.5);if(!Number.isFinite(seconds)||seconds<.1||seconds>1.5)throw Error('Choose a transition from 0.1 to 1.5 seconds.');if(input.loopMode&&!['pingpong','blend'].includes(input.loopMode))throw Error('Choose a loop method.');
   await writeFile(path.join(directory,'creator-input.json'),JSON.stringify({recipe:recipe.id,sources,transitionSeconds:seconds,loopMode:input.loopMode??'pingpong'}));
   const job={id,kind:'video-tool',status:'processing',createdAt:new Date().toISOString(),creatorSignature:signature,request:{kind:'video-tool',tool:'edit',prompt:recipe.title,creatorRecipe:recipe.id,sourceJob:input.sources[0].sourceJob??null},creator:{recipe:recipe.id,sources:input.sources.map(s=>({...s})),transitionSeconds:seconds,loopMode:input.loopMode??'pingpong'}};jobs.set(id,job);await saveJob(job);
   runPython('creator-finish.py',[directory],180000).then(async()=>{job.report=JSON.parse(await readFile(path.join(directory,'report.json'),'utf8'));job.video='output.mp4';job.status='review-ready';await saveJob(job);}).catch(async e=>{job.status='failed';job.error=e.message;await saveJob(job);}).finally(()=>{working=false;});return job;
  }catch(e){working=false;throw e;}})();pending.set(id,{signature,promise:task});try{return await task;}finally{pending.delete(id);}
 }
 return async(req,res,url)=>{
  const route=url.pathname,method=req.method;
  if(route==='/api/creator/catalog'&&method==='GET'){json(res,200,catalog);return true;}
  if(route==='/api/creator/library'&&method==='GET'){json(res,200,store.list());return true;}
  if(route==='/api/creator/smart-apply'&&method==='POST'){json(res,200,smartApply(await readJson(req,4000)));return true;}
  if(route==='/api/creator/boards'&&method==='POST'){json(res,201,await store.saveBoard(await readJson(req,500000)));return true;}
  if(route==='/api/creator/stories'&&method==='POST'){const input=await readJson(req,8000),cast=input.characterId?store.list().characters.find(c=>c.id===input.characterId):null;if(input.characterId&&!cast)throw Error('Choose a saved character.');const value=storyTemplate({...input,subject:cast?(cast.name+'. '+cast.notes+' '+String(input.subject??'')).slice(0,500):input.subject});if(cast)value.character={id:cast.id,name:cast.name,trigger:cast.trigger,referenceAsset:cast.images[0].asset};if(!['portrait','landscape','square'].includes(value.aspect))throw Error('Choose a story format.');json(res,201,await store.saveStory(value));return true;}
  const storyRoute=route.match(/^\/api\/creator\/stories\/([a-f0-9-]{36})\/project$/);
  if(storyRoute&&method==='POST'){await readJson(req,4000);const story=store.list().stories.find(s=>s.id===storyRoute[1]);if(!story)throw Error('Story not found.');
   const p=await projects.mutate(all=>{const old=all.find(p=>p.creatorStory===story.id);if(old)return old;const value={id:randomUUID(),name:story.name,description:story.subject,shots:[],creatorStory:story.id,film:{aspect:story.aspect,tracks:[],texts:[],overlays:[]},story:{script:story.frames.map(f=>f.title+'\n'+f.prompt+'\nTarget: '+f.duration.toFixed(2)+' seconds').join('\n\n'),frames:story.frames.map(f=>({id:randomUUID(),title:f.title,prompt:f.prompt,targetDuration:f.duration,...(story.character?{referenceAsset:story.character.referenceAsset}:{}),imageJobId:null,takeJobId:null})),silent:false,noCaptions:false},createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};all.unshift(value);return value;});json(res,201,{id:p.id,url:'/short-film?project='+p.id});return true;}
  if(route==='/api/creator/characters'&&method==='POST'){const input=await readJson(req,100000);for(const image of input.images??[])if(/^[a-f0-9-]{36}\.(png|jpg|webp)$/.test(image.asset??''))await stat(path.join(data,'assets',image.asset));const c=await store.saveCharacter(input);if(input.saveReference===true)await creativeStore.saveSubject({asset:c.images[0].asset,kind:'character',name:c.name,notes:(c.trigger+'. '+c.notes).slice(0,700),creatorId:c.id},hash(await readFile(path.join(data,'assets',c.images[0].asset))));json(res,201,c);return true;}
  const datasetRoute=route.match(/^\/api\/creator\/characters\/([a-f0-9-]{36})\/dataset$/);
  if(datasetRoute&&method==='POST'){const input=await readJson(req,1000),character=store.list().characters.find(c=>c.id===datasetRoute[1]);if(!character||character.revision!==input.revision)throw Error('Reload the saved character before exporting.');const packet=await characterDataset(character,data);json(res,201,{...await packageFile(packet.files,'frameforge-character-dataset'),trainCount:packet.trainCount,holdoutCount:packet.holdoutCount});return true;}
  if(route==='/api/creator/models'&&method==='POST'){const bytes=await readBody(req,catalog.limits.modelMiB*1024**2);validateGLB(bytes);const name=randomUUID()+'.glb';await mkdir(path.join(files,'models'),{recursive:true});await writeFile(path.join(files,'models',name),bytes);json(res,201,{url:'/creator-files/models/'+name,bytes:bytes.length});return true;}
  if(route==='/api/creator/finish'&&method==='POST'){json(res,202,await finish(await readJson(req,8000)));return true;}
  const editRoute=route.match(/^\/api\/creator\/films\/([a-f0-9-]{36})\/timeline$/);
  if(editRoute&&method==='POST'){json(res,201,await timelinePackage(editRoute[1],await readJson(req,100000)));return true;}
  const download=route.match(/^\/creator-files\/(models\/([a-f0-9-]{36})\.glb|([a-f0-9-]{36})\/bundle\.zip)$/);
  if(download&&method==='GET'){if(download[3])res.setHeader('Content-Disposition','attachment; filename="frameforge-package.zip"');await serveFile(req,res,path.join(files,download[1]));return true;}
  return false;
 };
}
