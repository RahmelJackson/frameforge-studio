export function graphModelNames(value){
 const names=new Set();function walk(v){if(typeof v==='string'&&/\.(safetensors|ckpt|pth|bin|onnx|gguf)$/.test(v))names.add(v.split(/[\\/]/).at(-1));else if(Array.isArray(v))v.forEach(walk);else if(v&&typeof v==='object')Object.values(v).forEach(walk);}walk(value);return [...names];
}
export function audioModelBindings(registry,bindings){
 const models=[],unresolved=[];
 for(const [name,sha256] of Object.entries(bindings??{})){const model=registry.find(m=>m.sha256===sha256&&m.path&&(name===m.path||name.endsWith('/'+m.path))&&(!m.directory||name.includes(m.directory+'/')));if(model)models.push(model);else unresolved.push(name);}
 return {models,unresolved};
}
export function resultProvenance(job,graph,models){
 const names=graphModelNames(graph),known=names.map(name=>models.find(m=>m.name===name)).filter(Boolean);
 return {id:job.id,createdVia:job.createdVia??'Origin not recorded',recipe:job.request?.providerWorkflow??job.request?.engine??job.request?.tool??'Saved local workflow',seed:job.request?.seed??null,source:job.request?.asset??null,models:known.map(m=>({name:m.name,url:m.url,licenseUrl:m.licenseUrl,sha256:m.sha256})),unresolved:names.filter(n=>!known.some(m=>m.name===n)),graphAvailable:!!graph,note:'Model names come from the saved graph. Source links describe model terms; this does not grant a new license or certify creative quality.'};
}
