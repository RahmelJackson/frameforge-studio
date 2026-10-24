import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url))),directory=path.join(root,'evidence'),base=process.env.STUDIO_URL??'http://127.0.0.1:4317';
const flags=new Set(process.argv.slice(2)),report={at:new Date().toISOString(),gates:[],results:[],creativeReview:'separate; no automatic approval'};
await mkdir(directory,{recursive:true});
async function get(route){const response=await fetch(base+route,{signal:AbortSignal.timeout(60000)});if(!response.ok)throw new Error('Studio request failed: '+route);return response;}
try{
  if(flags.has('--render'))throw new Error('This acceptance check is read-only. Render deliberately in the video workbench, then record its acknowledged job ID in evidence/video-state.json.');
  const health=await (await get('/api/health')).json();
  for(const name of ['upscale','temporal']){const value=health.videoTools?.[name];report.gates.push({name:name+' readiness',pass:!!value?.ready,details:value});}
  if(report.gates.some(g=>!g.pass))throw new Error('A video model or native node is unavailable.');
  let state;try{state=JSON.parse(await readFile(path.join(directory,'video-state.json'),'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
  if(flags.has('--resume')&&!state)throw new Error('No saved acceptance suite exists. No replacement jobs were submitted.');
  if(state){
    if(!Array.isArray(state.cases)||!state.cases.length)throw new Error('The saved acceptance suite is empty.');
    const jobs=await (await get('/api/jobs')).json();
    for(const saved of state.cases){
      const job=jobs.find(j=>j.id===saved.jobId);
      if(!job||job.request.kind!=='video-tool'||job.request.tool!==saved.tool)throw new Error('Saved case is missing or changed: '+saved.jobId);
      if(!job.report?.technicalPass||!job.video)throw new Error('Saved case is not technically ready: '+job.id+' ('+job.status+'). Inspect the original job; this check never retries.');
      const checksum=createHash('sha256').update(Buffer.from(await (await get(`/outputs/${job.id}/${job.video}`)).arrayBuffer())).digest('hex');
      const pass=checksum===job.report.sha256;
      report.gates.push({name:saved.tool+' saved MP4 checksum',jobId:job.id,pass});
      report.results.push({...saved,sha256:checksum,checks:job.report.checks,size:job.report.size,frames:job.report.frames,fps:job.report.fps,duration:job.report.duration,audio:job.report.audio??null,sourceSha256:job.report.sourceSha256,provenance:job.report.provenance??{},warnings:job.report.warnings,review:job.review??null});
      if(!pass)throw new Error('Served output differs from its verification evidence: '+job.id);
    }
  }
  report.status=state?'technical-pass':'readiness-pass';
}catch(error){report.status='needs-attention';report.error=error.message;process.exitCode=1;}
await writeFile(path.join(directory,'video-latest-run.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
