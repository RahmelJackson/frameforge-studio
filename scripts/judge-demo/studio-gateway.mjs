import {spawn} from 'node:child_process';
import {mkdir,readFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {canvasToApi} from '../../public/workflow-graph.js';

const fail=(status,message)=>Object.assign(Error(message),{status});
export const studioPages=new Set(['/','/home','/explore','/library','/workflows','/images','/create','/video-tools','/short-film','/director','/film','/audio','/continuity','/setup','/checklist','/online']);
const id='[a-f0-9-]{36}';
const writable=new RegExp(`^/api/(?:assets|footage|audio-assets|sounds(?:/${id}/use)?|projects(?:/${id}(?:/(?:composition|shots(?:/${id})?|order))?)?|short-films/${id}(?:/timeline)?|short-film-breakdown|director(?:/${id}(?:/assemble|/shots/${id}/select)?)?|image-library/(?:boards|characters)|continuity/packs|plans(?:/${id}/briefs/${id})?|references|recipes|body-pose|video-keyframe|outpaint-still|outpaint-guide/${id}|jobs/${id}/(?:image-asset|review|cancel)|audio-jobs/${id}/(?:review|cancel|audio-asset|video-footage)|provider-workflows/[a-z0-9-]+/export|workflow-plans(?:/${id}/export)?)$`);
const readAPI=new RegExp(`^/api/(?:health|catalog|video-catalog|audio-catalog|checklist|library|image-library|continuity|jobs(?:/${id}(?:/(?:thumbnail|canvas))?)?|audio-jobs|footage|sounds|projects(?:/${id})?|short-films(?:/${id}(?:/(?:timeline|packet))?)?|director(?:-catalog|/${id}(?:/packet|/shots/${id}/prepare)?)?|batches|video-frame|workflows(?:/[a-z0-9-]+)?|workflow-plans/${id}|provider-workflows(?:/[a-z0-9-]+(?:/(?:readiness|preview|poster|download))?)?|explore/civitai(?:/version/[0-9]{1,12})?|execution-policy|setup)$`);
const media=new RegExp(`^/(?:assets/${id}\\.(?:png|jpg|webp)|footage/${id}/(?:source\\.(?:mp4|webm)|poster\\.jpg)|audio/${id}\\.wav|audio-jobs/${id}/[a-z0-9.-]+|outputs/${id}/[a-z0-9.-]+|films/${id}/${id}/[a-z0-9.-]+|workflow-plan-inputs/${id}/[a-z0-9.-]+|workflow-exports/${id}/(?:workflow\\.json|bundle\\.zip)|provider-exports/${id}/bundle\\.zip)$`);
export function isStudioRun(route,method){return method==='POST'&&(route==='/api/jobs'||route==='/api/audio-jobs'||new RegExp(`^/api/(?:workflow-plans/${id}/run|jobs/${id}/retry|projects/${id}/export)$`).test(route));}
export function boundedInput(context,input){
 if(!input||typeof input!=='object'||Array.isArray(input))throw fail(400,'Choose valid workflow settings.');
 const next={...input};
 if(context==='audio'){
  if(String(next.text??'').length>300||(next.lines??[]).reduce((n,l)=>n+String(l.text??'').length,0)>300||(next.lines?.length??0)>4||['translations','sourceTexts'].some(k=>(next[k]??[]).reduce((n,s)=>n+String(s).length,0)>300))throw fail(422,'The hosted demo allows 300 speech characters and up to four dialogue lines per run. Download the workflow for longer work.');
 }else if(context==='images'){
  if((next.scale??2)>2||next.quality==='precise'||next.styleCards?.length>4)throw fail(422,'Use a preview image, up to four style cards or a 2× upscale in this hosted demo.');
 }else if(context==='video-tools'){
  if(String(next.narration??'').length>300)throw fail(422,'Use up to 300 narration characters in the hosted demo.');
  if(next.tool==='story'&&((next.cards?.length??0)>4||(next.cards??[]).some(c=>Number(c.seconds??3)>3)))throw fail(422,'Use up to four storyboard cards of three seconds or less in the hosted demo.');
  if(next.tool!=='story'&&(!(Number(next.end)>Number(next.start??0))||Number(next.end)-Number(next.start??0)>3.1))throw fail(422,'Trim the source to 3 seconds or less for the hosted demo.');
  if(next.videoModel==='detail')throw fail(422,'Use the preview editing model on the shared GPU. The full graph is downloadable.');
 }else{
  if((next.length??'preview')!=='preview'||(next.profile??'standard')!=='standard'||next.cameraSampling==='full')throw fail(422,'Choose a two-second preview and fast camera sampling on the shared GPU.');
 }
 return next;
}
export function cleanStudioJSON(value){
 if(Array.isArray(value))return value.map(cleanStudioJSON);
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([k])=>!['privatePath','python','visionPython','facePython','stylePython','apiKey','token','secret'].includes(k)).map(([k,v])=>[k,cleanStudioJSON(v)]));
 if(typeof value==='string')return value.replace(/[A-Z]:[\\/][^\r\n"<>]*/gi,'[creator-local file]').replace(/http:\/\/(?:127\.0\.0\.1|localhost):\d+/g,'[creator-local engine]');
 return value;
}

// Each signed visitor gets its own data store and studio process. Only models and
// the existing ComfyUI engine are shared; the gateway owns the global render gate.
export function createSessionPool({root,stateDir,hasActive,maximum=8}){
 const sessions=new Map();
 async function get(owner){
  if(!/^[a-f0-9-]{36}$/.test(owner))throw fail(403,'Invalid judge session.');
  const existing=sessions.get(owner);if(existing){existing.used=Date.now();return existing.ready;}
  if(sessions.size>=maximum){const idle=[...sessions].filter(([key,s])=>s.child&&!hasActive(key)).sort((a,b)=>a[1].used-b[1].used)[0];if(!idle)throw fail(503,'The studio is at capacity. Please try again shortly.');idle[1].child.kill();sessions.delete(idle[0]);}
  const entry={used:Date.now()};sessions.set(owner,entry);
  entry.ready=(async()=>{
   const data=path.join(stateDir,'studios',owner);await mkdir(data,{recursive:true});
   const child=spawn(process.execPath,[path.join(root,'server.mjs')],{cwd:root,windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,PORT:'0',STUDIO_DATA:data,FRAMEFORGE_JUDGE_MODE:'1',FRAMEFORGE_OPEN_WEIGHTS_ONLY:'0'}});entry.child=child;
   return new Promise((resolve,reject)=>{let output='';const timer=setTimeout(()=>{child.kill();reject(fail(503,'The private demo workspace is still starting. Try again.'));},25000);child.stdout.on('data',chunk=>{output=(output+chunk).slice(-4096);const m=output.match(/Frameforge studio: (http:\/\/127\.0\.0\.1:\d+)/);if(m){clearTimeout(timer);resolve(m[1]);}});child.stderr.resume();child.once('error',()=>{clearTimeout(timer);reject(fail(503,'Could not start the private demo workspace.'));});child.once('exit',()=>{clearTimeout(timer);if(sessions.get(owner)===entry)sessions.delete(owner);reject(fail(503,'The demo workspace stopped. Reopen the page.'));});});
  })();entry.ready.catch(()=>{if(sessions.get(owner)===entry)sessions.delete(owner);});
  return entry.ready;
 }
 return {get,close(){for(const s of sessions.values())s.child?.kill();sessions.clear();}};
}

