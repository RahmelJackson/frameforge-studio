// "Animate this" and friends: right-click any node that shows a saved or
// preview image or video in ComfyUI, choose a Frameforge action, and the result
// is imported into Studio with the matching tool already open on it. The
// original stays in ComfyUI. Nothing runs until you press Create in Studio.
export const IMAGE_ACTIONS=[
 {id:'animate',label:'Animate this',hint:'Turn the image into a short clip',path:a=>'/create?image='+encodeURIComponent(a)+'#shot-form'},
 {id:'edit',label:'Edit this image',hint:'Change one thing with words',path:a=>'/images?tool=edit&source='+encodeURIComponent(a)},
 {id:'select',label:'Select a subject',hint:'SAM selection and masks',path:a=>'/images?tool=select&source='+encodeURIComponent(a)},
 {id:'prop',label:'Make a 3D prop',hint:'A textured model for the 3D scene',path:a=>'/native-workflows?workflow=prop-3d&image='+encodeURIComponent('/assets/'+a)}
];
export const VIDEO_ACTIONS=[
 {id:'extend',label:'Extend this shot',hint:'Continue before or after',path:id=>'/video-tools?tool=extend&footage='+id+'#video-tool-form'},
 {id:'upscale',label:'Sharpen & smooth',hint:'Upscale and add frames',path:id=>'/video-tools?tool=upscale&footage='+id+'#video-tool-form'},
 {id:'finish',label:'Trim, grade & caption',hint:'Finish the clip',path:id=>'/video-tools?tool=finish&footage='+id+'#video-tool-form'}
];
const MEDIA=/\.(png|mp4|webm)$/i;
export function mediaOf(node){const list=node?.images??[];const m=list.find(i=>i&&MEDIA.test(i.filename??'')&&['output','temp'].includes(i.type));return m?{filename:m.filename,subfolder:m.subfolder??'',type:m.type}:null;}
export function actionsFor(media){if(!media)return [];return /\.png$/i.test(media.filename)?IMAGE_ACTIONS:VIDEO_ACTIONS;}
export function createQuickActions({app,api,studio}){
 let busy=false;
 const toast=(kind,summary,detail)=>{try{app.extensionManager.toast.add({severity:kind,summary,detail,life:kind==='error'?7000:3500});}catch{}};
 async function run(action,media){
  if(busy)return;busy=true;toast('info','Frameforge','Importing into Studio…');
  try{const response=await api.fetchApi('/frameforge/send',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({studio:studio.getBase(),media})}),value=await response.json();if(!response.ok)throw Error(value.error??'Studio did not accept the file.');
   const key=value.asset??value.id;if(!key)throw Error('Studio did not acknowledge the import.');
   toast('success','Frameforge · '+action.label,'Imported. Your original stays in ComfyUI. Review, then press Create in Studio.');
   await studio.open(action.path(key),'quick');}
  catch(error){toast('error','Frameforge',error.message);}finally{busy=false;}
 }
 function menuFor(node){const media=mediaOf(node);if(!media)return [];return [null,{content:'✦ Frameforge',has_submenu:true,submenu:{options:actionsFor(media).map(a=>({content:a.label,callback:()=>run(a,media)}))}}];}
 return {run,menuFor,selected(){const nodes=Object.values(app.canvas?.selected_nodes??{});for(const n of nodes){const m=mediaOf(n);if(m)return {node:n,media:m};}return null;}};
}
