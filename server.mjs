import {assertOpenProvider} from './lib/provider-policy.mjs';
import {setupReport,mediaRuntime,discoverComfy} from './lib/studio-setup.mjs';
import {StudioAssistant,assistantModels,createAssistantTools,ASSISTANT_TOOLS} from './lib/studio-assistant.mjs';
import {AssistantConnection,ASSISTANT_PROVIDERS,detectAssistantServers,agentMCPConfig} from './lib/assistant-connection.mjs';
import {CommunityGallery} from './lib/explore.mjs';
import {explainPlan} from './lib/workflow-explanations.mjs';
import {WorkflowPlans} from './lib/workflow-plans.mjs';
import {applyWorkflowSettings} from './lib/workflow-expectations.mjs';
import {WorkflowExports} from './lib/workflow-exports.mjs';
import {WORKFLOWS,workflowPacket,modelDependencies} from './lib/workflow-catalog.mjs';
import {imageToolSetup} from './lib/image-tool-setup.mjs';
import {providerCatalog,providerPacket,providerReadiness,providerRunPackage,providerVerification} from './lib/provider-workflows.mjs';
import {apiToCanvas} from './public/workflow-graph.js';
import {parseChecklist} from './lib/checklist.mjs';
import {storyPlan,normalizeShortFilm,shortFilmStatus} from './lib/short-film.mjs';
import {breakDownScript} from './lib/story.mjs';
import {FilmExportJournal} from './lib/film-exports.mjs';
import {renderWorkspacePage} from './lib/workspace.mjs';
import {DirectorStore,CAMERA_RECIPES,DIRECTOR_SOURCES,PUBLISHED_EXAMPLES,OPEN_STUDIOS,compileShot,productionStatus,productionAssembly} from './lib/director.mjs';
import {AudioStudio} from './lib/audio.mjs';
import {SoundLibrary} from './lib/sounds.mjs';
import {ContinuityStore,normalizePack,continuityPrompt,validateFaceAnchor} from './lib/continuity.mjs';
import {LOCAL_IMAGE_TOOLS} from './lib/images.mjs';
import {BatchQueue} from './lib/batches.mjs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID,createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, readdir, rename, stat, appendFile, unlink, copyFile, realpath } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { spawn } from 'node:child_process';
import { ComfyClient, findVideos, findImages, historyError } from './lib/comfy.mjs';
import {normalizeImage,buildImageWorkflow,imageReadiness,IMAGE_TOOLS,IMAGE_SIZES,STILL_CAMERA,IMAGE_LIGHT} from './lib/images.mjs';
import {ImageLibrary} from './lib/image-library.mjs';
import {normalizeVideoTool,buildVideoToolWorkflow,videoToolReadiness,VIDEO_TOOLS,VIDEO_FORMATS,VIDEO_GRADES} from './lib/video-tools.mjs';
import { LibraryStore, assetName } from './lib/library.mjs';
import { LOOKS } from './lib/looks.mjs';
import { ProjectStore } from './lib/projects.mjs';
import { normalizeEdit, editSignature } from './lib/timeline.mjs';
import {normalizeFilm,normalizeFilmShots,filmSignature,shotAudio} from './lib/film.mjs';
import {normalizePose} from './lib/pose.mjs';
import { MODELS, PRESETS, SIZES, LENGTHS, CAMERA_POSES, generationSize, normalizeRequest, buildWorkflow, readiness, cameraReadiness, keyframeReadiness } from './lib/workflow.mjs';
import {ExecutionPolicy,OPEN_WORKFLOW_IDS,assertOpenInput,assertOpenGraph,assertOpenWorkflow,policyError} from './lib/execution-policy.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const configDefaults={comfyUrl:'http://127.0.0.1:8188',port:4317,python:path.join(ROOT,'runtime','engine-env','Scripts','python.exe')};
let config={...configDefaults};
try{Object.assign(config,JSON.parse(await readFile(path.join(ROOT,'config.local.json'),'utf8')));}catch(error){if(error.code!=='ENOENT')throw error;}
const DATA = process.env.STUDIO_DATA ?? path.join(ROOT, 'data');
const executionPolicy=await new ExecutionPolicy({file:path.join(DATA,'execution-policy.json'),locked:process.env.FRAMEFORGE_OPEN_WEIGHTS_ONLY==='1'}).open();
const policyModels=JSON.parse(await readFile(path.join(ROOT,'workflows/models.json'),'utf8'));
const PORT = Number(process.env.PORT ?? config.port);
const JUDGE_MODE=process.env.FRAMEFORGE_JUDGE_MODE==='1';
const comfy = new ComfyClient(process.env.COMFY_URL ?? config.comfyUrl);
const jobs = new Map();
const saves = new Map();
const processors=new Map();
const verifications=new Map();
let busy = false;
await mkdir(path.join(DATA, 'assets'), { recursive: true });
await mkdir(path.join(DATA, 'jobs'), { recursive: true });
await mkdir(path.join(DATA,'footage'),{recursive:true});await mkdir(path.join(DATA,'audio'),{recursive:true});
const projects=await new ProjectStore(DATA).open();
const filmExports=new Set();
const filmJournal=new FilmExportJournal(DATA);
const library=await new LibraryStore(DATA).open();
const sounds=await new SoundLibrary(DATA).open();
const imageLibrary=await new ImageLibrary(DATA).open();
const continuityStore=await new ContinuityStore(DATA).open();
const director=await new DirectorStore(DATA).open();
const jobDir = id => path.join(DATA, 'jobs', id);
async function fileDigest(file){const hash=createHash('sha256');for await(const chunk of createReadStream(file))hash.update(chunk);return hash.digest('hex');}
async function save(job) {
  const pending=(saves.get(job.id)??Promise.resolve()).catch(()=>{}).then(async()=>{
    job.updatedAt = new Date().toISOString();
    await mkdir(jobDir(job.id), { recursive: true });
    const tmp = path.join(jobDir(job.id), 'job.json.tmp');
    await writeFile(tmp, JSON.stringify(job, null, 2));
    await rename(tmp, path.join(jobDir(job.id), 'job.json'));
  });
  saves.set(job.id,pending);
  try { await pending; } finally { if(saves.get(job.id)===pending)saves.delete(job.id); }
}
async function audit(job, event) {
  await appendFile(path.join(DATA, 'decisions.jsonl'), JSON.stringify({ time: new Date().toISOString(), job: job.id, event, status: job.status }) + '\n');
}
for (const id of await readdir(path.join(DATA, 'jobs'))) {
  try {
    const job = JSON.parse(await readFile(path.join(jobDir(id), 'job.json'), 'utf8'));
    try { job.report = JSON.parse(await readFile(path.join(jobDir(id), 'report.json'), 'utf8')); } catch {}
    if (['submitting', 'uploading'].includes(job.status)) { job.status = 'needs-attention'; job.error = 'Submission was interrupted. Check ComfyUI history before retrying; no duplicate was submitted.'; }
    if(job.status==='processing'){try{await stat(path.join(jobDir(id),'completed.json'));job.status='verifying';}catch{job.status='needs-attention';job.error='Local processing was interrupted. Inspect its manifest and output before retrying; no duplicate was started.';}}
    jobs.set(job.id, job);
  } catch { /* Non-job folders are not part of the queue. */ }
}
const visionPython=path.join(ROOT,'runtime','vision-env','Scripts','python.exe');
const facePython=path.join(ROOT,'runtime','facefusion-env','Scripts','python.exe');
async function selectionReady(){try{const models=JSON.parse(await readFile(path.join(ROOT,'setup','advanced-models.lock.json'),'utf8')).filter(x=>x.group==='clothing');for(const item of models)await stat(path.join(ROOT,item.path));return {ready:models.length===3,researchOnly:true};}catch{return {ready:false};}}
const stylePython=path.join(ROOT,'runtime','audio-env','Scripts','python.exe');
async function styleReady(mode='layers'){try{await stat(stylePython);const check=async file=>{const lock=JSON.parse(await readFile(path.join(ROOT,'setup',file),'utf8'));for(const item of [lock.base,...lock.files])if((await stat(item.path)).size!==item.bytes)throw Error('Pinned style file missing or truncated.');};await check(mode==='subtract'?'style-content-models.lock.json':'style-models.lock.json');let contentReady=false;try{await check('style-content-models.lock.json');contentReady=true;}catch{}return {ready:true,contentReady,cardsLimit:16};}catch{return {ready:false,contentReady:false,error:'Prepare the local style adapter and encoder on D: first.'};}}
async function startStyleImage(job){
 try{job.status='processing';await save(job);await comfy.releaseIdle();if(job.status==='cancelling')throw Error('Cancelled.');
  await new Promise((resolve,reject)=>{const child=spawn(stylePython,['-X','utf8',path.join(ROOT,'scripts/style_image.py'),jobDir(job.id)],{windowsHide:true});processors.set(job.id,child);let errors='';child.stdout.resume();child.stderr.on('data',c=>errors=(errors+c).slice(-8000));const timer=setTimeout(()=>child.kill(),600000);child.once('error',e=>{clearTimeout(timer);processors.delete(job.id);reject(e);});child.once('close',code=>{clearTimeout(timer);processors.delete(job.id);code===0?resolve():reject(Error(errors.slice(-2500)||'Local style processing stopped.'));});});
  if(job.status==='cancelling')throw Error('Cancelled.');job.status='verifying';await save(job);await verify(job);
 }catch(error){job.error=error.message;job.status=job.status==='cancelling'?'cancelled':'failed';await save(job);}
}
async function faceReady(){try{await stat(facePython);const lock=JSON.parse(await readFile(path.join(ROOT,'setup','facefusion.lock.json'),'utf8'));for(const model of lock.models)await stat(path.join(ROOT,lock.source,model.path));for(const name of ['ffmpeg.exe','ffprobe.exe'])await stat(path.join(ROOT,'runtime','facefusion-bin',name));return {ready:true,researchOnly:true};}catch{return {ready:false,error:'Prepare the isolated local face research runtime and selected weights.'};}}
async function visionReady(){try{await stat(visionPython);await stat(path.join(ROOT,'runtime','vision-models','face_landmarker.task'));return {ready:true};}catch{return {ready:false,error:'Set up the isolated vision environment.'};}}
async function humanPoseReady(){try{const lock=JSON.parse(await readFile(path.join(ROOT,'setup/human-pose.lock.json'),'utf8'));return (await stat(path.join(ROOT,lock.path))).size===lock.bytes&&(await visionReady()).ready;}catch{return false;}}
async function health() {
  try {
    const [stats, info] = await Promise.all([comfy.json('/system_stats'), comfy.json('/object_info')]);
    return { connected: true,styleImage:await styleReady(),vision:await visionReady(),humanPoseReady:await humanPoseReady(),selection:await selectionReady(),face:await faceReady(), ...readiness(info), videoTools:videoToolReadiness(info),images:imageReadiness(info),camera:cameraReadiness(info),cameraFull:cameraReadiness(info,'full'),keyframes:keyframeReadiness(info), device: stats.devices?.[0]?.name ?? 'Local device', gpuMemory:{free:stats.devices?.[0]?.vram_free,total:stats.devices?.[0]?.vram_total}, models: MODELS, comfyUrl: comfy.url };
  } catch (error) { return { connected: false,vision:await visionReady(),humanPoseReady:await humanPoseReady(),selection:await selectionReady(),face:await faceReady(), ready: false, error: error.message, comfyUrl: comfy.url }; }
}
async function readBody(req, limit = 25 * 1024 * 1024) {
  let total = 0, exceeded=false; const chunks = [];
  for await (const chunk of req) { total += chunk.length; if (total > limit) { exceeded=true;chunks.length=0; } else if(!exceeded) chunks.push(chunk); }
  if(exceeded)throw new Error(limit===25*1024*1024?'Upload exceeds 25 MB.':'Request is too large.');
  return Buffer.concat(chunks);
}
async function readJson(req,limit=32000) { return JSON.parse((await readBody(req,limit)).toString()); }
async function readAudioTrack(req){const bytes=await readBody(req,32000);return bytes.length?(JSON.parse(bytes.toString())?.track??null):null;}
function json(res, status, value) { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(value)); }
function imageExtension(buffer) {
  if (buffer.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return 'png';
  if (buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255) return 'jpg';
  if (buffer.toString('ascii',0,4) === 'RIFF' && buffer.toString('ascii',8,12) === 'WEBP') return 'webp';
  throw new Error('Upload a PNG, JPEG, or WebP image.');
}
async function inspectImage(filename,mask=false){
  try{await stat(config.python);}catch{throw Error('Studio media tools are missing. Open Setup & models, run npm run setup:media, then restart the studio. You can still download a graph for your own ComfyUI editor.');}
  return new Promise((resolve,reject)=>{
    const child=spawn(config.python,[path.join(ROOT,'scripts/inspect-image.py'),filename,...(mask?['--mask']:[])],{windowsHide:true});
    let output='';child.stdout.on('data',chunk=>output+=chunk);child.stderr.resume();
    const timer=setTimeout(()=>{child.kill();reject(new Error('Image validation timed out. Choose a smaller reference.'));},15000);
    child.once('error',error=>{clearTimeout(timer);reject(error);});
    child.once('close',code=>{clearTimeout(timer);if(code!==0)return reject(new Error('The image could not be decoded. Choose a valid PNG, JPEG, or WebP up to 40 megapixels.'));try{resolve(JSON.parse(output));}catch(error){reject(error);}});
  });
}
async function runPython(script,args,timeout=120000){
  await new Promise((resolve,reject)=>{
    const child=spawn(config.python,[path.join(ROOT,'scripts',script),...args],{windowsHide:true});let errors='';
    child.stdout.resume();child.stderr.on('data',chunk=>errors+=chunk);
    const timer=setTimeout(()=>{child.kill();reject(new Error('Export time limit reached. Use a shorter sequence.'));},timeout);
    child.once('error',error=>{clearTimeout(timer);reject(error);});child.once('close',code=>{clearTimeout(timer);code===0?resolve():reject(new Error(errors.slice(-1000)||'Export failed.'));});
  });
}
async function pythonJson(script,args){
  return new Promise((resolve,reject)=>{const child=spawn(config.python,[path.join(ROOT,'scripts',script),...args],{windowsHide:true});let output='',errors='';const timer=setTimeout(()=>{child.kill();reject(new Error('Media inspection exceeded its time budget.'));},60000);child.stdout.on('data',c=>output+=c);child.stderr.on('data',c=>errors+=c);child.once('error',e=>{clearTimeout(timer);reject(e);});child.once('close',code=>{clearTimeout(timer);if(code)return reject(new Error(errors.slice(-700)||'Media inspection failed.'));try{resolve(JSON.parse(output));}catch(e){reject(e);}});});
}
async function videoProcess(job,phase){
  await new Promise((resolve,reject)=>{const child=spawn(config.python,[path.join(ROOT,'scripts/process-video.py'),jobDir(job.id),'--phase',phase],{windowsHide:true});processors.set(job.id,child);let errors='';child.stdout.resume();child.stderr.on('data',c=>errors+=c);const timeout=setTimeout(()=>child.kill(),10*60*1000);child.once('error',reject);child.once('close',code=>{clearTimeout(timeout);processors.delete(job.id);code===0?resolve():reject(new Error(errors.slice(-1500)||'Local processing stopped.'));});});
}
async function startLocalImage(job){
  const run=async(python,script,args)=>new Promise((resolve,reject)=>{const child=spawn(python,[path.join(ROOT,'scripts',script),...args],{windowsHide:true});processors.set(job.id,child);let errors='';child.stdout.resume();child.stderr.on('data',c=>errors=(errors+c).slice(-6000));const timer=setTimeout(()=>child.kill(),300000);child.once('error',e=>{clearTimeout(timer);processors.delete(job.id);reject(e);});child.once('close',code=>{clearTimeout(timer);processors.delete(job.id);code===0?resolve():reject(new Error(errors.slice(-1200)||'Local image processing stopped.'));});});
  try{job.status='processing';await save(job);await run(visionPython,'vision_tools.py',['image',jobDir(job.id)]);if(job.status==='cancelling')throw new Error('Cancelled.');
    if(job.request.tool==='face-neural'){await run(facePython,'face-neural.py',[jobDir(job.id)]);if(job.status==='cancelling')throw new Error('Cancelled.');}
    if(job.request.tool==='face-anchor'){const v=JSON.parse(await readFile(path.join(jobDir(job.id),'vision.json'),'utf8'));const [l,t,r,b]=v.cropBox;job.request.size=[r-l,b-t];await save(job);}
    if(['face-match','face-neural'].includes(job.request.tool)&&!job.request.mask){const name=randomUUID()+'.png';await copyFile(path.join(jobDir(job.id),'auto-mask.png'),path.join(DATA,'assets',name));job.request.mask=name;await save(job);}
    await writeFile(path.join(jobDir(job.id),'completed.json'),JSON.stringify({localImage:true}));job.status='verifying';await save(job);await verify(job);
  }catch(error){job.error=error.message;job.status=job.status==='cancelling'?'cancelled':'failed';await save(job);}
}
async function resolveVideoSource(request){
  if(request.tool==='story')return null;
  if(request.sourceJob){const job=jobs.get(request.sourceJob);if(!job?.video||!job.report?.technicalPass)throw new Error('Choose a take with passing checks.');const filename=path.join(jobDir(job.id),job.video);const info=await pythonJson('inspect-video.py',[filename]);if(info.sha256!==job.report.sha256)throw new Error('The source take changed after verification.');return {...info,path:filename,jobId:job.id};}
  const directory=path.join(DATA,'footage',request.footage);const source=JSON.parse(await readFile(path.join(directory,'source.json'),'utf8'));return {...source,path:path.join(directory,source.filename),footageId:request.footage};
}
async function startVideoTool(job){
  try{
    const gpu=['upscale','restyle','relight','masked','interpolate','motion','extend','outpaint','segment'].includes(job.request.tool)&&!(job.request.tool==='upscale'&&job.request.upscaleMode==='faithful'||job.request.tool==='outpaint'&&job.request.outpaintMode==='track-still');job.status='processing';await save(job);if(job.status==='cancelling')throw new Error('Cancelled.');await videoProcess(job,gpu?'prepare':'render');
    if(job.status==='cancelling')throw new Error('Cancelled.');
    if(!gpu){job.finalized=true;job.video='output.mp4';job.status='verifying';await save(job);await verify(job);return;}
    job.request.prepared=JSON.parse(await readFile(path.join(jobDir(job.id),'prepared.json'),'utf8'));await save(job);
    if(job.request.lightingProposal){
      const manifest=JSON.parse(await readFile(path.join(jobDir(job.id),'manifest.json'),'utf8'));
      await copyFile(manifest.lightingProposal.path,path.join(jobDir(job.id),'raw.mp4'));
      if(job.status==='cancelling')throw new Error('Cancelled.');
      job.status='verifying';await save(job);await verify(job);await audit(job,'lighting-proposal-reused');return;
    }
    if(job.request.tool==='interpolate'){const lock=job.request.interpolationModel==='rife'?JSON.parse(await readFile(path.join(ROOT,'setup','advanced-models.lock.json'),'utf8')).find(x=>x.group==='rife'):JSON.parse(await readFile(path.join(ROOT,'setup','interpolation-model.lock.json'),'utf8'));if(await fileDigest(path.join(ROOT,lock.path))!==lock.sha256)throw new Error('The interpolation model changed. Restore the pinned weights.');const file=path.join(jobDir(job.id),'manifest.json'),manifest=JSON.parse(await readFile(file,'utf8'));manifest.interpolationModel=lock;await writeFile(file,JSON.stringify(manifest,null,2));}
    if(job.request.videoModel==='detail'&&['masked','restyle','relight','motion','extend','outpaint'].includes(job.request.tool)){const lock=JSON.parse(await readFile(path.join(ROOT,'setup','advanced-models.lock.json'),'utf8')).find(x=>x.group==='vace14');if(await fileDigest(lock.path)!==lock.sha256)throw new Error('Video edit model changed.');const file=path.join(jobDir(job.id),'manifest.json'),manifest=JSON.parse(await readFile(file,'utf8'));manifest.editModel=lock;await writeFile(file,JSON.stringify(manifest,null,2));}
    const check=await health(),ready=check.videoTools?.[job.request.tool==='segment'?'segment':job.request.tool==='interpolate'?(job.request.interpolationModel==='rife'?'rife':'interpolate'):job.request.tool==='upscale'?'upscale':job.request.videoModel==='detail'?'detail':'temporal'];if(!ready?.ready)throw new Error('Missing video nodes/models: '+[...(ready?.missingNodes??[]),...(ready?.missingModels??[])].join(', '));
    if(job.request.tool==='segment'){
      const spec=JSON.parse(await readFile(path.join(ROOT,'setup/round12-models.lock.json'),'utf8')).find(x=>x.directory==='checkpoints'),model={path:path.join('D:/FrameforgeModels/storybuilder',spec.directory,path.basename(spec.path)),sha256:spec.sha256,revision:spec.revision,repo:spec.repo};
      if(await fileDigest(model.path)!==model.sha256)throw Error('Segmentation weights changed.');const file=path.join(jobDir(job.id),'manifest.json'),m=JSON.parse(await readFile(file,'utf8'));m.segmentationModel=model;await writeFile(file,JSON.stringify(m,null,2));
    }
    const uploaded=await comfy.upload(path.join(jobDir(job.id),'input.mp4'),job.id+'.mp4'),names={video:uploaded.subfolder?uploaded.subfolder+'/'+uploaded.name:uploaded.name};
    if(job.request.reference){const image=await comfy.upload(path.join(DATA,'assets',job.request.reference),job.request.reference);names.reference=image.subfolder?image.subfolder+'/'+image.name:image.name;}
    if(job.status==='cancelling')throw new Error('Cancelled.');
    if(job.request.prepared.hasMaskVideo){const item=await comfy.upload(path.join(jobDir(job.id),'mask.mp4'),job.id+'-mask.mp4');names.maskVideo=item.subfolder?item.subfolder+'/'+item.name:item.name;}
    const graph=buildVideoToolWorkflow(job.request,names,'frameforge/'+job.id);await writeFile(path.join(jobDir(job.id),'workflow.json'),JSON.stringify(graph,null,2));job.status='submitting';await save(job);
    const response=await comfy.json('/prompt',{prompt:graph,client_id:job.id});if(!response.prompt_id)throw new Error('The engine did not acknowledge the video graph.');job.promptId=response.prompt_id;job.status='submitted';await save(job);await audit(job,'video-tool-submitted');
  }catch(error){job.error=error.message;job.status=job.status==='cancelling'?'cancelled':job.status==='submitting'?'needs-attention':'failed';await save(job);await audit(job,'video-tool-stopped');}
}
async function verify(job) {
  if(verifications.has(job.id))return verifications.get(job.id);
  const pending=verifyMediaJob(job);verifications.set(job.id,pending);try{return await pending;}finally{verifications.delete(job.id);}
}
async function verifyMediaJob(job) {
  const dir = jobDir(job.id);
  if(job.request.kind==='video-tool'){
    job.video='output.mp4';
    if(['upscale','restyle','relight','masked','interpolate','motion','extend','outpaint','segment'].includes(job.request.tool)&&!job.finalized&&!(job.request.tool==='upscale'&&job.request.upscaleMode==='faithful'||job.request.tool==='outpaint'&&job.request.outpaintMode==='track-still')){await videoProcess(job,'finalize');job.finalized=true;job.video='output.mp4';await save(job);}
    await runPython('verify-video-tool.py',[dir]);job.report=JSON.parse(await readFile(path.join(dir,'report.json'),'utf8'));job.status=job.report.technicalPass?'review-ready':'technical-failed';await save(job);await audit(job,'video-tool-verified');return;
  }
  if(job.request.kind==='image'){
    await runPython('verify-image.py',[dir,path.join(DATA,'assets')]);
    job.image='output.png';job.report=JSON.parse(await readFile(path.join(dir,'report.json'),'utf8'));
    job.status=job.report.technicalPass?'review-ready':'technical-failed';await save(job);await audit(job,'image-verified');return;
  }
  if(job.request.look?.style==='noir'){
    const source=path.join(dir,'ungraded.mp4');
    try{await copyFile(path.join(dir,job.video),source,1);}catch(error){if(error.code!=='EEXIST')throw error;}
    await runPython('finish-look.py',[source,path.join(dir,job.video)]);
    job.finishing=JSON.parse(await readFile(path.join(dir,'finish.json'),'utf8'));
  }
  await writeFile(path.join(dir, 'expected.json'), JSON.stringify(job.request.workflowExpected??{ frames: LENGTHS[job.request.length], size: generationSize(job.request), fps: job.request.fps }));
  await new Promise((resolve, reject) => {
    const child = spawn(config.python, [path.join(ROOT, 'scripts/verify-media.py'), path.join(dir, job.video), '--expected', path.join(dir, 'expected.json'), '--output', dir], { windowsHide: true });
    let stderr = '';
    child.stderr.on('data', c => { stderr += c; });
    child.stdout.resume();
    child.on('error', reject);
    child.on('close', code => code === 0 || code === 2 ? resolve() : reject(new Error(stderr.slice(-1000) || `Verifier exit ${code}`)));
  });
  job.report = JSON.parse(await readFile(path.join(dir, 'report.json'), 'utf8'));
  job.status = job.report.technicalPass ? 'review-ready' : 'technical-failed';
  await save(job); await audit(job, 'media-verified');
}
async function tick() {
  if (busy) return;
  busy = true;
  try {
    for (const job of jobs.values()) {
      if (job.status === 'verifying') { try { await verify(job); } catch (e) { job.status = 'verification-blocked'; job.error = e.message; await save(job); } continue; }
      if (!['submitted', 'running', 'cancelling'].includes(job.status)) continue;
      try {
        const history = await comfy.json('/history/' + encodeURIComponent(job.promptId));
        const record = history[job.promptId];
        if (!record) {
          const queue = await comfy.json('/queue');
          const running = (queue.queue_running ?? []).some(x => x[1] === job.promptId);
          const pending = (queue.queue_pending ?? []).some(x => x[1] === job.promptId);
          if (job.status === 'cancelling') {
            if (!running && !pending) { job.status='cancelled'; job.error='Render cancelled. Its settings are saved for a deliberate retry.'; await save(job); await audit(job,'cancelled'); }
            continue;
          }
          if (running && job.status !== 'running') { job.status = 'running'; await save(job); }
          if (!running && !pending && Date.now() - Date.parse(job.createdAt) > 30000) { job.status = 'needs-attention'; job.error = 'Job is absent from ComfyUI queue and history. Inspect the engine before retrying.'; await save(job); }
          continue;
        }
        if (record.status?.status_str === 'error') {
          const interrupted=(record.status.messages??[]).some(message=>message[0]==='execution_interrupted');
          job.status = interrupted ? 'cancelled' : 'failed'; job.error = interrupted ? 'Render interrupted. Its settings are saved for a deliberate retry.' : historyError(record.status.messages); await save(job); await audit(job, interrupted?'cancelled':'generation-failed'); continue;
        }
        const isImage=job.request.kind==='image';
        const refs = isImage?findImages(record.outputs):findVideos(record.outputs);
        if (!refs.length && record.status?.completed) { job.status = 'failed'; job.error = 'Workflow completed without saved media.'; await save(job); continue; }
        if (!refs.length) continue;
        const response = await comfy.output(refs[0]);
        const output=isImage?'raw.png':job.request.kind==='video-tool'?'raw.mp4':'output'+path.extname(refs[0].filename).toLowerCase();
        if(!isImage&&job.request.kind!=='video-tool')job.video=output;
        await writeFile(path.join(jobDir(job.id), output + '.tmp'), Buffer.from(await response.arrayBuffer()));
        await rename(path.join(jobDir(job.id), output + '.tmp'), path.join(jobDir(job.id), output));
        job.status = 'verifying'; job.error = null; await save(job);
        await verify(job);
      } catch (e) {
        job.error = 'Waiting for the engine or verifier: ' + e.message;
        await save(job);
      }
    }
  } finally { busy = false; }
}
const timer = setInterval(tick, 2500); timer.unref();

async function submitJob(input,retriedFrom=null,workflowOverride=null) {
  const openOnly=executionPolicy.enabled||input.openWeightsOnly===true;
  if(openOnly){assertOpenInput(input.kind==='image'?'images':input.kind==='video-tool'?'video-tools':'create',input);if(workflowOverride)assertOpenGraph(workflowOverride,policyModels);}
  if (typeof input.requestId !== 'string' || !/^[a-f0-9-]{36}$/.test(input.requestId)) throw new Error('A valid request ID is required.');
  const existing=[...jobs.values()].find(x=>x.requestId===input.requestId);
  if(existing)return {code:200,body:existing};
  const active=()=>audioStudio.busy()||[...jobs.values()].some(x=>['processing','uploading','submitting','submitted','running','cancelling','verifying'].includes(x.status));
  if(active())return {code:409,body:{error:'One local render at a time. Wait for the current shot.'}};
  const request=input.kind==='video-tool'?normalizeVideoTool(input):input.kind==='image'?normalizeImage(input):normalizeRequest(input);
  if(!(await mediaRuntime(config.python)).available)throw Error('Install the studio media tools before rendering here: npm run setup:media, then restart the studio. Graph downloads can run in your own ComfyUI without these helpers.');
  let videoSource,lightingProposal,segmentation;
  if(request.kind==='video-tool'){
    if(request.keyframeJob&&!request.lightingProposal){const frame=jobs.get(request.keyframeJob);if(!frame?.image||!frame.report?.technicalPass||frame.review?.verdict==='rejected')throw new Error('Choose a checked appearance still.');const file=path.join(jobDir(frame.id),frame.image);if(createHash('sha256').update(await readFile(file)).digest('hex')!==frame.report.sha256)throw new Error('Appearance keyframe changed.');const name=randomUUID()+'.png';await copyFile(file,path.join(DATA,'assets',name));request.reference=name;request.keyframeBinding={jobId:frame.id,sha256:frame.report.sha256,creativeReview:frame.review?.verdict??'pending'};}
    videoSource=await resolveVideoSource(request);for(const image of [request.reference,request.overlay,request.mask,request.poseTarget,...request.cards.map(c=>c.asset)].filter(Boolean))await stat(path.join(DATA,'assets',image));if(request.audio)await stat(path.join(DATA,'audio',request.audio+'.wav'));
    if(videoSource){const end=request.end??videoSource.duration;if(request.start>=end||end>videoSource.duration+.001||end-request.start>30)throw new Error('Choose a range of up to 30 seconds inside the source.');if(request.tool==='upscale'&&end-request.start>3.4)throw new Error('AI upscale previews are limited to 3.4 seconds.');}
    if(request.segmentationJob){
      const prior=jobs.get(request.segmentationJob);if(prior?.request.tool!=='segment'||!prior.report?.technicalPass||!prior.report.segmentation)throw Error('Choose a checked neural mask preview.');
      const file=path.join(jobDir(prior.id),'segmentation.json'),checksum=await fileDigest(file);if(checksum!==prior.report.segmentation.sha256)throw Error('Neural selection metadata changed.');
      const meta=JSON.parse(await readFile(file,'utf8'));if(meta.sourceSha256!==videoSource.sha256)throw Error('Neural selection belongs to a different source.');
      segmentation={jobId:prior.id,directory:jobDir(prior.id),metadataSha256:checksum};
    }
    if(request.lightingProposal){
      const proposal=jobs.get(request.lightingProposal);
      if(!proposal?.report?.technicalPass||!proposal.report.relighting||proposal.request.tool!=='relight')throw new Error('Choose a checked lighting result first.');
      for(const key of ['sourceJob','footage','start','end','aspect','cropX','cropY','cropEndX','cropEndY','prompt','seed','reference','guidance','steps','videoModel','keyframeJob'])if(request[key]!== (key==='videoModel'?(proposal.request[key]??'preview'):key==='keyframeJob'?(proposal.request[key]??null):proposal.request[key]))throw new Error('Reusing lighting keeps the original source, range, prompt, seed and model settings.');
      const file=path.join(jobDir(proposal.id),'raw.mp4'),sha256=createHash('sha256').update(await readFile(file)).digest('hex');
      if(sha256!==proposal.report.relighting.candidateSha256)throw new Error('The saved lighting proposal changed after verification.');
      lightingProposal={jobId:proposal.id,path:file,sha256};if(proposal.request.keyframeBinding)request.keyframeBinding=proposal.request.keyframeBinding;
    }
  }
  if(request.asset)await stat(path.join(DATA,'assets',request.asset));
  if(request.endAsset)await stat(path.join(DATA,'assets',request.endAsset));
  if(request.kind==='image'){
    for(const key of ['reference','reference2','mask'])if(request[key])await stat(path.join(DATA,'assets',request[key]));
    if(request.asset){const dimensions=await inspectImage(path.join(DATA,'assets',request.asset));
      const limit=request.tool==='upscale'?1000000:4000000;
      if(dimensions.width*dimensions.height>limit)throw new Error(request.tool==='upscale'?'Upscale source is limited to one megapixel.':'Edit source is limited to four megapixels.');
      if(LOCAL_IMAGE_TOOLS.includes(request.tool)||request.tool==='select'){request.size=[dimensions.width,dimensions.height];}
      else if(request.tool==='identity-pose'||request.tool==='continuity'&&!request.mask){request.size=IMAGE_SIZES[request.aspect];}
      else if(request.tool!=='upscale'){const scale=Math.min(1,1024/Math.max(dimensions.width,dimensions.height),768/Math.sqrt(dimensions.width*dimensions.height));request.size=[Math.max(16,Math.round(dimensions.width*scale/16)*16),Math.max(16,Math.round(dimensions.height*scale/16)*16)];}
      if(request.mask){const mask=await inspectImage(path.join(DATA,'assets',request.mask),true);if(mask.width!==dimensions.width||mask.height!==dimensions.height)throw new Error('Mask dimensions must match the source.');if(!mask.hasPaint||!mask.hasBackground)throw new Error('Paint part of the image and leave some area untouched.');}
    }
  }
  const duplicate=[...jobs.values()].find(x=>x.requestId===input.requestId);
  if(duplicate)return {code:200,body:duplicate};
  if(active())return {code:409,body:{error:'One local render at a time. Wait for the current shot.'}};
  const job={id:randomUUID(),requestId:input.requestId,createdAt:new Date().toISOString(),status:'uploading',request,review:null,...(openOnly?{executionPolicy:{profile:'open-weights-only',openWeightsOnly:true}}:{}),...(retriedFrom?{retriedFrom}:{})};
  jobs.set(job.id,job);await save(job);
  if(request.kind==='image'&&request.tool==='style-board'){
   try{if(!(await styleReady(request.styleMode)).ready)throw Error('Prepare the local style models first.');request.size=IMAGE_SIZES[request.aspect];await save(job);const sources=[];for(const asset of request.styleImages){const file=path.join(DATA,'assets',asset);await inspectImage(file);sources.push({asset,path:file,sha256:await fileDigest(file)});}const manifest={request,assets:path.join(DATA,'assets'),sources};await writeFile(path.join(jobDir(job.id),'style-manifest.json'),JSON.stringify(manifest,null,2));await writeFile(path.join(jobDir(job.id),'workflow.json'),JSON.stringify({processor:'local-sdxl-style-only',...manifest},null,2));void startStyleImage(job);return {code:202,body:job};}
   catch(error){job.status='failed';job.error=error.message;await save(job);return {code:400,body:job};}
  }
  if(request.kind==='image'&&LOCAL_IMAGE_TOOLS.includes(request.tool)){if(!(await visionReady()).ready||request.tool==='face-neural'&&!(await faceReady()).ready){job.status='failed';job.error='Set up the selected local vision runtime first.';await save(job);return {code:400,body:job};}await writeFile(path.join(jobDir(job.id),'workflow.json'),JSON.stringify({processor:request.tool==='face-neural'?'local-facefusion':'local-vision',request},null,2));void startLocalImage(job);return {code:202,body:job};}
  if(request.kind==='video-tool'){
    try{const poseTarget=request.poseTarget?{asset:request.poseTarget,path:path.join(DATA,'assets',request.poseTarget),sha256:await fileDigest(path.join(DATA,'assets',request.poseTarget))}:null;const manifest={request,visionPython,source:videoSource,...(poseTarget?{poseTarget}:{}),assets:path.join(DATA,'assets'),audioPath:request.audio?path.join(DATA,'audio',request.audio+'.wav'):null,...(lightingProposal?{lightingProposal}:{}),...(segmentation?{segmentation}:{})};await writeFile(path.join(jobDir(job.id),'manifest.json'),JSON.stringify(manifest,null,2));await writeFile(path.join(jobDir(job.id),'workflow.json'),JSON.stringify({processor:lightingProposal?'lighting-proposal-reuse':'local-video-tool',...manifest},null,2));void startVideoTool(job);return {code:202,body:job};}
    catch(error){job.status='failed';job.error=error.message;await save(job);return {code:500,body:job};}
  }
  try{
    const check=await health();
    const selected=request.kind==='image'?check.images?.[request.tool==='identity-pose'&&request.poseGuide==='skeleton'?'identity-skeleton':['upscale','inpaint','identity-pose','views','select'].includes(request.tool)?request.tool:['create','cinema'].includes(request.tool)?'create':'edit']:request.engine==='camera'?(request.cameraSampling==='full'?check.cameraFull:check.camera):request.engine==='keyframes'?check.keyframes:check;
    if(!selected?.ready)throw new Error(check.connected?'Missing models or nodes: '+[...(selected?.missingModels??[]),...(selected?.missingNodes??[])].join(', '):'Start the ComfyUI engine first.');
    if(request.kind==='image'&&request.tool==='identity-pose'){
      const locks=JSON.parse(await readFile(path.join(ROOT,'setup/advanced-models.lock.json'),'utf8')).filter(x=>['photomaker','sdxl',request.poseGuide==='skeleton'?'pose':'canny'].includes(x.group));
      if(request.poseGuide==='skeleton')locks.push(JSON.parse(await readFile(path.join(ROOT,'setup/pose-model.lock.json'),'utf8')));
      const derived=JSON.parse(await readFile(path.join(ROOT,'setup/photomaker-derived.lock.json'),'utf8'));locks.push(derived);
      for(const item of locks)if(await fileDigest(item.path)!==item.sha256)throw new Error('Identity model changed: '+item.path);
      await writeFile(path.join(jobDir(job.id),'identity-models.json'),JSON.stringify(locks,null,2));
    }
    if(request.kind==='image'&&request.tool==='views'){
      const spec=JSON.parse(await readFile(path.join(ROOT,'setup/round12-models.lock.json'),'utf8')).find(x=>x.directory==='loras'),model={...spec,path:path.join('D:/FrameforgeModels/storybuilder',spec.directory,path.basename(spec.path))};
      if(await fileDigest(model.path)!==model.sha256)throw Error('Angle adapter changed. Restore the pinned weights.');
      await writeFile(path.join(jobDir(job.id),'angle-model.json'),JSON.stringify(model,null,2));
    }
    const uploaded=request.asset?await comfy.upload(path.join(DATA,'assets',request.asset),request.asset):null;
    const imageName=uploaded?(uploaded.subfolder?uploaded.subfolder+'/'+uploaded.name:uploaded.name):null;
    const endUpload=request.endAsset?await comfy.upload(path.join(DATA,'assets',request.endAsset),request.endAsset):null;
    const endName=endUpload?(endUpload.subfolder?endUpload.subfolder+'/'+endUpload.name:endUpload.name):null;
    const names={asset:imageName};
    if(request.kind==='image')for(const key of ['reference','reference2','mask'])if(request[key]){const ref=await comfy.upload(path.join(DATA,'assets',request[key]),request[key]);names[key]=ref.subfolder?ref.subfolder+'/'+ref.name:ref.name;}
    const originalGraph=request.kind==='image'?buildImageWorkflow(request,names,'frameforge/'+job.id):buildWorkflow(request,imageName,'frameforge/'+job.id,endName);
    const graph=workflowOverride?structuredClone(workflowOverride):originalGraph;
    if(openOnly)job.executionPolicy={...job.executionPolicy,...assertOpenGraph(graph,policyModels)};
    if(workflowOverride){applyWorkflowSettings(request,graph,originalGraph);job.workflowEdited=true;for(const n of Object.values(graph))if(['SaveImage','SaveVideo'].includes(n.class_type))n.inputs.filename_prefix='frameforge/'+job.id;}
    await writeFile(path.join(jobDir(job.id),'workflow.json'),JSON.stringify(graph,null,2));
    job.status='submitting';await save(job);
    const response=await comfy.json('/prompt',{prompt:graph,client_id:job.id});
    if(!response.prompt_id)throw new Error('ComfyUI did not acknowledge the job: '+JSON.stringify(response));
    job.promptId=response.prompt_id;job.status='submitted';await save(job);await audit(job,retriedFrom?'retry-submitted':'submitted');
    return {code:202,body:job};
  }catch(e){job.error=e.message;job.status=job.status==='submitting'?'needs-attention':'failed';await save(job);return {code:502,body:{error:e.message,job}};}
}

const batchQueue=await new BatchQueue(DATA,{getJobs:()=>[...jobs.values()],submit:submitJob}).open();
const batchTimer=setInterval(()=>batchQueue.tick().catch(error=>console.error('Batch monitor:',error.message)),3000);batchTimer.unref();

const thumbnails=new Map();let thumbnailGate=Promise.resolve();
async function imageThumbnail(job,file){try{const [a,b]=await Promise.all([stat(path.join(jobDir(job.id),job.image)),stat(file)]);if(b.mtimeMs>=a.mtimeMs)return;}catch{}if(!thumbnails.has(job.id)){const work=thumbnailGate.catch(()=>{}).then(()=>pythonJson('image-thumbnail.py',[path.join(jobDir(job.id),job.image),file]));thumbnailGate=work;thumbnails.set(job.id,work);work.finally(()=>thumbnails.delete(job.id)).catch(()=>{});}return thumbnails.get(job.id);}
async function serveFile(req, res, filename, cacheSeconds=0) {
  const size = (await stat(filename)).size;
  const mime = { '.html':'text/html; charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.md':'text/markdown; charset=utf-8','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.mp4':'video/mp4','.mkv':'video/x-matroska','.webm':'video/webm','.json':'application/json','.svg':'image/svg+xml','.wav':'audio/wav','.flac':'audio/flac','.mp3':'audio/mpeg','.srt':'application/x-subrip; charset=utf-8','.vtt':'text/vtt; charset=utf-8' }[path.extname(filename)] ?? 'application/octet-stream';
  const range = req.headers.range?.match(/^bytes=(\d+)-(\d*)$/);
  if (range) {
    const start = Number(range[1]), end = range[2] ? Math.min(Number(range[2]), size-1) : size-1;
    if (start > end || start >= size) { res.writeHead(416, { 'Content-Range': `bytes */${size}` }); res.end(); return; }
    res.writeHead(206, { 'Content-Type':mime, 'Content-Length':end-start+1,'Content-Range':`bytes ${start}-${end}/${size}`,'Accept-Ranges':'bytes' });
    createReadStream(filename, { start, end }).pipe(res);
  } else { res.writeHead(200, { 'Content-Type':mime,'Content-Length':size,'Accept-Ranges':'bytes','Cache-Control':cacheSeconds?'private, max-age='+cacheSeconds:'no-cache' }); createReadStream(filename).pipe(res); }
}
const audioStudio=await new AudioStudio({root:ROOT,data:DATA,resolveVideo:resolveVideoSource,inspectAudio:file=>pythonJson('inspect-audio.py',[file]),releaseGpu:async()=>{await comfy.releaseIdle();await new Promise(r=>setTimeout(r,1500));},videoBusy:()=>[...jobs.values()].some(j=>['processing','uploading','submitting','submitted','running','cancelling','verifying'].includes(j.status))}).open();
async function preparePortableVideo(id,request){
 const source=await resolveVideoSource(request),directory=path.join(DATA,'workflow-plans',id,'stage');await mkdir(directory,{recursive:true});const manifest={request:{...request,narration:'',audio:null},visionPython,source,assets:path.join(DATA,'assets'),audioPath:null};await writeFile(path.join(directory,'manifest.json'),JSON.stringify(manifest));await runPython('process-video.py',[directory,'--phase','prepare'],300000);const prepared=JSON.parse(await readFile(path.join(directory,'prepared.json'),'utf8'));await pythonJson('inspect-video.py',[path.join(directory,'input.mp4'),'--poster',path.join(directory,'poster.jpg')]);const files=[];for(const [filename,name] of [['input.mp4','prepared-input.mp4'],...(prepared.hasMaskVideo?[['mask.mp4','prepared-mask.mp4']]:[])]){const file=path.join(directory,filename);files.push({name,path:file,bytes:(await stat(file)).size,sha256:await fileDigest(file),contentType:'video/mp4',url:'/workflow-plan-inputs/'+id+'/'+filename,previewUrl:'/workflow-plan-inputs/'+id+'/poster.jpg'});}return {prepared,files};
}
const workflowPlans=await new WorkflowPlans({root:ROOT,data:DATA,comfy,resolveVideo:resolveVideoSource,inspectImage,prepareVideo:preparePortableVideo,resolveKeyframe:async id=>{const frame=jobs.get(id);if(!frame?.image||!frame.report?.technicalPass||frame.review?.verdict==='rejected')throw Error('Choose a checked appearance still.');const file=path.join(jobDir(id),frame.image);if(await fileDigest(file)!==frame.report.sha256)throw Error('Appearance keyframe changed.');const name=randomUUID()+'.png';await copyFile(file,path.join(DATA,'assets',name));return name;}}).open();
const workflowExports=await new WorkflowExports({data:DATA,plans:workflowPlans}).open();

const communityGallery=new CommunityGallery();
const assistantTools=createAssistantTools({root:ROOT,comfy,policy:executionPolicy});
const assistantConnection=await new AssistantConnection(path.join(DATA,'assistant-connection.json')).open();
const studioAssistant=new StudioAssistant({tools:assistantTools,getConnection:()=>assistantConnection.value});
const server = http.createServer(async (req, res) => {
  try {
    const listeningPort=server.address()?.port??PORT;
    const validHosts = [`127.0.0.1:${listeningPort}`, `localhost:${listeningPort}`];
    if (!validHosts.includes(req.headers.host)) return json(res, 403, { error:'Local access only.' });
    if (req.headers.origin && !validHosts.some(host => req.headers.origin === 'http://' + host)) return json(res,403,{error:'Cross-origin requests are disabled.'});
    res.setHeader('X-Content-Type-Options','nosniff');
    const url = new URL(req.url, 'http://127.0.0.1');
    const workflowFrame=url.pathname==='/workflows';
    const communityMedia=!executionPolicy.enabled&&['/','/home','/explore'].includes(url.pathname)?' https://image.civitai.com https://blobs-b2.civitai.com':'';
    res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' blob:"+communityMedia+"; media-src 'self' blob:"+communityMedia+"; script-src 'self'; style-src 'self'; connect-src 'self'; object-src 'none'; frame-ancestors "+(workflowFrame?"'self'":"'none'"));
    const route = url.pathname;
    if(JUDGE_MODE&&(['/api/setup/connection','/api/setup/detect','/api/storage','/api/assistant/detect','/api/assistant/mcp-config','/api/assistant/tools'].includes(route)||route==='/api/assistant/connection'&&req.method!=='GET'))return json(res,403,{error:'Machine settings are managed by the demo creator. Download Frameforge to connect your own engine and assistant.'});
    const openOnly=executionPolicy.enabled||req.headers['x-frameforge-open-weights-only']==='1';
    if(route==='/api/execution-policy'&&req.method==='GET')return json(res,200,{...executionPolicy.describe(),...(openOnly?{openWeightsOnly:true,profile:'open-weights-only'}:{})});
    if(route==='/api/execution-policy'&&req.method==='POST'){const input=await readJson(req,2000);if([...jobs.values()].some(j=>['processing','uploading','submitting','submitted','running','verifying'].includes(j.status))||audioStudio.busy())throw Error('Wait for the current media job before changing the profile.');return json(res,200,await executionPolicy.set(input.openWeightsOnly));}
    if(openOnly&&route.startsWith('/api/explore/civitai'))throw policyError('external community APIs are disabled. Browse the reviewed local recipes instead.');
    if(route==='/api/assistant/connection'&&req.method==='GET')return json(res,200,{connection:assistantConnection.describe(),providers:ASSISTANT_PROVIDERS,inferenceEnabled:!openOnly});
    if(route==='/api/assistant/connection'&&req.method==='POST'){if(studioAssistant.busy)throw Error('Wait for the current assistant answer before changing its connection.');return json(res,200,{connection:await assistantConnection.set(await readJson(req,2000))});}
    if(route==='/api/assistant/detect'&&req.method==='GET')return json(res,200,await detectAssistantServers());
    if(route==='/api/assistant/mcp-config'&&req.method==='GET')return json(res,200,agentMCPConfig({client:url.searchParams.get('client'),root:ROOT,base:'http://127.0.0.1:'+PORT,writes:url.searchParams.get('writes')==='1',openWeightsOnly:openOnly||url.searchParams.get('open')==='1'}));
    if(route==='/api/assistant/models'&&req.method==='GET')return json(res,200,{...await assistantModels(fetch,assistantConnection.value),inferenceEnabled:!openOnly});
    if(route==='/api/assistant/chat'&&req.method==='POST'){const input=await readJson(req,16000);return json(res,200,await studioAssistant.ask(openOnly||JUDGE_MODE?{...input,model:null}:input));}
    if(route==='/api/assistant/tools'&&req.method==='GET')return json(res,200,ASSISTANT_TOOLS);
    if(route==='/api/assistant/tools'&&req.method==='POST'){const input=await readJson(req,4000);return json(res,200,await assistantTools(input.name,input.arguments));}
    if(route==='/api/setup/detect'&&req.method==='GET')return json(res,200,await discoverComfy());
    if(route==='/api/setup'&&req.method==='GET'){
      if(openOnly&&url.searchParams.has('workflow'))assertOpenWorkflow(url.searchParams.get('workflow'));
      const planId=url.searchParams.get('plan');let packet;if(url.searchParams.has('imageTool'))packet=await imageToolSetup(ROOT,url.searchParams.get('imageTool'));
      if(planId){if(!/^[a-f0-9-]{36}$/.test(planId))throw Error('Choose a saved prepared workflow.');packet=workflowPlans.public(await workflowPlans.read(planId));}
      return json(res,200,await setupReport({root:ROOT,comfy,workflow:url.searchParams.get('workflow')??'wan-i2v',packet,studioMedia:await mediaRuntime(config.python)}));
    }
    if(route==='/api/setup/connection'&&req.method==='POST'){
      const input=await readJson(req,2000),next=new ComfyClient(input.url);
      if(next.url!==comfy.url&&(audioStudio.busy()||[...jobs.values()].some(j=>['processing','uploading','submitting','submitted','running','cancelling','verifying'].includes(j.status))))throw Error('Finish or resolve existing generation jobs before changing the engine connection.');
      if(next.url!==comfy.url){try{const queue=await comfy.json('/queue');if(queue.queue_running?.length||queue.queue_pending?.length)throw Object.assign(Error('Wait for the current ComfyUI queue before changing engines.'),{queued:true});}catch(error){if(error.queued)throw error;}}
      const previous=comfy.url;config.comfyUrl=next.url;
      try{await writeFile(path.join(ROOT,'config.local.json'),JSON.stringify(config,null,2)+'\n');}catch(error){config.comfyUrl=previous;throw error;}
      comfy.url=next.url;return json(res,200,{url:comfy.url,saved:true});
    }
    if(route==='/api/director-catalog'&&req.method==='GET')return json(res,200,{recipes:CAMERA_RECIPES,sources:DIRECTOR_SOURCES,publishedExamples:PUBLISHED_EXAMPLES,openStudios:OPEN_STUDIOS});
    if(route==='/api/director'&&req.method==='GET')return json(res,200,director.list().map(p=>({...p,status:productionStatus(p,jobs)})));
    if(route==='/api/director'&&req.method==='POST'){
      const input=await readJson(req,256000);let pack=null;
      if(input.packId){pack=continuityStore.list().packs.find(p=>p.id===input.packId);if(!pack)throw Error('Continuity pack not found.');if(pack.revision!==input.packRevision)throw Error('The reference pack changed. Reload before saving a new snapshot.');}
      // Unchanged attachments keep their frozen snapshot until explicitly refreshed.
      if(input.id&&input.keepPack===true)pack=director.get(input.id,input.revision).pack;
      for(const shot of input.shots??[])if(shot.asset)await stat(path.join(DATA,'assets',assetName(shot.asset)?shot.asset:'invalid-asset'));
      return json(res,201,await director.save(input,pack));
    }
    const direction=route.match(/^\/api\/director\/([a-f0-9-]{36})(?:\/(packet|assemble)|\/shots\/([a-f0-9-]{36})\/(prepare|select))?$/);
    if(direction){
      const [,id,action,shotId,shotAction]=direction;
      if(req.method==='GET'){
        const plan=director.get(id),status=productionStatus(plan,jobs);
        if(shotAction==='prepare'){const shot=plan.shots.find(s=>s.id===shotId);if(!shot)throw Error('Shot not found.');return json(res,200,{request:compileShot(plan,shot),planId:id,shotId,revision:plan.revision});}
        if(action==='packet'){res.setHeader('Content-Disposition',`attachment; filename="production-${id}.json"`);return json(res,200,{format:'frameforge-production-v1',plan,status,sources:DIRECTOR_SOURCES,recipes:CAMERA_RECIPES.filter(r=>plan.shots.some(s=>s.recipe===r.id)),limitations:['Reference-pack images remain planning references; only the chosen first frame enters this video adapter.','Text traits and camera prompts do not guarantee identity, optical simulation or exact trajectories.','Creative approval remains a separate human decision.']});}
        if(!action&&!shotAction)return json(res,200,{...plan,status});
      }
      if(req.method==='POST'&&shotAction==='select'){const input=await readJson(req);return json(res,200,await director.select(id,input.revision,shotId,input.jobId,jobs));}
      if(req.method==='POST'&&action==='assemble'){const input=await readJson(req);if(!Number.isSafeInteger(input.revision))throw Error('Reload the saved production revision before assembling.');const plan=director.get(id,input.revision),assembly=productionAssembly(plan,jobs);return json(res,201,await projects.createProduction(assembly));}
    }
    if(route==='/api/storage'&&req.method==='GET'){
      const paths=Object.fromEntries(await Promise.all(['runtime','data','evidence','backups'].map(async name=>[name,await realpath(name==='data'?DATA:path.join(ROOT,name))])));
      return json(res,200,{onD:Object.values(paths).every(value=>/^D:[\\/]/i.test(value)),paths,extraModels:'D:/FrameforgeModels/storybuilder'});
    }
    if(route==='/api/checklist'&&req.method==='GET')return json(res,200,parseChecklist(await readFile(path.join(ROOT,'REMAINING-CHECKLIST.md'),'utf8')));
    if(route==='/checklist.md'&&req.method==='GET')return await serveFile(req,res,path.join(ROOT,'REMAINING-CHECKLIST.md'));
    if(route==='/caption-utils.js'&&req.method==='GET')return await serveFile(req,res,path.join(ROOT,'lib/captions.mjs'));
    if(route==='/api/audio-catalog'&&req.method==='GET')return json(res,200,await audioStudio.ready());
    if(route==='/api/sounds'&&req.method==='GET')return json(res,200,sounds.list());
    if(route==='/api/sounds'&&req.method==='POST'){
      const input=await readJson(req);if(!/^[a-f0-9-]{36}$/.test(input.audio??''))throw new Error('Choose an uploaded WAV first.');
      const file=path.join(DATA,'audio',input.audio+'.wav'),metadata=await pythonJson('inspect-audio.py',[file]);metadata.sha256=createHash('sha256').update(await readFile(file)).digest('hex');return json(res,201,await sounds.save(input,metadata));
    }
    const soundUse=route.match(/^\/api\/sounds\/([a-f0-9-]{36})\/use$/);
    if(soundUse&&req.method==='POST'){
      const item=sounds.list().find(s=>s.id===soundUse[1]);if(!item)throw new Error('Choose a saved sound.');
      if(createHash('sha256').update(await readFile(path.join(DATA,'audio',item.audio+'.wav'))).digest('hex')!==item.sha256)throw new Error('This WAV changed after it entered the sound library.');return json(res,200,item);
    }
    if(route==='/api/audio-jobs'&&req.method==='GET')return json(res,200,audioStudio.list());
    if(route==='/api/audio-jobs'&&req.method==='POST'){const input=await readJson(req,150000);if(openOnly)assertOpenInput('audio',input);return json(res,202,await audioStudio.submit(input));}
    const audioControl=route.match(/^\/api\/audio-jobs\/([a-f0-9-]{36})\/(review|cancel|reverify|audio-asset|video-footage)$/);
    if(audioControl&&req.method==='POST'){const result=audioControl[2]==='review'?await audioStudio.review(audioControl[1],await readJson(req)):audioControl[2]==='reverify'?await audioStudio.reverify(audioControl[1]):audioControl[2]==='cancel'?await audioStudio.cancel(audioControl[1]):audioControl[2]==='video-footage'?await audioStudio.videoFootage(audioControl[1]):await audioStudio.audioAsset(audioControl[1],await readAudioTrack(req));return json(res,200,result);}
    const audioOutput=route.match(/^\/audio-jobs\/([a-f0-9-]{36})\/(output\.(wav|mp4)|preserved\.mkv|transcript\.json|subtitles\.(srt|vtt)|report\.json|lipsync\.json|dialogue\.json|caption\.json|neural-speech\.json|separation\.json|voice-[12]\.wav|line-[0-9]{3}\.wav|poster\.jpg|contact-sheet\.jpg)$/);
    if(audioOutput&&req.method==='GET')return await serveFile(req,res,audioStudio.file(audioOutput[1],audioOutput[2]));
    if(route==='/api/judge-readiness'&&req.method==='GET'){let connected=false,queued=false;try{const q=await comfy.json('/queue');connected=true;queued=!!(q.queue_running?.length||q.queue_pending?.length);}catch{}return json(res,200,{connected,busy:queued||audioStudio.busy()||[...jobs.values()].some(j=>['processing','uploading','submitting','submitted','running','cancelling','verifying'].includes(j.status))});}
    if (route === '/api/health' && req.method === 'GET') return json(res,200,await health());
    if (route === '/api/catalog' && req.method === 'GET') return json(res,200,{ presets:PRESETS,sizes:SIZES,lengths:LENGTHS,cameraPoses:CAMERA_POSES,looks:LOOKS,images:{tools:IMAGE_TOOLS,sizes:IMAGE_SIZES,camera:STILL_CAMERA,light:IMAGE_LIGHT} });
    if(route==='/api/video-keyframe'&&req.method==='POST'){
      const input=await readJson(req),valid=v=>typeof v==='string'&&/^[a-f0-9-]{36}$/.test(v),time=Number(input.time??0);
      if(Boolean(input.sourceJob)===Boolean(input.footage)||!valid(input.sourceJob??input.footage)||!Number.isFinite(time))throw new Error('Choose a valid source frame.');
      const source=await resolveVideoSource(input);if(time<0||time>=source.duration)throw new Error('Frame time is outside the source clip.');
      let selection=null;const feather=Number(input.feather??0);
      if(Object.hasOwn(input,'segmentationJob')){
        if(!valid(input.segmentationJob)||!Number.isFinite(feather)||feather<0||feather>32)throw Error('Choose a checked selection and valid soft edge.');
        const prior=jobs.get(input.segmentationJob);if(prior?.request.tool!=='segment'||!prior.report?.technicalPass||!prior.report.segmentation)throw Error('Choose a checked neural selection preview.');
        const metadataFile=path.join(jobDir(prior.id),'segmentation.json'),metadataSha256=await fileDigest(metadataFile),meta=JSON.parse(await readFile(metadataFile,'utf8'));
        if(metadataSha256!==prior.report.segmentation.sha256||meta.sourceSha256!==source.sha256||Math.abs(time-meta.sourceRange[0])>.00001)throw Error('Selection and original source/start frame must match.');
        if(input.crop&&['cropX','cropY','cropEndX','cropEndY'].some(k=>!Number.isFinite(input.crop[k])||Math.abs(input.crop[k]-meta.crop[k])>.0001))throw Error('Keep the checked selection crop unchanged.');
        selection={directory:jobDir(prior.id),jobId:prior.id,metadataSha256,sourceSha256:source.sha256,time,feather};
      }
      const name=randomUUID()+'.png',file=path.join(DATA,'assets',name);await runPython('video-frame.py',[source.path,String(time),file],30000);
      if(await fileDigest(source.path)!==source.sha256)throw new Error('Source changed during frame extraction.');
      const binding={name,sha256:await fileDigest(file),sourceJob:input.sourceJob??null,footage:input.footage??null,sourceSha256:source.sha256,time,method:'decoded-source-frame-png-v1'};
      if(selection){const mask=randomUUID()+'.png',inputFile=file+'.selection-input.json';await writeFile(inputFile,JSON.stringify({...selection,frame:file,frameSha256:binding.sha256,output:path.join(DATA,'assets',mask)}));binding.mask=mask;binding.selection=await pythonJson('selection-keyframe.py',[inputFile]);}
      await writeFile(file+'.json',JSON.stringify(binding,null,2));return json(res,201,binding);
    }
    if(route==='/api/body-pose'&&req.method==='POST'){
      const pose=normalizePose(await readJson(req)),file=path.join(DATA,'assets',randomUUID()+'.pose-input.json');await writeFile(file,JSON.stringify(pose));
      return json(res,201,await pythonJson('body_pose.py',[file,path.join(DATA,'assets')]));
    }
    if(route.startsWith('/api/outpaint-guide/')&&req.method==='POST'){
      const id=route.slice('/api/outpaint-guide/'.length);if(!/^[a-f0-9-]{36}$/.test(id))throw new Error('Choose a saved still guide.');
      const job=jobs.get(id);if(!job?.report?.technicalPass||job.request.kind!=='image'||job.request.tool!=='inpaint')throw new Error('Choose a checked still-guide image.');
      try{await stat(path.join(DATA,'assets',job.request.asset+'.proposal.json'));}catch{throw new Error('This image was not prepared as a border guide. Use Generate a still guide first.');}
      const result=await pythonJson('match_outpaint_border.py',[jobDir(id),path.join(DATA,'assets')]);return json(res,201,result);
    }
    if(route==='/api/outpaint-still'&&req.method==='POST'){
      const input=await readJson(req);
      if(Boolean(input.sourceJob)===Boolean(input.footage))throw new Error('Choose one saved video source.');
      const request=normalizeVideoTool({...input,tool:'outpaint',outpaintGuide:false,prompt:input.prompt||'Extend the scene naturally into the marked borders.'});
      const source=await resolveVideoSource(request);
      const prepared=await pythonJson('prepare-outpaint-still.py',[source.path,String(request.start),request.aspect,String(request.outpaintInset),path.join(DATA,'assets')]);
      await writeFile(path.join(DATA,'assets',prepared.asset+'.proposal.json'),JSON.stringify({...prepared,sourceJob:request.sourceJob,footage:request.footage},null,2));
      return json(res,201,{...prepared,imageRequest:{kind:'image',tool:'inpaint',asset:prepared.asset,mask:prepared.mask,aspect:request.aspect,seed:request.seed,prompt:request.prompt+' Continue existing textures and lighting across the marked border. Preserve the unmarked original. No new objects, people, text or structures.'}});
    }
    if(route==='/api/video-frame'&&req.method==='GET'){
      const sourceJob=url.searchParams.get('sourceJob'),footage=url.searchParams.get('footage'),time=Number(url.searchParams.get('time')??0),valid=v=>typeof v==='string'&&/^[a-f0-9-]{36}$/.test(v);
      if(Boolean(sourceJob)===Boolean(footage)||!valid(sourceJob??footage)||!Number.isFinite(time))throw new Error('Choose a valid source frame.');
      const source=await resolveVideoSource({sourceJob,footage});if(time<0||time>=source.duration)throw new Error('Frame time is outside the source clip.');
      const directory=path.join(ROOT,'runtime','frame-cache');await mkdir(directory,{recursive:true});const frame=path.join(directory,source.sha256+'-'+Math.round(time*1000000)+'.jpg');
      try{await stat(frame);}catch{await runPython('video-frame.py',[source.path,String(time),frame],30000);}
      return await serveFile(req,res,frame);
    }
    if(route==='/api/continuity'&&req.method==='GET')return json(res,200,continuityStore.list());
    if(route==='/api/continuity/packs'&&req.method==='POST'){
      const input=await readJson(req),pack=normalizePack(input);for(const role of ['character','location','prop','style'])for(const name of pack[role].assets)await stat(path.join(DATA,'assets',name));return json(res,201,await continuityStore.save(input));
    }
    if(route==='/api/continuity/runs'&&req.method==='POST'){
      const input=await readJson(req);if(!/^[a-f0-9-]{36}$/.test(input.requestId??''))throw new Error('A run request ID is required.');const prior=continuityStore.list().runs.find(r=>r.requestId===input.requestId);if(prior)return json(res,200,prior);
      const pack=continuityStore.list().packs.find(p=>p.id===input.packId);if(!pack||pack.revision!==input.revision)throw new Error('Reopen the current pack before rendering.');
      if(!Array.isArray(input.briefs)||input.briefs.length<1||input.briefs.length>4||input.briefs.some(b=>typeof b!=='string'||!b.trim()||b.length>700))throw new Error('Write 1–4 shot briefs, up to 700 characters each.');
      const mode=input.mode??'scene';if(!['scene','guided-scene','face-swap','character-swap'].includes(mode))throw new Error('Choose a continuity mode.');if(!['preserve','change'].includes(input.wardrobe??'preserve'))throw new Error('Choose a wardrobe policy.');
      const seed=Number(input.seed??202610180);if(!Number.isSafeInteger(seed)||seed<0||seed>2**32-5)throw new Error('Choose a valid seed.');if(!Object.hasOwn(IMAGE_SIZES,input.aspect??'square'))throw new Error('Choose a format.');
      if(mode!=='scene'){if(!assetName(input.target))throw new Error('Choose a target image.');await stat(path.join(DATA,'assets',input.target));}if(input.mask){if(mode==='scene'||!assetName(input.mask))throw new Error('Use a mask with a replacement target.');await stat(path.join(DATA,'assets',input.mask));}
      if(batchQueue.list().some(b=>b.status==='running')||[...jobs.values()].some(j=>['uploading','processing','submitting','submitted','running','verifying','cancelling'].includes(j.status)))return json(res,409,{error:'Finish the current local work before starting a reference set.'});
      if(!['preview','precise'].includes(input.quality??'preview'))throw new Error('Choose preview or precise rendering.');if(!['none','boundary'].includes(input.blend??'none')||input.blend==='boundary'&&!input.mask)throw new Error('Boundary matching requires a mask.');
      let faceAnchor=null;if(input.faceAnchorJob){faceAnchor=validateFaceAnchor(jobs.get(input.faceAnchorJob),pack);for(const [file,expected] of [[path.join(jobDir(faceAnchor.jobId),'output.png'),faceAnchor.sha256],[path.join(DATA,'assets',faceAnchor.source),faceAnchor.sourceSha256]])if(createHash('sha256').update(await readFile(file)).digest('hex')!==expected)throw new Error('The face anchor or original changed after verification.');}
      const run={id:input.requestId,requestId:input.requestId,pack,faceAnchor,briefs:input.briefs,mode,conditioningPolicy:mode==='guided-scene'?'guide-and-character-only':'selected-roles',quality:input.quality??'preview',blend:input.blend??'none',wardrobe:input.wardrobe??'preserve',seed,aspect:input.aspect??'square',target:input.target??null,mask:input.mask??null,status:'preparing',at:new Date().toISOString()};await continuityStore.record(run);
      try{const directory=path.join(DATA,'continuity-runs',run.id);await mkdir(directory,{recursive:true});const manifest=path.join(directory,'pack.json');await writeFile(manifest,JSON.stringify({pack}));const sheets=await pythonJson('continuity-sheets.py',[manifest,path.join(DATA,'assets')]);
        if(faceAnchor){const name=randomUUID()+'.png';await copyFile(path.join(jobDir(faceAnchor.jobId),'output.png'),path.join(DATA,'assets',name));sheets.character=name;sheets.provenance[name]=faceAnchor.sha256;sheets.provenance[faceAnchor.source]=faceAnchor.sourceSha256;await writeFile(path.join(directory,'face-anchor.json'),JSON.stringify({...faceAnchor,asset:name},null,2));}
        const files=mode==='guided-scene'?[input.target,sheets.character]:mode==='scene'?[sheets.character,sheets.location,sheets.direction].filter(Boolean):[input.target,sheets.character];const slots=mode==='guided-scene'?['target scene','replacement character identity']:mode==='scene'?['character identity',...(sheets.location?['location architecture']:[]),...(sheets.direction?['prop and style board']:[])]:['target scene','replacement character identity'];
        const requests=input.briefs.map((brief,index)=>normalizeImage({tool:'continuity',asset:files[0],reference:files[1],reference2:files[2],mask:run.mask,quality:run.quality,blend:run.blend,aspect:run.aspect,seed:seed+index,prompt:continuityPrompt(pack,brief,slots,mode==='guided-scene'?'character-swap':mode,run.wardrobe),continuity:{packId:pack.id,revision:pack.revision,runId:run.id,mode,brief,slots,faceAnchor,provenance:sheets.provenance}}));
        const batch=await batchQueue.add(requests,run.requestId);return json(res,201,await continuityStore.updateRun(run.id,{status:'queued',batchId:batch.id,sheets,slots}));
      }catch(error){await continuityStore.updateRun(run.id,{status:'needs-attention',error:error.message});throw error;}
    }
    const assessment=route.match(/^\/api\/continuity\/jobs\/([a-f0-9-]{36})\/assessment$/);
    if(assessment&&req.method==='POST'){const job=jobs.get(assessment[1]);if(!job?.report?.technicalPass||!job.request.continuity)throw new Error('Choose a checked continuity image.');const input=await readJson(req),criteria={};for(const key of ['identity','location','prop','style','pose','wardrobe']){const value=input.criteria?.[key]??'not-applicable';if(!['pass','fail','uncertain','not-applicable'].includes(value))throw new Error('Choose a criterion verdict.');criteria[key]=value;}job.continuityReview={criteria,notes:String(input.notes??'').slice(0,2000),sha256:job.report.sha256,at:new Date().toISOString()};await save(job);return json(res,200,job);}
    if(route==='/api/video-catalog'&&req.method==='GET')return json(res,200,{tools:VIDEO_TOOLS,formats:VIDEO_FORMATS,grades:VIDEO_GRADES,voices:['Microsoft David Desktop','Microsoft Zira Desktop']});
    if(route==='/api/footage'&&req.method==='GET'){
      const records=[];for(const id of await readdir(path.join(DATA,'footage')))if(/^[a-f0-9-]{36}$/.test(id)){try{records.push(JSON.parse(await readFile(path.join(DATA,'footage',id,'source.json'),'utf8')));}catch{}}return json(res,200,records);
    }
    if(route==='/api/footage'&&req.method==='POST'){
      const bytes=await readBody(req,100*1024*1024),ext=bytes.subarray(0,4).equals(Buffer.from([26,69,223,163]))?'webm':bytes.toString('ascii',4,8)==='ftyp'?'mp4':null;if(!ext)throw new Error('Upload MP4/MOV or WebM footage up to 100 MB.');
      const id=randomUUID(),directory=path.join(DATA,'footage',id),filename='source.'+ext;await mkdir(directory,{recursive:true});await writeFile(path.join(directory,filename),bytes);
      try{const info=await pythonJson('inspect-video.py',[path.join(directory,filename),'--poster',path.join(directory,'poster.jpg')]);if(JUDGE_MODE&&(info.duration>10||Math.max(...info.size)>1280))throw Error('Use a clip up to 10 seconds and 1280 pixels on its longest side for the shared demo.');let displayName=String(req.headers['x-file-name']??'Uploaded footage');try{displayName=decodeURIComponent(displayName);}catch{}const record={id,...info,filename,name:displayName.slice(0,100),createdAt:new Date().toISOString()};await writeFile(path.join(directory,'source.json'),JSON.stringify(record,null,2));return json(res,201,record);}catch(error){await unlink(path.join(directory,filename));throw error;}
    }
    if(route==='/api/audio-assets'&&req.method==='POST'){
      const bytes=await readBody(req);if(bytes.toString('ascii',0,4)!=='RIFF'||bytes.toString('ascii',8,12)!=='WAVE')throw new Error('Choose a WAV soundtrack up to 25 MB.');const id=randomUUID(),filename=path.join(DATA,'audio',id+'.wav');await writeFile(filename,bytes);try{const metadata=await pythonJson('inspect-audio.py',[filename]);if(JUDGE_MODE&&metadata.duration>30)throw Error('Use a WAV up to 30 seconds in the shared demo.');return json(res,201,{id,...metadata});}catch(error){await unlink(filename);throw error;}
    }
    if (route === '/api/jobs' && req.method === 'GET') return json(res,200,[...jobs.values()].sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).map(j=>url.searchParams.get('summary')==='1'?{id:j.id,status:j.status,createdAt:j.createdAt,requestId:j.requestId,image:j.image,video:j.video,request:{kind:j.request.kind,tool:j.request.tool,prompt:j.request.prompt,seed:j.request.seed},review:j.review,report:j.report?{technicalPass:j.report.technicalPass}:null}:j));
    const jobRead=route.match(/^\/api\/jobs\/([a-f0-9-]{36})(\/thumbnail)?$/);
    if(jobRead&&req.method==='GET'){const job=jobs.get(jobRead[1]);if(!job)throw Object.assign(Error('Saved job not found.'),{statusCode:404});if(!jobRead[2])return json(res,200,job);if(!job.image)throw Object.assign(Error('This job has no image.'),{statusCode:404});const file=path.join(jobDir(job.id),'thumbnail.jpg');await imageThumbnail(job,file);return await serveFile(req,res,file,3600);}
    if(route==='/api/explore/civitai'&&req.method==='GET'){try{return json(res,200,await communityGallery.get(url.searchParams));}catch(e){return json(res,503,{error:e.message,sourceUrl:'https://civitai.com'});}}
    const communityVersion=route.match(/^\/api\/explore\/civitai\/version\/(\d{1,12})$/);if(communityVersion&&req.method==='GET')return json(res,200,await communityGallery.modelVersion(Number(communityVersion[1])));
    if(route==='/api/provider-workflows'&&req.method==='GET')return json(res,200,await providerCatalog({root:ROOT,data:DATA,openOnly}));
    const providerSetup=route.match(/^\/api\/provider-workflows\/([a-z0-9-]+)\/(readiness|export)$/);
    if(providerSetup&&((providerSetup[2]==='readiness'&&req.method==='GET')||(providerSetup[2]==='export'&&req.method==='POST'))){
      if(openOnly)assertOpenProvider(await providerPacket(ROOT,providerSetup[1],url.searchParams.get('variant')??'default'));
      const variant=url.searchParams.get('variant')??'default';
      return json(res,200,providerSetup[2]==='readiness'?await providerReadiness({root:ROOT,id:providerSetup[1],variant,engines:[comfy.url,'http://127.0.0.1:8189']}):await providerRunPackage({root:ROOT,data:DATA,id:providerSetup[1],variant,effect:url.searchParams.get('effect')??'original'}));
    }
    const providerExport=route.match(/^\/provider-exports\/([a-f0-9-]{36})\/bundle\.zip$/);
    if(providerExport&&req.method==='GET'){if(openOnly){const manifest=JSON.parse(await readFile(path.join(DATA,'provider-exports',providerExport[1],'manifest.json'),'utf8'));assertOpenProvider(await providerPacket(ROOT,manifest.workflow,manifest.variant));}res.setHeader('Content-Disposition','attachment; filename="frameforge-run-package.zip"');return await serveFile(req,res,path.join(DATA,'provider-exports',providerExport[1],'bundle.zip'));}
    const providerPreview=route.match(/^\/api\/provider-workflows\/([a-z0-9-]+)\/(preview|poster)$/);
    if(providerPreview&&req.method==='GET'){
      if(openOnly)assertOpenProvider(await providerPacket(ROOT,providerPreview[1],url.searchParams.get('variant')??'default'));
      const id=providerPreview[1],variant=url.searchParams.get('variant')??'default',proof=await providerVerification({data:DATA,id,variant});
      if(!proof)throw Object.assign(Error('No completed local preview is saved.'),{statusCode:404});
      return await serveFile(req,res,path.join(DATA,'provider-verifications',id+(variant==='local'?'-local':''),providerPreview[2]==='poster'?'poster.jpg':proof.mediaType==='image'?'result.png':'result.mp4'));
    }
    const providerRoute=route.match(/^\/api\/provider-workflows\/([a-z0-9-]+)(\/download)?$/);
    if(providerRoute&&req.method==='GET'){
      if(openOnly)assertOpenProvider(await providerPacket(ROOT,providerRoute[1],url.searchParams.get('variant')??'default'));
      const packet=await providerPacket(ROOT,providerRoute[1],url.searchParams.get('variant')??'default');
      if(providerRoute[2]){res.setHeader('Content-Disposition','attachment; filename="'+packet.file+'"');return await serveFile(req,res,path.join(ROOT,'workflows/bonus',packet.file));}
      const verification=await providerVerification({data:DATA,id:packet.id,variant:packet.variant});
      return json(res,200,{...packet,verification,generationVerified:!!verification,status:verification?'Local preview completed; creative approval pending':packet.status});
    }
    if(route==='/api/workflows'&&req.method==='GET')return json(res,200,openOnly||url.searchParams.get('openWeightsOnly')==='true'?WORKFLOWS.filter(w=>OPEN_WORKFLOW_IDS.includes(w.id)):WORKFLOWS);
    if(route==='/api/workflow-plans'&&req.method==='POST'){const input=await readJson(req,1000000);if(openOnly)assertOpenInput(input.context,{...input.input,provider:input.provider});const prepared=await workflowPlans.prepare(input);if(openOnly&&prepared.graph)prepared.openWeightsAudit=assertOpenGraph(prepared.graph,policyModels);return json(res,201,prepared);}
    const draftRoute=route.match(/^\/api\/workflow-plans\/([a-f0-9-]{36})$/);
    if(draftRoute&&req.method==='GET'){const plan=await workflowPlans.read(draftRoute[1]);if(openOnly){assertOpenInput(plan.context,{...plan.rawInput,provider:plan.provider});if(plan.graph)assertOpenGraph(plan.graph,policyModels);}return json(res,200,workflowPlans.public(plan));}
    const runDraft=route.match(/^\/api\/workflow-plans\/([a-f0-9-]{36})\/run$/);
    if(runDraft&&req.method==='POST'){const body=await readJson(req,2000000),{plan,api:graph}=await workflowPlans.compile(runDraft[1],body.graph);if(openOnly){assertOpenInput(plan.context,{...plan.rawInput,provider:plan.provider});assertOpenGraph(graph,policyModels);}if(plan.provider==='cloud')return json(res,409,{error:'Open this prepared workflow in Comfy Cloud. Paid submission is handled there.'});if(plan.execution==='processor')throw Error('Run this complete pipeline with the tool controls, or export its ComfyUI stage.');const result=await submitJob({...plan.rawInput,requestId:body.requestId,openWeightsOnly:openOnly},null,graph);return json(res,result.code,result.body);}
    if(route.startsWith('/api/cloud/'))return json(res,410,{error:'Cloud runs open in Comfy Cloud. This studio does not collect API keys or submit paid requests.'});
    const workflowExport=route.match(/^\/api\/workflow-plans\/([a-f0-9-]{36})\/export$/);
    if(workflowExport&&req.method==='POST'){const body=await readJson(req,2000000);if(openOnly){const {plan,api}=await workflowPlans.compile(workflowExport[1],body.graph);assertOpenInput(plan.context,{...plan.rawInput,provider:plan.provider});assertOpenGraph(api,policyModels);}return json(res,201,await workflowExports.create(workflowExport[1],body));}
    const exportFile=route.match(/^\/workflow-exports\/([a-f0-9-]{36})\/(bundle\.zip|workflow\.json)$/);
    if(exportFile&&req.method==='GET'){res.setHeader('Content-Disposition','attachment; filename="frameforge-'+exportFile[2]+'"');return await serveFile(req,res,path.join(DATA,'workflow-exports',exportFile[1],exportFile[2]));}
    const planInput=route.match(/^\/workflow-plan-inputs\/([a-f0-9-]{36})\/(input\.mp4|mask\.mp4|poster\.jpg)$/);
    if(planInput&&req.method==='GET')return await serveFile(req,res,path.join(DATA,'workflow-plans',planInput[1],'stage',planInput[2]));
    const workflowRoute=route.match(/^\/api\/workflows\/([a-z0-9-]+)$/);
    if(workflowRoute&&req.method==='GET'){
      if(openOnly)assertOpenWorkflow(workflowRoute[1]);
      if(!WORKFLOWS.some(w=>w.id===workflowRoute[1]))return json(res,404,{error:'Unknown workflow.'});
      return json(res,200,await workflowPacket(ROOT,workflowRoute[1]));
    }
    const jobCanvas=route.match(/^\/api\/jobs\/([a-f0-9-]{36})\/canvas$/);
    if(jobCanvas&&req.method==='GET'){
      const job=jobs.get(jobCanvas[1]);if(!job)return json(res,404,{error:'Take not found.'});
      const api=JSON.parse(await readFile(path.join(jobDir(job.id),'workflow.json'),'utf8'));
      const graph=apiToCanvas(api,await comfy.json('/object_info')),previews={};
      for(const node of graph.nodes){const filename=node.widgets_values?.[0];if(node.type==='LoadImage'&&typeof filename==='string'&&/^[a-f0-9-]{36}\.(png|jpg|webp)$/.test(path.basename(filename)))previews[node.id]={url:'/assets/'+path.basename(filename),label:'Saved input'};if(job.report&&['SaveImage','SaveVideo'].includes(node.type))previews[node.id]={url:'/outputs/'+job.id+(node.type==='SaveImage'?'/output.png':'/poster.jpg'),label:'Saved output · edits do not regenerate it',output:'/outputs/'+job.id+(node.type==='SaveImage'?'/output.png':'/output.mp4')};}
      const downloads=JSON.parse(await readFile(path.join(ROOT,'workflows','models.json'),'utf8'));
      return json(res,200,{id:job.id,previews,name:'Saved take · '+job.id.slice(0,8),explanation:explainPlan({context:job.request.kind==='image'?'images':job.request.kind==='video-tool'?'video-tools':'create',request:job.request}),execution:'local',status:'Exact saved graph · input filenames belong to its original engine',requirements:'Download the original API prompt too. Upload source files in your own ComfyUI and reselect Load Image inputs. Local processor records cannot be converted.',graph,...modelDependencies(graph,downloads),apiUrl:'/outputs/'+job.id+'/workflow.json'});
    }
    if(route==='/api/batches'&&req.method==='GET')return json(res,200,batchQueue.list());
    if(route==='/api/batches'&&req.method==='POST'){
      const input=await readJson(req);if(!Array.isArray(input.requests)||input.requests.length<1||input.requests.length>4)throw new Error('Choose 1–4 shots for this batch.');
      const requests=input.requests.map(r=>{if(openOnly)assertOpenInput(r.kind==='image'?'images':'create',r);return {...(r.kind==='image'?normalizeImage(r):normalizeRequest(r)),...(openOnly?{openWeightsOnly:true}:{})};});
      for(const request of requests){for(const key of ['asset','endAsset','reference','mask'])if(request[key])await stat(path.join(DATA,'assets',request[key]));}
      return json(res,201,await batchQueue.add(requests,input.requestId));
    }
    const batchStop=route.match(/^\/api\/batches\/([a-f0-9-]{36})\/stop$/);
    if(batchStop&&req.method==='POST')return json(res,200,await batchQueue.stop(batchStop[1]));
    if(route==='/api/library'&&req.method==='GET')return json(res,200,library.list());
    if(route==='/api/image-library'&&req.method==='GET')return json(res,200,imageLibrary.list());
    const imageCollection=route.match(/^\/api\/image-library\/(boards|characters)$/);
    if(imageCollection&&req.method==='POST'){
      const input=await readJson(req);if(!Array.isArray(input.cards)||input.cards.length>16)throw new Error('Choose up to 16 cards.');
      for(const card of input.cards){if(!assetName(card.asset))throw new Error('Choose valid reference images.');await stat(path.join(DATA,'assets',card.asset));}
      return json(res,201,await imageLibrary.save(imageCollection[1],input));
    }
    if(route==='/api/plans'&&req.method==='POST')return json(res,201,await library.addPlan(await readJson(req)));
    const briefMatch=route.match(/^\/api\/plans\/([a-f0-9-]{36})\/briefs\/([a-f0-9-]{36})$/);
    if(briefMatch&&req.method==='PATCH')return json(res,200,await library.editBrief(briefMatch[1],briefMatch[2],await readJson(req)));
    if(route==='/api/references'&&req.method==='POST'){
      const input=await readJson(req);if(!Array.isArray(input.assets)||input.assets.length>8||!input.assets.every(assetName))throw new Error('Choose valid uploaded references.');
      for(const asset of input.assets)await stat(path.join(DATA,'assets',asset));
      return json(res,201,await library.addReference(input));
    }
    if(route==='/api/recipes'&&req.method==='POST'){
      const input=await readJson(req),job=jobs.get(input.jobId);if(!job?.report?.technicalPass||!job.video)throw new Error('Save a recipe from a take with passing media checks.');
      return json(res,201,await library.addRecipe({name:input.name,request:job.request,evidenceJobId:job.id}));
    }
    if(route==='/api/short-film-breakdown'&&req.method==='POST')return json(res,200,breakDownScript((await readJson(req,100000)).script));
    if(route==='/api/short-films'&&req.method==='GET')return json(res,200,projects.list().map(p=>({...p,story:storyPlan(p),workflow:shortFilmStatus(p,jobs)})));
    if(route==='/api/short-films/demo'&&req.method==='POST'){const source=projects.list().find(p=>p.id==='9c6034e5-2465-4576-b1b9-5770a40a974b');if(!source)throw Error('The existing demonstration source is unavailable. Choose saved clips in a new film.');return json(res,201,await projects.createShortDemo(source.id));}
    const storyRoute=route.match(/^\/api\/short-films\/([a-f0-9-]{36})(?:\/(timeline|packet))?$/);
    if(storyRoute){
      const [,id,action]=storyRoute,p=projects.list().find(p=>p.id===id);if(!p)throw Error('Project not found.');
      if(req.method==='GET'&&!action)return json(res,200,{...p,story:storyPlan(p),workflow:shortFilmStatus(p,jobs)});
      if(req.method==='GET'&&action==='packet'){res.setHeader('Content-Disposition','attachment; filename="short-film-project.json"');return json(res,200,{schema:1,project:p,workflow:shortFilmStatus(p,jobs),sources:storyPlan(p).frames.map(f=>({frame:f.id,image:f.imageJobId?{id:f.imageJobId,sha256:jobs.get(f.imageJobId)?.report?.sha256}:null,clip:f.takeJobId?{id:f.takeJobId,sha256:jobs.get(f.takeJobId)?.report?.sha256}:null})),note:'Project metadata only; media stays in this local studio and its recovery backup.'});}
      if(req.method==='PUT'&&!action){const input=await readJson(req,100000),plan=normalizeShortFilm(input.story);for(const f of plan.frames)for(const [key,type] of [['imageJobId','image'],['takeJobId','video']])if(f[key]){const j=jobs.get(f[key]);if(!j?.[type]||!j.report?.technicalPass||j.review?.verdict==='rejected')throw Error('Choose checked, unrejected storyboard media.');}const saved=await projects.saveStory(id,plan,input.signature);return json(res,200,{...saved,workflow:shortFilmStatus(saved,jobs)});}
      if(req.method==='POST'&&action==='timeline'){const input=await readJson(req);for(const f of p.story?.frames??[])for(const key of ['imageJobId','takeJobId'])if(f[key]){const j=jobs.get(f[key]);if(!j||await fileDigest(path.join(jobDir(j.id),j.image??j.video))!==j.report?.sha256)throw Error('Selected media changed; recheck it before building the timeline.');}const saved=await projects.assembleStory(id,input.signature,jobs);return json(res,200,{...saved,workflow:shortFilmStatus(saved,jobs)});}
    }
    if(route==='/api/projects'&&req.method==='GET')return json(res,200,projects.list().map(p=>({...p,compositionSignature:filmSignature(p)})));
    if(route==='/api/projects'&&req.method==='POST')return json(res,201,await projects.create(await readJson(req)));
    const composition=route.match(/^\/api\/projects\/([a-f0-9-]{36})\/composition$/);
    if(composition&&req.method==='PUT'){
      const input=await readJson(req,100000),shots=normalizeFilmShots(input.shots),film=normalizeFilm(input.film);if(openOnly&&film.tracks.some(t=>t.type==='narration'))throw policyError('use an existing WAV or Kokoro narration; Windows narration is disabled.');
      for(const shot of shots){const job=jobs.get(shot.jobId);if(!job?.video||!job.report?.technicalPass)throw new Error('Choose checked video takes.');normalizeEdit(shot,job.report.duration);}
      for(const overlay of film.overlays)await stat(path.join(DATA,'assets',overlay.asset));for(const track of film.tracks)if(track.type==='wav')await stat(path.join(DATA,'audio',track.audio+'.wav'));
      const saved=await projects.compose(composition[1],{shots,film},input.signature);return json(res,200,{...saved,compositionSignature:filmSignature(saved)});
    }
    const filmMatch=route.match(/^\/api\/projects\/([a-f0-9-]{36})\/export$/);
    if(filmMatch&&req.method==='GET'){const requestId=url.searchParams.get('requestId'),entry=await filmJournal.get(filmMatch[1],requestId);if(!entry)return json(res,404,{error:'No saved export request.'});return json(res,200,{...entry,status:entry.status==='processing'&&!filmExports.has(filmMatch[1])?'needs-attention':entry.status});}
    if(filmMatch&&req.method==='POST'){
      const id=filmMatch[1],project=projects.list().find(p=>p.id===id);
      if(!project)throw new Error('Project not found.');
      if(openOnly&&normalizeFilm(project.film).tracks.some(t=>t.type==='narration'))throw policyError('use an existing WAV or Kokoro narration; Windows narration is disabled.');
      const input=await readJson(req),requestId=input.requestId??randomUUID(),release=input.release??'draft';if(!/^[a-f0-9-]{36}$/.test(requestId))throw new Error('Invalid export request ID.');
      if(!['draft','reviewed-sources'].includes(release))throw Error('Choose a draft or an export with reviewed sources.');
      if(release==='reviewed-sources'&&(!shortFilmStatus(project,jobs).reviewed||!shortFilmStatus(project,jobs).timeline))throw Error('Manually approve every chosen image and clip before exporting with reviewed sources.');
      if(project.lastExport?.requestId===requestId){if((project.lastExport.release??'draft')!==release)throw Error('This export request already has a different review setting.');return json(res,200,project);}
      const previousRequest=await filmJournal.get(id,requestId);
      if(previousRequest){if(previousRequest.signature!==filmSignature(project)||previousRequest.release!==release)throw Error('Saved export request belongs to different film edits or review settings.');if(previousRequest.status==='complete')return json(res,200,await projects.saveExport(id,previousRequest.result));throw Error('This export was already started. Inspect its saved recovery record before deliberately creating a new request; no duplicate export was started.');}
      if(filmExports.has(id))return json(res,409,{error:'This project is already exporting.'});
      if(!project.shots.length||project.shots.length>20)throw new Error('Choose 1–20 shots for a draft export.');
      const shots=project.shots.map(shot=>{const job=jobs.get(shot.jobId);if(!job?.video||!job.report?.technicalPass)throw new Error('Every shot needs a saved video with passing checks.');return {jobId:job.id,path:path.join(jobDir(job.id),job.video),sha256:job.report.sha256,...normalizeEdit(shot,job.report.duration),...shotAudio(shot)};});
      filmExports.add(id);
      try{
        await filmJournal.begin(id,requestId,filmSignature(project),release);
        const exportId=randomUUID(),directory=path.join(DATA,'films',id,exportId);await mkdir(directory,{recursive:true});await filmJournal.finish(id,requestId,{directory:exportId});
        const film=normalizeFilm(project.film);for(const layer of film.overlays)layer.path=path.join(DATA,'assets',layer.asset);for(const track of film.tracks)if(track.type==='wav')track.path=path.join(DATA,'audio',track.audio+'.wav');
        const manifest=path.join(directory,'sources.json');await writeFile(manifest,JSON.stringify({shots,film}));
        await runPython('render-film.py',[manifest,path.join(directory,'movie.mp4')],600000);
        const assembly=JSON.parse(await readFile(path.join(directory,'assembly.json'),'utf8'));
        await writeFile(path.join(directory,'expected.json'),JSON.stringify(assembly));
        await runPython('verify-video-tool.py',[directory,'--file','movie.mp4']);
        const report=JSON.parse(await readFile(path.join(directory,'report.json'),'utf8'));
        if(!report.technicalPass)throw new Error('The export failed media checks. The previous export is retained.');
        const result={id:exportId,requestId,release,at:new Date().toISOString(),url:`/films/${id}/${exportId}/movie.mp4`,reportUrl:`/films/${id}/${exportId}/report.json`,shotOrder:project.shots.map(s=>s.id),editSignature:editSignature(project.shots),compositionSignature:filmSignature(project),report,assembly};
        await filmJournal.finish(id,requestId,{status:'complete',result});return json(res,201,await projects.saveExport(id,result));
      }catch(error){const entry=await filmJournal.get(id,requestId);if(entry&&entry.status!=='complete')await filmJournal.finish(id,requestId,{status:'failed',error:error.message});throw error;}finally{filmExports.delete(id);}
    }
    const projectMatch=route.match(/^\/api\/projects\/([a-f0-9-]{36})(?:\/(shots|order)(?:\/([a-f0-9-]{36}))?)?$/);
    if(projectMatch){
      const [,id,action,shotId]=projectMatch;
      if(req.method==='PATCH'&&!action)return json(res,200,await projects.update(id,await readJson(req)));
      if(req.method==='POST'&&action==='order')return json(res,200,await projects.reorder(id,(await readJson(req)).shotIds));
      if(req.method==='POST'&&action==='shots'&&!shotId){const input=await readJson(req),job=jobs.get(input.jobId);if(!job?.video||!job.report?.technicalPass)throw new Error('Choose a take with a saved video and passing technical checks.');return json(res,201,await projects.add(id,input));}
      if(req.method==='PATCH'&&action==='shots'&&shotId){const input=await readJson(req),shot=projects.list().find(p=>p.id===id)?.shots.find(s=>s.id===shotId),job=jobs.get(shot?.jobId);if(!shot||!job?.report?.duration)throw new Error('Shot source is unavailable.');normalizeEdit({...shot,...input},job.report.duration);return json(res,200,await projects.updateShot(id,shotId,input));}
    }
    if (route === '/api/assets' && req.method === 'POST') {
      const bytes = await readBody(req); const name = randomUUID() + '.' + imageExtension(bytes);
      const filename=path.join(DATA,'assets',name);await writeFile(filename,bytes);
      let dimensions;try{dimensions=await inspectImage(filename);if(JUDGE_MODE&&(dimensions.width*dimensions.height>1500000||Math.max(dimensions.width,dimensions.height)>2048))throw Error('Use an image up to 1.5 megapixels and 2048 pixels on its longest side in the shared demo.');}catch(error){await unlink(filename);throw error;}
      return json(res,201,{name,url:'/assets/'+name,...dimensions});
    }
    if (route === '/api/jobs' && req.method === 'POST') {
      const result=await submitJob({...await readJson(req),...(openOnly?{openWeightsOnly:true}:{})});return json(res,result.code,result.body);
    }
    const imageReuse=route.match(/^\/api\/jobs\/([a-f0-9-]{36})\/image-asset$/);
    if(imageReuse&&req.method==='POST'){
      const job=jobs.get(imageReuse[1]);if(!job?.image||!job.report?.technicalPass)throw new Error('Choose a checked image first.');
      if(!job.reusableAsset){job.reusableAsset=randomUUID()+'.png';await copyFile(path.join(jobDir(job.id),job.image),path.join(DATA,'assets',job.reusableAsset));await save(job);}
      return json(res,200,{name:job.reusableAsset,url:'/assets/'+job.reusableAsset});
    }
    const controlMatch=route.match(/^\/api\/jobs\/([a-f0-9-]{36})\/(cancel|retry)$/);
    if(controlMatch && req.method==='POST'){
      const job=jobs.get(controlMatch[1]);
      if(!job)return json(res,404,{error:'Shot not found.'});
      if(controlMatch[2]==='cancel'){
        if(['cancelled','cancelling'].includes(job.status))return json(res,200,job);
        if(['video-tool','image'].includes(job.request.kind)&&job.status==='processing'){job.status='cancelling';await save(job);processors.get(job.id)?.kill();await audit(job,'local-cancel-requested');return json(res,202,job);}
        if(!['submitted','running'].includes(job.status)||!job.promptId)return json(res,409,{error:'Only an acknowledged queued or running render can be cancelled.'});
        job.status='cancelling';job.cancelRequestedAt=new Date().toISOString();await save(job);
        try{await comfy.cancel(job.promptId);await audit(job,'cancel-requested');return json(res,202,job);}
        catch(e){job.status='needs-attention';job.error='Cancellation could not be confirmed: '+e.message;await save(job);return json(res,502,{error:job.error,job});}
      }
      if(!['cancelled','failed','technical-failed','verification-blocked'].includes(job.status))return json(res,409,{error:'Inspect this shot before retrying; only a confirmed stopped or failed render can be retried.'});
      const body=await readJson(req);
      if(body.requestId===job.requestId)throw new Error('A retry needs its own request ID.');
      const result=await submitJob({...job.request,quality:job.request.kind==='image'?(job.request.quality??'preview'):job.request.steps===12?'draft':'standard',requestId:body.requestId},job.id);
      return json(res,result.code,result.body);
    }
    const reviewMatch=route.match(/^\/api\/jobs\/([a-f0-9-]{36})\/review$/);
    if(reviewMatch && req.method==='POST') {
      const job=jobs.get(reviewMatch[1]); const body=await readJson(req);
      if(!job || !['review-ready','technical-failed'].includes(job.status)) throw new Error('This shot is not ready for review.');
      if(!['approved','rejected'].includes(body.verdict)) throw new Error('Choose approved or rejected.');
      if(body.verdict==='approved' && !job.report?.technicalPass) throw new Error('Technical checks must pass before approval.');
      job.review={verdict:body.verdict,notes:String(body.notes??'').slice(0,2000),at:new Date().toISOString(),sha256:job.report?.sha256};
      await save(job); await audit(job,'creative-review'); return json(res,200,job);
    }
    const assetMatch=route.match(/^\/assets\/([a-f0-9-]{36}\.(png|jpg|webp))$/);
    const footageFile=route.match(/^\/footage\/([a-f0-9-]{36})\/(source\.(mp4|webm)|poster\.jpg)$/);
    if(footageFile&&req.method==='GET')return await serveFile(req,res,path.join(DATA,'footage',footageFile[1],footageFile[2]));
    const audioFile=route.match(/^\/audio\/([a-f0-9-]{36})\.wav$/);if(audioFile&&req.method==='GET')return await serveFile(req,res,path.join(DATA,'audio',audioFile[1]+'.wav'));
    const movieMatch=route.match(/^\/films\/([a-f0-9-]{36})\/([a-f0-9-]{36})\/(movie\.mp4|report\.json|poster\.jpg|contact-sheet\.jpg|subtitles\.srt)$/);
    if(movieMatch&&req.method==='GET')return await serveFile(req,res,path.join(DATA,'films',movieMatch[1],movieMatch[2],movieMatch[3]));
    if(assetMatch && req.method==='GET') return await serveFile(req,res,path.join(DATA,'assets',assetMatch[1]));
    const outputMatch=route.match(/^\/outputs\/([a-f0-9-]{36})\/(output\.(mp4|webm|png)|raw\.(png|mp4)|ungraded\.mp4|finish\.json|contact-sheet\.jpg|poster\.jpg|report\.json|workflow\.json|preserved\.mkv|tracking\.json|selection\.json|reframing\.json|extension\.json|outpainting\.json|selection-preview\.jpg|mask\.mp4|segmentation\.json|human-pose\.json|style\.json)$/);
    if(outputMatch && req.method==='GET') return await serveFile(req,res,path.join(jobDir(outputMatch[1]),outputMatch[2]));
    const publicFiles={'/explore':'explore.html','/explore.js':'explore.js','/explore.css':'explore.css','/explore-recipes.js':'explore-recipes.js','/showcase.js':'showcase.js','/studio-theme.css':'studio-theme.css','/home':'home.html','/create':'index.html','/home.js':'home.js','/home.css':'home.css','/workspace.css':'workspace.css','/workspace.js':'workspace.js','/studio-journeys.js':'studio-journeys.js','/studio-map.js':'studio-map.js','/studio-match.js':'studio-match.js','/checklist':'checklist.html','/checklist.js':'checklist.js','/checklist.css':'checklist.css','/dialogue-form.js':'dialogue-form.js','/dialogue-expressive-form.js':'dialogue-expressive-form.js','/caption-form.js':'caption-form.js','/sounds.js':'sounds.js','/audio':'audio.html','/audio.js':'audio.js','/lip-holds.js':'lip-holds.js','/body-pose.js':'body-pose.js','/audio.css':'audio.css','/continuity':'continuity.html','/continuity.js':'continuity.js','/continuity.css':'continuity.css','/film':'film.html','/film.js':'film.js','/film.css':'film.css','/':'home.html','/video-tools':'video-tools.html','/video-tools.js':'video-tools.js','/video-tools.css':'video-tools.css','/images':'images.html','/images.js':'images.js','/images.css':'images.css','/app.js':'app.js','/library.js':'library.js','/queue.js':'queue.js','/style.css':'style.css','/sample.jpg':'sample.jpg','/text-frame.svg':'text-frame.svg'};
    Object.assign(publicFiles,{'/director':'director.html','/director.js':'director.js','/director.css':'director.css','/view-options.js':'view-options.js','/style-board.js':'style-board.js'});
    Object.assign(publicFiles,{'/short-film':'short-film.html','/short-film.js':'short-film.js','/short-film.css':'short-film.css','/video-playback.js':'video-playback.js'});
    Object.assign(publicFiles,{'/workflows':'workflows.html','/workflows.js':'workflows.js','/workflows.css':'workflows.css','/workflow-graph.js':'workflow-graph.js','/provider-workflows.js':'provider-workflows.js','/provider-workflows.css':'provider-workflows.css'});
    Object.assign(publicFiles,{'/library':'saved-library.html','/saved-library.js':'saved-library.js','/saved-library-page.js':'saved-library-page.js','/saved-library.css':'saved-library.css','/workflow-help.js':'workflow-help.js'});
    Object.assign(publicFiles,{'/online':'online.html','/online.js':'online.js','/online.css':'online.css','/online-handoff.js':'online-handoff.js','/setup':'setup.html','/setup.js':'setup.js','/setup-prompt.js':'setup-prompt.js','/setup.css':'setup.css','/assistant.js':'assistant.js','/assistant-connection.js':'assistant-connection.js','/assistant.css':'assistant.css','/workspace-art.css':'workspace-art.css'});
    Object.assign(publicFiles,{'/execution-policy.js':'execution-policy.js','/execution-policy.css':'execution-policy.css','/mcp-app':'mcp-app.html','/mcp-app.js':'mcp-app.js','/mcp-app.css':'mcp-app.css'});
    Object.assign(publicFiles,{'/workflow-panel.js':'workflow-panel.js','/workflow-panel.css':'workflow-panel.css'});
    for(const name of ['compass','moon','character','knight','robot','bicycle'])publicFiles['/explore-art/'+name+'.svg']='explore-art/'+name+'.svg';
    for(const name of ['observatory-preview','portrait-preview','product-preview'])publicFiles['/explore-art/'+name+'.jpg']='explore-art/'+name+'.jpg';
    for(const name of ['observatory-concept','portrait-concept','product-concept'])publicFiles['/explore-art/'+name+'.png']='explore-art/'+name+'.png';
    for(const name of ['mcp-observatory','mcp-portrait','mcp-product'])publicFiles['/explore-art/'+name+'.png']='explore-art/'+name+'.png';
    for(const name of ['canvas-state.js','sam-selection.js','image-canvas.js','tool-picker.js','studio-tools.css','my-work.js','my-work.css','studio-interactions.js'])publicFiles['/'+name]=name;
    publicFiles['/video-project.js']='video-project.js';publicFiles['/studio-recipes.js']='studio-recipes.js';publicFiles['/workflow-outcomes.js']='workflow-outcomes.js';
    publicFiles['/explore-art/observatory-motion.mp4']='explore-art/observatory-motion.mp4';
    if(route==='/mcp-app'&&req.method==='GET')return await serveFile(req,res,path.join(ROOT,'public','mcp-app.html'));
    if(publicFiles[route] && req.method==='GET') {
      if(route==='/explore'){const params=new URLSearchParams(url.search),recipes=params.get('collection')==='recipes';params.delete('collection');if(recipes)params.set('collection','workflows');res.writeHead(302,{Location:(recipes?'/library':'/')+(params.size?'?'+params:'')+(recipes?'#workflow-cards':'#inspiration'),'Cache-Control':'no-store'});res.end();return;}
      const legacyImage=route==='/'&&url.searchParams.has('image'),mergedWorkflows=route==='/library'&&url.searchParams.get('collection')!=='saved',file=legacyImage?'index.html':mergedWorkflows?'workflows.html':publicFiles[route];
      if(file.endsWith('.html')){const page=legacyImage?'create':mergedWorkflows?'workflows':route==='/'||route==='/home'?'home':route.slice(1),raw=await readFile(path.join(ROOT,'public',file),'utf8');const html=route==='/workflows'&&url.searchParams.get('embedded')==='1'?raw.replace('<body>','<body class="embedded">'):renderWorkspacePage(raw,page,url.href,(req.headers.cookie??'').split(';').map(v=>v.trim()).find(v=>v.startsWith('frameforge_navigation='))?.split('=')[1],openOnly);res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});return res.end(html);}
      return await serveFile(req,res,path.join(ROOT,'public',file));
    }
    json(res,404,{error:'Not found.'});
  } catch(e) { if(!res.headersSent) json(res,e.statusCode??(e.code==='ENOENT'?404:400),{error:e.message}); else res.destroy(); }
});
server.listen(PORT,'127.0.0.1',()=>console.log(`Frameforge studio: http://127.0.0.1:${server.address().port}`));
