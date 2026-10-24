import {readFile,writeFile,rename,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {normalizeRequest} from './workflow.mjs';

export const DIRECTOR_SOURCES=[
  {id:'higgsfield',name:'Higgsfield camera guide',url:'https://higgsfield.ai/blog/ai-video-camera-control',kind:'Official published guide'},
  {id:'ltx',name:'LTX prompting guide',url:'https://docs.ltx.io/api-documentation/implementation-guides/prompting-guide',kind:'Official model guide'},
  {id:'wan',name:'Wan 2.2 official examples',url:'https://github.com/Wan-Video/Wan2.2',kind:'Official model repository'},
];
// Independently written recipes. The one short published example is separately labelled.
const recipe=(id,name,category,prompt,check,native=null,source='ltx')=>({id,name,category,prompt,check,native,source,version:2,authorship:'Frameforge original; informed by linked guide',status:'Local visual acceptance pending'});
export const CAMERA_RECIPES=[
  recipe('locked','Locked performance','Performance','A stationary eye-level view holds the composition while the subject performs the action.','Look for background drift and unrequested camera motion.','Static'),
  recipe('dolly-in','Dolly closer','Movement','The viewpoint advances toward the subject; nearby objects separate from the distant background as the framing tightens.','Check that depth changes, rather than a simple enlarged crop.','Zoom In','higgsfield'),
  recipe('dolly-out','Dolly reveal','Movement','The viewpoint retreats from the subject, opening room around them and revealing more of the existing setting.','Check that revealed scenery agrees with the starting frame.','Zoom Out','higgsfield'),
  recipe('pan-left','Pan left','Movement','From a fixed position, the view turns left to reveal the space beside the subject.','Background landmarks should travel right across the picture.',null,'higgsfield'),
  recipe('pan-right','Pan right','Movement','From a fixed position, the view turns right to reveal the space beside the subject.','Background landmarks should travel left across the picture.',null,'higgsfield'),
  recipe('tilt-up','Tilt upward','Movement','The viewpoint looks progressively higher, beginning with the lower part of the composition and revealing the space above.','Check vertical direction and unexpected horizon roll.'),
  recipe('tilt-down','Tilt downward','Movement','The viewpoint looks progressively lower, revealing the subject and ground beneath the opening composition.','Check vertical direction and the final subject framing.'),
  recipe('track-left','Track left','Movement','The viewpoint moves left beside the subject. Foreground and distant landmarks slide at different rates.','Check lateral depth changes and unintended rotation.','Pan Left'),
  recipe('track-right','Track right','Movement','The viewpoint moves right beside the subject. Foreground and distant landmarks slide at different rates.','Check lateral depth changes and unintended rotation.','Pan Right'),
  recipe('arc','Small subject arc','Movement','A short curved move reveals a slightly different side of the subject while keeping a similar viewing distance.','Check that the subject keeps their pose instead of spinning.','', 'higgsfield'),
  recipe('crane','Rising reveal','Movement','The viewpoint rises above its starting height, progressively revealing the surroundings below and behind the subject.','Check new geometry and accidental subject stretching.'),
  recipe('optical-zoom','Optical zoom','Movement','The framing tightens through a lens zoom while the viewpoint remains in its original position.','Check for unrequested travel and shifting perspective.'),
  recipe('rack-focus','Focus handoff','Performance','The camera holds position as focus passes from the foreground object to the subject behind it.','Check that both subjects persist while sharpness changes.'),
  recipe('handheld','Restrained handheld','Performance','A close observer follows the action with small natural camera corrections and controlled framing.','Check that sway stays small and subject anatomy remains stable.'),
  recipe('establishing','Establish the location','Coverage','A wide, stationary composition clearly shows the subject within the location and establishes the geography of the scene.','Check landmarks, entrances and relative character positions.','Static'),
  recipe('over-shoulder','Over the shoulder','Coverage','A stationary view past the near shoulder frames the other subject and preserves the established eyeline.','Check identity separation, eyeline and foreground anatomy.','Static'),
  recipe('insert','Prop detail','Coverage','A stationary close view isolates the important prop as the subject performs one small deliberate interaction.','Check distinctive markings, fingers and contact with the prop.','Static'),
  recipe('profile','Side profile','Coverage','A stationary side view holds the subject in profile while the action unfolds within the frame.','Check that the face remains in profile and the action stays visible.','Static'),
];
export const PUBLISHED_EXAMPLES=[
  {source:'higgsfield',kind:'Exact published short example; not tested locally',text:'Slow camera pan left across a coastal town at dusk, tripod fixed, horizon level.'},
  {source:'ltx',kind:'Exact excerpt from a longer LTX prompt; not tested locally',text:'The camera pans slowly left to a small frog in the front row, who twitches, eyes darting as the fly drifts past.'},
  {source:'wan',kind:'Exact published Wan example; not tested locally',text:'Two anthropomorphic cats in comfy boxing gear and bright gloves fight intensely on a spotlighted stage.'},
];
export const OPEN_STUDIOS=[
  {name:'AI Movie Studio 2',url:'https://github.com/Heroesjouney/AIMovieStudiov2',license:'AGPL-3.0',fit:'Closest production-workstation match: scene recipes, 3D planning, ComfyUI and timeline export.',limit:'Upstream labels parts experimental. Not installed or locally benchmarked.'},
  {name:'StoryBored',url:'https://github.com/storybored-app/storybored',license:'MIT',fit:'Storyboard, character LoRA imports, take approval and animatic workflow over the ComfyUI API.',limit:'Its character-training path needs WSL2 on Windows. Not installed or locally benchmarked.'},
  {name:'Castcut',url:'https://github.com/doodersrage/castcut',license:'MIT (repository listing)',fit:'Character and outfit plates, locations, shot creation and a local film-editing loop.',limit:'Its setup can add nodes and models. Not installed or locally benchmarked.'},
];

const idPattern=/^[a-f0-9-]{36}$/;
const assetPattern=/^[a-f0-9-]{36}\.(png|jpg|webp)$/;
const text=(value,label,max=300,required=false)=>{if(typeof value!=='string'||value.length>max||(required&&!value.trim()))throw Error(`${label}: use ${required?'1':'0'}–${max} characters.`);return value.trim();};
const asset=value=>{if(value==null||value==='')return null;if(!assetPattern.test(value))throw Error('Choose a saved image or upload a starting frame.');return value;};
function choice(value,allowed,label){if(!allowed.includes(value))throw Error(`Choose a supported ${label}.`);return value;}
export function normalizeProduction(input){
  if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Check the production plan.');
  const bible=Object.fromEntries(['scene','character','location','prop','style','lighting'].map(key=>[key,text(input.bible?.[key]??'',key,key==='lighting'?200:300)]));
  if(!Array.isArray(input.shots)||input.shots.length<1||input.shots.length>24)throw Error('Use 1–24 shots per production plan.');
  const shots=input.shots.map((s,i)=>{
    if(!s||!idPattern.test(s.id??''))throw Error('A shot is missing its saved identifier.');
    const seed=Number(s.seed);if(s.seed===''||s.seed==null||!Number.isSafeInteger(seed)||seed<0||seed>2**48-1)throw Error('Use a fixed, nonnegative whole-number seed.');
    const result={id:s.id,title:text(s.title,`Shot ${i+1} title`,100,true),action:text(s.action,'Action',400,true),start:text(s.start??'','Starting composition',180),end:text(s.end??'','Ending composition',180),notes:text(s.notes??'','Acceptance notes',500),recipe:choice(s.recipe,CAMERA_RECIPES.map(r=>r.id),'camera recipe'),pace:choice(s.pace??'slow',['slow','steady','brisk'],'pace'),length:choice(s.length??'preview',['preview','standard','extended'],'length'),screenDirection:choice(s.screenDirection??'neutral',['neutral','left-to-right','right-to-left'],'screen direction'),asset:asset(s.asset),seed};
    if(s.cameraMirror!==undefined&&typeof s.cameraMirror!=='boolean')throw Error('Choose a supported horizontal camera route.');result.cameraMirror=s.cameraMirror??false;result.cameraSampling=choice(s.cameraSampling??'fast',['fast','full'],'camera rendering');
    return result;
  });
  if(new Set(shots.map(s=>s.id)).size!==shots.length)throw Error('Each shot needs a different identifier.');
  return {name:text(input.name,'Production name',100,true),aspect:choice(input.aspect??'landscape',['landscape','portrait','square'],'format'),bible,shots};
}
export function compileShot(plan,shot){
  const r=shot.direction??CAMERA_RECIPES.find(r=>r.id===shot.recipe);if(!r)throw Error('Unknown camera recipe.');
  const pace={slow:'Movement develops gradually.',steady:'Movement maintains an even pace.',brisk:'Movement is brisk but remains readable.'}[shot.pace];
  const direction={'left-to-right':'The subject progresses toward screen right.','right-to-left':'The subject progresses toward screen left.'}[shot.screenDirection]??'';
  const packNotes=plan.pack?['character','location','prop','style'].filter(k=>plan.pack[k]?.notes).map(k=>`${k} reference traits: ${plan.pack[k].notes}.`).join(' '):'';
  const prompt=[...Object.entries(plan.bible).filter(([,v])=>v).map(([k,v])=>`${k}: ${v}.`),packNotes,shot.start&&`Opening composition: ${shot.start}.`,shot.action,r.prompt,pace,direction,shot.end&&`Closing composition: ${shot.end}.`,'One uninterrupted take.'].filter(Boolean).join(' ');
  if(prompt.length>2500)throw Error(`Shorten shared notes or the action for “${shot.title}”; the combined prompt exceeds 2,500 characters.`);
  // The native route is explicit; unsupported moves use text conditioning without a conflicting preset.
  const engine=shot.asset&&r.native?'camera':'wan5b';
  return {prompt,preset:'directed',asset:shot.asset,mode:shot.asset?'image':'text',engine,aspect:plan.aspect,length:shot.length,quality:'draft',seed:shot.seed,profile:'standard',...(engine==='camera'?{cameraSampling:shot.cameraSampling??'fast',cameraPose:r.native,cameraSpeed:{slow:.5,steady:1,brisk:1.5}[shot.pace],cameraMirror:['Pan Left','Pan Right'].includes(r.native)&&!!shot.cameraMirror}:{})};
}
export const requestSignature=request=>createHash('sha256').update(JSON.stringify(normalizeRequest({...request,quality:request.quality??(request.steps===12?'draft':'standard')}))).digest('hex');
export function productionStatus(plan,jobs){
  const list=Array.isArray(jobs)?jobs:[...jobs.values()];
  const shots=plan.shots.map(shot=>{
    const request=compileShot(plan,shot),signature=requestSignature(request);
    const matching=list.filter(j=>{try{return j.video&&j.report?.technicalPass&&requestSignature(j.request)===signature;}catch{return false;}});
    const takes=matching.map(j=>({id:j.id,approved:j.review?.verdict==='approved'&&j.review.sha256===j.report.sha256,url:`/outputs/${j.id}/${j.video}`,sha256:j.report.sha256}));
    const selected=takes.find(t=>t.id===plan.selections?.[shot.id]),previous=list.find(j=>j.id===plan.selections?.[shot.id]&&j.video&&j.report?.technicalPass);
    return {id:shot.id,signature,request,takes,selected:selected??null,previousSelection:!selected&&previous?{id:previous.id,url:`/outputs/${previous.id}/${previous.video}`} :null,ready:!!selected?.approved,recipe:rName(shot.recipe)};
  });
  return {shots,ready:shots.every(s=>s.ready),approvedCount:shots.filter(s=>s.ready).length};
}
const rName=id=>CAMERA_RECIPES.find(r=>r.id===id)?.name;
export function productionAssembly(plan,jobs){
  const status=productionStatus(plan,jobs);if(!status.ready)throw Error('Choose an approved, matching take for every shot before assembling. Review approval must match the checked file checksum.');
  const key=createHash('sha256').update(JSON.stringify({id:plan.id,revision:plan.revision,shots:status.shots.map(s=>[s.id,s.selected.id,s.selected.sha256])})).digest('hex');
  return {key,name:plan.name,aspect:plan.aspect,description:`Director plan ${plan.id}, revision ${plan.revision}. ${plan.bible.scene}`,shots:plan.shots.map((s,i)=>({jobId:status.shots[i].selected.id,scene:plan.bible.scene.slice(0,100)||'Scene 1',title:s.title,notes:s.notes}))};
}
export class DirectorStore{
  constructor(directory){this.file=path.join(directory,'director.json');this.plans=[];this.pending=Promise.resolve();}
  async open(){try{this.plans=JSON.parse(await readFile(this.file,'utf8'));if(!Array.isArray(this.plans))throw Error('Production storage is invalid.');}catch(e){if(e.code!=='ENOENT')throw e;}return this;}
  list(){return structuredClone(this.plans);}
  get(id,revision){const p=this.plans.find(p=>p.id===id);if(!p)throw Error('Production plan not found.');if(revision!==undefined&&p.revision!==revision)throw Error('This plan changed elsewhere. Reload before saving.');return structuredClone(p);}
  mutate(action){const task=this.pending.catch(()=>{}).then(async()=>{const draft=structuredClone(this.plans),result=action(draft);await mkdir(path.dirname(this.file),{recursive:true});await writeFile(this.file+'.tmp',JSON.stringify(draft,null,2));await rename(this.file+'.tmp',this.file);this.plans=draft;return structuredClone(result);});this.pending=task;return task;}
  save(input,pack=null){return this.mutate(all=>{
    const normalized=normalizeProduction(input),old=input.id?all.find(p=>p.id===input.id):null;
    if(input.id&&!old)throw Error('Production plan not found.');if(old&&old.revision!==input.revision)throw Error('This plan changed elsewhere. Reload before saving.');
    const plan={...normalized,id:old?.id??randomUUID(),revision:(old?.revision??0)+1,pack:structuredClone(pack),selections:old?.selections??{},updatedAt:new Date().toISOString(),history:old?[{revision:old.revision,bible:old.bible,shots:old.shots,pack:old.pack},...(old.history??[])].slice(0,10):[]};
    for(const shot of plan.shots){shot.direction=structuredClone(CAMERA_RECIPES.find(r=>r.id===shot.recipe));compileShot(plan,shot);}
    if(old)Object.assign(old,plan);else all.unshift(plan);return plan;
  });}
  select(id,revision,shotId,jobId,jobs){return this.mutate(all=>{
    const plan=all.find(p=>p.id===id);if(!plan||plan.revision!==revision)throw Error('This plan changed elsewhere. Reload before choosing a take.');
    const shot=productionStatus(plan,jobs).shots.find(s=>s.id===shotId);if(!shot?.takes.some(t=>t.id===jobId))throw Error('Choose a checked take matching this shot’s current settings.');
    plan.selections[shotId]=jobId;plan.revision++;plan.updatedAt=new Date().toISOString();return plan;
  });}
}
