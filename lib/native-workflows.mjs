import entries from '../workflows/native/catalog.json' with {type:'json'};
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {rebuildLinks} from '../public/workflow-graph.js';
export const NATIVE_WORKFLOWS=entries.map(({models,...entry})=>({...entry,explanation:{title:entry.title,summary:entry.summary,bestFor:entry.title+' using native ComfyUI controls.',example:entry.input+' → '+entry.output,category:entry.category,inputs:[entry.input],output:entry.output,steps:['Review the exact model files and original terms.','Prepare your media and open this graph in ComfyUI.','Inspect the native controls, then press Run in ComfyUI.'],limits:entry.requirements}}));
export async function nativePacket(root,id){
 const e=entries.find(e=>e.id===id);if(!e)throw Error('Unknown native workflow.');
 const bytes=await readFile(path.join(root,'workflows',e.file));if(createHash('sha256').update(bytes).digest('hex')!==e.sha256)throw Error('The pinned upstream graph changed. Review it before using it.');
 const graph=JSON.parse(bytes),models=structuredClone(e.models);
 // Upstream T2A leaves a stale CLIP wire on a ckpt_path socket. Retain the
 // socket's declared active link and rebuild both ends of that connection.
 if(id==='ltx-audio'){graph.links=graph.links.filter(l=>l[0]!==13811);rebuildLinks(graph);}
 if(e.adapter){
  const old='ltx-2.3-22b-ic-lora-deblur-0.9.safetensors';
  const replace=value=>value===old?e.adapter.name:Array.isArray(value)?value.map(replace):value;
  for(const n of [...graph.nodes,...(graph.definitions?.subgraphs??[]).flatMap(s=>s.nodes??[])]){
   if(n.widgets_values)n.widgets_values=replace(n.widgets_values);
   if(n.type==='LTXICLoRALoaderModelOnly'){n.widgets_values=[e.adapter.name,1];n.properties={...n.properties,models:[{name:e.adapter.name,url:e.adapter.url,directory:'loras'}]};}
  }
  if(id==='ltx-clean-plate'){graph.nodes.find(n=>n.id===5508).widgets_values=['An empty view of this location. Keep the existing buildings, ground, furniture and light. No people or moving subjects.'];graph.nodes.find(n=>n.id===5509).widgets_values=['people, limbs, vehicles, ghosted subjects, flicker'];}
 }
 // Keep the graph intact, while pinning its built-in missing-model links.
 for(const n of [...graph.nodes,...(graph.definitions?.subgraphs??[]).flatMap(s=>s.nodes??[])])if(n.properties?.models)n.properties.models=n.properties.models.map(m=>{const pinned=models.find(p=>p.name===m.name);return pinned?{...m,url:pinned.url}:m;});
 return {...NATIVE_WORKFLOWS.find(w=>w.id===id),graph,models,missingDownloads:[],graphFormat:'canvas',reviewed:'2026-10-28',generationVerified:false};
}
