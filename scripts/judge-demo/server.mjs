import http from 'node:http';
import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {randomBytes,randomUUID,createHash,createHmac,timingSafeEqual} from 'node:crypto';
import {createSessionPool,createStudioGateway} from './studio-gateway.mjs';
const HERE=path.dirname(fileURLToPath(import.meta.url));
const uuid=s=>typeof s==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(s);
const digest=s=>createHash('sha256').update(s).digest('hex');
const equal=(a,b)=>{if(typeof a!=='string'||typeof b!=='string')return false;const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y);};
const error=(status,message,code)=>Object.assign(Error(message),{status,code});
const send=(res,status,value)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(value));};
async function body(req){let b='';for await(const chunk of req){b+=chunk;if(Buffer.byteLength(b)>4096)throw error(413,'Request is too large.');}try{return JSON.parse(b);}catch{throw error(400,'Use valid JSON.');}}
const finished=new Set(['review-ready','approved','rejected','failed','cancelled','needs-refinement','needs-attention','technical-failed','verification-blocked','not-submitted']);
const blocksEngine=j=>!finished.has(j.status)||j.status==='needs-attention';
const activeStates=new Set(['processing','uploading','submitting','submitted','running','cancelling','verifying']);
const bonuses={ltx:{id:'ltx-vfx',variant:'default',model:'LTX 2.5',title:'Create an atmospheric VFX shot'},flux:{id:'flux3-video',variant:'local',model:'FLUX 3 Image Klein',title:'Edit a product image'},h3:{id:'minimax-h3',variant:'local',model:'MiniMax H3',title:'Animate an image'}};
const workflowNames=new Set(['frameforge-ltx-atmosphere','frameforge-flux3-product','frameforge-flux3-image-edit','frameforge-h3-keyframes','frameforge-h3-local','video_ltx2_5_i2v','video_ltx2_5_dfr_i2v','api_bfl_flux3_i2v','video_minimax_h3_i2v','api_minimax_h3_flf2v','ltx-models.lock','flux3-image-models.lock','h3-models.lock']);