export function createStudioGateway({root,pool,mainBackend,submit,reserveUpload=async()=>{}}){
 const writes=new Map();
 async function request(base,url,method='GET',payload,headers={}){return fetch(new URL(url,base),{method,headers:{...headers,...(payload!==undefined?{'Content-Type':'application/json'}:{})},...(payload!==undefined?{body:JSON.stringify(payload)}:{}),redirect:'manual',signal:AbortSignal.timeout(120000)});}
 async function parse(req,limit=2*1024*1024){const chunks=[];let n=0;for await(const c of req){n+=c.length;if(n>limit)throw fail(413,'The demo upload is too large.');chunks.push(c);}const b=Buffer.concat(chunks);if(req.headers['content-type']?.startsWith('application/json')){try{return {json:JSON.parse(b.toString()||'{}')};}catch{throw fail(400,'Use valid JSON.');}}return {bytes:b};}
 async function forward(res,r,html=false){
  const type=r.headers.get('content-type')??'application/octet-stream';
  for(const key of ['location','content-disposition','content-range','accept-ranges'])if(r.headers.has(key))res.setHeader(key,r.headers.get(key));
  res.setHeader('Content-Type',type);res.statusCode=r.status;
  if(type.includes('application/json'))return res.end(JSON.stringify(cleanStudioJSON(await r.json())));
  if(html&&type.includes('text/html')){let page=await r.text();page=page.replace('</head>','<link rel="stylesheet" href="/judge-studio.css"><script type="module" src="/judge-studio.js"></script></head>');return res.end(page);}
  let total=0;for await(const chunk of r.body){total+=chunk.length;if(total>100*1024*1024)return res.destroy();if(!res.write(Buffer.from(chunk)))await new Promise(resolve=>res.once('drain',resolve));}return res.end();
 }
 return async function handle(req,res,owner,url){
  const route=url.pathname,method=req.method;
  const ui={'/judge-studio.js':['studio.js','text/javascript'],'/judge-studio.css':['studio.css','text/css']};
  if(ui[route]&&method==='GET'){res.setHeader('Content-Type',ui[route][1]);res.end(await readFile(path.join(root,'scripts/judge-demo',ui[route][0])));return true;}
  if(!owner)return false;
  let staticFile=false;
  if(method==='GET'&&/^\/[a-z0-9-]+\.(?:js|css|svg|jpg)$/.test(route)){try{staticFile=(await stat(path.join(root,'public',route.slice(1)))).isFile();}catch{}}
  const art=method==='GET'&&/^\/explore-art\/[a-z0-9-]+\.(?:png|jpg|svg|mp4)$/.test(route);
  if(method==='GET'&&(studioPages.has(route)||staticFile||art||route==='/caption-utils.js'||route==='/checklist.md')){
   const r=await request(mainBackend,route+url.search,'GET',undefined,{Cookie:req.headers.cookie??''});await forward(res,r,true);return true;
  }
  // Only the three deliberately published model examples use owner data.
  if(method==='GET'&&/^\/api\/provider-workflows(?:\/(?:ltx-vfx|flux3-video|minimax-h3)(?:\/(?:preview|poster))?)?$/.test(route)){await forward(res,await request(mainBackend,route+url.search,'GET',undefined,req.headers.range?{Range:req.headers.range}:{}));return true;}
  if(route==='/api/execution-policy'){
   // Profile changes affect this visitor only, never the creator's studio.
  }else if(route.startsWith('/api/assistant/')){
   if(route==='/api/assistant/models'&&method==='GET'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({connected:false,inferenceEnabled:false,models:[],connection:{id:'judge-guide',name:'Hosted guide'},notice:'Guided workflow matching is available. Configure your own LLM in your own installation.'}));return true;}
   if(route!=='/api/assistant/chat'||method!=='POST')throw fail(403,'Connection settings and machine tools belong to the creator. Guided workflow matching is available.');
  }else if(!(method==='GET'&&(readAPI.test(route)||media.test(route)))&&!(['POST','PUT','PATCH'].includes(method)&&(writable.test(route)||isStudioRun(route,method))))throw fail(403,'This operation is unavailable on the shared demo. Download the workflow to use it in your own studio.');
  const backend=await pool.get(owner);
  if(method==='GET'){await forward(res,await request(backend,route+url.search,'GET',undefined,req.headers.range?{Range:req.headers.range}:{}));return true;}
  const times=(writes.get(owner)??[]).filter(t=>t>Date.now()-60000);if(times.length>=30)throw fail(429,'Please pause a moment before making more changes to the shared demo.');times.push(Date.now());writes.set(owner,times);
  const input=await parse(req,['/api/assets','/api/footage','/api/audio-assets'].includes(route)?12*1024*1024:2*1024*1024);let payload=input.json;
  if(input.bytes)await reserveUpload(owner,input.bytes.length);
  if(route==='/api/assistant/chat')payload={...payload,model:null,history:[]};
  if(route==='/api/workflow-plans'&&payload.provider!=='cloud')payload={...payload,input:boundedInput(payload.context,payload.input)};
  if(isStudioRun(route,method)){
   if(route==='/api/jobs')payload=boundedInput(payload.kind==='image'?'images':payload.kind==='video-tool'?'video-tools':'create',payload);
   if(route==='/api/audio-jobs')payload=boundedInput('audio',payload);
   if(route.includes('/workflow-plans/')){
    const plan=await(await request(backend,route.replace(/\/run$/,''))).json();
    if(plan.provider==='cloud')throw fail(403,'Paid runs are handled in your own Comfy Cloud account.');
    if(payload.graph&&JSON.stringify(canvasToApi(payload.graph))!==JSON.stringify(canvasToApi(plan.graph)))throw fail(422,'Run the prepared preview graph unchanged on the shared GPU. Download the graph to customize it in your own ComfyUI.');
    // The prepared graph is already bounded and scoped to this visitor.
    payload={requestId:payload.requestId};
   }
   if(route.includes('/retry'))throw fail(422,'Create a fresh preview from the tool controls. It will use one of your remaining demo runs.');
   const value=await submit({owner,backend,route,input:payload,task:route==='/api/audio-jobs'?'speech':'studio',synchronous:route.endsWith('/export'),perform:async()=>{const r=await request(backend,route,method,payload);return {status:r.status,body:cleanStudioJSON(await r.json())};}});
   res.statusCode=value.status;res.setHeader('Content-Type','application/json');res.end(JSON.stringify(value.body));return true;
  }
  const r=input.bytes?await fetch(new URL(route+url.search,backend),{method,headers:{'Content-Type':req.headers['content-type']??'application/octet-stream','X-File-Name':String(req.headers['x-file-name']??'judge-upload').slice(0,200)},body:input.bytes,redirect:'manual',signal:AbortSignal.timeout(120000)}):await request(backend,route+url.search,method,payload);
  await forward(res,r);return true;
 };
}
