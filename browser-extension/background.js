// Frameforge Quick: right-click an image or a video, send it to your own studio, land in the right tool.
// The bytes go straight from this browser to your studio; nothing passes through a server.
export const IMAGE_ACTIONS=[
 ['remix','Remix this image','/images?source={name}&tool=edit'],
 ['sam','Select part of it with SAM 3','/images?source={name}&tool=select'],
 ['pose','Copy the pose (OpenPose)','/images?source={name}&tool=identity-pose'],
 ['video','Make it a video','/create?image={name}'],
 ['vertical','Make a vertical 9:16 video','/create?image={name}&aspect=portrait'],
 ['ltx','Animate with LTX 2.5 (motion + sound)','/native-workflows?workflow=ltx-native-shot&image=/assets/{name}'],
 ['identity','Use as a character (identity swap)','/native-workflows?workflow=identity-swap&image=/assets/{name}'],
 ['layout','Turn the scene into a 3D layout','/native-workflows?workflow=scene-depth&image=/assets/{name}'],
 ['prop','Make a 3D model of it','/native-workflows?workflow=prop-3d&image=/assets/{name}']
];
export const VIDEO_ACTIONS=[
 ['v-remix','Remix this video with LTX 2.5','/native-workflows?workflow=ltx-adapter-edit&video={url}'],
 ['v-vertical','Make it vertical 9:16','/native-workflows?workflow=ltx-outpaint&video={url}'],
 ['v-swap','Swap in your character','/native-workflows?workflow=identity-swap&video={url}'],
 ['v-swap-lite','Swap in your character (lighter GPU)','/native-workflows?workflow=character-replace&video={url}'],
 ['v-motion','Use its motion on your character','/native-workflows?workflow=wan-animate-fast&video={url}'],
 ['v-sam','Track a subject with SAM 3','/video-tools?tool=segment&footage={id}'],
 ['v-upscale','Upscale it','/native-workflows?workflow=video-upscale-seedvr2&video={url}'],
 ['v-edit','Cut, dub and caption','/video-tools?footage={id}']
];
const ALL=[...IMAGE_ACTIONS.map(a=>[...a,'image']),...VIDEO_ACTIONS.map(a=>[...a,'video'])];
export const studioUrl=async()=>{const {studio}=await chrome.storage.sync.get('studio');return (studio||'http://127.0.0.1:4317').replace(/\/+$/,'');};
chrome.runtime.onInstalled.addListener(()=>{chrome.contextMenus.removeAll(()=>{
 chrome.contextMenus.create({id:'ff-image',title:'Frameforge',contexts:['image']});
 chrome.contextMenus.create({id:'ff-video',title:'Frameforge',contexts:['video']});
 for(const [id,title,,kind] of ALL)chrome.contextMenus.create({id,parentId:'ff-'+kind,title,contexts:[kind]});});});
const LIMIT={image:25*1024*1024,video:100*1024*1024};
const TYPES={image:/^image\/(png|jpeg|webp)$/,video:/^video\/(mp4|webm|quicktime)$/};
chrome.contextMenus.onClicked.addListener(async(info)=>{
 const action=ALL.find(a=>a[0]===info.menuItemId);if(!action)return;const kind=action[3],studio=await studioUrl();
 const fail=message=>chrome.tabs.create({url:studio+'/grab#error='+encodeURIComponent(message)});
 if(!info.srcUrl||info.srcUrl.startsWith('blob:'))return fail(kind==='video'?'This site streams its video in pieces, so the browser cannot hand over a file. Download the clip and add it in Studio instead.':'This image has no address the browser can read.');
 let bytes,type;
 try{const r=await fetch(info.srcUrl,{credentials:'omit'});if(!r.ok)throw Error('The site refused the '+kind+' ('+r.status+').');type=(r.headers.get('content-type')||'').split(';')[0];if(!TYPES[kind].test(type))throw Error(kind==='video'?'That is not an MP4, MOV or WebM file.':'That is not a PNG, JPEG or WebP image.');const buf=await r.arrayBuffer();if(buf.byteLength>LIMIT[kind])throw Error(kind==='video'?'Videos up to 100 MB.':'Images up to 25 MB.');bytes=Array.from(new Uint8Array(buf));}
 catch(e){return fail(e.message);}
 const tab=await chrome.tabs.create({url:studio+'/grab'});
 await new Promise(res=>{const l=(id,ch)=>{if(id===tab.id&&ch.status==='complete'){chrome.tabs.onUpdated.removeListener(l);res();}};chrome.tabs.onUpdated.addListener(l);});
 // Runs inside the studio tab, so the upload is a same-origin request to your studio.
 await chrome.scripting.executeScript({target:{tabId:tab.id},args:[bytes,type,action[2],kind],func:async(bytes,type,path,kind)=>{
  const say=t=>{const el=document.getElementById('grab-status');if(el)el.textContent=t;};
  try{say('Saving the '+kind+' to your studio…');const r=await fetch(kind==='video'?'/api/footage':'/api/assets',{method:'POST',headers:{'Content-Type':type,'x-frameforge-source':'browser-extension','x-file-name':'From the web'},body:new Uint8Array(bytes)});const v=await r.json();if(!r.ok)throw Error(v.error||'Upload failed');
   const url=kind==='video'?'/footage/'+v.id+'/'+v.filename:'/assets/'+v.name;
   say('Opening the tool…');location.replace(path.replaceAll('{name}',encodeURIComponent(v.name??'')).replaceAll('{id}',encodeURIComponent(v.id??'')).replaceAll('{url}',encodeURIComponent(url)));}
  catch(e){say(e.message);}
 }});
});
