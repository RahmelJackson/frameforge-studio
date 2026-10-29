import {configuredModelRoot} from './workspace-paths.mjs';
import path from 'node:path';
import {readFile,writeFile,mkdir,readdir,stat,copyFile,rename} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {normalizeCues,transcriptCues} from './captions.mjs';
export const VOICES=[['af_heart','Heart · US English','en'],['am_michael','Michael · US English','en'],['bf_emma','Emma · British English','en'],['ef_dora','Dora · Spanish','es'],['em_alex','Alex · Spanish','es']].map(([id,name,language])=>({id,name,language}));
const uuid=v=>typeof v==='string'&&/^[a-f0-9-]{36}$/.test(v);
export function normalizeAudio(input){
  const tool=input.tool;if(!['speech','expressive','convert','dialogue','caption','transcribe','dub','lipsync','separate'].includes(tool))throw new Error('Choose an audio workflow.');
  if(!uuid(input.requestId))throw new Error('A valid request ID is required.');
  const source=value=>{if(!value||!['take','footage','audio','speech'].includes(value.kind)||!uuid(value.id))throw new Error('Choose a saved source.');return {kind:value.kind,id:value.id};};
  const language=input.language??'en',voice=input.voice??(language==='es'?'ef_dora':'af_heart'),speed=Number(input.speed??1),text=String(input.text??'').trim(),seed=Number(input.seed??202610190);
  if(!['en','es'].includes(language)||!VOICES.some(v=>v.id===voice&&v.language===language))throw new Error('Choose an installed voice in the target language.');
  if(!Number.isFinite(speed)||speed<.7||speed>1.3||!Number.isSafeInteger(seed)||seed<0||seed>2**32-1)throw new Error('Choose valid speech speed and seed.');
  if(tool==='speech'&&(!text||text.length>2000))throw new Error('Enter 1–2000 characters of speech.');
  if(!['auto','en','es'].includes(input.sourceLanguage??'auto'))throw new Error('Choose auto, English or Spanish transcription.');
  const r={tool,language,voice,speed,text,seed,sourceLanguage:input.sourceLanguage??'auto',loopVideo:input.loopVideo===true,lipSync:input.lipSync===true};
  if(tool==='transcribe'){r.asrModel=input.asrModel??'small';if(!['small','turbo'].includes(r.asrModel))throw Error('Choose a local transcription model.');}
  if(tool==='expressive'||tool==='dialogue'){
    const speechEngine=input.speechEngine??'original';if(!['original','turbo'].includes(speechEngine))throw Error('Choose an installed expressive speech engine.');
    if(speechEngine==='turbo'&&(language!=='en'||tool==='dialogue'&&input.dialogueEngine!=='expressive'))throw Error('Turbo requires English expressive speech or expressive dialogue.');
    r.speechEngine=speechEngine;
    const script=tool==='dialogue'?(input.lines??[]).map(l=>l.text??'').join(' '):text,tags=[...script.matchAll(/\[([^\]]+)\]/g)].map(x=>x[1]);
    if(speechEngine==='turbo'&&tool==='expressive'&&!script.replace(/\[[^\]]+\]/g,'').trim())throw Error('Include spoken words as well as event tags.');
    if(tags.length&&(speechEngine!=='turbo'||tags.some(t=>!['laugh','chuckle','cough','sigh','gasp','groan','sniff','shush','clear throat'].includes(t))))throw Error('Use supported event tags with Turbo speech only.');
  }
  if(tool==='lipsync'||tool==='dub'){
    r.lipStability=input.lipStability??'stable';if(!['stable','original'].includes(r.lipStability))throw new Error('Choose a lip-sync stability mode.');
  }
  if(tool==='lipsync'){
    r.lipEngine=input.lipEngine??'musetalk';if(!['musetalk','latentsync'].includes(r.lipEngine))throw new Error('Choose an installed lip-sync method.');
    const holds=input.lipHolds??[];
    if(!Array.isArray(holds)||holds.length>8||holds.some(h=>!h||!Number.isFinite(h.start)||!Number.isFinite(h.end)||h.start<0||h.end>8||h.end-h.start<.039))throw new Error('Use up to eight covered-mouth ranges of at least 0.04 seconds.');
    r.lipHolds=holds.map(h=>({start:h.start,end:h.end})).sort((a,b)=>a.start-b.start);
    if(r.lipHolds.some((h,i)=>i&&h.start<r.lipHolds[i-1].end))throw new Error('Covered-mouth ranges must not overlap.');
  }
  if(['expressive','convert'].includes(tool)){
    if(language!=='en')throw new Error('The expressive/conversion preview is currently English only.');
    if(tool==='expressive'&&(!text||text.length>350))throw new Error('Write 1-350 characters for expressive speech.');
    if(tool==='convert')r.source=source(input.source);
    if(tool==='convert'||input.targetVoice)r.targetVoice=source(input.targetVoice);
    r.exaggeration=Number(input.exaggeration??.5);r.cfgWeight=Number(input.cfgWeight??.5);
    if(!Number.isFinite(r.exaggeration)||r.exaggeration<0||r.exaggeration>1.5||!Number.isFinite(r.cfgWeight)||r.cfgWeight<0||r.cfgWeight>1)throw new Error('Choose valid expressiveness and pacing guidance.');
  }
  if(tool==='dialogue'){
    const speakers=input.speakers,lines=input.lines;
    r.dialogueEngine=input.dialogueEngine??'preset';if(!['preset','expressive'].includes(r.dialogueEngine))throw new Error('Choose a dialogue engine.');
    const expressive=r.dialogueEngine==='expressive';
    if(!Array.isArray(speakers)||!speakers.length||speakers.length>4||speakers.some(s=>!s||typeof s.id!=='string'||!/^[-a-z0-9_]{1,36}$/i.test(s.id)||typeof s.name!=='string'||!s.name.trim()||s.name.length>40||/[<>\u0000-\u001f]/.test(s.name)||!VOICES.some(v=>v.id===s.voice))||new Set(speakers.map(s=>s.id)).size!==speakers.length)throw new Error('Choose 1-4 named speakers with installed voices.');
    if(!Array.isArray(lines)||!lines.length||lines.length>16)throw new Error('Write 1-16 dialogue lines.');
    r.speakers=speakers.map(s=>({id:s.id,name:s.name.trim(),voice:s.voice,language:VOICES.find(v=>v.id===s.voice).language}));
    if(expressive)r.speakers=r.speakers.map((s,i)=>({...s,language:'en',targetVoice:source(speakers[i].targetVoice)}));
    r.lines=lines.map(l=>{if(!l||typeof l!=='object')throw new Error('Choose a valid dialogue line.');const speed=Number(l.speed??1),pauseBefore=Number(l.pauseBefore??.3);if(!speakers.some(s=>s.id===l.speaker)||typeof l.text!=='string'||!l.text.trim()||l.text.length>400||!Number.isFinite(speed)||speed<.7||speed>1.3||!Number.isFinite(pauseBefore)||pauseBefore<0||pauseBefore>2)throw new Error('Each line needs a speaker, 1-400 characters, a valid pace and a 0-2 second pause.');return {speaker:l.speaker,text:l.text.trim(),speed,pauseBefore};});
    if(r.lines.reduce((n,l)=>n+l.text.length,0)>2000)throw new Error('Keep the dialogue within 2,000 characters.');
    if(expressive){
      if(lines.length>8||r.lines.reduce((n,l)=>n+l.text.length,0)>800)throw new Error('Expressive dialogue allows up to eight lines / 800 characters / 30 seconds.');
      r.lines=r.lines.map((l,i)=>{const exaggeration=Number(lines[i].exaggeration??.5),cfgWeight=Number(lines[i].cfgWeight??.5);if(l.text.length>350||!Number.isFinite(exaggeration)||exaggeration<0||exaggeration>1.5||!Number.isFinite(cfgWeight)||cfgWeight<0||cfgWeight>1)throw new Error('Each expressive line needs 1-350 characters and valid expression/pacing controls.');return {...l,speed:1,exaggeration,cfgWeight};});
    }
  }
  if(tool==='caption'){
    r.source=source(input.source);if(!['take','footage'].includes(r.source.kind))throw new Error('Choose video for the caption export.');
    if(!uuid(input.transcriptJob)||!['keep','narrate'].includes(input.captionMode??'narrate'))throw new Error('Choose checked caption timing and an audio mode.');
    r.transcriptJob=input.transcriptJob;r.captionMode=input.captionMode??'narrate';r.captionCues=input.captionCues==null?null:normalizeCues(input.captionCues,30);
    r.fontSize=Number(input.fontSize??24);r.sourceVolume=Number(input.sourceVolume??(r.captionMode==='keep'?1:0));r.speechVolume=Number(input.speechVolume??1);for(const field of ['burnCaptions','speakerLabels','duckOriginal'])if(input[field]!=null&&typeof input[field]!=='boolean')throw new Error('Choose valid caption and mixing switches.');r.burnCaptions=input.burnCaptions!==false;r.speakerLabels=input.speakerLabels===true;r.duckOriginal=input.duckOriginal!==false;
    if(!Number.isInteger(r.fontSize)||r.fontSize<14||r.fontSize>40||[r.sourceVolume,r.speechVolume].some(v=>!Number.isFinite(v)||v<0||v>2)||typeof (input.loopVideo??false)!=='boolean')throw new Error('Choose a caption size from 14-40 and valid audio levels.');
    if(r.captionMode==='keep'&&r.sourceVolume<=0||r.captionMode==='narrate'&&r.speechVolume<=0)throw new Error('Keep the selected speech soundtrack audible.');
  }
  if(['transcribe','lipsync','separate'].includes(tool))r.source=source(input.source);
  if(tool==='lipsync'){if(!['take','footage'].includes(r.source.kind))throw new Error('Lip sync requires video footage.');r.audioSource=source(input.audioSource);if(!['speech','audio'].includes(r.audioSource.kind))throw new Error('Choose a saved speech result or WAV.');}
  if(tool==='dub'){
    if(!uuid(input.transcriptJob))throw new Error('Choose a checked transcript.');r.transcriptJob=input.transcriptJob;
    if(input.translations!=null&&(!Array.isArray(input.translations)||input.translations.length>100||input.translations.some(t=>typeof t!=='string'||t.length>1000)))throw new Error('Use one optional translated line per segment.');r.translations=input.translations??null;
    if(input.sourceTexts!=null&&(!Array.isArray(input.sourceTexts)||input.sourceTexts.length>100||input.sourceTexts.some(t=>typeof t!=='string'||!t.trim()||t.length>1000)))throw new Error('Use one nonempty corrected source line per segment.');r.sourceTexts=input.sourceTexts??null;
    if(input.segmentVoices!=null&&(!Array.isArray(input.segmentVoices)||input.segmentVoices.length>100||input.segmentVoices.some(v=>!VOICES.some(x=>x.id===v&&x.language===language))))throw new Error('Assign an installed target-language voice to each segment.');
    if(input.speakerNames!=null&&(!Array.isArray(input.speakerNames)||input.speakerNames.length>100||input.speakerNames.some(v=>typeof v!=='string'||v.length>40||/[<>\u0000-\u001f]/.test(v))))throw new Error('Use short speaker names for each segment.');
    r.segmentVoices=input.segmentVoices??null;r.speakerNames=input.speakerNames??null;
  }
  if(r.speechEngine==='turbo'){if(tool==='expressive'){r.exaggeration=0;r.cfgWeight=0;}if(tool==='dialogue')r.lines=r.lines.map(line=>({...line,exaggeration:0,cfgWeight:0}));}
  return r;
}
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
export class AudioStudio{
  constructor({root,data,resolveVideo,inspectAudio,videoBusy,releaseGpu=async()=>{}}){Object.assign(this,{root,data,resolveVideo,inspectAudio,videoBusy,releaseGpu});this.directory=path.join(data,'audio-jobs');this.jobs=new Map();this.children=new Map();this.saves=new Map();this.submitting=false;}
  async latentsyncReady(){try{const lock=JSON.parse(await readFile(path.join(this.root,'setup/latentsync.lock.json'),'utf8'));for(const item of lock.files)if((await stat(path.join(this.root,'runtime/latentsync-models',item.path))).size!==item.bytes)return false;await stat(path.join(this.root,'runtime/latentsync-env/Scripts/python.exe'));await stat(path.join(this.root,'runtime/latentsync-source/configs/unet/stage2_512.yaml'));return true;}catch{return false;}}
  async open(){await mkdir(this.directory,{recursive:true});for(const id of await readdir(this.directory)){try{const job=JSON.parse(await readFile(this.file(id,'job.json'),'utf8'));try{job.report=JSON.parse(await readFile(this.file(id,'report.json'),'utf8'));}catch{}if(job.status==='processing'){job.status='needs-attention';job.error='Processing was interrupted. Inspect saved artifacts before starting a new job; nothing was replayed.';await this.save(job);}this.jobs.set(id,job);}catch{}}return this;}
  file(id,name){return path.join(this.directory,id,name);}
  async save(job){const pending=(this.saves.get(job.id)??Promise.resolve()).catch(()=>{}).then(async()=>{await mkdir(this.file(job.id,''),{recursive:true});job.updatedAt=new Date().toISOString();await writeFile(this.file(job.id,'job.json.tmp'),JSON.stringify(job,null,2));await rename(this.file(job.id,'job.json.tmp'),this.file(job.id,'job.json'));});this.saves.set(job.id,pending);try{await pending;}finally{if(this.saves.get(job.id)===pending)this.saves.delete(job.id);}}
  busy(){return this.submitting||[...this.jobs.values()].some(j=>j.status==='processing'||j.status==='cancelling');}
  list(){return [...this.jobs.values()].sort((a,b)=>b.createdAt.localeCompare(a.createdAt));}
  async ready(){const files=JSON.parse(await readFile(path.join(this.root,'setup/audio-models.lock.json'),'utf8')).files;const missing=[];for(const f of files){try{const info=await stat(path.join(this.root,'runtime/audio-models',f.path));if(info.size!==f.bytes)missing.push(f.path);}catch{missing.push(f.path);}}try{await stat(path.join(this.root,'runtime/audio-env/Scripts/python.exe'));}catch{missing.push('audio environment');}let neuralReady=false,reverseReady=false;try{const extra=JSON.parse(await readFile(path.join(this.root,'setup/speech-upgrades.lock.json'),'utf8'));for(const f of extra.files)if((await stat(path.join(this.root,'runtime/speech-models',f.path))).size!==f.bytes)throw Error('Incomplete extra speech model');await stat(path.join(this.root,'runtime/speech-env/Scripts/python.exe'));neuralReady=true;reverseReady=true;}catch{}let separationReady=false;try{const lock=JSON.parse(await readFile(path.join(this.root,'setup/audio-separation.lock.json'),'utf8'));separationReady=(await stat(path.join(this.root,'runtime/audio-models',lock.path))).size===lock.bytes;}catch{}let turboReady=false,largeAsrReady=false;try{const extra=JSON.parse(await readFile(path.join(this.root,'setup/round12-speech-models.lock.json'),'utf8'));const check=async family=>{const files=extra.filter(f=>f.directory===family);return files.length>0&&(await Promise.all(files.map(async f=>{try{return (await stat(path.join(configuredModelRoot(this.root)||path.join(this.root,'models'),f.directory,path.basename(f.path)))).size===f.bytes;}catch{return false;}}))).every(Boolean);};turboReady=await check('speech/turbo');largeAsrReady=await check('speech/asr-large');}catch{}return {ready:missing.length===0,missing,turboReady,largeAsrReady,neuralReady,separationReady,latentsyncReady:await this.latentsyncReady(),voices:VOICES,translationRoutes:[{from:'en',to:'es'},...(reverseReady?[{from:'es',to:'en'}]:[])],tools:['speech','expressive','convert','dialogue','caption','transcribe','dub','lipsync','separate']};}
  async resolve(source){
    if(['take','footage'].includes(source.kind))return {...await this.resolveVideo(source.kind==='take'?{sourceJob:source.id}:{footage:source.id}),kind:'video'};
    if(source.kind==='speech'){const job=this.jobs.get(source.id);if(!job?.report?.technicalPass||!job.report.files['output.wav'])throw new Error('Choose a checked speech result.');const filename=this.file(job.id,'output.wav'),bytes=await readFile(filename);if(sha(bytes)!==job.report.files['output.wav'])throw new Error('Saved speech changed after verification.');return {path:filename,sha256:sha(bytes),...await this.inspectAudio(filename),kind:'audio'};}
    const filename=path.join(this.data,'audio',source.id+'.wav');return {path:filename,sha256:sha(await readFile(filename)),...await this.inspectAudio(filename),kind:'audio'};
  }
  async submit(input){
    const existing=this.list().find(j=>j.requestId===input.requestId);if(existing)return existing;
    if(this.busy()||this.videoBusy())throw new Error('One local media job at a time. Wait for the current job.');this.submitting=true;
    try{
      const request=normalizeAudio(input);if(!(await this.ready()).ready)throw new Error('Set up the local audio models first.');
      if(request.speechEngine==='turbo'||request.asrModel==='turbo'){
        const family=request.speechEngine==='turbo'?'speech/turbo':'speech/asr-large',files=JSON.parse(await readFile(path.join(this.root,'setup/round12-speech-models.lock.json'),'utf8')).filter(x=>x.directory===family);
        if(!files.length)throw Error('Restore the pinned speech upgrade first.');for(const file of files)if((await stat(path.join(configuredModelRoot(this.root)||path.join(this.root,'models'),file.directory,path.basename(file.path)))).size!==file.bytes)throw Error('Restore the pinned speech upgrade first.');
      }
      const manifest={request,root:this.root,models:path.join(this.root,'runtime/audio-models'),visionPython:path.join(this.root,'runtime/vision-env/Scripts/python.exe')};
      if(request.source){manifest.source=await this.resolve(request.source);if(['transcribe','separate'].includes(request.tool)&&manifest.source.kind==='video'&&!manifest.source.hasAudio)throw new Error('This video is silent. Choose footage with speech or a WAV.');}
      if(request.tool==='separate'){if(!(await this.ready()).separationReady)throw new Error('Restore the local two-voice separation model first.');if(manifest.source.duration<.5||manifest.source.duration>12)throw new Error('Two-voice separation previews require 0.5-12 seconds of speech.');}
      if(request.audioSource)manifest.audio=await this.resolve(request.audioSource);
      if(request.tool==='lipsync'&&request.lipHolds.length){
        const frames=Math.floor(manifest.audio.duration*25);
        if(request.lipHolds.some(h=>h.end>frames/25+.00001)||Array.from({length:frames},(_,i)=>i/25).filter(t=>!request.lipHolds.some(h=>h.start<=t&&t<h.end)).length<8)throw new Error('Keep ranges inside the speech and leave at least eight frames for visible lip sync.');
      }
      if(request.tool==='lipsync'&&request.lipEngine==='latentsync'){
        if(!await this.latentsyncReady())throw new Error('Restore the separate LatentSync setup first.');
        if(manifest.audio.duration<.5||manifest.audio.duration>4)throw new Error('LatentSync comparisons require 0.5-4 seconds of speech.');
        await this.releaseGpu();
      }
      if(request.tool==='dialogue'&&request.dialogueEngine==='expressive'){
        if(!(await this.ready()).neuralReady)throw new Error('Restore expressive speech setup first.');
        manifest.speakerReferences={};
        for(const s of request.speakers){const ref=await this.resolve(s.targetVoice),minimum=request.speechEngine==='turbo'?5.1:2;if(ref.kind==='video'&&!ref.hasAudio||ref.duration<minimum||ref.duration>12)throw new Error('Each speaker needs '+minimum+'-12 seconds of clean target speech.');manifest.speakerReferences[s.id]=ref;}
      }
      if(['expressive','convert'].includes(request.tool)){
        await stat(path.join(this.root,'runtime/speech-env/Scripts/python.exe'));
        const lock=JSON.parse(await readFile(path.join(this.root,'setup/speech-upgrades.lock.json'),'utf8'));for(const item of lock.files.filter(x=>x.path.startsWith('chatterbox/')))if((await stat(path.join(this.root,'runtime/speech-models',item.path))).size!==item.bytes)throw new Error('Restore the pinned speech model first.');
        if(request.targetVoice){manifest.targetVoice=await this.resolve(request.targetVoice);if(manifest.targetVoice.kind==='video'&&!manifest.targetVoice.hasAudio)throw new Error('The target voice reference has no audio.');const minimum=request.speechEngine==='turbo'?5.1:2;if(manifest.targetVoice.duration<minimum||manifest.targetVoice.duration>12)throw new Error('Choose '+minimum+'-12 seconds of clean target voice.');}
        if(manifest.source?.kind==='video'&&!manifest.source.hasAudio)throw new Error('Voice conversion needs a recording with speech.');
        if(manifest.source&&manifest.source.duration>20)throw new Error('Voice conversion previews are limited to 20 seconds.');
      }
      if(request.tool==='dub'){
        const parent=this.jobs.get(request.transcriptJob);if(!parent?.report?.technicalPass||!parent.report.files['transcript.json'])throw new Error('Choose a checked transcript.');const transcript=await readFile(this.file(parent.id,'transcript.json'));if(sha(transcript)!==parent.report.files['transcript.json'])throw new Error('Transcript changed since verification.');manifest.transcript=JSON.parse(transcript);manifest.transcriptSha256=sha(transcript);manifest.source=await this.resolve(parent.request.source);
        if(request.translations&&request.translations.length!==manifest.transcript.segments.length)throw new Error('Use exactly one translated line per transcript segment.');
        for(const key of ['segmentVoices','speakerNames'])if(request[key]&&request[key].length!==manifest.transcript.segments.length)throw new Error('Use one '+key+' entry per transcript segment.');
        let lastEnd=0;for(const s of manifest.transcript.segments){if(s.start<lastEnd-.001)throw new Error('Overlapping transcript segments require separate speaker tracks before dubbing.');lastEnd=s.end;}
        if(request.sourceTexts){if(request.sourceTexts.length!==manifest.transcript.segments.length)throw new Error('Use exactly one corrected source line per segment.');manifest.transcript.segments.forEach((segment,index)=>segment.text=request.sourceTexts[index].trim());manifest.transcript.text=manifest.transcript.segments.map(s=>s.text).join(' ');}
        if(manifest.source.kind==='video'&&manifest.source.duration>(request.lipSync?8:30))throw new Error('Trim the source to '+(request.lipSync?8:30)+' seconds for this dubbed video preview.');
        if(request.lipSync&&manifest.source.kind!=='video')throw new Error('Lip-synced dubbing requires a video transcript.');
      }
      if(request.tool==='caption'){
        const parent=this.jobs.get(request.transcriptJob);if(!parent?.report?.technicalPass||!parent.report.files['transcript.json'])throw new Error('Choose checked caption timing.');
        const file=this.file(parent.id,'transcript.json'),bytes=await readFile(file);if(sha(bytes)!==parent.report.files['transcript.json'])throw new Error('Caption timing changed after verification.');
        const transcript=JSON.parse(bytes);manifest.captionTiming={path:file,sha256:sha(bytes),jobId:parent.id,review:parent.review?.verdict??'pending'};
        if(request.captionMode==='narrate'){
          manifest.narration=await this.resolve({kind:'speech',id:parent.id});if(manifest.narration.duration>30)throw new Error('Keep narrated video within 30 seconds.');
          if(manifest.source.duration+.001<manifest.narration.duration&&!request.loopVideo)throw new Error('Speech is longer than the video. Choose a longer take or explicitly enable looping.');
          manifest.speechModels=parent.report.models??{};
        }else{
          if(!['take','footage'].includes(parent.request.source?.kind))throw new Error('Original-audio captions need a transcript of this video.');
          const original=await this.resolve(parent.request.source);if(original.sha256!==manifest.source.sha256)throw new Error('Choose the same video that supplied this transcript.');
          if(manifest.source.duration>30)throw new Error('Trim the video to 30 seconds before caption export.');
        }
        const duration=request.captionMode==='narrate'?manifest.narration.duration:manifest.source.duration;
        request.captionCues=normalizeCues(request.captionCues??transcriptCues(transcript),duration);
      }
      if(['expressive','convert'].includes(request.tool)||request.tool==='dialogue'&&request.dialogueEngine==='expressive')await this.releaseGpu();
      const job={id:randomUUID(),requestId:input.requestId,request,createdAt:new Date().toISOString(),status:'processing',review:null};this.jobs.set(job.id,job);await this.save(job);await writeFile(this.file(job.id,'manifest.json'),JSON.stringify(manifest,null,2));void this.run(job);return job;
    }finally{this.submitting=false;}
  }
  async reverify(id){
    const job=this.jobs.get(id);if(!job||['processing','cancelling'].includes(job.status)||this.busy()||this.videoBusy())throw new Error('Choose an idle saved result to recheck.');
    this.submitting=true;try{
    for(const [name,expected] of Object.entries(job.report?.files??{}))if(sha(await readFile(this.file(id,name)))!==expected)throw new Error('A saved output changed; keep it for inspection rather than replacing its verification record.');
    await stat(this.file(id,'expected.json'));job.status='processing';job.error=null;job.recheckedAt=new Date().toISOString();await this.save(job);void this.run(job,true);return job;
    }finally{this.submitting=false;}
  }
  async run(job,verifyOnly=false){
    try{await new Promise((resolve,reject)=>{const neural=!verifyOnly&&(['expressive','convert'].includes(job.request.tool)||job.request.tool==='dialogue'&&job.request.dialogueEngine==='expressive'),latent=!verifyOnly&&job.request.tool==='lipsync'&&job.request.lipEngine==='latentsync',child=spawn(path.join(this.root,latent?'runtime/latentsync-env/Scripts/python.exe':neural?'runtime/speech-env/Scripts/python.exe':'runtime/audio-env/Scripts/python.exe'),[path.join(this.root,'scripts',verifyOnly?'verify-audio.py':latent?'audio_latentsync.py':neural?'speech-neural.py':'audio-process.py'),this.file(job.id,'')],{windowsHide:true});this.children.set(job.id,child);let errors='';child.stdout.resume();child.stderr.on('data',c=>errors=(errors+c).slice(-12000));const timer=setTimeout(()=>child.kill(),15*60*1000);child.once('error',e=>{clearTimeout(timer);reject(e);});child.once('close',code=>{clearTimeout(timer);this.children.delete(job.id);code===0?resolve():reject(new Error(errors.slice(-1800)||'Audio processing stopped.'));});});if(job.status==='cancelling')throw new Error('Cancelled.');job.report=JSON.parse(await readFile(this.file(job.id,'report.json'),'utf8'));job.status=job.report.technicalPass?'review-ready':'technical-failed';
    }catch(error){job.status=job.status==='cancelling'?'cancelled':'failed';job.error=error.message;}await this.save(job);
  }
  async review(id,input){const job=this.jobs.get(id);if(!job?.report||!['approved','rejected'].includes(input.verdict)||input.verdict==='approved'&&!job.report.technicalPass)throw new Error('Choose a checked result and a valid review.');for(const [file,expected] of Object.entries(job.report.files))if(sha(await readFile(this.file(id,file)))!==expected)throw new Error('Output changed since verification.');job.review={verdict:input.verdict,notes:String(input.notes??'').slice(0,2000),files:job.report.files,at:new Date().toISOString()};await this.save(job);return job;}
  async cancel(id){const job=this.jobs.get(id);if(job?.status!=='processing')throw new Error('Only an active audio job can be stopped.');job.status='cancelling';await this.save(job);this.children.get(id)?.kill();return job;}
  async audioAsset(id,track=null){
    if(track!=null&&![1,2].includes(track))throw new Error('Choose voice track 1 or 2.');
    const filename=track==null?'output.wav':`voice-${track}.wav`,job=this.jobs.get(id);
    if(!job?.report?.technicalPass||!job.report.files[filename]||track!=null&&job.request.tool!=='separate')throw new Error('Choose a checked speech result or separated voice track.');
    const bytes=await readFile(this.file(id,filename));if(sha(bytes)!==job.report.files[filename])throw new Error('Saved audio changed.');
    const assetId=randomUUID();await writeFile(path.join(this.data,'audio',assetId+'.wav'),bytes);return {id:assetId,sha256:sha(bytes),...(track!=null?{separationJob:id,track}: {})};
  }
  async videoFootage(id){const job=this.jobs.get(id);if(!job?.report?.technicalPass||!job.report.files['output.mp4'])throw new Error('Choose a checked video result.');const bytes=await readFile(this.file(id,'output.mp4'));if(sha(bytes)!==job.report.files['output.mp4'])throw new Error('Saved video changed.');const assetId=randomUUID(),directory=path.join(this.data,'footage',assetId);await mkdir(directory,{recursive:true});await copyFile(this.file(id,'output.mp4'),path.join(directory,'source.mp4'));await copyFile(this.file(id,'poster.jpg'),path.join(directory,'poster.jpg'));const record={id:assetId,...job.report.media.video,filename:'source.mp4',name:job.request.tool+' · '+id.slice(0,8),createdAt:new Date().toISOString(),audioJob:id};await writeFile(path.join(directory,'source.json'),JSON.stringify(record,null,2));return record;}
}
