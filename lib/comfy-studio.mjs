import {startStudioEmbed} from './studio-embed.mjs';
export function comfyOrigin(value){
 if(typeof value!=='string'||value.length>150)throw Error('Use the exact local ComfyUI origin.');
 const u=new URL(value);if(u.protocol!=='http:'||!['127.0.0.1','localhost'].includes(u.hostname)||u.username||u.password||u.search||u.hash||u.pathname!=='/'||u.origin!==value)throw Error('Use the exact local ComfyUI origin.');
 return u.origin;
}
// Each local ComfyUI origin receives a separate, narrowly framed view of this
// same Studio. The normal website keeps its anti-framing policy.
export class ComfyStudioViews{
 constructor(){this.views=new Map();}
 async open({base,ancestor}){const origin=comfyOrigin(ancestor),key=base+'|'+origin;if(!this.views.has(key)){if(this.views.size>=4)throw Error('Four ComfyUI connections are already open. Restart Studio to clear unused connections.');const pending=startStudioEmbed({base,allowWrites:true}).then(view=>{view.setAncestors([origin]);return view;}).catch(error=>{this.views.delete(key);throw error;});this.views.set(key,pending);}const view=await this.views.get(key);return {url:view.url,ancestor:origin,kind:'full-studio',writes:true};}
 async close(){const pending=[...this.views.values()];this.views.clear();await Promise.allSettled(pending.map(async p=>(await p).close()));}
}
