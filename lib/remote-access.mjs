// Director remote: an opt-in, Wi-Fi-only phone surface for Produce. It runs on
// its own port and serves only the remote page, a handful of production
// actions and media that belongs to a production. The full Studio and ComfyUI
// stay on 127.0.0.1. Pairing uses a random token (only its hash is stored),
// and media links are signed so <img>/<video> can load without the token.
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import {readFile,writeFile,rename,mkdir} from 'node:fs/promises';
import {createHash,createHmac,randomBytes,timingSafeEqual} from 'node:crypto';

const sha=v=>createHash('sha256').update(v).digest('hex');
// Tailscale gives this PC a 100.64.0.0/10 address that a phone on the same tailnet reaches from anywhere.
export const isTailnet=a=>{const [x,y]=a.split('.').map(Number);return x===100&&y>=64&&y<=127;};
export function lanAddresses(){return Object.values(os.networkInterfaces()).flat().filter(a=>a&&a.family==='IPv4'&&!a.internal&&!a.address.startsWith('169.254.')).map(a=>a.address).sort((a,b)=>isTailnet(a)-isTailnet(b));}
const MEDIA=/^\/(outputs\/[a-f0-9-]{36}\/[\w.-]{1,120}|films\/[a-f0-9-]{36}\/[a-f0-9-]{36}\/(movie\.mp4|poster\.jpg|subtitles\.srt))$/;
const PUBLIC_ART=/^\/(explore-art\/[\w.-]{1,60}\.(png|jpg|svg)|creator-stories\.svg|frameforge\.svg)$/;
const ACTIONS=new Set(['continue','pause','resume','retry','redo','narration','auto']);

