const frame=document.querySelector('#studio'),opening=document.querySelector('#opening'),status=document.querySelector('#status');
const notice=document.querySelector('#connection-notice'),message=document.querySelector('#connection-message'),directLink=document.querySelector('#direct-link');
directLink.href=STUDIO_ORIGIN;
function showNotice(text){message.textContent=text;notice.hidden=false;}
let next=0,parentOrigin='*',timer;const pending=new Map();
function request(method,params={}){return new Promise((resolve,reject)=>{const id=++next,timeout=setTimeout(()=>{pending.delete(id);reject(Error('This client did not answer the studio connection.'));},20000);pending.set(id,{resolve,reject,timeout});window.parent.postMessage({jsonrpc:'2.0',id,method,params},parentOrigin);});}
window.addEventListener('message',event=>{
 if(event.source===frame.contentWindow&&event.origin===STUDIO_EMBED_ORIGIN){
  if(event.data?.type==='frameforge-studio-ready'){clearTimeout(timer);opening.hidden=true;notice.hidden=true;document.body.classList.add('ready');}
  if(event.data?.type==='frameforge-external-link'){try{const url=new URL(event.data.url);if(['https:','http:'].includes(url.protocol)&&!url.username&&!url.password)openLink(url.href).catch(error=>showNotice(error.message));}catch{}}
  return;
 }
 if(event.source!==window.parent||event.data?.jsonrpc!=='2.0')return;
 if(parentOrigin!=='*'&&event.origin!==parentOrigin)return;
 if(Object.hasOwn(event.data,'id')&&pending.has(event.data.id)){const p=pending.get(event.data.id);pending.delete(event.data.id);clearTimeout(p.timeout);if(event.origin!=='null')parentOrigin=event.origin;event.data.error?p.reject(Error(event.data.error.message)):p.resolve(event.data.result);}
});
async function openLink(url){const result=await request('ui/open-link',{url});if(result?.isError||result?.opened===false)throw Error('The client declined to open that link.');}
async function external(){showNotice('Requested opening the studio. If no window appears, use the studio link below: '+STUDIO_ORIGIN);try{await openLink(STUDIO_ORIGIN);}catch(error){showNotice(error.message+' Your studio address is '+STUDIO_ORIGIN);}}
document.querySelector('#browser').onclick=external;document.querySelector('#fallback').onclick=external;
async function start(){
 document.querySelector('#retry').hidden=true;status.textContent='Opening your images, video, voices and films…';
 try{
  await request('ui/initialize',{protocolVersion:'2026-01-26',appInfo:{name:'frameforge-studio',version:'0.5.2'},appCapabilities:{}});
  window.parent.postMessage({jsonrpc:'2.0',method:'ui/notifications/initialized',params:{}},parentOrigin);
  const ancestors=[location.origin,parentOrigin,...Array.from(location.ancestorOrigins??[])].filter(o=>o&&o!=='null'&&o!=='*');
  if(!ancestors.length)throw Error('This client does not expose an embeddable page origin.');
  const result=await request('tools/call',{name:'studio_workflows',arguments:{embedAncestors:[...new Set(ancestors)]}});
  if(result.isError)throw Error(result.content?.[0]?.text??'Studio connection failed.');
  frame.hidden=false;frame.src=STUDIO_EMBED_ORIGIN+'/';
  // Do not cover a usable editor while waiting for its optional ready message.
  opening.hidden=true;document.body.classList.add('ready');notice.hidden=true;
  timer=setTimeout(()=>{showNotice('The studio has not confirmed loading. If the editor is blank, this client may have blocked its local frame.');document.querySelector('#retry').hidden=false;},12000);
  window.parent.postMessage({jsonrpc:'2.0',method:'ui/notifications/size-changed',params:{height:Math.max(740,innerHeight)}},parentOrigin);
 }catch(error){if(frame.hidden){status.textContent=error.message;opening.hidden=false;}else showNotice(error.message);document.querySelector('#retry').hidden=false;}
}
const retry=()=>{clearTimeout(timer);start();};document.querySelector('#retry').onclick=retry;document.querySelector('#retry-frame').onclick=retry;start();
