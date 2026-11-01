const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// Keep going: every result offers the natural next workflow, with the result already attached.
// Images become videos (Studio, LTX 2.5, MiniMax H3), get edited (FLUX 3) or become a locked identity;
// videos get remixed, made vertical, recast with your character, upscaled or finished.
export function nextStepLinks(id,url){
 const video=/\.(mp4|webm|mov)$/i.test(url),media=encodeURIComponent(url),native=(w,kind)=>'/native-workflows?workflow='+w+'&'+kind+'='+media;
 return video?[
  {label:'Remix with LTX 2.5',hint:'Restyle the same motion',href:native('ltx-adapter-edit','video'),badge:'LTX'},
  {label:'Make it vertical',hint:'LTX outpaints to 9:16',href:native('ltx-outpaint','video'),badge:'LTX'},
  {label:'Swap in your character',hint:'Openjutsu identity swap',href:native('identity-swap','video'),badge:'ID'},
  {label:'Swap · lighter GPU',hint:'SCAIL-2 int8 character replace',href:native('character-replace','video'),badge:'ID'},
  {label:'Track a subject with SAM 3',hint:'Mask one thing across the clip',href:'/video-tools?tool=segment&job='+id,badge:'SAM'},
  {label:'Upscale',hint:'SeedVR2 detail pass',href:native('video-upscale-seedvr2','video')},
  {label:'Cut, dub & caption',hint:'Video tools',href:'/video-tools?job='+id}
 ]:[
  {label:'Make it a video',hint:'Studio video, this frame first',action:'animate'},
  {label:'Select with SAM 3',hint:'Click or name an object, then edit it',action:'tool:select',badge:'SAM'},
  {label:'Repaint a region',hint:'Mask it and describe the change',action:'tool:inpaint'},
  {label:'Vertical video',hint:'9:16 for Shorts and Reels',action:'animate-vertical'},
  {label:'Animate with LTX 2.5',hint:'Motion and sound in one pass',href:native('ltx-native-shot','image'),badge:'LTX'},
  {label:'Animate with MiniMax H3',hint:'Keyframe video with audio',href:native('h3-keyframes','image'),badge:'H3'},
  {label:'Edit with FLUX 3',hint:'Change it with references',href:native('flux3-references','image'),badge:'F3'},
  {label:'Use as a locked identity',hint:'Put this character in any clip',href:native('identity-swap','image'),badge:'ID'},
  {label:'Animate with your motion',hint:'Wan Animate · lighter on VRAM',href:native('wan-animate-fast','image'),badge:'ID'},
  {label:'Make it a 3D model',hint:'TRELLIS.2 textured GLB',href:native('prop-3d','image'),badge:'3D'},
  {label:'Scene to 3D geometry',hint:'MoGe depth mesh',href:native('scene-depth','image'),badge:'3D'}
 ];
}
function nextSteps(id,url){
 const nav=document.createElement('nav');nav.className='next-steps';nav.setAttribute('aria-label','Keep going');
 nav.innerHTML='<strong>Keep going</strong><div>'+nextStepLinks(id,url).map(s=>(s.href?'<a href="'+esc(s.href)+'"':'<button type="button" data-next="'+s.action+'"')+' title="'+esc(s.hint)+'">'+(s.badge?'<i>'+esc(s.badge)+'</i>':'')+esc(s.label)+'<small>'+esc(s.hint)+'</small>'+(s.href?'</a>':'</button>')).join('')+'</div>';
 nav.onclick=async e=>{const b=e.target.closest('[data-next]');if(!b)return;b.disabled=true;try{const r=await fetch('/api/jobs/'+id+'/image-asset',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}),v=await r.json();if(!r.ok)throw Error(v.error??'Could not prepare the image.');location.href=b.dataset.next.startsWith('tool:')?'/images?source='+encodeURIComponent(v.name)+'&tool='+b.dataset.next.slice(5):'/?image='+encodeURIComponent(v.name)+(b.dataset.next==='animate-vertical'?'&aspect=portrait':'');}catch(err){b.disabled=false;b.querySelector('small').textContent=err.message;}};
 return nav;
}
if(typeof document!=='undefined'){
 const roots=[...document.querySelectorAll('#image-evidence,#shot-evidence,#video-tool-evidence,#dialogue-result')];
 function attach(root){const link=[...root.querySelectorAll('a[href]')].find(a=>/^\/(outputs|audio-jobs)\/[a-f0-9-]{36}\//.test(a.getAttribute('href')));if(!link)return;const id=link.getAttribute('href').split('/')[2],audio=link.getAttribute('href').startsWith('/audio-jobs/');if(root.querySelector('[data-provenance="'+id+'"]'))return;const details=document.createElement('details');details.dataset.provenance=id;details.className='result-provenance';details.innerHTML='<summary>What made this · models, terms & remix</summary><div>Open to inspect the saved workflow.</div>';root.append(details);if(!audio){root.append(nextSteps(id,link.getAttribute('href')));const a=document.createElement('a');a.href='/creator?tab=canvas&job='+id;a.textContent='Reuse on creative canvas →';a.className='creator-result-link';root.append(a);}let loaded=false;details.ontoggle=async()=>{if(!details.open||loaded)return;loaded=true;const target=details.querySelector('div');try{const r=await fetch((audio?'/api/audio-jobs/':'/api/jobs/')+id+'/provenance'),v=await r.json();if(!r.ok)throw Error(v.error);target.innerHTML='<p>'+esc(v.recipe)+' · '+esc(v.createdVia)+(v.seed!=null?' · seed '+esc(v.seed):'')+'</p>'+v.models.map(m=>'<p><b>'+esc(m.name)+'</b><br><a href="'+esc(m.url)+'" target="_blank" rel="noopener">Model source ↗</a> · <a href="'+esc(m.licenseUrl)+'" target="_blank" rel="noopener">Model terms ↗</a></p>').join('')+(v.unresolved.length?'<p>Additional graph files: '+v.unresolved.map(esc).join(', ')+'. Source terms have not been mapped.</p>':'')+(v.graphAvailable?'<p><a href="/library?collection=workflows&job='+id+'">Remix / Open in ComfyUI →</a> · <a href="/outputs/'+id+'/workflow.json" download>Exact workflow JSON ↓</a></p>':'<p>This result uses Studio processing steps rather than a complete portable graph.</p>'+(audio?'<p><a href="/audio?job='+id+'">Remix these audio settings →</a></p>':''))+'<p>'+esc(v.note)+'</p>';}catch(e){loaded=false;target.textContent=e.message;}};}
 roots.forEach(root=>{new MutationObserver(()=>attach(root)).observe(root,{childList:true,subtree:true});attach(root);});
}