export class RemoteAccess{
 constructor({data,root,port=4318,studioPort,productions,formats,hosted=false}){Object.assign(this,{data,root,port,studioPort,productions,formats,hosted});this.file=path.join(data,'remote-access.json');this.state={enabled:false,tokenHash:null,secret:null,pairedAt:null};this.server=null;}
 async open(){await mkdir(this.data,{recursive:true});try{this.state={...this.state,...JSON.parse(await readFile(this.file,'utf8'))};}catch(e){if(e.code!=='ENOENT')throw e;}if(this.state.enabled&&!this.hosted)await this.listen().catch(()=>{this.state.enabled=false;});return this;}
 async persist(){const tmp=this.file+'.tmp';await writeFile(tmp,JSON.stringify(this.state));await rename(tmp,this.file);}
 describe(){return {enabled:this.state.enabled,listening:!!this.server,port:this.port,addresses:lanAddresses(),pairedAt:this.state.pairedAt,note:'Works for phones on the same Wi-Fi, and from anywhere when the phone and this PC are both signed in to Tailscale. Only Produce actions and its results are reachable.'};}
 async enable(){if(this.hosted)throw Error('The phone remote is only for the studio owner’s computer.');const token=randomBytes(24).toString('base64url');this.state={enabled:true,tokenHash:sha(token),secret:randomBytes(32).toString('hex'),pairedAt:new Date().toISOString()};await this.persist();await this.listen();const addresses=lanAddresses();if(!addresses.length)throw Error('No Wi-Fi or network address was found on this computer.');return {...this.describe(),token,urls:addresses.map(a=>`http://${a}:${this.port}/remote#t=${token}`)};}
 async disable(){this.state={enabled:false,tokenHash:null,secret:null,pairedAt:null};await this.persist();await new Promise(r=>this.server?this.server.close(()=>r()):r());this.server=null;return this.describe();}
 authorized(req){const h=String(req.headers.authorization??'');if(!this.state.tokenHash||!h.startsWith('Bearer '))return false;const a=Buffer.from(sha(h.slice(7))),b=Buffer.from(this.state.tokenHash);return a.length===b.length&&timingSafeEqual(a,b);}
 sign(p){return createHmac('sha256',this.state.secret).update(p).digest('base64url').slice(0,32);}
 media(p){return p?'/m/'+this.sign(p)+p:null;}
 view(p){const pub=this.productions.public(p),m=v=>this.media(v);return {id:pub.id,name:pub.name,format:pub.format,duration:pub.duration,aspect:pub.aspect,stage:pub.stage,waiting:pub.waiting,paused:pub.paused,error:pub.error,auto:pub.auto,lastEvent:pub.events?.at(-1)?.message??'',frames:pub.frames.map(f=>({id:f.id,title:f.title,prompt:f.prompt,targetDuration:f.targetDuration,narration:f.narration,image:f.image?.done?m(f.image.url):null,clip:f.clip?.done?m(f.clip.url):null,poster:f.clip?.done?m(f.clip.poster):null,busy:!!(f.image?.jobId&&!f.image.done||f.clip?.jobId&&!f.clip.done)})),movie:pub.movie?{url:m(pub.movie.url),poster:m(pub.movie.poster)}:null,updatedAt:pub.updatedAt};}
 async listen(){if(this.server)return;this.server=http.createServer((req,res)=>this.handle(req,res).catch(error=>this.send(res,400,{error:error.message})));await new Promise((resolve,reject)=>{this.server.once('error',reject);this.server.listen(this.port,'0.0.0.0',resolve);});}
 headers(res,type){res.setHeader('Content-Type',type);res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('Cache-Control','no-store');res.setHeader('Content-Security-Policy',"default-src 'self'; img-src 'self' data:; media-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-ancestors 'none'");}
 send(res,code,body){if(res.headersSent)return res.end();this.headers(res,'application/json; charset=utf-8');res.statusCode=code;res.end(JSON.stringify(body));}
 async body(req){const chunks=[];let n=0;for await(const c of req){n+=c.length;if(n>20000)throw Error('Request too large.');chunks.push(c);}return chunks.length?JSON.parse(Buffer.concat(chunks)):{};}
 proxy(req,res,target){const upstream=http.request({host:'127.0.0.1',port:typeof this.studioPort==='function'?this.studioPort():this.studioPort,path:target,method:'GET',headers:req.headers.range?{range:req.headers.range}:{}},up=>{res.writeHead(up.statusCode,Object.fromEntries(['content-type','content-length','content-range','accept-ranges'].filter(k=>up.headers[k]).map(k=>[k,up.headers[k]])));up.pipe(res);});upstream.on('error',()=>this.send(res,502,{error:'Studio is not responding.'}));upstream.end();}
 async handle(req,res){
  const url=new URL(req.url,'http://remote'),route=url.pathname;
  if(req.method==='GET'&&['/','/remote'].includes(route)){const html=await readFile(path.join(this.root,'public','remote.html'));this.headers(res,'text/html; charset=utf-8');return res.end(html);}
  if(req.method==='GET'&&['/remote.js','/remote.css'].includes(route)){const file=await readFile(path.join(this.root,'public',route.slice(1)));this.headers(res,route.endsWith('.js')?'text/javascript; charset=utf-8':'text/css; charset=utf-8');return res.end(file);}
  if(req.method==='GET'&&PUBLIC_ART.test(route))return this.proxy(req,res,route);
  const signed=route.match(/^\/m\/([\w-]{32})(\/.+)$/);
  if(req.method==='GET'&&signed){if(!this.state.secret||!MEDIA.test(signed[2])||!timingSafeEqual(Buffer.from(signed[1]),Buffer.from(this.sign(signed[2]))))return this.send(res,404,{error:'Not found.'});return this.proxy(req,res,signed[2]);}
  if(!route.startsWith('/api/remote/'))return this.send(res,404,{error:'Not found.'});
  if(!this.authorized(req))return this.send(res,401,{error:'Pair this phone again from Studio → Produce → Phone remote.'});
  if(route==='/api/remote/state'&&req.method==='GET')return this.send(res,200,{studio:'Frameforge',formats:this.formats.map(f=>({id:f.id,title:f.title,summary:f.summary,art:f.art==='fruit-romance'?'/creator-stories.svg':'/explore-art/'+f.art,sources:f.sources??null,aspect:f.aspect,experimental:!!f.experimental})),productions:this.productions.list.slice(0,20).map(p=>this.view(p))});
  if(route==='/api/remote/produce'&&req.method==='POST'){const b=await this.body(req);const p=await this.productions.create({format:b.format,subject:b.subject,duration:b.duration,aspect:b.aspect,sources:b.sources,name:String(b.subject??'').slice(0,60),quality:b.quality==='standard'?'standard':'draft'});return this.send(res,201,this.view(p));}
  const act=route.match(/^\/api\/remote\/productions\/([a-f0-9-]{36})\/action$/);
  if(act&&req.method==='POST'){const b=await this.body(req);if(!ACTIONS.has(b.action))throw Error('That action is not available from the phone.');const p=await this.productions.action(act[1],b);return this.send(res,200,this.view(p));}
  return this.send(res,404,{error:'Not found.'});
 }
}
