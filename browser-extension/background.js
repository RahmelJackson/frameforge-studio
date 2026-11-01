// Frameforge Quick: right-click an image, send it to your own studio, land in the right tool.
// The image bytes go straight from this browser to your studio; nothing passes through a server.
export const ACTIONS=[
 ['remix','Remix this image','/images?source={name}&tool=edit'],
 ['sam','Select part of it with SAM 3','/images?source={name}&tool=select'],
 ['video','Make it a video','/create?image={name}'],
 ['vertical','Make a vertical 9:16 video','/create?image={name}&aspect=portrait'],
 ['ltx','Animate with LTX 2.5 (motion + sound)','/native-workflows?workflow=ltx-native-shot&image=/assets/{name}'],
 ['identity','Use as a character (identity swap)','/native-workflows?workflow=identity-swap&image=/assets/{name}'],
 ['layout','Turn the scene into a 3D layout','/native-workflows?workflow=scene-depth&image=/assets/{name}'],
 ['prop','Make a 3D model of it','/native-workflows?workflow=prop-3d&image=/assets/{name}']
];
const MAX=25*1024*1024;
export const studioUrl=async()=>{const {studio}=await chrome.storage.sync.get('studio');return (studio||'http://127.0.0.1:4317').replace(/\/+$/,'');};
export const target=(path,name)=>path.replaceAll('{name}',encodeURIComponent(name));
chrome.runtime.onInstalled.addListener(()=>{chrome.contextMenus.removeAll(()=>{chrome.contextMenus.create({id:'ff',title:'Frameforge',contexts:['image']});for(const [id,title] of ACTIONS)chrome.contextMenus.create({id,parentId:'ff',title,contexts:['image']});});});
chrome.contextMenus.onClicked.addListener(async(info)=>{
 const action=ACTIONS.find(a=>a[0]===info.menuItemId);if(!action||!info.srcUrl)return;
 const studio=await studioUrl();let bytes,type;
 try{const r=await fetch(info.srcUrl,{credentials:'omit'});if(!r.ok)throw Error('The site refused the image ('+r.status+').');type=(r.headers.get('content-type')||'').split(';')[0];if(!/^image\/(png|jpeg|webp)$/.test(type))throw Error('That is not a PNG, JPEG or WebP image.');const buf=await r.arrayBuffer();if(buf.byteLength>MAX)throw Error('Images up to 25 MB.');bytes=Array.from(new Uint8Array(buf));}
 catch(e){const tab=await chrome.tabs.create({url:studio+'/grab#error='+encodeURIComponent(e.message)});return tab;}
 const tab=await chrome.tabs.create({url:studio+'/grab'});
 const ready=()=>new Promise(res=>{const l=(id,ch)=>{if(id===tab.id&&ch.status==='complete'){chrome.tabs.onUpdated.removeListener(l);res();}};chrome.tabs.onUpdated.addListener(l);});
 await ready();
 // Runs inside the studio tab, so the upload is a same-origin request to your studio.
 await chrome.scripting.executeScript({target:{tabId:tab.id},args:[bytes,type,action[2],info.pageUrl||''],func:async(bytes,type,path,page)=>{
  const say=t=>{const el=document.getElementById('grab-status');if(el)el.textContent=t;};
  try{say('Saving the image to your studio…');const r=await fetch('/api/assets',{method:'POST',headers:{'Content-Type':type,'x-frameforge-source':'browser-extension'},body:new Uint8Array(bytes)});const v=await r.json();if(!r.ok)throw Error(v.error||'Upload failed');
   say('Opening the tool…');location.replace(path.replaceAll('{name}',encodeURIComponent(v.name)));}
  catch(e){say(e.message);}
 }});
});
