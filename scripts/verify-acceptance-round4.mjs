import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {randomUUID,createHash} from 'node:crypto';
const root=new URL('../',import.meta.url),folder=new URL('evidence/acceptance-round4/',root),base='http://127.0.0.1:4317';await mkdir(folder,{recursive:true});
let state={jobs:{},requests:{},budget:{diffusionStills:4,videoEdits:4,interpolation:4,swaps:4,selection:6},creativeApproval:'pending'};
try{state=JSON.parse(await readFile(new URL('state.json',folder),'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
const save=()=>writeFile(new URL('state.json',folder),JSON.stringify(state,null,2));
async function api(route,body,raw){const r=await fetch(base+route,raw??(body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})),v=await r.json();if(!r.ok)throw Error(v.error??JSON.stringify(v));return v;}
const rowan='850cf011-0100-4027-b54f-42368d8ff78d',mara='34659372-3bbb-4bbf-87c3-e3fa0a74f791.png',ginger='64ddf9a2-a540-416f-8d9d-41c92c00cdb5.png';
const cases={
 'auto-navy':{kind:'video-tool',tool:'recolor',sourceJob:rowan,start:0,end:1.8125,selectionMode:'clothing',clothingPart:'upper',materialSeed:[.75,.6],feather:4,materialColor:'#244b80',seed:202610401},
 'auto-mara':{kind:'video-tool',tool:'recolor',sourceJob:'b1dde788-8d8e-454e-8cdf-d125cab9991e',start:0,end:1,selectionMode:'clothing',clothingPart:'upper',materialSeed:[.75,.65],feather:4,materialColor:'#7c2540',seed:202610402},
 'identity-rain':{kind:'image',tool:'identity-pose',asset:mara,reference:'9892b721-9850-4762-ace7-6992503b7a17.png',prompt:'Mara, a young brown-skinned woman with short black curly hair, teal waterproof jacket, silver pendant, shown from behind with a three-quarter face profile, raising her right hand to touch a rainy greenhouse window, wet rainy garden, cinematic photograph, realistic anatomy.',identityStrength:1,poseStrength:.65,aspect:'portrait',seed:202610403},
 'swap-inswapper':{kind:'image',tool:'face-neural',asset:mara,reference:ginger,swapModel:'inswapper',includeBeard:true,seed:202610404},
 'swap-hyperswap-beard':{kind:'image',tool:'face-neural',asset:mara,reference:ginger,swapModel:'hyperswap',includeBeard:true,seed:202610405},
 'detail-jacket':{kind:'video-tool',tool:'masked',videoModel:'detail',sourceJob:rowan,start:0,end:1.8125,mask:'9fa60922-e237-4abc-8762-c93808ceac0d.png',trackMask:true,feather:6,maskedContent:'replace',prompt:'Change only the jacket to saturated deep burgundy red woven fabric. Retain the original face, cream shirt, pose, lighting, hands and background. Realistic fabric folds.',guidance:5,seed:202610406},
};
const label=process.argv.find(x=>x.startsWith('--case='))?.slice(7);
if(label){
 if(['fast-film','fast-rife','fast-guarded'].includes(label)){
  if(!state.motionFootage){state.motionFootage=(await api('/api/footage',null,{method:'POST',headers:{'Content-Type':'video/mp4','X-File-Name':'Fast%20motion%20and%20occlusion'},body:await readFile(new URL('fast-occlusion-source.mp4',folder))})).id;await save();}
  cases[label]={kind:'video-tool',tool:'interpolate',footage:state.motionFootage,interpolationModel:label==='fast-rife'?'rife':'film',motionSafety:label==='fast-guarded'?'hold':'off'};
 }
 if(['identity-face-anchor','identity-anchor-full'].includes(label)){
  if(!state.faceAnchor){state.faceAnchor=(await api('/api/jobs/1fc6263c-c855-4f97-9cee-8682eb6c8a18/image-asset',{})).name;await save();}
  cases[label]={...cases['identity-rain'],asset:state.faceAnchor,poseStrength:1,seed:202610403,prompt:'A young brown-skinned woman with short black curly hair in a teal waterproof jacket, inside a rainy greenhouse, back towards camera and face turning right in profile. Her right arm is raised straight overhead, reaching up toward the hanging fern. Rain droplets on glass, correct anatomy, realistic cinematic photograph.'};
 }
 if(label==='auto-mara-whole')cases[label]={...cases['auto-mara'],isolateGarment:false};
 if(label==='detail-keyframe')cases[label]={...cases['detail-jacket'],mask:null,trackMask:false,selectionMode:'clothing',clothingPart:'upper',materialSeed:[.75,.6],keyframeJob:state.jobs['jacket-appearance']};
 let input=cases[label];if(!input)throw Error('Unknown preview case.');
 if(!state.requests[label]){const group=input.kind==='image'?(input.tool==='face-neural'?'swaps':'diffusionStills'):input.tool==='interpolate'?'interpolation':['masked','restyle','relight'].includes(input.tool)?'videoEdits':'selection';const used=Object.values(state.requests).filter(r=>(r.kind==='image'?(r.tool==='face-neural'?'swaps':'diffusionStills'):r.tool==='interpolate'?'interpolation':['masked','restyle','relight'].includes(r.tool)?'videoEdits':'selection')===group).length;if(input.selectionMode==='clothing'&&Object.values(state.requests).filter(r=>r.selectionMode==='clothing').length>=state.budget.selection)throw Error('Parser preview budget exhausted');if(used>=state.budget[group])throw Error('Preview budget exhausted: '+group);state.requests[label]={...input,requestId:randomUUID()};await save();}
 let job=state.jobs[label]?(await api('/api/jobs')).find(j=>j.id===state.jobs[label]):await api('/api/jobs',state.requests[label]);state.jobs[label]=job.id;await save();console.log(label,job.id,job.status);
 for(let i=0;i<1800&&!['review-ready','technical-failed','failed','cancelled','needs-attention','verification-blocked'].includes(job.status);i++){await new Promise(r=>setTimeout(r,2000));job=(await api('/api/jobs')).find(j=>j.id===job.id);}
 await writeFile(new URL(label+'.json',folder),JSON.stringify(job,null,2));if(!job.report?.technicalPass)throw Error(label+': '+(job.error??job.status));console.log('checked',label,job.id);
}else for(const [label,id] of Object.entries(state.jobs)){const job=(await api('/api/jobs')).find(j=>j.id===id);if(!job?.report?.technicalPass)throw Error(label+': '+job?.status);const file=new URL('data/jobs/'+id+'/'+(job.image??job.video),root);if(createHash('sha256').update(await readFile(file)).digest('hex')!==job.report.sha256)throw Error('Changed output '+label);await writeFile(new URL(label+'.json',folder),JSON.stringify(job,null,2));console.log('checked',label,id);}
