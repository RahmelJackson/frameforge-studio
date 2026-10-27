import {shotGenerationInput,checkedSelectedTake} from './video-project.js';
import {takeLaunchPrompt} from '/workspace.js';
import {createQueueUI} from './queue.js';
import {createLibraryUI} from './library.js';
const $ = selector => document.querySelector(selector);
const state = { asset:null,endAsset:null,preset:'push-in',jobs:[],selected:null,health:null,requestId:null,submitting:false,view:'studio',loaded:false,projects:[] };
const busyStates = ['processing','uploading','submitting','submitted','running','cancelling','verifying'];
const labels = { processing:'Processing footage', uploading:'Preparing reference',submitting:'Submitting shot',submitted:'Queued',running:'Rendering',verifying:'Checking video','review-ready':'Ready for visual review','technical-failed':'Technical check failed','verification-blocked':'Verification needs attention','needs-attention':'Needs attention',failed:'Generation failed' };
let presets=[];
const retryRequests=new Map();
const pendingControls=new Set();
labels.cancelling='Stopping render';labels.cancelled='Cancelled';
function escape(text=''){return String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
async function api(route,options={}){const response=await fetch(route,options);const data=await response.json();if(!response.ok)throw new Error(data.error??'Request failed.');return data;}
function toast(message){$('#toast').textContent=message;$('#toast').hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').hidden=true,6000);}
function switchView(name){state.view=name;window.dispatchEvent(new CustomEvent('frameforge:workspace-panel',{detail:{panel:name}}));const address=new URL(location.href);address.pathname='/create';address.searchParams.set('view',name);history.replaceState(null,'',address.pathname+address.search);document.querySelectorAll('.view').forEach(el=>el.hidden=el.id!=='view-'+name);document.querySelectorAll('[data-view]').forEach(el=>el.classList.toggle('active',el.dataset.view===name));$('#page-title').textContent={studio:'Generate a video',gallery:'Your library',checks:'Verification',projects:'Film projects',compare:'Compare takes',guide:'Studio guide',story:'Story planner',assets:'References & recipes',queue:'Batch queue'}[name];render();}
document.querySelectorAll('[data-view]').forEach(el=>el.addEventListener('click',()=>switchView(el.dataset.view)));
function selectPreset(id){state.preset=id;document.querySelectorAll('.preset').forEach(el=>{el.classList.toggle('selected',el.dataset.preset===id);el.setAttribute('aria-pressed',String(el.dataset.preset===id));});state.requestId=null;}
async function upload(file){
  if(!file || file.size>25*1024*1024){toast('Choose an image smaller than 25 MB.');return;}
  $('#form-status').textContent='Saving reference…';
  try{const result=await api('/api/assets',{method:'POST',headers:{'Content-Type':file.type},body:file});state.asset=result.name;state.selected=null;state.requestId=null;$('#reference-preview').src=result.url;$('#reference-preview').hidden=false;$('#drop-copy').hidden=true;$('#reference-name').textContent=file.name??'Sample reference';render();toast('Reference ready. Choose a movement and describe the shot.');}catch(e){toast(e.message);}
}
$('#reference').addEventListener('change',e=>upload(e.target.files[0]));
$('#drop-zone').addEventListener('dragover',e=>{e.preventDefault();$('#drop-zone').classList.add('drag');});
$('#drop-zone').addEventListener('dragleave',()=>$('#drop-zone').classList.remove('drag'));
$('#drop-zone').addEventListener('drop',e=>{e.preventDefault();$('#drop-zone').classList.remove('drag');upload(e.dataTransfer.files[0]);});
$('#use-sample').addEventListener('click',async()=>{try{const blob=await(await fetch('/sample.jpg')).blob();await upload(new File([blob],'Sample reference.jpg',{type:'image/jpeg'}));if(!$('#prompt').value)$('#prompt').value='A cinematic scene with subtle natural movement. Preserve the subject, colors, and environment of the reference image.';}catch(e){toast(e.message);}});
$('#shot-form').addEventListener('input',()=>state.requestId=null);
$('#shot-form').addEventListener('submit',async e=>{
  e.preventDefault();if(state.submitting)return;
  if(!state.asset&&$('#generation-type').value!=='text'){toast('Upload a reference image first.');return;}
  state.submitting=true;state.requestId??=crypto.randomUUID();render();
  const input=getComposerInput();
  try{const job=await api('/api/jobs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)});state.selected=job.id;toast('Shot queued on your local GPU.');}catch(e){toast(e.message);}finally{state.submitting=false;await refreshJobs();}
});
function selectedJob(){return state.jobs.find(j=>j.id===state.selected);}
function status(job){return job.review?.verdict==='approved'?'Approved':job.review?.verdict==='rejected'?'Needs refinement':job.error?.includes('execution_interrupted')?'Interrupted':labels[job.status]??job.status;}
const cameraLabel=id=>({'Pan Up':'Rise vertically','Pan Down':'Lower vertically','Pan Left':'Track left','Pan Right':'Track right','Zoom In':'Dolly forward','Zoom Out':'Dolly backward','Anti Clockwise (ACW)':'Roll anticlockwise','ClockWise (CW)':'Roll clockwise','Static':'Stationary'}[id]??id);
function presetName(job){if(job.request.kind==='video-tool')return 'Video · '+job.request.tool;if(job.request.engine==='camera')return cameraLabel(job.request.cameraPose);return presets.find(p=>p.id===job.request.preset)?.name??job.request.preset;}
function thumbnail(job){return job.report?.poster?`/outputs/${job.id}/poster.jpg`:job.request.asset?'/assets/'+job.request.asset:'/text-frame.svg';}
function selectJob(id){if(state.jobs.find(j=>j.id===id)?.request.kind==='video-tool'){location.href='/video-tools?job='+id;return;}state.selected=id;switchView('studio');window.scrollTo({top:0,behavior:'smooth'});}
function evidence(job,full=false){
  const report=job.report;
  const control=['submitted','running','cancelling'].includes(job.status)?`<button class="secondary" data-cancel="${job.id}" ${job.status==='cancelling'||pendingControls.has(job.id)?'disabled':''}>${job.status==='cancelling'?'Waiting for the engine to stop…':'Cancel render'}</button>`:['cancelled','failed','technical-failed','verification-blocked'].includes(job.status)?`<button class="secondary" data-retry="${job.id}" ${pendingControls.has(job.id)?'disabled':''}>Retry this shot ↗</button>`:'';
  const pills=report?.checks?.map(c=>`<span class="${c.pass?'':'fail'}">${c.pass?'✓':'×'} ${escape(c.name)}</span>`).join('')??'';
  return `<h3>${escape(presetName(job))} <span class="card-status">${escape(status(job))}</span></h3>${report?`<div class="check-pills">${pills}</div><p>${report.technicalPass?'The file passed technical checks. Watch the shot before approving its creative quality.':'The video failed a technical check. Inspect the evidence before retrying.'}</p>${(report.warnings??[]).map(w=>`<p class="error-text">${escape(w)}</p>`).join('')}`:`<p>${escape(job.error?.includes('execution_interrupted')?'This render was interrupted before a video was saved. Reuse its settings to try again.':job.error??'Evidence will appear after the render completes.')}</p>`}
  ${job.video&&report?.technicalPass?`<details class="result-sendto"><summary>Send clip to…</summary><div class="result-sendto-options"><a href="/video-tools?sourceJob=${job.id}">Edit, caption or add sound →</a>${report.hasAudio||report.audio||job.request.audio||job.request.narration?`<a href="/audio?tool=transcribe&sourceJob=${job.id}">Transcribe its audio →</a>`:''}<a href="/film?take=${job.id}">Add to a film →</a></div></details>`:''}<div class="links"><a href="/library?collection=workflows&job=${job.id}">Edit ComfyUI workflow ↗</a><a href="/outputs/${job.id}/workflow.json" target="_blank" rel="noopener">Original API prompt ↗</a>${report?`<a href="/outputs/${job.id}/report.json" target="_blank" rel="noopener">Check report ↗</a><a href="/outputs/${job.id}/contact-sheet.jpg" target="_blank" rel="noopener">Frame contact sheet ↗</a>`:''}</div>${control}${job.retriedFrom?'<p>New take from a saved attempt. The earlier take is retained.</p>':''}
  ${full&&report?`<img class="contact-sheet" src="/outputs/${job.id}/contact-sheet.jpg" alt="Six sampled frames from this shot">`:''}
  ${job.finishing?'<p>Noir includes a monochrome finish. The ungraded source is preserved.</p>':''}${job.review?`<p><strong>${escape(job.review.verdict)}</strong> · ${escape(job.review.notes||'No review notes.')}</p>`:''}
  ${report&&['review-ready','technical-failed'].includes(job.status)?`<textarea class="review-note" data-note="${job.id}" aria-label="Visual review notes" placeholder="Identity, flicker, camera movement, composition…">${escape(job.review?.notes??'')}</textarea><div class="review-actions"><button data-review="approved" data-job="${job.id}" ${report.technicalPass?'':'disabled'}>Approve take ✓</button><button data-review="rejected" data-job="${job.id}">Needs refinement</button><button data-reuse="${job.id}">Reuse settings ↗</button></div>`:`<div class="review-actions"><button data-reuse="${job.id}">Reuse settings ↗</button></div>`}`;
}
function render(){
  const job=selectedJob();window.dispatchEvent(new CustomEvent('frameforge:take-selected',{detail:{takeJob:checkedSelectedTake(job)}}));window.dispatchEvent(new CustomEvent('frameforge:video-context',{detail:{sourceJob:job?.video&&job.report?.technicalPass?job.id:null}})); const active=state.anyRenderBusy??state.jobs.some(j=>busyStates.includes(j.status));
  const engine=$('#engine').value,camera=engine==='camera';const modeReady=camera?($('#camera-sampling').value==='full'?state.health?.cameraFull?.ready:state.health?.camera?.ready):engine==='keyframes'?state.health?.keyframes?.ready:state.health?.ready;
  $('#generate').disabled=!modeReady||active||state.submitting;
  $('#model-badge').textContent=job?.request.kind==='video-tool'?'VIDEO WORKFLOW':job?.request.engine==='camera'?'FUN CAMERA · 14B':job?.request.engine==='keyframes'?'FUN INPAINT · 5B':'WAN 2.2 · 5B';
  $('#generate span:first-child').textContent=state.submitting?'Submitting…':active?'Render in progress':'Generate shot';
  $('#form-status').textContent=!state.health?.connected?'Start your local ComfyUI engine to generate.':!modeReady?'This mode needs its model files before rendering.':active?'One shot at a time keeps your GPU focused.':'Local GPU · No credits · Silent video';
  $('#library-count').textContent=state.jobs.length;
  $('#shot-counter').textContent=job?'SHOT / '+job.id.slice(0,8).toUpperCase():'NO SHOT SELECTED';
  const video=job?.video?`/outputs/${job.id}/${job.video}`:null;
  $('#player').hidden=!video;$('#stage-reference').hidden=!!video;
  if(video && $('#player').getAttribute('src')!==video){$('#player').src=video;}
  if(!video){$('#player').pause();$('#player').removeAttribute('src');$('#stage-reference').src=job?.request.mode==='text'||!job&&$('#generation-type').value==='text'?'/text-frame.svg':job?'/assets/'+job.request.asset:state.asset?'/assets/'+state.asset:'/sample.jpg';}
  $('#stage').classList.toggle('has-reference',!!state.asset||!!job);
  $('#stage-empty').hidden=!!state.asset||!!job;
  $('#render-overlay').hidden=!job||!busyStates.includes(job.status);
  $('#render-title').textContent=job?labels[job.status]??'Working':'';
  $('#render-detail').textContent=job?.status==='verifying'?'Decoding every frame and recording evidence.':'Your GPU is bringing the scene to life.';
  $('#download').hidden=!video;if(video)$('#download').href=video;
  $('#stage-description').textContent=job?`${presetName(job)} · seed ${job.request.seed}`:'Local image-to-video';
  $('#recent-shots').innerHTML=state.jobs.length?state.jobs.slice(0,6).map(j=>`<button class="shot-thumb ${j.id===state.selected?'selected':''}" data-select="${j.id}" aria-label="Open ${escape(presetName(j))} shot"><img src="${thumbnail(j)}" alt="Shot thumbnail"><span>${escape(status(j))}</span></button>`).join(''):'<p class="empty-inline">Your generated shots will appear here.</p>';
  const evidenceEl=$('#shot-evidence');evidenceEl.hidden=!job;
  if(job && !evidenceEl.contains(document.activeElement)) evidenceEl.innerHTML=evidence(job);
  const filter=$('#gallery-filter').value;
  const filtered=state.jobs.filter(j=>filter==='all'||filter==='approved'&&j.review?.verdict==='approved'||filter==='pending'&&j.status==='review-ready'&&!j.review);
  $('#gallery').innerHTML=filtered.length?filtered.map(j=>`<article class="gallery-card"><button data-select="${j.id}"><img src="${thumbnail(j)}" alt="Shot thumbnail for ${escape(presetName(j))}"><div class="card-body"><h3>${escape(presetName(j))}</h3><p>${escape(j.request.prompt.slice(0,110))}</p><span class="card-status">${escape(status(j))}</span></div></button></article>`).join(''):'<div class="empty-state">No shots here yet. Create a shot and it will be saved with its settings and review.</div>';
  if(state.view==='compare')renderComparison();
  if(state.view==='projects')renderProjects();
  if(['story','assets'].includes(state.view))libraryUI.render();
  if(state.view==='queue')queueUI.render();
  if(state.view==='checks'&&!$('#verification-list').contains(document.activeElement))$('#verification-list').innerHTML=state.jobs.map(j=>`<article class="evidence-card">${evidence(j,true)}</article>`).join('');
}
async function refreshHealth(){
  try{state.health=await api('/api/health');}catch(e){state.health={connected:false,ready:false,error:e.message};}
  $('#connection').classList.toggle('ready',state.health.ready);
  $('#connection span').textContent=state.health.ready?'Local engine ready':state.health.connected?'Local models needed':'Local engine offline';
  const memory=state.health.gpuMemory;
  $('#health-panel').innerHTML=`<h2>${state.health.ready?'Ready to render':state.health.connected?'Finish engine setup':'Connect your engine'}</h2><p>${escape(state.health.device??state.health.error??'')}</p>${memory?.total?`<p>GPU memory available: ${(memory.free/1024**3).toFixed(1)} GB of ${(memory.total/1024**3).toFixed(1)} GB. Closing unused video editors or games can leave more room for rendering.</p>`:''}${state.health.missingModels?.length?'<ul>'+state.health.missingModels.map(m=>'<li>Missing model: '+escape(m)+'</li>').join('')+'</ul>':''}${state.health.missingNodes?.length?'<p>Missing nodes: '+escape(state.health.missingNodes.join(', '))+'</p>':''}<p>Technical checks run automatically. Creative approval is recorded against the video’s checksum.</p>`;render();
}
async function refreshJobs(){try{const allJobs=await api('/api/jobs');state.anyRenderBusy=allJobs.some(j=>busyStates.includes(j.status));state.jobs=allJobs.filter(j=>j.request.kind!=='image');if(!state.loaded){state.selected=new URLSearchParams(location.search).has('start')?null:state.jobs[0]?.id??null;state.loaded=true;}render();}catch(e){$('#form-status').textContent='Studio disconnected. Reload when the server is available.';}}
$('#connection').addEventListener('click',()=>{refreshHealth();toast('Checking the local engine…');});
$('#gallery-filter').addEventListener('change',render);
document.addEventListener('click',async e=>{
  const control=e.target.closest('[data-cancel],[data-retry]');
  if(control){
    const id=control.dataset.cancel??control.dataset.retry;if(pendingControls.has(id))return;
    pendingControls.add(id);control.disabled=true;
    try{
      if(control.dataset.cancel){await api(`/api/jobs/${id}/cancel`,{method:'POST'});toast('Stop requested for this shot. Waiting for the engine.');}
      else{if(!retryRequests.has(id))retryRequests.set(id,crypto.randomUUID());const job=await api(`/api/jobs/${id}/retry`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({requestId:retryRequests.get(id)})});state.selected=job.id;toast('New take queued. The earlier attempt is saved.');}
    }catch(error){toast(error.message);}finally{pendingControls.delete(id);control.blur();await refreshJobs();}
    return;
  }
  const select=e.target.closest('[data-select]');if(select)selectJob(select.dataset.select);
  const reuse=e.target.closest('[data-reuse]');if(reuse){const j=state.jobs.find(x=>x.id===reuse.dataset.reuse);if(j.request.kind==='video-tool'){location.href='/video-tools?job='+j.id;return;}restoreSettings(j.request);toast('Settings restored. Change one thing and compare.');}
  const review=e.target.closest('[data-review]');if(review){const id=review.dataset.job;const note=review.closest('.evidence-card').querySelector('[data-note]')?.value??'';try{await api(`/api/jobs/${id}/review`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({verdict:review.dataset.review,notes:note})});review.blur();await refreshJobs();toast('Review saved with the video checksum.');}catch(error){toast(error.message);}}
});
async function initialize(){try{const catalog=await api('/api/catalog');presets=catalog.presets;$('#look-controls').innerHTML=Object.entries(catalog.looks).map(([key,options])=>`<label>${key[0].toUpperCase()+key.slice(1)}<select data-look="${key}" aria-label="${key[0].toUpperCase()+key.slice(1)} look">${options.map(o=>`<option value="${o.id}">${escape(o.name)}</option>`).join('')}</select></label>`).join('');$('#camera-pose').innerHTML=(catalog.cameraPoses??[]).map(p=>`<option value="${escape(p)}">${escape(cameraLabel(p))}</option>`).join('');$('#camera-pose').value='Zoom In';$('#presets').innerHTML=presets.map(p=>`<button type="button" class="preset ${p.id===state.preset?'selected':''}" data-preset="${p.id}" aria-pressed="${p.id===state.preset}" title="${escape(p.description)}"><b>${escape(p.icon)}</b>${escape(p.name)}</button>`).join('');document.querySelectorAll('.preset').forEach(el=>el.addEventListener('click',()=>selectPreset(el.dataset.preset)));await Promise.all([refreshHealth(),refreshJobs(),refreshProjects(),libraryUI.refresh(),queueUI.refresh()]);}catch(e){toast(e.message);}}
setInterval(refreshJobs,3000);setInterval(refreshHealth,30000);

function syncMode(){
  const text=$('#generation-type').value==='text';if(text&&$('#engine').value!=='wan5b')$('#engine').value='wan5b';
  ['camera','keyframes'].forEach(value=>$('#engine').querySelector(`[value="${value}"]`).disabled=text);$('#end-reference-section').hidden=$('#engine').value!=='keyframes';$('#reference-section').hidden=text;
  const camera=$('#engine').value==='camera';$('#camera-mirror').disabled=!camera||!['Pan Left','Pan Right'].includes($('#camera-pose').value);
  $('#presets').hidden=camera;$('#camera-controls').hidden=!camera;
  $('#quality').closest('label').hidden=camera;
  $('#motion-note').textContent=camera?'Camera motion is conditioned by the model. Choose a fast preview or full sampling at 16 fps; inspect geometry and movement before keeping a take.':'Motion presets guide the model through your prompt. Results can vary.';
  $('#mode-caption').textContent=text?'TEXT TO VIDEO / WAN 2.2':camera?'IMAGE TO VIDEO / CAMERA CONTROL':$('#engine').value==='keyframes'?'START + END FRAMES / FUN INPAINT':'IMAGE TO VIDEO / WAN 2.2';
  const names=camera?['3.1s · Preview','5.1s · Standard','7.6s · Extended','Unavailable']:['2s · Preview','3.4s · Standard','5s · Extended','10s · Long preview'];const quick=$('#engine').value==='wan5b';$('#generation-profile').disabled=!quick;if(!quick){$('#generation-profile').value='standard';if($('#length').value==='long')$('#length').value='extended';}const larger=$('#generation-profile').value==='hd';for(const option of $('#length').options)option.disabled=option.value==='long'&&!quick||larger&&option.value!=='preview';if(larger)$('#length').value='preview';
  [...$('#length').options].forEach((option,index)=>option.textContent=names[index]);
  state.requestId=null;render();
}
$('#camera-pose').addEventListener('change',syncMode);$('#camera-sampling').addEventListener('change',syncMode);$('#engine').addEventListener('change',syncMode);$('#generation-profile').addEventListener('change',syncMode);
$('#end-reference').addEventListener('change',async event=>{const file=event.target.files[0];if(!file||file.size>25*1024*1024){toast('Choose an ending image smaller than 25 MB.');return;}try{const asset=await api('/api/assets',{method:'POST',body:file});state.endAsset=asset.name;state.requestId=null;$('#end-reference-preview').src=asset.url;$('#end-reference-preview').hidden=false;$('#end-reference-name').textContent=file.name;toast('Ending frame ready.');}catch(error){toast(error.message);}});


async function refreshProjects(){try{state.projects=await api('/api/projects');if(state.view==='projects')renderProjects();}catch(error){toast(error.message);}}
function projectEditSignature(shots){return JSON.stringify(shots.map(s=>({id:s.id,jobId:s.jobId,trimStart:s.trimStart??0,trimEnd:s.trimEnd??null,transition:s.transition??'cut',transitionSeconds:s.transitionSeconds??0.5})));}
function renderProjects(){
  const container=$('#project-list');if(container.contains(document.activeElement))return;
  const available=state.jobs.filter(j=>j.video&&j.report?.technicalPass);
  const renderKey=JSON.stringify([state.projects,available.map(j=>[j.id,status(j)])]);
  if(container.querySelector('[data-unsaved]')||container.dataset.renderKey===renderKey)return;
  container.dataset.renderKey=renderKey;
  container.innerHTML=state.projects.length?state.projects.map(project=>`<article class="project-card" data-project="${project.id}"><h2>${escape(project.name)}</h2><a class="text-link" href="/film?project=${project.id}">Open film editor ↗</a><div class="review-actions"><button class="secondary" data-export-project="${project.id}" ${project.shots.length?'':'disabled'}>Export draft movie</button>${project.lastExport?`<a class="text-link" href="${project.lastExport.url}" target="_blank" rel="noopener">Watch / download last export ↗</a><a class="text-link" href="${project.lastExport.reportUrl}" target="_blank" rel="noopener">Export checks ↗</a>`:''}</div><p class="micro">Picture + sound · trims, cuts and crossfades. Open the film editor for audio tracks, timed text and image layers. Creative approval remains separate.${project.lastExport&&(project.lastExport.compositionSignature?project.lastExport.compositionSignature!==project.compositionSignature:project.lastExport.editSignature!==projectEditSignature(project.shots))?' Sequence changed; export again to include the saved edits.':''}</p>${project.lastExport?`<div class="film-preview"><video controls preload="metadata" aria-label="Draft film" src="${project.lastExport.url}"></video><button class="secondary" data-play-film>Play draft from start</button><p class="micro">${project.lastExport.assembly.duration.toFixed(3)} seconds · ${project.lastExport.report.technicalPass?'File checks passed':'File checks failed'} · ${project.lastExport.assembly.audio?'Includes audio':'Silent'}</p></div>`:''}<p class="micro" data-unsaved-message hidden>Unsaved edits — save each changed shot or project details before exporting.</p><label class="field-label">Project title<input data-project-name aria-label="Project title" maxlength="100" value="${escape(project.name)}"></label><textarea data-project-description aria-label="Project notes">${escape(project.description)}</textarea><div class="review-actions"><button class="secondary" data-save-project="${project.id}">Save project details</button></div><label class="field-label">Add a saved take<select data-add-job aria-label="Take to add">${available.filter(j=>!project.shots.some(s=>s.jobId===j.id)).map(j=>`<option value="${j.id}">${escape(presetName(j))} · ${j.id.slice(0,8)} · ${escape(status(j))}</option>`).join('')}</select></label><button class="secondary" data-add-shot="${project.id}">Add take to sequence</button><div>${project.shots.length?project.shots.map((shot,index)=>{
    const job=state.jobs.find(j=>j.id===shot.jobId);
    return `<div class="project-shot" data-shot="${shot.id}"><div>${job?`<img src="${thumbnail(job)}" alt="${escape(shot.title)}"><button data-select="${job.id}" class="text-link">Watch this take ↗</button>`:''}<p>SHOT ${index+1}${job?' · '+escape(status(job)):''}</p></div><div><label class="field-label">Scene<input data-shot-scene aria-label="Scene" maxlength="100" value="${escape(shot.scene??'Scene 1')}"></label><input data-shot-title aria-label="Shot title" maxlength="100" value="${escape(shot.title)}"><textarea data-shot-notes aria-label="Shot notes" maxlength="2000">${escape(shot.notes)}</textarea><div class="edit-grid"><label>Start (seconds)<input type="number" data-trim-start aria-label="Start (seconds)" min="0" max="${job?.report?.duration??120}" step="0.001" value="${shot.trimStart??0}"></label><label>End (seconds)<input type="number" data-trim-end aria-label="End (seconds)" min="0" max="${job?.report?.duration??120}" step="0.001" placeholder="Full clip · ${job?.report?.duration??'?'}s" value="${shot.trimEnd??''}"></label><label>Transition into this shot<select data-transition aria-label="Transition into this shot" ${index===0?'disabled':''}><option value="cut" ${(shot.transition??'cut')==='cut'?'selected':''}>Cut</option><option value="crossfade" ${shot.transition==='crossfade'?'selected':''}>Crossfade</option></select></label><label>Fade length (seconds)<input type="number" data-fade-seconds aria-label="Fade length (seconds)" min="0.042" max="2" step="0.001" value="${shot.transitionSeconds??0.5}" ${index===0?'disabled':''}></label></div><p class="micro">Source: ${job?.report?.duration??'?'} seconds. Leave End blank to use the rest. A crossfade overlaps the previous shot; the first shot starts directly. Save edits before exporting.</p><div class="review-actions"><button data-save-shot="${shot.id}" data-owner="${project.id}">Save shot edits</button><button aria-label="Move shot ${index+1} up" data-move="-1" data-index="${index}" data-owner="${project.id}" ${index===0?'disabled':''}>↑ Move up</button><button aria-label="Move shot ${index+1} down" data-move="1" data-index="${index}" data-owner="${project.id}" ${index===project.shots.length-1?'disabled':''}>↓ Move down</button></div></div></div>`;
  }).join(''):'<p class="micro">Add a take to start the sequence. Technical readiness and creative approval are shown separately.</p>'}</div></article>`).join(''):'<div class="empty-state">Create a project, then add completed takes from your library.</div>';
}
function markProjectDirty(event){const card=event.target.closest('[data-project]');if(!card||!event.target.matches('input,textarea,select')||event.target.matches('[data-add-job]'))return;event.target.dataset.unsaved='true';card.querySelector('[data-export-project]').disabled=true;card.querySelector('[data-unsaved-message]').hidden=false;}
document.addEventListener('input',markProjectDirty);
document.addEventListener('change',markProjectDirty);
document.addEventListener('click',async event=>{const button=event.target.closest('[data-play-film]');if(!button)return;const video=button.closest('.film-preview').querySelector('video');video.currentTime=0;try{await video.play();}catch(error){toast('The draft could not play. Check the export link.');}});
$('#project-form').addEventListener('submit',async event=>{event.preventDefault();const button=event.currentTarget.querySelector('button');button.disabled=true;try{await api('/api/projects',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:$('#project-name').value,description:$('#project-description').value})});$('#project-name').value='';$('#project-description').value='';await refreshProjects();toast('Project created. Add your saved takes.');}catch(error){toast(error.message);}finally{button.disabled=false;}});
document.addEventListener('click',async event=>{
  const button=event.target.closest('[data-add-shot],[data-save-shot],[data-save-project],[data-move],[data-export-project]');if(!button||button.disabled)return;
  button.disabled=true;
  try{
    const card=button.closest('[data-project]'),id=card.dataset.project;
    let route=`/api/projects/${id}`,method='PATCH',body;
    if(button.dataset.exportProject){route+='/export';method='POST';body={};toast('Assembling and checking your draft movie…');}
    else if(button.dataset.addShot){route+='/shots';method='POST';body={jobId:card.querySelector('[data-add-job]').value};}
    else if(button.dataset.saveProject)body={name:card.querySelector('[data-project-name]').value,description:card.querySelector('[data-project-description]').value};
    else if(button.dataset.saveShot){const row=button.closest('[data-shot]');route+='/shots/'+button.dataset.saveShot;body={scene:row.querySelector('[data-shot-scene]').value,title:row.querySelector('[data-shot-title]').value,notes:row.querySelector('[data-shot-notes]').value,trimStart:Number(row.querySelector('[data-trim-start]').value),trimEnd:row.querySelector('[data-trim-end]').value===''?null:Number(row.querySelector('[data-trim-end]').value),transition:row.querySelector('[data-transition]').value,transitionSeconds:Number(row.querySelector('[data-fade-seconds]').value)};}
    else{route+='/order';method='POST';const project=state.projects.find(p=>p.id===id),ids=project.shots.map(s=>s.id),index=Number(button.dataset.index),next=index+Number(button.dataset.move);[ids[index],ids[next]]=[ids[next],ids[index]];body={shotIds:ids};}
    await api(route,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    if(button.dataset.saveShot)button.closest('[data-shot]').querySelectorAll('[data-unsaved]').forEach(el=>delete el.dataset.unsaved);
    if(button.dataset.saveProject)card.querySelectorAll('[data-project-name],[data-project-description]').forEach(el=>delete el.dataset.unsaved);
    const dirty=!!card.querySelector('[data-unsaved]');card.querySelector('[data-unsaved-message]').hidden=!dirty;card.querySelector('[data-export-project]').disabled=dirty;
    button.blur();await refreshProjects();toast(button.dataset.exportProject?'Draft exported and checked.':'Project saved.');
  }catch(error){toast(error.message);}finally{button.disabled=false;}
});

$('#generation-type').addEventListener('change',syncMode);

function renderComparison(){
  const available=state.jobs.filter(j=>j.video&&j.report?.technicalPass);
  const draft=available.find(a=>a.request.steps===12&&available.some(b=>b.request.steps===20&&sameComparison(a,b)));
  const standard=draft?available.find(b=>b.request.steps===20&&sameComparison(draft,b)):null;
  for(const [index,side] of ['left','right'].entries()){
    const select=$('#compare-'+side),previous=select.value;
    if(select.options.length!==available.length){select.innerHTML=available.map(j=>`<option value="${j.id}">${escape(presetName(j))} · ${j.request.steps} steps · ${j.id.slice(0,8)}</option>`).join('');select.value=available.some(j=>j.id===previous)?previous:(index?standard?.id:draft?.id)??available[index]?.id??available[0]?.id??'';}
    const job=available.find(j=>j.id===select.value),video=$('#compare-'+side+'-video');
    if(job){const url=`/outputs/${job.id}/${job.video}`;if(video.getAttribute('src')!==url)video.src=url;$('#compare-'+side+'-meta').textContent=`${job.request.engine==='camera'?'Camera conditioned':job.request.engine==='keyframes'?'Start/end conditioned':'Prompt guided'} · ${job.request.steps} steps · ${job.report.size.join(' × ')} · ${job.report.fps} fps · seed ${job.request.seed}. Creative review: ${job.review?.verdict??'pending'}.`;}
  }
  const a=available.find(j=>j.id===$('#compare-left').value),b=available.find(j=>j.id===$('#compare-right').value);
  $('#compare-context').textContent=a&&b&&a.request.seed===b.request.seed&&a.request.asset===b.request.asset&&a.request.prompt===b.request.prompt?'Same source, prompt, and seed. Compare the changed settings and actual result.':'These takes use different inputs or seeds; differences may have several causes.';
}
for(const side of ['left','right'])$('#compare-'+side).addEventListener('change',renderComparison);
$('#compare-play').addEventListener('click',async()=>{try{const videos=[$('#compare-left-video'),$('#compare-right-video')];videos.forEach(v=>v.currentTime=0);await Promise.all(videos.map(v=>v.play()));}catch(error){toast('Choose two playable takes first.');}});
$('#compare-pause').addEventListener('click',()=>[$('#compare-left-video'),$('#compare-right-video')].forEach(v=>v.pause()));

function getComposerInput(){return {profile:$('#generation-profile').value,endAsset:state.endAsset,look:readLook(),requestId:state.requestId,asset:state.asset,preset:state.preset,prompt:$('#prompt').value,aspect:$('#aspect').value,length:$('#length').value,quality:$('#quality').value,seed:$('#seed').value,engine:$('#engine').value,cameraSampling:$('#camera-sampling').value,cameraPose:$('#camera-pose').value,cameraSpeed:$('#camera-speed').value,cameraMirror:$('#engine').value==='camera'&&['Pan Left','Pan Right'].includes($('#camera-pose').value)&&$('#camera-mirror').checked,mode:$('#generation-type').value};}
function readLook(){return Object.fromEntries([...document.querySelectorAll('[data-look]')].map(s=>[s.dataset.look,s.value]));}
function restoreSettings(r){
  state.asset=r.asset;state.endAsset=r.endAsset??null;$('#end-reference-preview').src=state.endAsset?'/assets/'+state.endAsset:'';$('#end-reference-preview').hidden=!state.endAsset;$('#end-reference-name').textContent=state.endAsset?'Saved ending reference':'Choose the frame where this shot should end.';state.selected=null;state.requestId=null;$('#reference-preview').src=r.asset?'/assets/'+r.asset:'';$('#reference-preview').hidden=!r.asset;$('#drop-copy').hidden=!!r.asset;$('#reference-name').textContent=r.asset?'Saved reference':'No reference needed for text-to-video';
  $('#generation-profile').value=r.profile??'standard';$('#generation-type').value=r.mode??'image';$('#prompt').value=r.prompt;$('#engine').value=r.engine??'wan5b';$('#camera-sampling').value=r.cameraSampling??'fast';$('#camera-pose').value=r.cameraPose??'Zoom In';$('#camera-speed').value=r.cameraSpeed??1;$('#camera-mirror').checked=r.cameraMirror??false;$('#aspect').value=r.aspect;$('#length').value=r.length;$('#quality').value=r.quality==='draft'||r.steps===12?'draft':'standard';$('#seed').value=r.seed;
  document.querySelectorAll('[data-look]').forEach(el=>el.value=r.look?.[el.dataset.look]??'original');syncMode();selectPreset(r.preset);switchView('studio');window.scrollTo({top:0,behavior:'smooth'});
}
const libraryUI=createLibraryUI({api,toast,getJobs:()=>state.jobs,getPresets:()=>presets,openJob:selectJob,restore:restoreSettings,
  prepare:brief=>{restoreSettings({asset:null,mode:'text',engine:'wan5b',prompt:brief.prompt,preset:brief.preset,aspect:'landscape',length:'preview',steps:12,seed:''});toast('Brief loaded. Add a saved reference if needed, then generate.');},
  useReference:(asset,reference)=>{state.asset=asset;state.selected=null;state.requestId=null;$('#generation-type').value='image';$('#reference-preview').src='/assets/'+asset;$('#reference-preview').hidden=false;$('#drop-copy').hidden=true;$('#reference-name').textContent=reference.name;syncMode();switchView('studio');toast('Reference loaded. Appearance notes remain in your reference collection.');}
});
const queueUI=createQueueUI({api,toast,getInput:getComposerInput,switchView,openJob:selectJob,getJobs:()=>state.jobs});
setInterval(()=>{if(state.view==='queue')queueUI.refresh();},3000);
initialize().then(async()=>{const launch=takeLaunchPrompt('video');if(launch){$('#prompt').value=launch;$('#generation-type').value='text';syncMode();}
  const query=new URLSearchParams(location.search),initialView=query.get('view');if(['image','text'].includes(query.get('mode')))$('#generation-type').value=query.get('mode');if(['wan5b','camera','keyframes'].includes(query.get('engine')))$('#engine').value=query.get('engine');syncMode();$('#generation-type').dispatchEvent(new Event('change',{bubbles:true}));
  if(['studio','gallery','checks','projects','compare','guide','story','assets','queue'].includes(initialView))switchView(initialView);
  const image=query.get('image');if(image&&/^[a-f0-9-]{36}\.(png|jpg|webp)$/.test(image)){state.asset=image;state.selected=null;state.requestId=null;$('#reference-preview').src='/assets/'+image;$('#reference-preview').hidden=false;$('#drop-copy').hidden=true;$('#reference-name').textContent='From your image library';render();}
  if(query.get('job')&&state.jobs.some(j=>j.id===query.get('job')))selectJob(query.get('job'));
  if(/^[a-f0-9-]{36}$/.test(query.get('project')??'')&&/^[a-f0-9-]{36}$/.test(query.get('shot')??'')&&!query.has('job')&&!query.has('production')){
    try{const project=await api('/api/short-films/'+query.get('project')),frame=project.story.frames.find(f=>f.id===query.get('shot'));if(!frame)throw Error('The selected storyboard shot no longer exists.');const input=shotGenerationInput(frame,state.jobs);$('#prompt').value=input.prompt;state.selected=null;state.requestId=null;if(presets.some(p=>p.id===input.preset))selectPreset(input.preset);
      if(frame.imageJobId){const source=state.jobs.find(j=>j.id===frame.imageJobId);if(!source?.image||!source.report?.technicalPass||source.review?.verdict==='rejected')throw Error('Choose a checked storyboard still in Story, or upload a new image.');const asset=await api('/api/jobs/'+frame.imageJobId+'/image-asset',{method:'POST'});state.asset=asset.name;$('#generation-type').value='image';$('#reference-preview').src=asset.url;$('#reference-preview').hidden=false;$('#drop-copy').hidden=true;$('#reference-name').textContent=frame.title+' · saved storyboard still';}else if(input.asset){state.asset=input.asset;$('#generation-type').value='image';$('#reference-preview').src='/assets/'+input.asset;$('#reference-preview').hidden=false;$('#drop-copy').hidden=true;$('#reference-name').textContent=frame.title+' · original take reference';}else{$('#generation-type').value='text';}
      syncMode();render();toast(!input.prompt?'No brief is saved for this shot yet. Write one here or in Story before generating.':input.fromTake?'Original take prompt loaded. Review the source and controls before generating a variation.':'Saved shot brief loaded. Review the controls, generate a take, then choose Use selected clip for this shot.');
    }catch(error){toast(error.message);}
  }
  if(/^[a-f0-9-]{36}$/.test(query.get('production')??'')&&/^[a-f0-9-]{36}$/.test(query.get('shot')??'')){
    try{const prepared=await api(`/api/director/${query.get('production')}/shots/${query.get('shot')}/prepare`);restoreSettings(prepared.request);toast('Director shot loaded. Keep its settings to match the saved plan; generate, review, then select the take in Director.');}catch(error){toast(error.message);}
  }
});

function sameComparison(a,b){return ['asset','seed','prompt','preset','aspect','length'].every(key=>a.request[key]===b.request[key])&&(a.request.engine??'wan5b')===(b.request.engine??'wan5b');}

import {mountWorkflowPanel} from '/workflow-panel.js';
mountWorkflowPanel({context:'create',form:$('#shot-form'),getRequest:()=>getComposerInput(),onLocalResult:async job=>{state.selected=job.id;await refreshJobs();},onImport:async item=>{if(item.kind==='image'){state.asset=item.name;$('#reference-preview').src=item.url;$('#reference-preview').hidden=false;$('#drop-copy').hidden=true;state.requestId=null;render();}else if(item.kind==='footage')location.href='/video-tools?footage='+item.id;}});

window.addEventListener('frameforge:use-media',async event=>{try{const m=event.detail;if(m.kind!=='image')return;const asset=m.asset?{name:m.asset}:m.file?await api('/api/assets',{method:'POST',headers:{'Content-Type':m.file.type},body:m.file}):await api('/api/jobs/'+m.jobId+'/image-asset',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});state.asset=asset.name;state.selected=null;state.requestId=null;$('#generation-type').value='image';$('#reference-preview').src='/assets/'+asset.name;$('#reference-preview').hidden=false;$('#drop-copy').hidden=true;$('#reference-name').textContent='From My work';$('#generation-type').dispatchEvent(new Event('change',{bubbles:true}));switchView('studio');toast('Image ready. Choose the motion, then generate.');}catch(error){toast(error.message);}});
