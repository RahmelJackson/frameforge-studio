import {readFile,writeFile,readdir,copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url))),dir=path.join(root,'evidence/round12'),results=[];
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
for(const name of (await readdir(dir)).filter(n=>n.endsWith('-result.json')).sort()){
 const saved=JSON.parse(await readFile(path.join(dir,name),'utf8')),job=saved.job;if(!job?.id)continue;
 const audio=['expressive','dialogue','transcribe'].includes(job.request.tool)&&!job.request.kind,folder=path.join(root,'data',audio?'audio-jobs':'jobs',job.id),script=audio?'verify-audio.py':job.request.kind==='image'?'verify-image.py':'verify-video-tool.py',python=audio?'audio-env':'engine-env';
 const original=JSON.parse(await readFile(path.join(folder,'report.json'),'utf8')),files=audio?original.files:{[job.image??job.video]:original.sha256};
 for(const [file,expected] of Object.entries(files))if(sha(await readFile(path.join(folder,file)))!==expected)throw Error('Changed saved output: '+job.id+'/'+file);
 try{await copyFile(path.join(folder,'report.json'),path.join(dir,name.replace('-result.json','-initial-report.json')),1);}catch(e){if(e.code!=='EEXIST')throw e;}
 const args=[path.join(root,'scripts',script),folder,...(job.request.kind==='image'?[path.join(root,'data/assets')]:[])],run=spawnSync(path.join(root,'runtime',python,'Scripts/python.exe'),['-X','utf8',...args],{encoding:'utf8',windowsHide:true,timeout:120000});
 if(run.status!==0)throw Error(name+': '+run.stderr.slice(-1500));const report=JSON.parse(await readFile(path.join(folder,'report.json'),'utf8'));if(!report.technicalPass)throw Error('Saved artifact checks failed: '+name);
 results.push({case:name.replace('-result.json',''),jobId:job.id,requestId:job.requestId,promptId:job.promptId??null,technicalPass:true,creativeReview:job.review?.verdict??'pending',reportSha256:sha(await readFile(path.join(folder,'report.json')))});
}
await writeFile(path.join(dir,'saved-verification.json'),JSON.stringify({at:new Date().toISOString(),rendersSubmitted:0,results},null,2));console.log(JSON.stringify({savedJobs:results.length,technicalPass:results.every(r=>r.technicalPass),rendersSubmitted:0}));
