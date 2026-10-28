export const comfyConnected=()=>Boolean(window.frameforgeComfyOrigin);
export async function sendToComfy({graph,name,files=[],execution,scope}){
 if(!comfyConnected())throw Error('Open this Studio inside ComfyUI to send a graph directly.');
 if(!graph)throw Error('This tool uses a Studio processing pipeline. Continue in its Studio editor.');
 if(execution==='partner')throw Error('This is a paid partner graph. Use its external Cloud route.');
 if(files.length>20||files.reduce((n,f)=>n+(f.bytes??0),0)>100*1024**2)throw Error('Inputs exceed the direct handoff limit. Download the workflow package instead.');
 const payload=[];let total=0;
 for(const file of files){
  if(!/^[-\w .]{1,140}\.(png|jpg|jpeg|webp|mp4|webm|wav)$/i.test(file.name)||file.name.includes('..'))throw Error('Use the downloadable package for these input filenames.');
  const url=new URL(file.url,location.href);if(url.origin!==location.origin||!url.pathname.startsWith('/'))throw Error('Only this local Studio’s prepared inputs can be sent.');
  const response=await fetch(url);if(!response.ok)throw Error('Could not read '+file.name+'. Prepare the workflow again.');
  const length=Number(response.headers.get('content-length'));if(length>80*1024**2)throw Error('Use the package for inputs larger than 80 MiB.');
  const data=await response.arrayBuffer();total+=data.byteLength;if(data.byteLength>80*1024**2||total>100*1024**2)throw Error('Inputs exceed the direct handoff limit. Download the package.');
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',data)),b=>b.toString(16).padStart(2,'0')).join('');if(file.sha256&&hash!==file.sha256)throw Error('An input changed. Prepare this workflow again.');
  payload.push({name:file.name,sha256:hash,data});
 }
 const requestId=crypto.randomUUID();
 return await new Promise((resolve,reject)=>{
  const clear=()=>{clearTimeout(timer);window.removeEventListener('message',receive);};
  const receive=event=>{if(event.source!==window.parent||event.origin!==window.frameforgeComfyOrigin||event.data?.type!=='frameforge-workflow-imported'||event.data.requestId!==requestId)return;clear();event.data.error?reject(Error(event.data.error)):resolve(event.data);};
  const timer=setTimeout(()=>{clear();reject(Error('ComfyUI has not acknowledged the handoff. Check its graph tabs before trying again.'));},60000);
  window.addEventListener('message',receive);window.parent.postMessage({type:'frameforge-workflow-import',requestId,name:String(name??'Studio workflow').slice(0,160),graph,files:payload,scope},window.frameforgeComfyOrigin,payload.map(f=>f.data));
 });
}
export function mountComfyHandoff(parent,{getPayload,onStatus=()=>{}}){
 const button=document.createElement('button');button.type='button';button.textContent='Open graph in ComfyUI →';button.hidden=!comfyConnected();parent.append(button);
 window.addEventListener('frameforge:comfy-connected',()=>button.hidden=false);
 button.onclick=async()=>{button.disabled=true;onStatus('Sending graph and prepared inputs to a new ComfyUI tab…');try{const result=await sendToComfy(await getPayload());onStatus('Opened '+result.nodes+' nodes and '+result.files+' inputs. Check the graph, then press Run in ComfyUI.');}catch(e){onStatus(e.message,true);}finally{button.disabled=false;}};
 return button;
}
