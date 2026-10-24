import {readFile,writeFile} from 'node:fs/promises';import {createReadStream} from 'node:fs';import {createHash} from 'node:crypto';import path from 'node:path';import {fileURLToPath} from 'node:url';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url))),directory=path.join(root,'evidence/audio'),base=process.env.STUDIO_URL??'http://127.0.0.1:4317';
const report={at:new Date().toISOString(),checks:[],expectedFailures:[],creativeAcceptance:'Separate; lip/tooth quality and broad transcription/translation accuracy require review.'};
async function get(route){const response=await fetch(base+route,{signal:AbortSignal.timeout(60000)});if(!response.ok)throw new Error('Unavailable evidence: '+route);return response;}
const sha=data=>createHash('sha256').update(data).digest('hex');async function fileHash(file){const hash=createHash('sha256');for await(const bytes of createReadStream(file))hash.update(bytes);return hash.digest('hex');}
const normalized=text=>text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
try{
 const state=JSON.parse(await readFile(path.join(directory,'state.json'),'utf8')),jobs=await(await get('/api/audio-jobs')).json(),catalog=await(await get('/api/audio-catalog')).json();if(!catalog.ready)throw new Error('Audio models unavailable.');
 const entries=Object.entries(state).filter(([,value])=>value?.job?.id),models=new Map();if(entries.length!==10)throw new Error('Expected ten retained audio-stage attempts, got '+entries.length);
 for(const [name,entry] of entries){const job=jobs.find(j=>j.id===entry.job.id);if(!job)throw new Error('Missing saved job: '+name);
   if(['spanishDub','videoDub'].includes(name)){if(job.status!=='failed')throw new Error('Initial failed example was replaced: '+name);report.expectedFailures.push({name,jobId:job.id,error:job.error});continue;}
   if(!job.report?.technicalPass)throw new Error('Technical checks need attention: '+name);
   for(const [file,expected] of Object.entries(job.report.files)){const bytes=Buffer.from(await(await get(`/audio-jobs/${job.id}/${file}`)).arrayBuffer());if(sha(bytes)!==expected)throw new Error('Changed served artifact: '+job.id+'/'+file);}
   const manifest=JSON.parse(await readFile(path.join(root,'data/audio-jobs',job.id,'manifest.json'),'utf8'));if(manifest.source&&await fileHash(manifest.source.path)!==job.report.sourceSha256)throw new Error('Changed original input');for(const [file,hash] of Object.entries(job.report.models))models.set(file,hash);
   report.checks.push({name,jobId:job.id,technicalPass:true,files:job.report.files,media:job.report.media,review:job.review??null});
 }
 const transcript=async key=>(await(await get(`/audio-jobs/${state[key].job.id}/transcript.json`)).json()).text;
 if(normalized(await transcript('transcript'))!==normalized(state.english.request.text))throw new Error('English known-script transcription mismatch');
 if(normalized(await transcript('spanishRoundTrip'))!==normalized(await transcript('spanishDubV2')))throw new Error('Spanish speech round-trip mismatch');
 if(normalized(await transcript('videoTranscript'))!==normalized(state.english.request.text))throw new Error('Video speech transcription mismatch');
 for(const [file,expected] of models)if(await fileHash(path.join(root,'runtime/audio-models',file))!==expected)throw new Error('Changed model artifact: '+file);
 report.knownScriptChecks={english:'all five words match after punctuation/case normalization',spanish:'all translated words match after punctuation/case normalization',video:'all five original words match'};report.verifiedModels=models.size;report.status='technical-pass';
}catch(error){report.status='needs-attention';report.error=error.message;process.exitCode=1;}
await writeFile(path.join(directory,'latest-verification.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({status:report.status,checkedJobs:report.checks.length,retainedFailures:report.expectedFailures.length,verifiedModels:report.verifiedModels,error:report.error,creativeAcceptance:report.creativeAcceptance},null,2));