export async function createJudgeServer({root,stateDir,backend='http://127.0.0.1:4317',publicOrigin='',limit=35,visitorLimit=7,days=14,fullStudio=true,sessionPool}={}){
 if(!root){for(const candidate of [path.resolve(HERE,'../..'),path.resolve(HERE,'../../frameforge')]){try{if(JSON.parse(await readFile(path.join(candidate,'package.json'))).name==='frameforge-local'){root=candidate;break;}}catch{}}if(!root)throw Error('Set FRAMEFORGE_ROOT to the installed studio folder.');}
 stateDir??=path.join(root,'data','judge-demo');
 const upstream=new URL(backend);if(!['127.0.0.1','localhost','[::1]'].includes(upstream.hostname)||upstream.protocol!=='http:'||upstream.username||upstream.password||upstream.pathname!=='/')throw Error('The studio backend must be a loopback HTTP origin.');
 if(publicOrigin){const u=new URL(publicOrigin);if(u.protocol!=='https:'||u.origin!==publicOrigin)throw Error('Public origin must be an exact HTTPS origin.');}
 if(!Number.isInteger(visitorLimit)||visitorLimit<1||visitorLimit>7)throw Error('Visitor allowance must be between 1 and 7.');
 await mkdir(stateDir,{recursive:true});const stateFile=path.join(stateDir,'state.json');let state;
 try{state=JSON.parse(await readFile(stateFile));}catch(e){if(e.code!=='ENOENT')throw e;state={version:2,code:randomBytes(32).toString('base64url'),cookie:randomBytes(32).toString('hex'),expiresAt:new Date(Date.now()+days*86400000).toISOString(),limit,jobs:[],visitors:{}};}
 if(!Number.isInteger(state.limit)||state.limit<1||state.limit>35)throw Error('Judge budget must be between 1 and 35.');
 state.version=2;state.visitors??={};state.visitorLimit=visitorLimit;
 for(const j of state.jobs){j.visitor??='legacy';if(j.status==='submitting'&&!j.id)j.status='needs-attention';}
 async function save(){await writeFile(stateFile+'.tmp',JSON.stringify(state,null,2));await rename(stateFile+'.tmp',stateFile);}
 await save();let gate=Promise.resolve();function locked(fn){const next=gate.catch(()=>{}).then(fn);gate=next;return next;}
 const sign=id=>createHmac('sha256',state.cookie).update(id).digest('hex');
 function visitor(req){const token=req.headers.cookie?.split(';').map(s=>s.trim()).find(s=>s.startsWith('frameforge_judge='))?.slice('frameforge_judge='.length)??'';const [id,signature]=token.split('.');return state.visitors[id]&&equal(signature,sign(id))?id:null;}
 const assets={'/art/observatory.jpg':['public/explore-art/observatory-preview.jpg','image/jpeg'],'/art/product.jpg':['public/explore-art/product-preview.jpg','image/jpeg'],'/art/portrait.jpg':['public/explore-art/portrait-preview.jpg','image/jpeg'],'/art/observatory.png':['public/explore-art/observatory-concept.png','image/png'],'/art/product.png':['public/explore-art/product-concept.png','image/png'],'/art/portrait.png':['public/explore-art/portrait-concept.png','image/png'],'/art/motion.mp4':['public/explore-art/observatory-motion.mp4','video/mp4']};
 async function call(route,init={},base=upstream){const r=await fetch(new URL(route,base),{...init,headers:{'Content-Type':'application/json','X-Frameforge-Open-Weights-Only':'1',...init.headers},signal:AbortSignal.timeout(30000)});const v=await r.json();if(!r.ok){const e=error(r.status,'The local engine could not accept this run.',r.status===409?'ENGINE_BUSY':'NOT_ACCEPTED');e.definite=[400,401,403,404,409,422].includes(r.status);throw e;}return v;}
 async function availability(){try{const v=await call('/api/judge-readiness');if(typeof v.connected==='boolean')return v;}catch{}try{const [h,images,audio]=await Promise.all([call('/api/health'),call('/api/jobs'),call('/api/audio-jobs')]);return {connected:h.connected===true,busy:[...(Array.isArray(images)?images:[]),...(Array.isArray(audio)?audio:[])].some(j=>activeStates.has(j.status))};}catch{return {connected:false,busy:false};}}
 async function refresh(record){await locked(()=>refreshUnlocked(record));return record;}
 const charged=j=>j.status!=='not-submitted';
 const view=j=>({requestId:j.requestId,id:j.id??null,task:j.task,prompt:j.prompt,status:j.status,technicalPass:j.pass===true,summary:j.summary??{},message:j.status==='needs-attention'?'The creator must check this uncertain submission. It will not be sent twice.':null});
 const attempts=new Map();
 const pool=sessionPool??createSessionPool({root,stateDir,hasActive:owner=>state.jobs.some(j=>j.visitor===owner&&blocksEngine(j))});
 const gateway=createStudioGateway({root,pool,mainBackend:backend,reserveUpload:async(owner,bytes)=>locked(async()=>{const v=state.visitors[owner];if((v.uploadBytes??0)+bytes>64*1024*1024||Object.values(state.visitors).reduce((n,v)=>n+(v.uploadBytes??0),0)+bytes>256*1024*1024)throw error(413,'The shared demo upload allowance is full. Use smaller files or download the workflows.');v.uploadBytes=(v.uploadBytes??0)+bytes;await save();}),submit:async({owner,route,input,task,synchronous,perform})=>{
  if(!uuid(input?.requestId))throw error(400,'A fresh request ID is required.');
  const signature=digest(JSON.stringify({route,input}));let record,isNew=false;
  await locked(async()=>{
   record=state.jobs.find(j=>j.requestId===input.requestId);
   if(record){if(record.visitor!==owner||record.signature!==signature)throw error(409,'That request ID belongs to different inputs.');return;}
   if(state.jobs.filter(charged).length>=state.limit)throw error(429,'The shared demo allowance is used. You can keep browsing and downloading workflows.','SHARED_LIMIT');
   if(state.jobs.filter(j=>j.visitor===owner&&charged(j)).length>=visitorLimit)throw error(429,'Your seven demo runs are used. You can keep browsing and downloading workflows.','VISITOR_LIMIT');
   for(const j of state.jobs.filter(blocksEngine))await refreshUnlocked(j);
   if(state.jobs.some(blocksEngine))throw error(409,'Another judge is running a workflow. Please wait. No run was used.','ENGINE_BUSY');
   const ready=await availability();if(!ready.connected)throw error(503,'The creator’s GPU engine is offline. No run was used.','ENGINE_OFFLINE');if(ready.busy)throw error(409,'The creator is rendering. Please wait. No run was used.','ENGINE_BUSY');
   record={requestId:input.requestId,visitor:owner,task,signature,studio:true,route,prompt:String(input.prompt??input.text??'Studio workflow').slice(0,800),status:'submitting',createdAt:new Date().toISOString()};state.jobs.push(record);await save();isNew=true;
  });
  if(!isNew)return record.response??{status:202,body:view(record)};
  try{
   const result=await perform();
   if(result.status>=400){record.status=result.status<500?'not-submitted':'needs-attention';record.response=result;await locked(save);return result;}
   if(!synchronous&&!uuid(result.body.id))throw Error('No acknowledged studio job.');
   record.id=result.body.id;record.status=synchronous?'review-ready':result.body.status;record.response=result;await locked(save);return result;
  }catch(e){record.status='needs-attention';await locked(save);return {status:202,body:{...view(record),error:'The submission needs inspection. It will not be sent twice.'}};}
 }});
 const server=http.createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('Cache-Control','no-store');res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' blob:; media-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
  try{
   const localHost=req.headers.host===`127.0.0.1:${server.address().port}`||req.headers.host===`localhost:${server.address().port}`;
   const publicHost=publicOrigin&&req.headers.host===new URL(publicOrigin).host;
   if(!localHost&&!publicHost)throw error(403,'Unknown host.');
   const ownOrigin=publicHost?publicOrigin:'http://'+req.headers.host;
   if(req.headers.origin&&req.headers.origin!==ownOrigin)throw error(403,'Cross-site requests are disabled.');
   const url=new URL(req.url,ownOrigin),route=url.pathname;
   const signedVisitor=visitor(req);
   if(fullStudio){
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' blob: https://image.civitai.com https://blobs-b2.civitai.com; media-src 'self' blob: https://image.civitai.com https://blobs-b2.civitai.com; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'self'; form-action 'self'");
    if(req.method==='GET'&&['/judge-login.js','/judge-login.css'].includes(route)){res.setHeader('Content-Type',route.endsWith('.js')?'text/javascript':'text/css');return res.end(await readFile(path.join(HERE,route.endsWith('.js')?'login.js':'studio.css')));}
    if(!signedVisitor&&req.method==='GET'&&(route==='/'||!path.extname(route)&&!route.startsWith('/api/'))){res.setHeader('Content-Type','text/html; charset=utf-8');return res.end(await readFile(path.join(HERE,'login.html')));}
    if(signedVisitor&&Date.now()>Date.parse(state.expiresAt))throw error(410,'The judge invitation has expired.');
    if(!['/api/login','/api/status','/api/run'].includes(route)&&!route.startsWith('/api/job/')&&!route.startsWith('/result/')&&!route.startsWith('/bonus/')&&!route.startsWith('/workflow/')&&!route.startsWith('/art/')&&route!=='/api/showcase'){
     if(req.method!=='GET'&&req.headers.origin!==ownOrigin)throw error(403,'Open the judge studio to make changes.');
     if(await gateway(req,res,signedVisitor,url))return;
     if(!signedVisitor)throw error(401,'Reopen your judge invitation to enter the studio.');
    }
   }
   if(!fullStudio&&req.method==='GET'&&['/','/app.js','/style.css'].includes(route)){const name=route==='/'?'index.html':route.slice(1);res.writeHead(200,{'Content-Type':name.endsWith('.html')?'text/html; charset=utf-8':name.endsWith('.js')?'text/javascript':'text/css'});return res.end(await readFile(path.join(HERE,name)));}
   if(req.method==='GET'&&assets[route]){const [name,mime]=assets[route];res.setHeader('Cache-Control','public, max-age=3600');res.writeHead(200,{'Content-Type':mime});return res.end(await readFile(path.join(root,name)));}
   const workflow=route.match(/^\/workflow\/([a-z0-9.-]+)\.json$/);
   if(req.method==='GET'&&workflow&&workflowNames.has(workflow[1])){res.writeHead(200,{'Content-Type':'application/json','Content-Disposition':'attachment; filename="'+workflow[1]+'.json"'});return res.end(await readFile(path.join(root,'workflows/bonus',workflow[1]+'.json')));}
   if(route==='/api/showcase'&&req.method==='GET'){const items=await Promise.all(Object.entries(bonuses).map(async([key,b])=>{try{const p=await call('/api/provider-workflows/'+b.id+'?variant='+b.variant);return {...b,key,available:!!p.verification,mediaType:p.verification?.mediaType??'video',size:p.verification?.size,scope:p.verification?.scope,duration:p.verification?.duration,previewUrl:'/bonus/'+key+'/preview',posterUrl:p.verification?.posterUrl?'/bonus/'+key+'/poster':null};}catch{return {...b,key,available:false};}}));return send(res,200,items);}
   const bonus=route.match(/^\/bonus\/(ltx|flux|h3)\/(preview|poster)$/);
   if(bonus&&req.method==='GET'){const b=bonuses[bonus[1]],r=await fetch(new URL('/api/provider-workflows/'+b.id+'/'+(bonus[2]==='poster'?'poster':'preview')+'?variant='+b.variant,upstream),{headers:{'X-Frameforge-Open-Weights-Only':'1',...(req.headers.range?{Range:req.headers.range}:{})},signal:AbortSignal.timeout(15000)});if(![200,206].includes(r.status))throw error(404,'No saved preview is available.');res.setHeader('Cache-Control','public, max-age=300');res.writeHead(r.status,{'Content-Type':r.headers.get('content-type'),...Object.fromEntries(['content-length','content-range','accept-ranges'].flatMap(k=>r.headers.has(k)?[[k,r.headers.get(k)]]:[]))});let bytes=0;for await(const chunk of r.body){bytes+=chunk.length;if(bytes>12*1024**2)return res.destroy();res.write(Buffer.from(chunk));}return res.end();}
   if(req.method==='POST'&&route==='/api/login'){
    if(req.headers.origin!==ownOrigin)throw error(403,'Open the judge page to sign in.');const input=await body(req);
    if(!equal(digest(String(input.code??'')),digest(state.code))){const address=publicHost?String(req.headers['cf-connecting-ip']??req.socket.remoteAddress):String(req.socket.remoteAddress);const key=digest(address),a=attempts.get(key)??{time:Date.now(),count:0};if(Date.now()-a.time>60000){a.time=Date.now();a.count=0;}a.count++;attempts.set(key,a);if(attempts.size>1000)attempts.delete(attempts.keys().next().value);throw error(a.count>20?429:401,a.count>20?'Wait one minute before retrying this access code.':'The access code did not match.');}
    if(Date.now()>Date.parse(state.expiresAt))throw error(410,'The judge invitation has expired.');let id=visitor(req);
    if(!id){id=randomUUID();await locked(async()=>{state.visitors[id]={createdAt:new Date().toISOString()};await save();});}
    const seconds=Math.max(1,Math.floor((Date.parse(state.expiresAt)-Date.now())/1000));res.setHeader('Set-Cookie',`frameforge_judge=${id}.${sign(id)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${seconds}${publicHost?'; Secure':''}`);return send(res,200,{connected:true});
   }
   const owner=visitor(req);if(!owner)throw error(401,'Enter your judge access code to create.');if(Date.now()>Date.parse(state.expiresAt))throw error(410,'The judge invitation has expired.');
   if(route==='/api/status'&&req.method==='GET'){
    await Promise.all(state.jobs.filter(blocksEngine).map(refresh));const ready=await availability(),active=state.jobs.find(blocksEngine),own=state.jobs.filter(j=>j.visitor===owner),used=own.filter(charged).length,total=state.jobs.filter(charged).length;
    return send(res,200,{remaining:Math.max(0,visitorLimit-used),limit:visitorLimit,sharedRemaining:Math.max(0,state.limit-total),sharedLimit:state.limit,expiresAt:state.expiresAt,engineConnected:ready.connected,busy:Boolean(active)||ready.busy,activeRequestId:active?.visitor===owner?active.requestId:null,busyMessage:active?.status==='needs-attention'?'A previous submission needs the creator to check it.':active||ready.busy?'Another judge or studio render is running. Please wait. Your request has not been submitted.':null,jobs:own.map(view)});
   }
   if(route==='/api/run'&&req.method==='POST'){
    if(req.headers.origin!==ownOrigin)throw error(403,'Open the judge page to run a workflow.');const input=await body(req);
    if(Object.keys(input).some(k=>!['requestId','task','prompt'].includes(k))||!uuid(input.requestId)||!['image','video','speech'].includes(input.task)||typeof input.prompt!=='string'||!input.prompt.trim()||input.prompt.length>(input.task==='speech'?300:800))throw error(400,'Choose a supported task and a short prompt.');
    const signature=digest(JSON.stringify({task:input.task,prompt:input.prompt.trim()}));let record,isNew=false;
    await locked(async()=>{
     record=state.jobs.find(j=>j.requestId===input.requestId);if(record){if(record.visitor!==owner||record.signature!==signature)throw error(409,'That request ID belongs to different inputs.');return;}
     if(state.jobs.filter(charged).length>=state.limit)throw error(429,'The shared judge allowance is used. Existing results remain available.','SHARED_LIMIT');
     if(state.jobs.filter(j=>j.visitor===owner&&charged(j)).length>=visitorLimit)throw error(429,'Your seven-run visitor allowance is used.','VISITOR_LIMIT');
     for(const j of state.jobs.filter(blocksEngine))await refreshUnlocked(j);
     if(state.jobs.some(blocksEngine))throw error(409,'Another judge is generating. Please wait. No run was charged.','ENGINE_BUSY');
     const ready=await availability();if(!ready.connected)throw error(503,'The local engine is offline. No run was charged.','ENGINE_OFFLINE');if(ready.busy)throw error(409,'The studio is rendering. Please wait. No run was charged.','ENGINE_BUSY');
     record={requestId:input.requestId,visitor:owner,task:input.task,prompt:input.prompt.trim(),signature,status:'submitting',createdAt:new Date().toISOString()};state.jobs.push(record);await save();isNew=true;
    });
    if(isNew){try{
     let result;if(input.task==='speech')result=await call('/api/audio-jobs',{method:'POST',body:JSON.stringify({requestId:input.requestId,tool:'speech',text:record.prompt,language:'en',voice:'af_heart',speed:1})});
     else if(input.task==='image')result=await call('/api/jobs',{method:'POST',body:JSON.stringify({requestId:input.requestId,kind:'image',tool:'create',prompt:record.prompt,aspect:'square',quality:'preview',seed:20261026})});
     else{const bytes=await readFile(path.join(root,assets['/art/observatory.png'][0]));const upload=await fetch(new URL('/api/assets',upstream),{method:'POST',headers:{'Content-Type':'image/png','X-File-Name':'original-frameforge-observatory.png','X-Frameforge-Open-Weights-Only':'1'},body:bytes,signal:AbortSignal.timeout(30000)});if(!upload.ok)throw Object.assign(error(503,'The sample image could not be prepared. No run was charged.','NOT_ACCEPTED'),{definite:true});const asset=await upload.json();result=await call('/api/jobs',{method:'POST',body:JSON.stringify({requestId:input.requestId,kind:'video',mode:'image',engine:'wan5b',asset:asset.name??asset.asset,preset:'locked',aspect:'landscape',length:'preview',quality:'draft',seed:20261026,prompt:record.prompt})});}
     if(!uuid(result.id))throw Error('No acknowledged job.');record.id=result.id;record.status=result.status;await locked(save);
    }catch(e){record.status=e.definite?'not-submitted':'needs-attention';await locked(save);if(e.definite)throw e;}}
    return send(res,202,view(record));
   }
   const job=route.match(/^\/api\/job\/([a-f0-9-]{36})$/);if(job&&req.method==='GET'){const record=state.jobs.find(j=>j.requestId===job[1]&&j.visitor===owner);if(!record)throw error(404,'That job is not in your judge session.');return send(res,200,view(await refresh(record)));}
   const media=route.match(/^\/result\/([a-f0-9-]{36})\/(output\.(png|mp4|wav)|subtitles\.srt|poster\.jpg)$/);
   if(media&&req.method==='GET'){const record=state.jobs.find(j=>j.id===media[1]&&j.visitor===owner);if(!record||!record.pass)throw error(404,'That checked result is not in your judge session.');const file=media[2],mime={'output.png':'image/png','output.mp4':'video/mp4','output.wav':'audio/wav','subtitles.srt':'application/x-subrip','poster.jpg':'image/jpeg'}[file];
    if(record.task==='image'&&file!=='output.png'||record.task==='speech'&&!['output.wav','subtitles.srt'].includes(file)||record.task==='video'&&!['output.mp4','poster.jpg'].includes(file))throw error(404,'Choose a file for this result.');
    const r=await fetch(new URL((record.task==='speech'?'/audio-jobs/':'/outputs/')+record.id+'/'+file,upstream),{headers:req.headers.range?{Range:req.headers.range}:{},signal:AbortSignal.timeout(30000)});if(![200,206].includes(r.status))throw error(404,'Result file is unavailable.');
    if(Number(r.headers.get('content-length'))>100*1024**2)throw error(413,'Result is too large.');res.writeHead(r.status,{'Content-Type':mime,...Object.fromEntries(['content-length','content-range','accept-ranges'].flatMap(k=>r.headers.has(k)?[[k,r.headers.get(k)]]:[]))});let total=0;for await(const chunk of r.body){total+=chunk.length;if(total>100*1024**2){res.destroy();return;}if(!res.write(Buffer.from(chunk)))await new Promise(resolve=>res.once('drain',resolve));}return res.end();
   }
   throw error(404,'This route is not part of the judge demo.');
  }catch(e){if(res.headersSent)return res.destroy();if(e.code==='ENGINE_BUSY')res.setHeader('Retry-After','5');send(res,e.status??500,{error:e.status?e.message:'The local demo is temporarily unavailable.',...(e.code?{code:e.code}:{})});}
 });
 // Called inside the reservation lock; do not reacquire the same lock.
 async function refreshUnlocked(record){try{if(record.studio&&record.route?.endsWith('/export'))return;const base=record.studio?await pool.get(record.visitor):upstream;const rows=await call(record.task==='speech'?'/api/audio-jobs':'/api/jobs',{},base),j=rows.find(j=>record.id?j.id===record.id:j.requestId===record.requestId);if(j){record.id=j.id;record.status=j.status;record.pass=j.report?.technicalPass===true;record.summary={size:j.report?.size,duration:j.report?.duration??j.report?.media?.audio?.duration};await save();}}catch{}}
 server.once('close',()=>pool.close());
 return {server,stateFile,expiresAt:state.expiresAt};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const app=await createJudgeServer({root:process.env.FRAMEFORGE_ROOT,stateDir:process.env.JUDGE_STATE_DIR,publicOrigin:process.env.JUDGE_PUBLIC_ORIGIN??'',backend:process.env.JUDGE_BACKEND??'http://127.0.0.1:4317',fullStudio:process.env.JUDGE_FULL_STUDIO!=='0'});const port=Number(process.env.PORT??4329);app.server.listen(port,'127.0.0.1',()=>console.log(JSON.stringify({url:'http://127.0.0.1:'+port,stateFile:app.stateFile,public:false,expiresAt:app.expiresAt})));}
