const MAX_GRAPH=4*1024**2,MAX_MEDIA=100*1024**2;
const mediaTypes=new Set(['LoadImage','LoadImageMask','LoadVideo','LoadAudio','VHS_LoadVideo','VHS_LoadVideoPath','VHS_LoadAudio']);
export function checkTransfer(value){
 if(!value||!/^[-a-f0-9]{36}$/i.test(value.requestId??'')||typeof value.name!=='string'||value.name.length>160)throw Error('Invalid workflow handoff.');
 const graph=value.graph;
 if(!graph||typeof graph!=='object'||Array.isArray(graph)||JSON.stringify(graph).length>MAX_GRAPH)throw Error('Choose a workflow up to 4 MiB.');
 const canvas=Array.isArray(graph.nodes),nodes=canvas?graph.nodes:Object.values(graph);
 if(!nodes.length||nodes.length>500||nodes.some(n=>!n||typeof(canvas?n.type:n.class_type)!=='string'||!canvas&&(!n.inputs||typeof n.inputs!=='object')))throw Error('Choose a ComfyUI graph with 1–500 nodes.');
 if(canvas&&!Array.isArray(graph.links))throw Error('The canvas is missing its connections.');
 const files=value.files??[];if(!Array.isArray(files)||files.length>20)throw Error('Use at most 20 input files.');
 const names=new Set();let total=0;
 for(const f of files){
  if(!f||typeof f.name!=='string'||!/^[-\w .]{1,140}\.(png|jpg|jpeg|webp|mp4|webm|wav)$/i.test(f.name)||f.name.includes('..')||names.has(f.name)||!(f.data instanceof ArrayBuffer)||!f.data.byteLength||f.data.byteLength>80*1024**2||!/^[a-f0-9]{64}$/.test(f.sha256??''))throw Error('Use uniquely named PNG, JPEG, WebP, MP4, WebM or WAV inputs up to 80 MiB each.');
  names.add(f.name);total+=f.data.byteLength;
 }
 if(total>MAX_MEDIA)throw Error('Input files exceed 100 MiB. Use the downloadable package for larger handoffs.');
 return {graph,files,canvas};
}
export function remapInputs(graph,files){
 const next=structuredClone(graph),replace=value=>typeof value==='string'&&files.has(value)?files.get(value):Array.isArray(value)?value.map(replace):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).map(([k,v])=>[k,replace(v)])):value;
 if(Array.isArray(next.nodes)){next.id=crypto.randomUUID();const visit=g=>{for(const n of g.nodes??[])if(mediaTypes.has(n.type)){n.widgets_values=replace(n.widgets_values);if(n.widgets_values_named)n.widgets_values_named=replace(n.widgets_values_named);}for(const sub of g.definitions?.subgraphs??[])visit(sub);};visit(next);}
 else for(const n of Object.values(next))if(mediaTypes.has(n.class_type))n.inputs=replace(n.inputs);
 return next;
}
export async function importWorkflow(app,api,value){
 const {graph,files}=checkTransfer(value),paths=new Map(),prefix='frameforge-'+value.requestId+'-';
 // Verify every input before creating any local uploads. Never queue a run.
 for(const file of files){const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',file.data)),b=>b.toString(16).padStart(2,'0')).join('');if(hash!==file.sha256)throw Error('Input checksum changed: '+file.name);}
 for(const file of files){
  // Native LoadImage enumerates files at the input root. Unique names keep
  // these inputs discoverable without replacing anybody's existing media.
  const form=new FormData();form.append('image',new Blob([file.data]),prefix+file.name);form.append('type','input');form.append('subfolder','');form.append('overwrite','false');
  const response=await api.fetchApi('/upload/image',{method:'POST',body:form}),item=await response.json();
  if(!response.ok)throw Error(item.error??'Could not copy '+file.name+' into ComfyUI.');
  if(item.type!=='input'||item.subfolder!==''||typeof item.name!=='string'||!item.name.startsWith(prefix)||item.name.includes('/')||item.name.includes('\\')||item.name.includes('..'))throw Error('Unexpected ComfyUI upload destination.');
  paths.set(file.name,item.name);
 }
 if(files.length&&app.refreshComboInNodes)await app.refreshComboInNodes();
 const next=remapInputs(graph,paths),name='Frameforge - '+value.name.replace(/[^\w .-]/g,' ').slice(0,90)+' - '+value.requestId.slice(0,8)+'.json';
 await app.handleFile(new File([JSON.stringify(next)],name,{type:'application/json'}));
 return {name,files:files.length,nodes:Array.isArray(graph.nodes)?graph.nodes.length:Object.keys(graph).length};
}
