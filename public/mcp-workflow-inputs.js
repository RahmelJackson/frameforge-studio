export const isProviderRecipe=id=>['ltx-vfx','flux3-image','minimax-h3-local'].includes(id);
export function mcpRecipeInput(id,{asset,prompt,seed,aspect='landscape',preset='locked'}){
 if(!['z-image','qwen-edit','sam-image','wan-i2v','wan-camera','ltx-vfx','flux3-image','minimax-h3-local'].includes(id))throw Error('Choose a supported local recipe.');
 if(id!=='z-image'&&!asset)throw Error('Choose or import a starting image first.');
 if(isProviderRecipe(id))return {context:id==='flux3-image'?'images':'create',provider:'local',task:id,input:{asset,prompt,seed}};
 if(['z-image','qwen-edit','sam-image'].includes(id))return {context:'images',provider:'local',input:{tool:id==='z-image'?'create':id==='sam-image'?'select':'edit',...(id==='sam-image'?{segmentMethod:'text'}:{}),prompt,aspect,seed,...(asset?{asset}:{})}};
 return {context:'create',provider:'local',input:{mode:'image',engine:id==='wan-camera'?'camera':'wan5b',asset,prompt,preset,aspect,length:'preview',seed,quality:'draft'}};
}
// MCP Apps inline this small pure converter; no imports, filesystem or network access.
export function mcpNativePrompt(graph){
 if(!Array.isArray(graph?.nodes)||!Array.isArray(graph.links))throw Error('Inspect a prepared graph first.');const api={};
 for(const node of graph.nodes){const names=node.properties?.['frameforge.widget_names'];if(!Array.isArray(names))throw Error('This graph requires native ComfyUI compilation.');const inputs={};for(const [i,name] of names.entries()){if(name.endsWith(' control'))continue;if(['__proto__','prototype','constructor'].includes(name))throw Error('Invalid widget name.');inputs[name]=node.widgets_values[i];}for(const [i,input] of (node.inputs??[]).entries()){const link=graph.links.find(l=>l[3]===node.id&&l[4]===i);if(link)inputs[input.name]=[String(link[1]),link[2]];}api[String(node.id)]={class_type:node.type,inputs};}return api;
}
