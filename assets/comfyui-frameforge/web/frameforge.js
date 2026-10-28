import {app} from '../../../scripts/app.js';
import {api} from '../../../scripts/api.js';
const localStudio=value=>{const url=new URL(value);if(url.protocol!=='http:'||!['localhost','127.0.0.1','[::1]'].includes(url.hostname)||url.username||url.password||url.search||url.hash||url.pathname!=='/')throw Error('Use the root address of your local Frameforge Studio.');return url.origin;};
const openStudio=url=>{const tab=window.open(url,'_blank');if(tab)tab.opener=null;return tab;};
app.registerExtension({name:'Frameforge.StudioBridge',nodeCreated(node){
 const kind={FrameforgeStudioOutput:'image',FrameforgeStudioVideoOutput:'video',FrameforgeStudioAudioOutput:'audio'}[node.comfyClass];if(!kind)return;
 node.color='#354632';node.bgcolor='#18231c';node.title='Frameforge · '+kind[0].toUpperCase()+kind.slice(1)+' handoff';
 let media,studio='http://127.0.0.1:4317',sending=false;
 const box=document.createElement('div');box.style.cssText='font:12px/1.6 system-ui;color:#d1dfc8;padding:10px 12px;background:#202d22;border:1px solid #526c4555;border-radius:8px;box-sizing:border-box;white-space:normal';const help=document.createElement('p');help.style.cssText='margin:0 0 8px';help.textContent='1. Connect your '+kind+' output. 2. Run this graph. 3. Send the saved result to Studio.';const launch=document.createElement('a');launch.href=studio;launch.target='_blank';launch.rel='noopener';launch.textContent='Open Frameforge Studio ↗';launch.style.cssText='display:block;color:#dcffb8;text-decoration:none;border-top:1px solid #526c4555;padding-top:6px';box.append(help,launch);
 node.addDOMWidget?.('frameforge_help','frameforge',box,{serialize:false,hideOnZoom:false,getMinHeight:()=>105,getMaxHeight:()=>105});
 const previous=node.onExecuted;node.onExecuted=function(message){previous?.apply(this,arguments);media=(message.frameforge_media??message.images)?.[0];help.textContent=media?'Saved '+kind+' ready. Send it to Studio to edit, caption or reuse it.':'No saved result yet. Run the connected graph first.';node.setDirtyCanvas(true,true);};
 node.addWidget('button','Send saved '+kind+' → Studio',null,async()=>{
  if(sending)return;if(!media){help.textContent='Nothing to send yet. Connect your '+kind+' and run this output node first.';return;}
  const address=prompt('Local Frameforge address',studio);if(!address)return;try{studio=localStudio(address);launch.href=studio;}catch(error){help.textContent=error.message;return;}
  sending=true;const tab=openStudio('about:blank');help.textContent='Importing the saved '+kind+' into Studio…';
  try{const response=await api.fetchApi('/frameforge/send',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({studio,media})}),value=await response.json();if(!response.ok)throw Error(value.error);const url=new URL(value.url);if(url.origin!==studio)throw Error('Unexpected Studio address.');help.textContent='Imported. Your original stays saved in ComfyUI.';if(tab)tab.location.href=url.href;else help.textContent='Imported. Open '+url.href;}catch(error){tab?.close();help.textContent=error.message;}finally{sending=false;}
 });
 const resize=()=>{const size=node.computeSize();node.setSize([Math.max(360,node.size[0],size[0]),Math.max(200,size[1])]);};const configured=node.onConfigure;node.onConfigure=function(){configured?.apply(this,arguments);node.title='Frameforge · '+kind[0].toUpperCase()+kind.slice(1)+' handoff';resize();};resize();
}});
