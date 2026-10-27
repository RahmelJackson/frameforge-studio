import {mountToolPicker} from './tool-picker.js';
import {readMediaDrop} from './my-work.js';
const groups={
 'video-tool':[{label:'Finish',ids:['finish','shorts','upscale','interpolate','reframe','recolor']},{label:'Generate edits',ids:['restyle','relight','masked','motion','extend','outpaint']},{label:'Guides & stories',ids:['story','pose-guide','segment']}],
 'audio-tool':[{label:'Voice',ids:['speech','expressive','convert']},{label:'Dialogue',ids:['dialogue']},{label:'Transcribe & dub',ids:['transcribe','dub','separate','caption']},{label:'Lip sync',ids:['lipsync']}]
};
if(typeof document!=='undefined'){
for(const [id,g] of Object.entries(groups)){const select=document.getElementById(id);if(select)mountToolPicker(select,{groups:g});}
document.addEventListener('keydown',e=>{if(!(e.ctrlKey||e.metaKey)||e.key!=='Enter'||e.isComposing||e.repeat||e.target.closest('#studio-assistant,#my-work-drawer'))return;const forms=[...document.querySelectorAll('#canvas-form,#image-form,#shot-form,#video-tool-form,#audio-form')],form=forms.find(f=>f.getBoundingClientRect().width&&f.getBoundingClientRect().height);if(!form)return;const button=form.querySelector('[data-canvas-run],#image-generate,#generate,#render-video-tool,#run-audio,button[type=submit]');if(!button||button.disabled)return;e.preventDefault();form.requestSubmit(button);});
const header=document.querySelector('.workspace-page-header');if(header){const indicator=document.createElement('span');indicator.className='header-work-progress';indicator.setAttribute('role','status');header.append(indicator);const sources=[...document.querySelectorAll('#image-status,#video-tool-status,#audio-status,#form-status')];let last='';function update(){const active=sources.find(e=>/submitting|render in progress|saving inputs|generating|processing|checking result|verifying/i.test(e.textContent));const next=active?.textContent??'';if(next===last)return;last=next;indicator.textContent=next;indicator.hidden=!next;}for(const el of sources)new MutationObserver(update).observe(el,{childList:true,subtree:true,characterData:true});update();}
let dragDepth=0;const supported=()=>['images','create','video-tools','audio','film','short-film'].includes(document.body.dataset.page);
document.addEventListener('dragenter',e=>{if(!supported()||!e.dataTransfer.types.some(t=>['Files','application/x-frameforge-media'].includes(t)))return;dragDepth++;document.body.classList.add('studio-drop-active');});
document.addEventListener('dragover',e=>{if(supported()&&e.dataTransfer.types.some(t=>['Files','application/x-frameforge-media'].includes(t)))e.preventDefault();});
document.addEventListener('dragleave',()=>{if(--dragDepth<=0){dragDepth=0;document.body.classList.remove('studio-drop-active');}});
document.addEventListener('drop',e=>{dragDepth=0;document.body.classList.remove('studio-drop-active');if(!supported())return;let media;try{media=readMediaDrop(e.dataTransfer);}catch(error){e.preventDefault();return;}if(media){e.preventDefault();window.dispatchEvent(new CustomEvent('frameforge:use-media',{detail:{...media,target:e.target.closest('#replacement-controls')?'reference':document.body.dataset.page==='film'?'timeline':'source'}}));return;}const files=[...e.dataTransfer.files];if(!files.length)return;
 // Native file controls keep their own browser drop behavior.
 if(e.defaultPrevented||e.target.matches('input[type=file]'))return;e.preventDefault();const file=files[0],page=document.body.dataset.page;
 if(page==='images'){window.dispatchEvent(new CustomEvent('frameforge:use-media',{detail:{kind:'image',file,target:e.target.closest('#replacement-controls')?'reference':'source'}}));return;}
 const mode=page==='create'?document.querySelector('#generation-type'):page==='audio'?document.querySelector('#audio-tool'):null;if(mode&&(page==='create'||['speech','dialogue','expressive'].includes(mode.value))){mode.value=page==='create'?'image':'transcribe';mode.dispatchEvent(new Event('change',{bubbles:true}));}
 const input=page==='video-tools'?document.querySelector('#footage-upload'):page==='audio'?document.querySelector(file.type.startsWith('video/')?'#dialogue-video':'#dialogue-wav'):document.querySelector('#reference');if(input){const dt=new DataTransfer();dt.items.add(file);input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));}
});
}
