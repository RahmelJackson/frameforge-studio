// Adapt the pinned upstream graph in memory. Original files and source hashes
// remain available for provenance; exported local graphs have no API branch.
export function localLTXProfile(graph) {
 const definitions=graph.definitions?.subgraphs??[], graphs=[graph,...definitions];
 const links=g=>g.links.map(l=>Array.isArray(l)?{id:l[0],origin_id:l[1],origin_slot:l[2],target_id:l[3],target_slot:l[4],type:l[5]}:{...l});
 const write=(g,ls)=>{g.links=g===graph?ls.map(l=>[l.id,l.origin_id,l.origin_slot,l.target_id,l.target_slot,l.type]):ls;};
 const rebuild=g=>{const ls=links(g);for(const n of g.nodes){for(const i of n.inputs??[])i.link=null;for(const o of n.outputs??[])o.links=[];}for(const l of ls){const a=g.nodes.find(n=>n.id===l.origin_id),b=g.nodes.find(n=>n.id===l.target_id);if(a?.outputs?.[l.origin_slot])a.outputs[l.origin_slot].links.push(l.id);if(b?.inputs?.[l.target_slot])b.inputs[l.target_slot].link=l.id;}if(g!==graph){for(const [i,v] of (g.inputs??[]).entries())v.linkIds=ls.filter(l=>l.origin_id===-10&&l.origin_slot===i).map(l=>l.id);for(const [i,v] of (g.outputs??[]).entries())v.linkIds=ls.filter(l=>l.target_id===-20&&l.target_slot===i).map(l=>l.id);}};
 for(const g of graphs){
  let ls=links(g).filter(l=>(l.origin_id===-10||g.nodes.some(n=>n.id===l.origin_id))&&(l.target_id===-20||g.nodes.some(n=>n.id===l.target_id)));const remove=new Set(g.nodes.filter(n=>['GemmaAPITextEncode','TextGenerateLTX2Prompt','StringContains'].includes(n.type)||n.type==='CLIPLoader'&&JSON.stringify(n).includes('gemma4_e2b')).map(n=>n.id));
  // These switches select local text vs enhanced/API text. Keep the local input.
  for(const n of g.nodes.filter(n=>n.type==='ComfySwitchNode')){
   const onFalse=n.inputs?.findIndex(i=>i.name==='on_false'),source=ls.find(l=>l.target_id===n.id&&l.target_slot===onFalse);
   if(!source||!n.inputs?.some(i=>i.name==='switch'))continue;
   const isPromptBranch=ls.some(l=>l.target_id===n.id&&remove.has(l.origin_id))||['STRING','CONDITIONING'].includes(n.outputs?.[0]?.type)&&g.nodes.some(n=>n.type==='GemmaAPITextEncode');
   if(!isPromptBranch)continue;
   for(const l of ls.filter(l=>l.origin_id===n.id)){l.origin_id=source.origin_id;l.origin_slot=source.origin_slot;}
   remove.add(n.id);
  }
  g.nodes=g.nodes.filter(n=>!remove.has(n.id));ls=ls.filter(l=>!remove.has(l.origin_id)&&!remove.has(l.target_id));
  // Keep a concrete passthrough node for exporters that do not compile a
  // direct subgraph-input → subgraph-output boundary link.
  for(const l of [...ls].filter(l=>l.origin_id===-10&&l.target_id===-20&&l.type==='STRING')){const id=Math.max(0,...g.nodes.map(n=>n.id))+1,linkId=Math.max(0,...ls.map(l=>l.id))+1;g.nodes.push({id,type:'PrimitiveString',pos:[0,0],size:[300,100],flags:{},order:0,mode:0,inputs:[{name:'value',type:'STRING',widget:{name:'value'},link:linkId}],outputs:[{name:'STRING',type:'STRING',links:[l.id]}],properties:{'Node name for S&R':'PrimitiveString'},widgets_values:['']});ls.push({id:linkId,origin_id:-10,origin_slot:l.origin_slot,target_id:id,target_slot:0,type:'STRING'});l.origin_id=id;l.origin_slot=0;}
  write(g,ls);
 }
 // Remove unused subgraph ports too, so the native editor does not show retired
 // API/enhancer controls or request their weights. Rebuild promoted defaults.
 for(let pass=0;pass<definitions.length+1;pass++){
  let changed=false;
  for(const sub of definitions){let ls=links(sub);
   for(const [direction,boundary,slot] of [['inputs',-10,'origin_slot'],['outputs',-20,'target_slot']]){
    const ports=sub[direction]??[],usedOutput=i=>graphs.some(parent=>parent.nodes.some(n=>n.type===sub.id&&links(parent).some(l=>l.origin_id===n.id&&l.origin_slot===i))),keep=ports.map((_,i)=>i).filter(i=>ls.some(l=>(direction==='inputs'?l.origin_id:l.target_id)===boundary&&l[slot]===i)&&(direction==='inputs'||usedOutput(i)));
    if(keep.length===ports.length)continue;changed=true;const map=new Map(keep.map((old,i)=>[old,i]));sub[direction]=keep.map(i=>ports[i]);ls=ls.filter(l=>(direction==='inputs'?l.origin_id:l.target_id)!==boundary||map.has(l[slot]));for(const l of ls)if((direction==='inputs'?l.origin_id:l.target_id)===boundary)l[slot]=map.get(l[slot]);
    for(const parent of graphs){let pl=links(parent);for(const n of parent.nodes.filter(n=>n.type===sub.id)){n[direction]=keep.map(i=>n[direction]?.[i]).filter(Boolean);delete n.widgets_values;delete n.widgets_values_named;
     pl=pl.filter(l=>direction==='inputs'?l.target_id!==n.id||map.has(l.target_slot):l.origin_id!==n.id||map.has(l.origin_slot));for(const l of pl)if((direction==='inputs'?l.target_id:l.origin_id)===n.id)l[direction==='inputs'?'target_slot':'origin_slot']=map.get(l[direction==='inputs'?'target_slot':'origin_slot']);
    }write(parent,pl);}
   }const dead=new Set(sub.nodes.filter(n=>n.type==='CLIPLoader'&&!ls.some(l=>l.origin_id===n.id)).map(n=>n.id));if(dead.size){changed=true;sub.nodes=sub.nodes.filter(n=>!dead.has(n.id));ls=ls.filter(l=>!dead.has(l.target_id));}write(sub,ls);
  }if(!changed)break;
 }
 for(const g of graphs){rebuild(g);for(const n of g.nodes.filter(n=>['Note','MarkdownNote'].includes(n.type))){n.widgets_values=(n.widgets_values??[]).map(v=>typeof v==='string'?v.split('\n').filter(line=>!/gemma4_e2b|\*\*Text Enhancer\*\*/i.test(line)).join('\n')+'\n\nFrameforge local export: int8 core weights, direct local prompts, no API key or prompt-enhancer download.':v);}}
 graph.extra={...graph.extra,frameforgeLocalProfile:'LTX 2.5 int8 · direct local prompts · no API or prompt-enhancer weights'};
 return graph;
}
