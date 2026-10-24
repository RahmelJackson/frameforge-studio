import {readFile,writeFile,rename,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {breakDownScript,validateBrief} from './story.mjs';
export class LibraryStore{
  constructor(directory){this.file=path.join(directory,'library.json');this.data={plans:[],references:[],recipes:[]};this.pending=Promise.resolve();}
  async open(){try{this.data=JSON.parse(await readFile(this.file,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}return this;}
  list(){return structuredClone(this.data);}
  mutate(action){const op=this.pending.catch(()=>{}).then(async()=>{const draft=structuredClone(this.data),result=action(draft);await mkdir(path.dirname(this.file),{recursive:true});await writeFile(this.file+'.tmp',JSON.stringify(draft,null,2));await rename(this.file+'.tmp',this.file);this.data=draft;return structuredClone(result);});this.pending=op;return op;}
  addPlan(input){return this.mutate(d=>{const plan={id:randomUUID(),name:name(input.name),...breakDownScript(input.script),createdAt:new Date().toISOString()};d.plans.unshift(plan);return plan;});}
  editBrief(planId,briefId,input){return this.mutate(d=>{const brief=d.plans.find(p=>p.id===planId)?.briefs.find(b=>b.id===briefId);if(!brief)throw new Error('Shot brief not found.');Object.assign(brief,validateBrief(input));return brief;});}
  addReference(input){return this.mutate(d=>{if(!['character','location','prop','style'].includes(input.kind))throw new Error('Choose a reference category.');if(typeof input.notes!=='string'||input.notes.length>2000)throw new Error('Reference notes must be at most 2,000 characters.');if(!Array.isArray(input.assets)||input.assets.length<1||input.assets.length>8||new Set(input.assets).size!==input.assets.length||input.assets.some(a=>!assetName(a)))throw new Error('Choose 1–8 different uploaded references.');const reference={id:randomUUID(),name:name(input.name),kind:input.kind,notes:input.notes,assets:input.assets,createdAt:new Date().toISOString()};d.references.unshift(reference);return reference;});}
  addRecipe(input){return this.mutate(d=>{const recipe={id:randomUUID(),name:name(input.name),request:input.request,createdAt:new Date().toISOString(),evidenceJobId:input.evidenceJobId??null};d.recipes.unshift(recipe);return recipe;});}
}
export function assetName(value){return typeof value==='string'&&/^[a-f0-9-]{36}\.(png|jpg|webp)$/.test(value);}
function name(value){if(typeof value!=='string'||!value.trim()||value.length>100)throw new Error('Use a name of 1–100 characters.');return value.trim();}
