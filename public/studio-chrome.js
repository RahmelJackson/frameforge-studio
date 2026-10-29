export function enginePresentation(status={},online=false){
 if(status.connected)return {state:'ready',label:'Engine ready',href:'/setup#local-install',hint:'ComfyUI is connected. Each workflow checks its own models and nodes. '+(status.mediaAvailable?'Studio media helpers are ready.':'Media uploads also need the optional media helpers.')};
 if(online)return {state:'online',label:'Online mode',href:'/online',hint:'Use Comfy Cloud or Civitai with your own account. A local engine is optional.'};
 if(status.quickstartComplete)return {state:'offline',label:'Engine offline',href:'/setup#local-install',hint:'Start your local ComfyUI, reconnect it, or choose an online route.'};
 return {state:'setup',label:'Get set up',href:'/welcome',hint:'Choose an existing engine, install ComfyUI or create online.'};
}
if(typeof document!=='undefined'){
 let pending=false,last=0;
 async function refresh(){
  if(pending||Date.now()-last<10000)return;pending=true;last=Date.now();
  let status={};try{const response=await fetch('/api/setup/status');if(!response.ok)throw Error();status=await response.json();}
  catch{try{const response=await fetch('/api/health');if(response.ok){const health=await response.json();status={connected:health.connected,quickstartComplete:true};}}catch{}}
  let online=false;try{online=localStorage.getItem('frameforge_start_path')==='online';}catch{}
  const value=enginePresentation(status,online);
  for(const link of document.querySelectorAll('[data-engine-status]')){link.dataset.state=value.state;link.href=value.href;link.title=value.hint;link.setAttribute('aria-label',value.label+'. '+value.hint);link.querySelector('[data-engine-label]').textContent=value.label;}
  pending=false;
 }
 void refresh();addEventListener('focus',()=>void refresh());addEventListener('pageshow',()=>void refresh());
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)void refresh();});
}
