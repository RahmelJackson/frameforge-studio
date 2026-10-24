// ComfyUI 0.4 workflow editing. Keep unknown metadata for native-editor round trips.
export function validateGraph(g){
  if(!g||!Array.isArray(g.nodes)||!Array.isArray(g.links)||g.nodes.length>500)throw Error('Import a ComfyUI canvas JSON with at most 500 nodes. API prompts need conversion first.');
  const ids=new Set();for(const n of g.nodes){if(!Number.isSafeInteger(n.id)||ids.has(n.id)||typeof n.type!=='string')throw Error('Invalid or duplicate node.');ids.add(n.id);if(!Array.isArray(n.pos)||n.pos.length!==2||!n.pos.every(Number.isFinite))throw Error('Invalid node position.');for(const key of ['inputs','outputs','widgets_values'])if(n[key]!==undefined&&!Array.isArray(n[key]))throw Error('Invalid node '+key+'.');}
  const links=new Set(),targets=new Set();for(const l of g.links){if(!Array.isArray(l)||l.length!==6||links.has(l[0])||!l.slice(0,5).every(v=>Number.isSafeInteger(v)&&v>=0))throw Error('Invalid link.');links.add(l[0]);const key=l[3]+':'+l[4];if(targets.has(key))throw Error('An input has multiple connections.');targets.add(key);const a=g.nodes.find(n=>n.id===l[1]),b=g.nodes.find(n=>n.id===l[3]);if(!a?.outputs?.[l[2]]||!b?.inputs?.[l[4]])throw Error('Link refers to a missing node or socket.');}
  // Detect cycles before exporting a graph that cannot execute.
  const visiting=new Set(),done=new Set();function visit(id){if(visiting.has(id))throw Error('Connections contain a cycle.');if(done.has(id))return;visiting.add(id);for(const l of g.links.filter(l=>l[1]===id))visit(l[3]);visiting.delete(id);done.add(id);}for(const id of ids)visit(id);
  return g;
}
export function rebuildLinks(g){for(const n of g.nodes){for(const i of n.inputs??[])i.link=null;for(const o of n.outputs??[])o.links=[];}for(const [id,from,out,to,input] of g.links){g.nodes.find(n=>n.id===from).outputs[out].links.push(id);g.nodes.find(n=>n.id===to).inputs[input].link=id;}g.last_link_id=Math.max(0,...g.links.map(l=>l[0]));return g;}
export function connect(g,from,out,to,input){
  const copy=structuredClone(g),a=copy.nodes.find(n=>n.id===from),b=copy.nodes.find(n=>n.id===to),source=a?.outputs?.[out],target=b?.inputs?.[input];
  if(!source||!target||from===to)throw Error('Choose an output and a different node’s input.');
  if(source.type!==target.type&&source.type!=='*'&&target.type!=='*')throw Error(`Cannot connect ${source.type} to ${target.type}.`);
  copy.links=copy.links.filter(l=>!(l[3]===to&&l[4]===input));copy.links.push([Math.max(0,...copy.links.map(l=>l[0]))+1,from,out,to,input,source.type]);validateGraph(copy);return rebuildLinks(copy);
}
export function apiToCanvas(api,info){
  if(!api||Array.isArray(api)||Object.values(api).some(n=>!n?.class_type||!n.inputs))throw Error('This record is a local processor, not a ComfyUI node graph.');
  const ids=Object.keys(api),mapping=new Map(ids.map((id,i)=>[id,i+1]));const nodes=[],links=[];
  for(const [index,id] of ids.entries()){
    const n=api[id],schema=info[n.class_type];if(!schema)throw Error('Missing node schema: '+n.class_type);
    const inputs=[],widgets=[],names=[];const defs={...schema.input?.required,...schema.input?.optional};
    for(const [name,value] of Object.entries(n.inputs)){
      const spec=defs[name];if(!spec)throw Error('Missing input schema: '+n.class_type+'.'+name);
      const type=spec[0],isLink=Array.isArray(value)&&value.length===2&&mapping.has(String(value[0]));
      if(isLink||(!Array.isArray(type)&&!['STRING','INT','FLOAT','BOOLEAN','COMBO'].includes(type))||spec[1]?.forceInput){inputs.push({name,type:Array.isArray(type)?'COMBO':type,link:null});}
    }
    // Widget serialization follows schema order, including the frontend seed control.
    for(const [name,spec] of Object.entries(defs)){
      if(!(name in n.inputs)||inputs.some(i=>i.name===name))continue;
      widgets.push(n.inputs[name]);names.push(name);if(spec[1]?.control_after_generate){widgets.push('fixed');names.push(name+' control');}
    }
    nodes.push({id:index+1,type:n.class_type,pos:[(index%4)*350,Math.floor(index/4)*350],size:[310,230],flags:{},order:index,mode:0,inputs,outputs:(schema.output??[]).map((type,i)=>({name:schema.output_name?.[i]??type,type,links:[]})),properties:{'Node name for S&R':n.class_type,'frameforge.widget_names':names},widgets_values:widgets});
  }
  for(const [id,n] of Object.entries(api)){for(const [name,value] of Object.entries(n.inputs)){if(Array.isArray(value)&&value.length===2&&mapping.has(String(value[0]))){const target=nodes.find(n=>n.id===mapping.get(id)),slot=target.inputs.findIndex(i=>i.name===name);links.push([links.length+1,mapping.get(String(value[0])),value[1],target.id,slot,target.inputs[slot].type]);}}}
  return validateGraph(rebuildLinks({last_node_id:nodes.length,last_link_id:links.length,nodes,links,groups:[],config:{},extra:{},version:0.4}));
}
export function canvasToApi(canvas){
 validateGraph(canvas);const graph={};
 for(const n of canvas.nodes){const names=n.properties?.['frameforge.widget_names'];if(!Array.isArray(names))throw Error('This graph needs the native ComfyUI editor to compile. Prepare it from the current tab first.');const inputs={};for(let i=0;i<names.length;i++){const name=names[i];if(name.endsWith(' control'))continue;if(['__proto__','prototype','constructor'].includes(name))throw Error('Invalid input name.');inputs[name]=n.widgets_values[i];}for(let i=0;i<(n.inputs??[]).length;i++){const link=canvas.links.find(l=>l[3]===n.id&&l[4]===i);if(link)inputs[n.inputs[i].name]=[String(link[1]),link[2]];}graph[String(n.id)]={class_type:n.type,inputs};}
 return graph;
}
