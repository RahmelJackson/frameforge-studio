const section=document.querySelector('#provider-workflows');
document.body.classList.add('provider-featured');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const link=(url,text)=>`<a href="${esc(url)}" target="_blank" rel="noopener">${esc(text)} ↗</a>`;
async function show(id,variant='default',focus=true,check=false){
 const output=section.querySelector('[data-provider-detail]');
 output.textContent='Loading the exact workflow…';
 try{
  const base='/api/provider-workflows/'+encodeURIComponent(id),suffix=variant==='local'?'?variant=local':'';
  const response=await fetch(base+suffix),p=await response.json();
  if(!response.ok)throw Error(p.error??'Could not load the provider workflow.');
  const sample=p.id==='flux3-video'?'product-concept.png':'observatory-concept.png';
  output.innerHTML=`<p class="eyebrow">${esc(p.model)} / ${p.execution==='local'?'LOCAL SETUP':'PAID EXTERNAL RUN'}</p>
   <h3>${esc(p.title)}</h3><p>${esc(p.summary)}</p>
   ${p.relatedModel?'<p class="help-limit"><strong>Looking for local FLUX?</strong> '+link(p.relatedModel.url,p.relatedModel.name)+'. This video graph uses the separate hosted video model.</p>':''}
   <p><strong>Bring:</strong> ${esc(p.input)}<br><strong>Make:</strong> ${esc(p.output)}</p>
   ${p.licenseNotice?'<p class="help-limit"><strong>Local model license:</strong> '+esc(p.licenseNotice)+' '+link(p.licenseUrl,'Read the model license')+'</p>':''}
   <ol>${p.steps.map(s=>'<li>'+esc(s)+'</li>').join('')}</ol>
   ${p.example?'<p><strong>Try this prompt:</strong> '+esc(p.example)+'</p>':''}
   <div class="provider-run-panel"><h3>Start this workflow</h3><p>Use the run package to keep this sample’s prompt, graph and input together. Import it in the editor, check settings, then press Run there.</p><div class="actions">
   ${link(p.cloudUrl,p.variant==='local'?'Run Cloud alternative':p.id==='ltx-vfx'?'Run with Comfy Cloud':'Run on Comfy Cloud')}
   ${p.execution==='local'?'<button data-check-local>Check local run setup</button>':''}
   ${p.localFile&&p.variant!=='local'?'<button data-provider-local>'+esc(p.localLabel??'Use local H3 alternative')+'</button>':''}
   <button class="primary" data-run-package>Download run package ↓</button></div><p data-run-status role="status"></p><div data-local-readiness></div></div>
   <details><summary>Graph, input and official guide</summary><div class="actions"><a href="${base}/download${suffix}" download>Download ${esc(p.model)} graph only ↓</a>
   <a href="/explore-art/${sample}" download="${sample}">Download original input image ↓</a>
   ${link(p.guide,'Official model & setup guide')}
   </div></details>
   <p class="help-limit">${esc(p.limits)}</p><p><strong>Core model:</strong> ${esc(p.bonus)}</p>
   <p><strong>Status:</strong> ${esc(p.status)}. Save an actual result and the executed graph before claiming bonus evidence.</p>
   ${p.models.length?'<h3>Model downloads from the official graph</h3><p>Choose the files used by your branch in native ComfyUI. Optional prompt enhancement is disabled in the LTX sample.</p>'+p.models.map(m=>'<p>'+link(m.url,m.name)+'<br><small>ComfyUI/models/'+esc(m.directory)+'/</small></p>').join(''):'<p>This selected route uses a hosted model. No local weights are required for the Cloud template.</p>'}
   <details><summary>Inspect ${p.nodeTypes.length} native node types</summary><ul>${p.nodeTypes.map(t=>'<li><code>'+esc(t)+'</code></li>').join('')}</ul><p>Use native ComfyUI for nested subgraphs and provider settings. The downloaded JSON retains them.</p></details>
   <details><summary>View the complete ComfyUI JSON</summary><pre>${esc(JSON.stringify(p.graph,null,2))}</pre></details>
   <p><small>${link(p.source,'Official upstream graph')}<br>Upstream commit: ${esc(p.upstreamCommit)}<br>Download SHA-256: ${esc(p.sha256)}</small></p>`;
  output.querySelector('[data-provider-local]')?.addEventListener('click',()=>show(id,'local',true,true));
  output.querySelector('[data-run-package]').onclick=async()=>{const message=output.querySelector('[data-run-status]');message.textContent='Preparing graph and original input…';try{const r=await fetch(base+'/export'+suffix,{method:'POST'}),v=await r.json();if(!r.ok)throw Error(v.error??'Could not prepare the run package.');const a=document.createElement('a');a.href=v.bundleUrl;a.download=p.id+'-run.zip';a.click();message.textContent='Run package downloaded. Unzip it, import workflow.json and the image in inputs/ into the selected editor, then press Run there.';}catch(e){message.textContent=e.message;}};
  async function localSetup(){const panel=output.querySelector('[data-local-readiness]');panel.textContent='Checking your local engines…';try{const r=await fetch(base+'/readiness'+suffix),v=await r.json();if(!r.ok)throw Error(v.error??'Could not check local setup.');panel.innerHTML=`<h3>${esc(v.message)}</h3>${(v.missingModels??[]).length?'<ul>'+v.missingModels.map(m=>'<li><strong>'+esc(m.name)+'</strong><br>'+link(m.url,'Download model')+' · '+(m.bytes?(m.bytes/1024**3).toFixed(1)+' GiB':'')+'<br><small>ComfyUI/models/'+esc(m.directory)+'/</small></li>').join('')+'</ul>':''}${v.missingNodes?.length?'<p>Missing nodes: '+v.missingNodes.map(esc).join(', ')+'</p>':''}${v.engineUrl?link(v.engineUrl,'Open this local ComfyUI'):''}<p>${esc(v.verification)}</p>`;const badge=section.querySelector('[data-readiness="'+id+'"]');if(badge)badge.textContent=v.ready?'Local setup present':v.missingModels?.length?v.missingModels.length+' model downloads needed':'Local setup needed';}catch(e){panel.textContent=e.message;}}
  output.querySelector('[data-check-local]')?.addEventListener('click',localSetup);
  if(check)await localSetup();
  if(focus)output.scrollIntoView({behavior:'smooth',block:'start'});
 }catch(e){output.textContent=e.message;}
}
try{
 const response=await fetch('/api/provider-workflows'),data=await response.json();
 if(!response.ok)throw Error(data.error??'Provider workflows unavailable.');
 if(!data.length)section.innerHTML='<h2>Provider workflows</h2><p>Open weights only is enabled. This profile shows the reviewed local graphs below; provider templates and these unreviewed model routes are hidden.</p>';
 else{
  section.querySelector('[data-provider-cards]').innerHTML=data.map(w=>`<article class="workflow-card"><img src="${esc(w.art)}" alt="Original sample input for ${esc(w.model)}"><small>Original sample input</small><span class="badge">${esc(w.model)}</span><h3>${esc(w.title)}</h3><p>${esc(w.summary)}</p><p class="provider-readiness" data-readiness="${esc(w.id)}">${w.execution==='local'?'Check your local setup':'Comfy Cloud account and credits required'}</p><div class="provider-card-actions"><button data-provider="${esc(w.id)}">${w.execution==='local'?'Set up local run':'Open workflow & inputs'}</button>${w.localFile?'<button data-provider-local-card="'+esc(w.id)+'">'+esc(w.localLabel??'Use local H3')+'</button>':''}${link(w.cloudUrl,'Run on Comfy Cloud')}</div></article>`).join('');
  section.querySelectorAll('[data-provider]').forEach(b=>b.addEventListener('click',()=>show(b.dataset.provider,'default',true,b.dataset.provider==='ltx-vfx')));
  section.querySelectorAll('[data-provider-local-card]').forEach(b=>b.addEventListener('click',()=>show(b.dataset.providerLocalCard,'local',true,true)));
  const id=new URLSearchParams(location.search).get('providerWorkflow');
  if(data.some(w=>w.id===id))await show(id,'default',false);
 }
}catch(e){section.querySelector('[data-provider-detail]').textContent=e.message;}
