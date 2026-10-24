const $=s=>document.querySelector(s);
const esc=(v='')=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function createLibraryUI({api,toast,getJobs,getPresets,prepare,restore,useReference,openJob}){
  let data={plans:[],references:[],recipes:[]},version='';
  async function refresh(){data=await api('/api/library');version='';render();}
  function render(){
    const root=$('#story-list'),key=JSON.stringify(data);
    if(version!==key&&!root.contains(document.activeElement)&&!root.querySelector('[data-dirty-brief]')){
      root.innerHTML=data.plans.map(plan=>`<article class="project-card" data-plan="${plan.id}"><h2>${esc(plan.name)}</h2><p class="micro">${esc(plan.method)} ${plan.characters.length?'Dialogue speakers: '+esc(plan.characters.join(', ')):''}</p>${plan.briefs.map((b,index)=>`<div class="brief-card" data-brief="${b.id}"><h3>SHOT ${index+1}</h3><div class="settings-row"><label>Scene<input data-brief-scene aria-label="Brief scene" value="${esc(b.scene)}" maxlength="100"></label><label>Title<input data-brief-title aria-label="Brief title" value="${esc(b.title)}" maxlength="100"></label></div><label class="field-label">Shot brief<textarea data-brief-prompt aria-label="Shot brief" maxlength="2500">${esc(b.prompt)}</textarea></label><label class="field-label">Movement suggestion<select data-brief-preset aria-label="Movement suggestion">${getPresets().map(p=>`<option value="${p.id}" ${p.id===b.preset?'selected':''}>${esc(p.name)}</option>`).join('')}</select></label><label class="field-label">Continuity notes<textarea data-brief-notes aria-label="Brief continuity notes" maxlength="2000">${esc(b.notes)}</textarea></label><details><summary>Original script beat</summary><pre>${esc(b.source)}</pre></details><div class="review-actions"><button data-save-brief>Save brief</button><button data-prepare-brief>Prepare this shot</button></div><p class="micro" data-brief-message>Review the brief before rendering. Preparing opens the composer without starting a render.</p></div>`).join('')}</article>`).join('')||'<p class="empty-state">Paste your script to create the first shot plan.</p>';
      version=key;
    }
    const refs=$('#reference-list');if(refs.dataset.version!==key){refs.dataset.version=key;refs.innerHTML=data.references.map(r=>`<article class="info-panel"><h2>${esc(r.name)}</h2><p>${esc(r.kind)} · ${r.assets.length} reference${r.assets.length===1?'':'s'}</p><p>${esc(r.notes)}</p><div class="reference-choices">${r.assets.map((a,i)=>`<button data-reference="${r.id}" data-asset="${a}" aria-label="Use ${esc(r.name)} reference ${i+1}"><img src="/assets/${a}" alt="${esc(r.name)} reference ${i+1}"><span>Use frame ${i+1} ↗</span></button>`).join('')}</div></article>`).join('');}
    const recipes=$('#recipe-list');if(recipes.dataset.version!==key){recipes.dataset.version=key;recipes.innerHTML=data.recipes.map(r=>`<article class="info-panel"><h2>${esc(r.name)}</h2><p>${esc(r.request.kind==='video-tool'?'Video · '+r.request.tool:r.request.engine==='camera'?'Fun Camera 14B':'Wan 5B')} · ${esc(r.request.mode??r.request.tool)} · ${esc(r.request.aspect)} · seed ${r.request.seed}</p><p>${esc(r.request.prompt)}</p><div class="review-actions"><button data-use-recipe="${r.id}">Load recipe</button><button data-recipe-example="${r.evidenceJobId}">View verified example</button></div></article>`).join('');}
    const select=$('#recipe-job'),jobs=getJobs().filter(j=>j.video&&j.report?.technicalPass),jobKey=jobs.map(j=>j.id).join(',');
    if(select.dataset.version!==jobKey){const previous=select.value;select.innerHTML=jobs.map(j=>`<option value="${j.id}">${esc((j.request.caption||j.request.narration||j.request.prompt||j.request.tool).slice(0,65))} · ${j.id.slice(0,8)}</option>`).join('');if(jobs.some(j=>j.id===previous))select.value=previous;select.dataset.version=jobKey;}
  }
  async function saveForm(event,action){event.preventDefault();const button=event.currentTarget.querySelector('button');button.disabled=true;try{await action();await refresh();toast('Saved to your studio.');}catch(e){toast(e.message);}finally{button.disabled=false;}}
  $('#story-form').addEventListener('submit',e=>saveForm(e,async()=>{await api('/api/plans',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:$('#story-name').value,script:$('#story-script').value})});}));
  $('#reference-form').addEventListener('submit',e=>saveForm(e,async()=>{
    const files=[...$('#collection-files').files];if(!files.length||files.length>8||files.some(f=>f.size>25*1024*1024))throw new Error('Choose 1–8 images, each smaller than 25 MB.');
    const assets=[];for(const file of files){const uploaded=await api('/api/assets',{method:'POST',body:file});assets.push(uploaded.name);}
    await api('/api/references',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:$('#collection-name').value,kind:$('#collection-kind').value,notes:$('#collection-notes').value,assets})});$('#reference-form').reset();
  }));
  $('#recipe-form').addEventListener('submit',e=>saveForm(e,()=>api('/api/recipes',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:$('#recipe-name').value,jobId:$('#recipe-job').value})})));
  for(const type of ['input','change'])$('#story-list').addEventListener(type,event=>{const row=event.target.closest('[data-brief]');if(!row)return;row.dataset.dirtyBrief='true';row.querySelector('[data-prepare-brief]').disabled=true;row.querySelector('[data-brief-message]').textContent='Unsaved edits — save this brief before preparing the shot.';});
  document.addEventListener('click',async event=>{
    const button=event.target.closest('[data-save-brief],[data-prepare-brief],[data-reference],[data-use-recipe],[data-recipe-example]');if(!button||button.disabled)return;
    button.disabled=true;
    try{
      if(button.hasAttribute('data-save-brief')||button.hasAttribute('data-prepare-brief')){
        const row=button.closest('[data-brief]'),planId=button.closest('[data-plan]').dataset.plan,brief=data.plans.find(p=>p.id===planId).briefs.find(b=>b.id===row.dataset.brief);
        if(button.hasAttribute('data-save-brief')){const input={scene:row.querySelector('[data-brief-scene]').value,title:row.querySelector('[data-brief-title]').value,prompt:row.querySelector('[data-brief-prompt]').value,preset:row.querySelector('[data-brief-preset]').value,notes:row.querySelector('[data-brief-notes]').value};await api(`/api/plans/${planId}/briefs/${brief.id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)});delete row.dataset.dirtyBrief;button.blur();await refresh();toast('Shot brief saved.');}
        else prepare(brief);
      }else if(button.dataset.reference){const ref=data.references.find(r=>r.id===button.dataset.reference);useReference(button.dataset.asset,ref);}
      else if(button.dataset.useRecipe){const recipe=data.recipes.find(r=>r.id===button.dataset.useRecipe);if(recipe.request.kind==='video-tool'){openJob(recipe.evidenceJobId);return;}restore(recipe.request);toast('Recipe loaded. Review the settings, then generate.');}
      else openJob(button.dataset.recipeExample);
    }catch(error){toast(error.message);}finally{button.disabled=false;}
  });
  return {refresh,render};
}
