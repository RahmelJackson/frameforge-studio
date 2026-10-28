import http from 'node:http';
import {once} from 'node:events';
import {studioAddress} from './studio-address.mjs';

// A connection-owned loopback view of the real website. The normal studio's
// anti-framing policy stays intact. Only the origins supplied by the MCP UI
// bridge can frame this view; it never proxies an arbitrary destination.
export function embedAncestors(values){
 if(!Array.isArray(values)||!values.length||values.length>8)throw Error('Supply the exact embed ancestor origins.');
 return [...new Set(values.map(value=>{
  if(typeof value!=='string'||value.length>250||/[\s;'"*]/.test(value))throw Error('Invalid embed ancestor origin.');
  const url=new URL(value);
  // Installed Codex 26.1007.2314.0 constructs this exact local sandbox origin
  // from a 24-byte connection identity digest. Keep the scheme host-restricted.
  const codexSandbox=url.protocol==='codex-sandbox:'&&!url.port&&/^mcp-app-[a-f0-9]{48}\.web-sandbox\.oaiusercontent\.com$/.test(url.hostname);
  if((!['https:','http:','app:','codex:'].includes(url.protocol)&&!codexSandbox)||url.username||url.password||url.search||url.hash||url.pathname&&url.pathname!=='/')throw Error('Use exact embed origins only ('+url.protocol+').');
  if(url.protocol==='http:'&&!['127.0.0.1','localhost'].includes(url.hostname))throw Error('HTTP embed hosts must be loopback.');
  if(value.replace(/\/$/,'')!==url.protocol+'//'+url.host)throw Error('Use a canonical embed origin.');
  return value.replace(/\/$/,'');
 }))];
}
const bridge=`window.parent.postMessage({type:'frameforge-studio-ready'},'*');
window.addEventListener('message',event=>{if(event.source!==window.parent||event.data?.type!=='frameforge-comfy-host'||event.data.origin!==event.origin)return;let u;try{u=new URL(event.origin);}catch{return;}if(u.protocol!=='http:'||!['127.0.0.1','localhost'].includes(u.hostname))return;window.frameforgeComfyOrigin=event.origin;window.dispatchEvent(new Event('frameforge:comfy-connected'));});
document.addEventListener('click',event=>{const a=event.target.closest('a[href]');if(!a||event.defaultPrevented)return;const u=new URL(a.href,location.href);if(u.origin===location.origin||!['http:','https:'].includes(u.protocol))return;event.preventDefault();window.parent.postMessage({type:'frameforge-external-link',url:u.href},'*');});`;
export async function startStudioEmbed({base,allowWrites=false,openWeightsOnly=false}={}){
 const upstream=new URL(studioAddress(base));let ancestors=[];
 const server=http.createServer((req,res)=>{
  const origin='http://127.0.0.1:'+server.address().port;
  const deny=(code,message)=>{res.writeHead(code,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({error:message}));};
  if(req.headers.host!==new URL(origin).host||req.headers.origin&&req.headers.origin!==origin)return deny(403,'Cross-origin requests are disabled.');
  if(!req.url.startsWith('/')||req.url.startsWith('//'))return deny(400,'Local studio paths only.');
  if(!ancestors.length)return deny(403,'Open this view from the Frameforge MCP panel.');
  const pathname=new URL(req.url,origin).pathname;
  if(pathname==='/__frameforge_embed/bridge.js'){res.writeHead(200,{'Content-Type':'text/javascript','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});return res.end(bridge);}
  if(!allowWrites&&!['GET','HEAD'].includes(req.method))return deny(403,'This MCP connection is read-only. Enable local creation to use these controls.');
  // A locked connection cannot weaken the persistent website profile.
  if(openWeightsOnly&&req.method!=='GET'&&req.method!=='HEAD'&&pathname==='/api/execution-policy')return deny(403,'This MCP connection locks open weights only.');
  const headers={...req.headers,host:upstream.host,...(req.headers.origin?{origin:upstream.origin}:{}),...(openWeightsOnly?{'x-frameforge-open-weights-only':'1'}:{})};
  delete headers.cookie;delete headers.authorization;delete headers['proxy-authorization'];
  const navigation=req.headers.cookie?.match(/(?:^|;\s*)frameforge_navigation=(top|side)(?:;|$)/)?.[1];
  if(navigation)headers.cookie='frameforge_navigation='+navigation;
  const request=http.request(upstream,{method:req.method,path:req.url,headers},response=>{
   const out={...response.headers,'cache-control':'no-store','referrer-policy':'no-referrer'};
   delete out['set-cookie'];delete out['x-frame-options'];
   const policy=String(out['content-security-policy']??"default-src 'self'; object-src 'none'").replace(/(?:^|;)\s*frame-ancestors[^;]*/g,'');
   out['content-security-policy']=policy+"; frame-ancestors 'self' "+ancestors.join(' ');
   if(out.location?.startsWith(upstream.origin))out.location=origin+out.location.slice(upstream.origin.length);
   if(openWeightsOnly&&pathname==='/api/execution-policy'&&req.method==='GET'){
    const parts=[];response.on('data',part=>parts.push(part));response.on('end',()=>{try{const policy={...JSON.parse(Buffer.concat(parts)),openWeightsOnly:true,locked:true};delete out['content-length'];res.writeHead(response.statusCode,out);res.end(JSON.stringify(policy));}catch{deny(502,'Could not read the studio profile.');}});
   }else if(String(out['content-type']).startsWith('text/html')){
    const parts=[];let bytes=0;response.on('data',part=>{bytes+=part.length;if(bytes>4*1024**2){response.destroy();res.destroy();}else parts.push(part);});
    response.on('end',()=>{const html=Buffer.concat(parts).toString('utf8').replace('</head>','<script src="/__frameforge_embed/bridge.js" defer></script></head>');delete out['content-length'];res.writeHead(response.statusCode,out);res.end(html);});
   }else{res.writeHead(response.statusCode,out);response.pipe(res);}
   response.on('error',()=>res.destroy());
  });
  request.on('error',()=>{if(!res.headersSent)deny(502,'The local studio is unavailable. Start Frameforge and retry.');else res.destroy();});
  request.setTimeout(120000,()=>request.destroy());req.on('aborted',()=>request.destroy());req.pipe(request);
 });
 server.listen(0,'127.0.0.1');await once(server,'listening');server.unref();
 return {url:'http://127.0.0.1:'+server.address().port,setAncestors(values){ancestors=embedAncestors(values);},async close(){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}};
}
