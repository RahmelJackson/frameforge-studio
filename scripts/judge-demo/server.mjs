import http from 'node:http';
import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {randomBytes,randomUUID,createHash,timingSafeEqual} from 'node:crypto';
const HERE=path.dirname(fileURLToPath(import.meta.url));
const uuid=s=>typeof s==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(s);
const digest=s=>createHash('sha256').update(s).digest('hex');
const equal=(a,b)=>{if(typeof a!=='string'||typeof b!=='string')return false;const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y);};
const error=(status,message)=>Object.assign(Error(message),{status});
const send=(res,status,value)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(value));};
async function body(req){let b='';for await(const chunk of req){b+=chunk;if(Buffer.byteLength(b)>4096)throw error(413,'Request is too large.');}try{return JSON.parse(b);}catch{throw error(400,'Use valid JSON.');}}
export async function createJudgeServer({root,stateDir,backend='http://127.0.0.1:4317',publicOrigin='',limit=10,days=14}={}){
 if(!root){for(const candidate of [path.resolve(HERE,'../..'),path.resolve(HERE,'../../frameforge')]){try{const p=JSON.parse(await readFile(path.join(candidate,'package.json')));if(p.name==='frameforge-local'){root=candidate;break;}}catch{}}if(!root)throw Error('Set FRAMEFORGE_ROOT to the installed studio folder.');}
 stateDir??=path.join(root,'data','judge-demo');
 const upstream=new URL(backend);if(!['127.0.0.1','localhost','[::1]'].includes(upstream.hostname)||upstream.protocol!=='http:'||upstream.username||upstream.password||upstream.pathname!=='/')throw Error('The studio backend must be a loopback HTTP origin.');
 if(publicOrigin){const u=new URL(publicOrigin);if(u.protocol!=='https:'||u.origin!==publicOrigin)throw Error('Public origin must be an exact HTTPS origin.');}
 await mkdir(stateDir,{recursive:true});const stateFile=path.join(stateDir,'state.json');let state;
 try{state=JSON.parse(await readFile(stateFile));}catch(e){if(e.code!=='ENOENT')throw e;state={version:1,code:randomBytes(32).toString('base64url'),cookie:randomBytes(32).toString('hex'),expiresAt:new Date(Date.now()+days*86400000).toISOString(),limit,jobs:[]};await writeFile(stateFile,JSON.stringify(state,null,2));}
 if(!Number.isInteger(state.limit)||state.limit<1||state.limit>20)throw Error('Judge budget must be between 1 and 20.');
 async function save(){await writeFile(stateFile+'.tmp',JSON.stringify(state,null,2));await rename(stateFile+'.tmp',stateFile);}
 let gate=Promise.resolve();function locked(fn){const next=gate.catch(()=>{}).then(fn);gate=next;return next;}
 const assets={'/art/observatory.png':['public/explore-art/observatory-concept.png','image/png'],'/art/product.png':['public/explore-art/product-concept.png','image/png'],'/art/portrait.png':['public/explore-art/portrait-concept.png','image/png'],'/art/motion.mp4':['public/explore-art/observatory-motion.mp4','video/mp4']};
 async function call(route,init={}){const r=await fetch(new URL(route,upstream),{...init,headers:{'Content-Type':'application/json','X-Frameforge-Open-Weights-Only':'1',...init.headers},signal:AbortSignal.timeout(30000)});const v=await r.json();if(!r.ok)throw error(502,'The local engine could not accept this run. Its slot is retained so it cannot be submitted twice.');return v;}
 const finished=new Set(['review-ready','approved','rejected','failed','cancelled','needs-refinement','needs-attention']);
 async function refresh(record){if(!record.id)return record;try{const rows=await call(record.task==='speech'?'/api/audio-jobs':'/api/jobs');const j=rows.find(j=>j.id===record.id);if(!j)throw Error('Saved job unavailable');record.status=j.status;record.pass=j.report?.technicalPass===true;record.summary={size:j.report?.size,duration:j.report?.duration??j.report?.media?.audio?.duration};await locked(save);}catch{}return record;}
 const view=j=>({requestId:j.requestId,id:j.id??null,task:j.task,prompt:j.prompt,status:j.status,technicalPass:j.pass===true,summary:j.summary??{},message:j.status==='needs-attention'?'The submission needs local inspection. This slot remains reserved.':null});
 let authWindow={time:0,count:0};
 const server=http.createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('Cache-Control','no-store');res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' blob:; media-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
  try{
   const localHost=req.headers.host===`127.0.0.1:${server.address().port}`||req.headers.host===`localhost:${server.address().port}`;
   const publicHost=publicOrigin&&req.headers.host===new URL(publicOrigin).host;
   if(!localHost&&!publicHost)throw error(403,'Unknown host.');
   const ownOrigin=publicHost?publicOrigin:'http://'+req.headers.host;
   if(req.headers.origin&&req.headers.origin!==ownOrigin)throw error(403,'Cross-site requests are disabled.');
   const url=new URL(req.url,ownOrigin);const route=url.pathname;
   if(req.method==='GET'&&['/','/app.js','/style.css'].includes(route)){const name=route==='/'?'index.html':route.slice(1);res.writeHead(200,{'Content-Type':name.endsWith('.html')?'text/html; charset=utf-8':name.endsWith('.js')?'text/javascript':'text/css'});return res.end(await readFile(path.join(HERE,name)));}
   if(req.method==='GET'&&assets[route]){const [name,mime]=assets[route];res.writeHead(200,{'Content-Type':mime});return res.end(await readFile(path.join(root,name)));}
   const workflow=route.match(/^\/workflow\/(frameforge-ltx-atmosphere|video_ltx2_5_i2v|video_ltx2_5_dfr_i2v|api_bfl_flux3_i2v|video_minimax_h3_i2v|api_minimax_h3_flf2v)\.json$/);
   if(req.method==='GET'&&workflow){res.writeHead(200,{'Content-Type':'application/json','Content-Disposition':'attachment; filename="'+workflow[1]+'.json"'});return res.end(await readFile(path.join(root,'workflows/bonus',workflow[1]+'.json')));}
   if(req.method==='POST'&&route==='/api/login'){
    if(Date.now()-authWindow.time>60000)authWindow={time:Date.now(),count:0};if(++authWindow.count>20)throw error(429,'Please wait one minute before trying again.');
    const input=await body(req);if(!equal(digest(String(input.code??'')),digest(state.code)))throw error(401,'The access code did not match.');if(Date.now()>Date.parse(state.expiresAt))throw error(410,'The judge session has expired.');
    res.setHeader('Set-Cookie',`frameforge_judge=${state.cookie}; HttpOnly; SameSite=Strict; Path=/; Max-Age=86400${publicHost?'; Secure':''}`);return send(res,200,{connected:true});
   }
   const cookie=req.headers.cookie?.split(';').map(s=>s.trim()).find(s=>s.startsWith('frameforge_judge='))?.slice('frameforge_judge='.length);
   if(!equal(cookie,state.cookie))throw error(401,'Enter your judge access code to create.');if(Date.now()>Date.parse(state.expiresAt))throw error(410,'The judge session has expired.');
   if(route==='/api/status'&&req.method==='GET'){
    await Promise.all(state.jobs.filter(j=>!finished.has(j.status)).map(refresh));let ready=false;try{const h=await call('/api/health');ready=h.connected===true||h.comfy?.connected===true||h.engine?.connected===true;}catch{}
    return send(res,200,{remaining:state.limit-state.jobs.length,limit:state.limit,expiresAt:state.expiresAt,engineConnected:ready,jobs:state.jobs.map(view)});
   }
   if(route==='/api/run'&&req.method==='POST'){
    if(req.headers.origin!==ownOrigin)throw error(403,'Open the judge page to run a workflow.');const input=await body(req);
    if(Object.keys(input).some(k=>!['requestId','task','prompt'].includes(k))||!uuid(input.requestId)||!['image','video','speech'].includes(input.task)||typeof input.prompt!=='string'||!input.prompt.trim()||input.prompt.length>(input.task==='speech'?300:800))throw error(400,'Choose a supported task and a short prompt.');
    const signature=digest(JSON.stringify({task:input.task,prompt:input.prompt.trim()}));
    let record,isNew=false;await locked(async()=>{record=state.jobs.find(j=>j.requestId===input.requestId);if(record){if(record.signature!==signature)throw error(409,'That request ID belongs to different inputs.');return;}
     if(state.jobs.length>=state.limit)throw error(429,'The judge run allowance is used. Existing results remain available.');if(state.jobs.some(j=>!finished.has(j.status)))throw error(409,'One local job is already running. Please wait for it to finish.');
     record={requestId:input.requestId,task:input.task,prompt:input.prompt.trim(),signature,status:'submitting',createdAt:new Date().toISOString()};state.jobs.push(record);await save();isNew=true;
    });
    if(isNew){try{
     let result;if(input.task==='speech')result=await call('/api/audio-jobs',{method:'POST',body:JSON.stringify({requestId:input.requestId,tool:'speech',text:record.prompt,language:'en',voice:'af_heart',speed:1})});
     else if(input.task==='image')result=await call('/api/jobs',{method:'POST',body:JSON.stringify({requestId:input.requestId,kind:'image',tool:'create',prompt:record.prompt,aspect:'square',quality:'preview',seed:20261026})});
     else{const bytes=await readFile(path.join(root,assets['/art/observatory.png'][0]));const assetResponse=await fetch(new URL('/api/assets',upstream),{method:'POST',headers:{'Content-Type':'image/png','X-File-Name':'original-frameforge-observatory.png','X-Frameforge-Open-Weights-Only':'1'},body:bytes,signal:AbortSignal.timeout(30000)});if(!assetResponse.ok)throw Error('Could not prepare the original sample.');const asset=await assetResponse.json();result=await call('/api/jobs',{method:'POST',body:JSON.stringify({requestId:input.requestId,kind:'video',mode:'image',engine:'wan5b',asset:asset.name??asset.asset,preset:'locked',aspect:'landscape',length:'preview',quality:'draft',seed:20261026,prompt:record.prompt})});}
     if(!uuid(result.id))throw Error('No acknowledged job.');record.id=result.id;record.status=result.status;await locked(save);
    }catch{record.status='needs-attention';await locked(save);}}
    return send(res,202,view(record));
   }
   const job=route.match(/^\/api\/job\/([a-f0-9-]{36})$/);if(job&&req.method==='GET'){const record=state.jobs.find(j=>j.requestId===job[1]);if(!record)throw error(404,'That job is not in this judge session.');return send(res,200,view(await refresh(record)));}
   const media=route.match(/^\/result\/([a-f0-9-]{36})\/(output\.(png|mp4|wav)|subtitles\.srt|poster\.jpg)$/);
   if(media&&req.method==='GET'){const record=state.jobs.find(j=>j.id===media[1]);if(!record||!record.pass)throw error(404,'That checked result is not in this judge session.');const file=media[2],mime={'output.png':'image/png','output.mp4':'video/mp4','output.wav':'audio/wav','subtitles.srt':'application/x-subrip','poster.jpg':'image/jpeg'}[file];
    if(record.task==='image'&&file!=='output.png'||record.task==='speech'&&!['output.wav','subtitles.srt'].includes(file)||record.task==='video'&&!['output.mp4','poster.jpg'].includes(file))throw error(404,'Choose a file for this result.');
    const r=await fetch(new URL((record.task==='speech'?'/audio-jobs/':'/outputs/')+record.id+'/'+file,upstream),{headers:req.headers.range?{Range:req.headers.range}:{},signal:AbortSignal.timeout(30000)});if(![200,206].includes(r.status))throw error(404,'Result file is unavailable.');
    if(Number(r.headers.get('content-length'))>100*1024**2)throw error(413,'Result is too large.');res.writeHead(r.status,{'Content-Type':mime,...Object.fromEntries(['content-length','content-range','accept-ranges'].flatMap(k=>r.headers.has(k)?[[k,r.headers.get(k)]]:[]))});let total=0;for await(const chunk of r.body){total+=chunk.length;if(total>100*1024**2){res.destroy();return;}if(!res.write(Buffer.from(chunk)))await new Promise(resolve=>res.once('drain',resolve));}return res.end();
   }
   throw error(404,'This route is not part of the judge demo.');
  }catch(e){if(res.headersSent)return res.destroy();send(res,e.status??500,{error:e.status?e.message:'The local demo is temporarily unavailable.'});}
 });
 return {server,stateFile,expiresAt:state.expiresAt};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const app=await createJudgeServer({root:process.env.FRAMEFORGE_ROOT,stateDir:process.env.JUDGE_STATE_DIR,publicOrigin:process.env.JUDGE_PUBLIC_ORIGIN??'',backend:process.env.JUDGE_BACKEND??'http://127.0.0.1:4317'});const port=Number(process.env.PORT??4328);app.server.listen(port,'127.0.0.1',()=>console.log(JSON.stringify({url:'http://127.0.0.1:'+port,stateFile:app.stateFile,public:false,expiresAt:app.expiresAt})));}
