import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url))),directory=path.join(root,'evidence/stage3'),base=process.env.STUDIO_URL??'http://127.0.0.1:4317';
const report={at:new Date().toISOString(),checks:[],creativeAcceptance:'partial; see STAGE3-WORKFLOWS.md'};
const digest=data=>createHash('sha256').update(data).digest('hex');
async function get(route){const response=await fetch(base+route,{signal:AbortSignal.timeout(60000)});if(!response.ok)throw new Error('Unavailable evidence: '+route);return response;}
const seen=new Set();async function verifyHash(route,expected){if(seen.has(route))return;const actual=digest(Buffer.from(await(await get(route)).arrayBuffer()));if(actual!==expected)throw new Error('Changed artifact: '+route);seen.add(route);}
try{
  const state=JSON.parse(await readFile(path.join(directory,'state.json'),'utf8')),jobs=await(await get('/api/jobs')).json(),batches=await(await get('/api/batches')).json();
  const ids=new Set();for(const item of Object.values(state)){const id=item?.job?.id??item?.response?.id;if(id&&jobs.some(j=>j.id===id))ids.add(id);const batchId=item?.run?.batchId??item?.response?.batchId;if(batchId)for(const take of batches.find(b=>b.id===batchId)?.items??[])if(take.jobId)ids.add(take.jobId);}
  if(ids.size!==10)throw new Error('Expected ten saved bounded image/video evidence jobs, found '+ids.size);
  for(const id of ids){const job=jobs.find(j=>j.id===id);if(!job?.report?.technicalPass)throw new Error('Technical checks did not pass: '+id);await verifyHash(`/outputs/${id}/${job.image??job.video}`,job.report.sha256);
    for(const value of Object.values(job.report.provenance??{}))if(value?.name)await verifyHash('/assets/'+value.name,value.sha256);
    for(const [name,sha] of Object.entries(job.request.continuity?.provenance??{}))await verifyHash('/assets/'+name,sha);
    if(job.report.preservation){await verifyHash(`/outputs/${id}/preserved.mkv`,job.report.preservation.losslessSha256);const manifest=JSON.parse(await readFile(path.join(root,'data/jobs',id,'manifest.json'),'utf8'));if(digest(await readFile(manifest.source.path))!==job.report.sourceSha256)throw new Error('Changed original footage');const track=JSON.parse(await readFile(path.join(root,'data/jobs',id,'tracking.json'),'utf8'));for(let i=0;i<track.maskSha256.length;i++)if(digest(await readFile(path.join(root,'data/jobs',id,'masks',String(i).padStart(4,'0')+'.png')))!==track.maskSha256[i])throw new Error('Changed mask frame '+i);}
    report.checks.push({jobId:id,technicalPass:true,sha256:job.report.sha256,vision:job.report.vision??null,preservation:job.report.preservation??null,tracking:job.report.tracking??null,creativeReview:job.review??null});
  }
  const finalBatch=batches.find(b=>b.id===state.finalGuide.response.batchId),final=jobs.find(j=>j.id===finalBatch.items[0].jobId),comparisonBatch=batches.find(b=>b.id===state.twoReferenceGuide.run.batchId),comparison=jobs.find(j=>j.id===comparisonBatch.items[0].jobId);
  if(final.report.sha256!==comparison.report.sha256)throw new Error('Guide-mode adapter changed the tested graph result');
  report.guideAdapter={matchesTestedTwoReferenceResult:true,sha256:final.report.sha256};report.status='technical-pass';report.verifiedArtifacts=seen.size;
}catch(error){report.status='needs-attention';report.error=error.message;process.exitCode=1;}
await writeFile(path.join(directory,'latest-verification.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({status:report.status,jobs:report.checks.length,verifiedArtifacts:report.verifiedArtifacts,error:report.error,creativeAcceptance:report.creativeAcceptance},null,2));
