import {app} from '../../../scripts/app.js';
import {api} from '../../../scripts/api.js';
app.registerExtension({name:'Frameforge.StudioBridge',nodeCreated(node){
 if(node.comfyClass!=='FrameforgeStudioOutput')return;
 let image;const previous=node.onExecuted;node.onExecuted=function(message){previous?.apply(this,arguments);image=message.images?.[0];};
 node.addWidget('button','Send saved image to Frameforge',null,async()=>{
  if(!image){alert('Run this output node first, then send its saved image.');return;}
  const studio=prompt('Local Frameforge address','http://127.0.0.1:4317');if(!studio)return;
  const tab=window.open('about:blank','_blank');
  try{const response=await api.fetchApi('/frameforge/send',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({studio,image})}),value=await response.json();if(!response.ok)throw Error(value.error);const url=new URL(value.url);if(url.protocol!=='http:'||!['localhost','127.0.0.1','[::1]'].includes(url.hostname))throw Error('Unexpected Studio address.');if(tab){tab.opener=null;tab.location.href=url.href;}else alert('Image imported. Open '+url.href);}catch(error){tab?.close();alert(error.message);}
 });
}});
