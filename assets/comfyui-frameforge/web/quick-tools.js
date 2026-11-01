export const QUICK_TOOLS=[
 {group:'Start',name:'Produce a whole video',hint:'Idea → keyframes → clips → voice → cut, with review stops',symbol:'▶',path:'/produce'},
 {group:'Start',name:'My productions',hint:'Continue a production, approve shots, remix',symbol:'▤',path:'/produce#produce-runs'},
 {group:'Start',name:'Templates',hint:'Ready-to-run starting points, checked against your setup',symbol:'◇',path:'/templates'},
 {group:'Start',name:'Block a shot in 3D',hint:'Place stand-ins, move a camera, render the layout',symbol:'⬡',path:'/scene'},
 {group:'Start',name:'Creative recipes',hint:'Chain subjects, motion and shots',symbol:'✦',path:'/recipes'},
 {group:'Images',name:'Creative canvas',hint:'Infinite board for images, clips and 3D',symbol:'◇',path:'/creator?tab=canvas'},
 {group:'Images',name:'Your cast & LoRA dataset',hint:'Reusable references, captions and trainer export',symbol:'◇',path:'/creator?tab=characters'},
 {group:'Video',name:'Story formats → Produce',hint:'Fruit drama, explainer or narrative, rendered end to end',symbol:'▤',path:'/produce?format=fruit-romance'},
 {group:'Video',name:'Effects & transitions',hint:'Finish saved clips and compare versions',symbol:'✧',path:'/creator?tab=effects'},
 {group:'Video',name:'Looping GIF',hint:'Forward-and-back or a blended wrap',symbol:'≋',path:'/creator?tab=effects&recipe=loop'},

 {group:'3D',name:'Make a 3D prop',hint:'TRELLIS.2 / Pixal3D textured model',symbol:'⬡',path:'/native-workflows?workflow=prop-3d'},
 {group:'3D',name:'Scene from a still',hint:'MoGe depth and scene mesh',symbol:'⬡',path:'/native-workflows?workflow=scene-depth'},
 {group:'Video',name:'H3 keyframes',hint:'First / last frames in the local graph',symbol:'▷',path:'/native-workflows?workflow=h3-keyframes'},
 {group:'Video',name:'LTX reference sheet',hint:'Keep characters, props and places',symbol:'◇',path:'/native-workflows?workflow=ltx-ingredients'},
 {group:'Images',name:'Remove background',hint:'BiRefNet cutout and mask',symbol:'⊡',path:'/native-workflows?workflow=background-cutout'},
 {group:'Audio',name:'Compose music',hint:'ACE-Step 1.5 local soundtrack',symbol:'♪',path:'/native-workflows?workflow=music-ace15'},
 {group:'Video',name:'Animate an image',hint:'A still into a moving shot',symbol:'▷',path:'/create#shot-form'},
 {group:'Video',name:'LTX atmosphere & VFX',hint:'Image, effect and camera direction',symbol:'✧',path:'/create?localWorkflow=ltx-vfx#shot-form'},
 {group:'Video',name:'Trim & finish',hint:'Crop, grade, captions and sound',symbol:'✂',path:'/video-tools?tool=finish#video-tool-form'},
 {group:'Video',name:'Smooth motion',hint:'Interpolate frames with FILM or RIFE',symbol:'≋',path:'/video-tools?tool=interpolate#video-tool-form'},
 {group:'Video',name:'Enhance a clip',hint:'Upscale and inspect detail',symbol:'↗',path:'/video-tools?tool=upscale#video-tool-form'},
 {group:'Video',name:'Reframe a subject',hint:'Follow a subject in a new crop',symbol:'⊡',path:'/video-tools?tool=reframe#video-tool-form'},
 {group:'Video',name:'Make a rough cut',hint:'Arrange takes into a first film',symbol:'▤',path:'/short-film'},
 {group:'Images',name:'Create an image',hint:'Prompt to a new still',symbol:'✧',path:'/images?tool=create#image-form'},
 {group:'Images',name:'Edit with FLUX 3',hint:'A focused change to a picture',symbol:'◇',path:'/images?tool=edit&localWorkflow=flux3-image#image-form'},
 {group:'Images',name:'Canvas & selection',hint:'Paint, box, SAM and extend edges',symbol:'⊡',path:'/images?view=canvas'},
 {group:'Audio',name:'Read a script aloud',hint:'Local narration from your words',symbol:'♪',path:'/audio?tool=speech#audio-form'},
 {group:'Audio',name:'Transcribe & subtitle',hint:'A recording into timed words',symbol:'≡',path:'/audio?tool=transcribe#audio-form'},
 {group:'Audio',name:'Translate & dub',hint:'Review words, translate and replace speech',symbol:'◎',path:'/audio?tool=dub#audio-form'}
];
QUICK_TOOLS.sort((a,b)=>['Start','Video','Images','Audio','3D'].indexOf(a.group)-['Start','Video','Images','Audio','3D'].indexOf(b.group)||(a.name==='Animate an image'?-1:b.name==='Animate an image'?1:0));
export function createQuickTools({app,api,open,getMode,getBase=()=>'http://127.0.0.1:4317'}){
 const dock=document.createElement('div');dock.className='ff-comfy-dock';dock.setAttribute('aria-label','Frameforge quick toolbar');
 dock.innerHTML='<button type="button" data-tools aria-expanded="false" aria-keyshortcuts="Alt+Shift+F" title="Frameforge tools (Alt+Shift+F)"><i class="ff-dock-mark">F</i>Frameforge<small>Tools · productions</small></button><button type="button" data-export>Export graph ↓</button><button type="button" data-full>Full Studio ↗</button><span role="status" data-dock-status></span>';
 // First visit: point at the dock once so people know where Frameforge lives inside ComfyUI.
 try{if(!localStorage.getItem('frameforge.dock.seen')){const tip=document.createElement('div');tip.className='ff-dock-tip';tip.innerHTML='<b>Frameforge is here.</b> Open Quick tools, your productions and the full Studio from this button. Shortcut: Alt+Shift+F. <button type="button">Got it</button>';dock.append(tip);tip.querySelector('button').onclick=()=>{tip.remove();try{localStorage.setItem('frameforge.dock.seen','1');}catch{}};}}catch{}
 const panel=document.createElement('section');panel.className='ff-comfy-quick';panel.hidden=true;panel.setAttribute('aria-label','Frameforge quick tools');
 panel.innerHTML='<div class="ff-quick-heading"><div><small>FRAMEFORGE / QUICK TOOLS</small><h2>What’s next for your shot?</h2></div><button type="button" data-close aria-label="Close quick tools">×</button></div><p>Choose a tool. Upload, adjust and run in Quick.</p><div class="ff-quick-tabs" role="group" aria-label="Tool category">'+['Start','Video','Images','Audio','3D'].map((name,i)=>'<button type="button" data-category="'+name+'" aria-pressed="'+(!i)+'">'+name+'</button>').join('')+'</div><div data-tool-list></div><div class="ff-quick-footer"><button type="button" data-library>All workflows →</button><button type="button" data-split>Work side by side</button></div>';
 document.body.append(dock,panel);let category='Start',opener;
 function close(){panel.hidden=true;dock.querySelector('[data-tools]').setAttribute('aria-expanded','false');opener?.setAttribute('aria-expanded','false');}
 function show(source=dock.querySelector('[data-tools]')){if(!panel.hidden){close();return;}opener=source;panel.hidden=false;panel.classList.toggle('ff-quick-in-studio',getMode()!=='graph');source?.setAttribute('aria-expanded','true');render();panel.querySelector('[data-category]')?.focus();}
 function render(){const picked=window.frameforgeQuickActions?.selected();panel.querySelector('[data-tool-list]').innerHTML=(picked?'<div class="ff-quick-selected"><small>WITH THE SELECTED OUTPUT</small>'+window.frameforgeQuickActionsList(picked.media).map((a,i)=>'<button type="button" data-action="'+i+'"><span aria-hidden="true">✦</span><span><b>'+a.label+'</b><small>'+a.hint+'</small></span><span aria-hidden="true">→</span></button>').join('')+'</div>':'')+QUICK_TOOLS.filter(t=>t.group===category).map(t=>'<button type="button" data-path="'+t.path+'"><span aria-hidden="true">'+t.symbol+'</span><span><b>'+t.name+'</b><small>'+t.hint+'</small></span><span aria-hidden="true">→</span></button>').join('')+(category==='Start'?'<div class="ff-quick-productions" data-productions><small>YOUR PRODUCTIONS</small><p>Loading from Studio…</p></div>':'');if(category==='Start')loadProductions();}
 // Productions from Studio, each shot one click from its real graph on this canvas.
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 async function loadProductions(){const box=panel.querySelector('[data-productions]');if(!box)return;try{const r=await api.fetchApi('/frameforge/productions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({studio:getBase()})}),v=await r.json();if(!r.ok)throw Error(v.error);
  box.innerHTML='<small>YOUR PRODUCTIONS · LOAD ANY SHOT AS NODES</small>'+(v.productions.length?v.productions.map(p=>'<details><summary><b>'+esc(p.name)+'</b><span>'+esc(p.stage)+'</span></summary><div class="ff-shot-list">'+p.shots.map((s,i)=>'<div><span>'+(i+1)+' · '+esc(s.title)+'</span>'+(s.image?'<button type="button" data-shot="'+s.image+'" data-label="'+esc(p.name+' · '+(i+1)+' keyframe')+'">Keyframe graph</button>':'')+(s.clip?'<button type="button" data-shot="'+s.clip+'" data-label="'+esc(p.name+' · '+(i+1)+' clip')+'">Clip graph</button>':'')+'</div>').join('')+'</div><button type="button" data-path="/produce?run='+esc(p.id)+'">Open in Studio →</button></details>').join(''):'<p>No productions yet. Start one with Produce a whole video.</p>');}
  catch(e){box.innerHTML='<small>YOUR PRODUCTIONS</small><p>'+esc(e.message||'Studio is not reachable.')+'</p>';}}
 async function loadShot(job,label){status('Loading the shot graph…');try{const r=await api.fetchApi('/frameforge/shot-graph',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({studio:getBase(),job})}),v=await r.json();if(!r.ok)throw Error(v.error);close();await app.handleFile(new File([JSON.stringify(v.graph)],('Frameforge - '+label).replace(/[^\w .-]/g,' ').slice(0,100)+'.json',{type:'application/json'}));status('Loaded '+v.graph.nodes.length+' nodes. Press Run in ComfyUI.');}catch(e){status(e.message);}}
 dock.querySelector('[data-tools]').onclick=e=>show(e.currentTarget);
 dock.querySelector('[data-full]').onclick=()=>{close();open('/','studio');};
 dock.querySelector('[data-export]').onclick=()=>{try{const graph=(app.rootGraph??app.graph).serialize(),a=document.createElement('a'),url=URL.createObjectURL(new Blob([JSON.stringify(graph,null,2)],{type:'application/json'}));a.href=url;a.download='frameforge-current-graph.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);status('Current graph exported.');}catch(e){status(e.message);}};
 panel.querySelector('[data-close]').onclick=()=>{close();opener?.focus();};
 panel.querySelector('[data-library]').onclick=()=>{close();open('/library');};panel.querySelector('[data-split]').onclick=()=>{close();open('/','split');};
 panel.addEventListener('click',e=>{const group=e.target.closest('[data-category]'),tool=e.target.closest('[data-path]');if(group){category=group.dataset.category;panel.querySelectorAll('[data-category]').forEach(b=>b.setAttribute('aria-pressed',String(b===group)));render();}const shot=e.target.closest('[data-shot]');if(shot){loadShot(shot.dataset.shot,shot.dataset.label);return;}if(tool){close();open(tool.dataset.path);}const act=e.target.closest('[data-action]');if(act){const picked=window.frameforgeQuickActions?.selected();if(picked){close();window.frameforgeQuickActions.run(window.frameforgeQuickActionsList(picked.media)[Number(act.dataset.action)],picked.media);}}});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!panel.hidden){close();opener?.focus();}});
 const status=text=>{dock.querySelector('[data-dock-status]').textContent=text;};
 return {show,close,status,modeChanged(mode){dock.hidden=mode!=='graph';close();}};
}
