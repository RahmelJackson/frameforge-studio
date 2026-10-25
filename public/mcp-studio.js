const frame=document.querySelector('#studio'),opening=document.querySelector('#opening'),status=document.querySelector('#status');
let next=0,parentOrigin='*',timer;const pending=new Map();
function request(method,params={}){return new Promise((resolve,reject)=>{const id=++next,timeout=setTimeout(()=>{pending.delete(id);reject(Error('This client did not answer the studio connection.'));},20000);pending.set(id,{resolve,reject,timeout});window.parent.postMessage({jsonrpc:'2.0',id,method,params},parentOrigin);});}
window.addEventListener('message',event=>{
 if(event.source===frame.contentWindow&&event.origin===STUDIO_EMBED_ORIGIN){
  if(event.data?.type==='frameforge-studio-ready'){clearTimeout(timer);opening.hidden=true;document.body.classList.add('ready');}
  if(event.data?.type==='frameforge-external-link'){try{const url=new URL(event.data.url);if(['https:','http:'].includes(url.protocol)&&!url.username&&!url.password)request('ui/open-link',{url:url.href}).catch(()=>{status.textContent='Open the studio in your browser to continue to this external service.';opening.hidden=false;});}catch{}}
  return;
 }
 if(event.source!==window.parent||event.data?.jsonrpc!=='2.0')return;
 if(parentOrigin!=='*'&&event.origin!==parentOrigin)return;
 if(Object.hasOwn(event.data,'id')&&pending.has(event.data.id)){const p=pending.get(event.data.id);pending.delete(event.data.id);clearTimeout(p.timeout);if(event.origin!=='null')parentOrigin=event.origin;event.data.error?p.reject(Error(event.data.error.message)):p.resolve(event.data.result);}
});
async function external(){try{await request('ui/open-link',{url:STUDIO_ORIGIN});}catch{status.textContent='Open '+STUDIO_ORIGIN+' in a browser on the computer running Frameforge.';opening.hidden=false;}}
document.querySelector('#browser').onclick=external;document.querySelector('#fallback').onclick=external;
async function start(){
 document.querySelector('#retry').hidden=true;status.textContent='Opening your images, video, voices and films…';
 try{
  await request('ui/initialize',{protocolVersion:'2026-01-26',appInfo:{name:'frameforge-studio',version:'0.5.1'},appCapabilities:{}});
  window.parent.postMessage({jsonrpc:'2.0',method:'ui/notifications/initialized',params:{}},parentOrigin);
  const ancestors=[location.origin,parentOrigin,...Array.from(location.ancestorOrigins??[])].filter(o=>o&&o!=='null'&&o!=='*');
  if(!ancestors.length)throw Error('This client does not expose an embeddable page origin.');
  const result=await request('tools/call',{name:'studio_workflows',arguments:{embedAncestors:[...new Set(ancestors)]}});
  if(result.isError)throw Error(result.content?.[0]?.text??'Studio connection failed.');
  frame.hidden=false;frame.src=STUDIO_EMBED_ORIGIN+'/';
  timer=setTimeout(()=>{status.textContent='This client may block embedded local pages. Open the complete studio in your browser, or retry.';document.querySelector('#retry').hidden=false;},12000);
  window.parent.postMessage({jsonrpc:'2.0',method:'ui/notifications/size-changed',params:{height:Math.max(740,innerHeight)}},parentOrigin);
 }catch(error){status.textContent=error.message+' You can still use the complete studio in your browser.';document.querySelector('#retry').hidden=false;}
}
document.querySelector('#retry').onclick=()=>{clearTimeout(timer);start();};start();
