const ltxEffects=[['original','Violet smoke · tested sample'],['embers','Floating embers'],['mist','Low drifting mist'],['light','Doorway light'],['rain','Rain atmosphere']];
const section=document.querySelector('#provider-workflows');
const compact=section.hasAttribute('data-provider-compact');
const detailOnly=section.hasAttribute('data-provider-detail-only');
if(!compact&&!detailOnly)document.body.classList.add('provider-featured');
window.addEventListener('frameforge:provider-workflow',event=>{section.hidden=false;show(event.detail.id,event.detail.variant,true,true);});
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const link=(url,text)=>`<a href="${esc(url)}" target="_blank" rel="noopener">${esc(text)} ↗</a>`;
function resultView(v,sample){
 if(!v)return '';
 const dimensions=v.size.map(esc).join(' × ');
 const media=v.mediaType==='image'?`<div class="provider-comparison"><figure><img loading="lazy" src="/explore-art/${sample.replace('-concept.png','-preview.jpg')}" alt="Original product with a green control knob"><figcaption>Original input</figcaption></figure><figure><img src="${esc(v.imageUrl)}" alt="Actual local FLUX 3 product-edit result"><figcaption>Actual local result</figcaption></figure></div>`:`<video controls playsinline preload="metadata" ${v.posterUrl?`poster="${esc(v.posterUrl)}"`:""} src="${esc(v.videoUrl)}#t=2"></video>`;
 const facts=v.mediaType==='image'?dimensions+' · edited image':dimensions+' · '+Number(v.duration).toFixed(2)+' seconds · '+v.frames+' frames · '+v.blackFrames+' black frames · '+(v.hasAudio?'audio included':'no audio');
 return `<div class="provider-run-panel provider-result"><h3>Actual local test result</h3>${media}<p>${esc(v.model)} · ${facts}</p><p>${esc(v.scope)}</p><small>Technical checks passed. Review the creative result before using it.</small></div>`;
}
let detailToken=0;
window.addEventListener('frameforge:provider-workflow-close',()=>{++detailToken;section.hidden=true;});
async function show(id,variant='default',focus=true,check=false){
 const token=++detailToken;
 const output=section.querySelector('[data-provider-detail]');
 output.textContent='Loading the exact workflow…';
 try{
  const base='/api/provider-workflows/'+encodeURIComponent(id),suffix=variant==='local'?'?variant=local':'';
  const response=await fetch(base+suffix),p=await response.json();
  if(token!==detailToken)return;
  if(!response.ok)throw Error(p.error??'Could not load the provider workflow.');
  const sample=p.id==='flux3-video'?'product-concept.png':'observatory-concept.png';
  output.innerHTML=`<p class="eyebrow">${esc(p.model)} / ${p.execution==='local'?'LOCAL SETUP':'PAID EXTERNAL RUN'}</p>
   <h3>${esc(p.title)}</h3><p>${esc(p.summary)}</p>
   ${p.relatedModel?'<p class="help-limit"><strong>Looking for local FLUX?</strong> '+link(p.relatedModel.url,p.relatedModel.name)+'. This video graph uses the separate hosted video model.</p>':''}
   <p><strong>Bring:</strong> ${esc(p.input)}<br><strong>Make:</strong> ${esc(p.output)}</p>
   ${p.licenseNotice?'<p class="help-limit"><strong>Local model license:</strong> '+esc(p.licenseNotice)+' '+link(p.licenseUrl,'Read the model license')+'</p>':''}
   <ol>${p.steps.map(s=>'<li>'+esc(s)+'</li>').join('')}</ol>
   ${p.example?'<p><strong>Try this prompt:</strong> '+esc(p.example)+'</p>':''}
   <div class="provider-run-panel"><h3>Start this workflow</h3>${p.id==='ltx-vfx'?'<label class="ltx-effect-picker">LTX effects pack<select data-ltx-effect>'+ltxEffects.map(([id,title])=>'<option value="'+id+'">'+title+'</option>').join('')+'</select></label><p class="micro">All five use this local LTX graph and its bounded preview settings. The saved result below demonstrates Violet smoke; other effects are prompt variations to try.</p>':''}<p>Use the run package to keep this sample’s prompt, graph and input together. Import it in the editor, check settings, then press Run there.</p><div class="actions">
   ${p.execution==='local'?'<button data-check-local>Check local run setup</button>':''}
   ${p.localFile&&p.variant!=='local'?'<button data-provider-local>'+esc(p.localLabel??'Use local H3 alternative')+'</button>':''}
   <button class="primary" data-run-package>Download run package ↓</button>${link(p.cloudUrl,p.execution==='local'?'Cloud alternative':'Run on Comfy Cloud')}</div><p data-run-status role="status"></p><div data-local-readiness></div></div>
   <details><summary>Graph, input and official guide</summary><div class="actions"><a href="${base}/download${suffix}" download>Download ${esc(p.model)} graph only ↓</a>
   <a href="/explore-art/${sample}" download="${sample}">Download original input image ↓</a>
   ${link(p.guide,'Official model & setup guide')}
   </div></details>
   <p class="help-limit">${esc(p.limits)}</p><p><strong>Core model:</strong> ${esc(p.bonus)}</p>
   <p><strong>Status:</strong> ${esc(p.status)}. ${p.verification?'The result below covers one tested profile; other settings still need review.':'Save an actual result and the executed graph before claiming bonus evidence.'}</p>
   ${resultView(p.verification,sample)}
   ${p.models.length?'<h3>Model downloads from the official graph</h3><p>Choose the files used by your branch in native ComfyUI. Optional prompt enhancement is disabled in the LTX sample.</p>'+p.models.map(m=>'<p>'+link(m.url,m.name)+'<br><small>ComfyUI/models/'+esc(m.directory)+'/</small></p>').join(''):'<p>This selected route uses a hosted model. No local weights are required for the Cloud template.</p>'}
   <details><summary>Inspect ${p.nodeTypes.length} native node types</summary><ul>${p.nodeTypes.map(t=>'<li><code>'+esc(t)+'</code></li>').join('')}</ul><p>Use native ComfyUI for nested subgraphs and provider settings. The downloaded JSON retains them.</p></details>
   <details><summary>View the complete ComfyUI JSON</summary><pre>${esc(JSON.stringify(p.graph,null,2))}</pre></details>
   <p><small>${link(p.source,'Official upstream graph')}<br>Upstream commit: ${esc(p.upstreamCommit)}<br>Download SHA-256: ${esc(p.sha256)}</small></p>`;
  output.querySelector('[data-provider-local]')?.addEventListener('click',()=>show(id,'local',true,true));
  output.querySelector('[data-run-package]').onclick=async()=>{const message=output.querySelector('[data-run-status]');message.textContent='Preparing graph and original input…';try{const r=await fetch(base+'/export'+suffix+(p.id==='ltx-vfx'?(suffix?'&':'?')+'effect='+output.querySelector('[data-ltx-effect]').value:''),{method:'POST'}),v=await r.json();if(!r.ok)throw Error(v.error??'Could not prepare the run package.');const a=document.createElement('a');a.href=v.bundleUrl;a.download=p.id+'-run.zip';a.click();message.textContent='Run package downloaded. Unzip it, import workflow.json and the image in inputs/ into the selected editor, then press Run there.';}catch(e){message.textContent=e.message;}};
  async function localSetup(){const panel=output.querySelector('[data-local-readiness]');panel.textContent='Checking your local engines…';try{const r=await fetch(base+'/readiness'+suffix),v=await r.json();if(!r.ok)throw Error(v.error??'Could not check local setup.');panel.innerHTML=`<h3>${esc(v.message)}</h3>${(v.missingModels??[]).length?'<ul>'+v.missingModels.map(m=>'<li><strong>'+esc(m.name)+'</strong><br>'+link(m.url,'Download model')+' · '+(m.bytes?(m.bytes/1024**3).toFixed(1)+' GiB':'')+'<br><small>ComfyUI/models/'+esc(m.directory)+'/</small></li>').join('')+'</ul>':''}${v.missingNodes?.length?'<p>Missing nodes: '+v.missingNodes.map(esc).join(', ')+'</p>':''}${v.engineUrl?link(v.engineUrl,'Open this local ComfyUI'):''}<p>${esc(v.verification)}</p>`;const badge=section.querySelector('[data-readiness="'+id+'"]');if(badge)badge.textContent=v.ready?'Local setup present':v.missingModels?.length?v.missingModels.length+' model downloads needed':'Local setup needed';}catch(e){panel.textContent=e.message;}}
  output.querySelector('[data-check-local]')?.addEventListener('click',localSetup);
  if(check)await localSetup();
  if(token!==detailToken)return;
  const address=new URL(location.href);address.searchParams.delete('workflow');address.searchParams.delete('job');address.searchParams.set('providerWorkflow',id);address.searchParams.set('providerVariant',variant);history.replaceState(null,'',address);
  if(focus)output.scrollIntoView({behavior:'smooth',block:'start'});
 }catch(e){if(token===detailToken)output.textContent=e.message;}
}
try{
 const response=await fetch('/api/provider-workflows'),data=await response.json();
 if(!response.ok)throw Error(data.error??'Provider workflows unavailable.');
 if(!data.length){if(compact)section.hidden=true;else section.innerHTML='<h2>Provider workflows</h2><p>Open weights only is enabled. This profile shows the reviewed local graphs below; provider templates and these unreviewed model routes are hidden.</p>';}
 else{
  if(!detailOnly)section.querySelector('[data-provider-cards]').innerHTML=data.map(w=>{
   const f=w.featured??w,v=f.verification,variant=f.variant??'default',url='/library?'+new URLSearchParams({collection:'workflows',providerWorkflow:w.id,providerVariant:variant})+'#provider-workflows';
   const media=v?.mediaType==='image'?`<img src="${esc(v.posterUrl??v.imageUrl)}" alt="Actual ${esc(f.model)} local result" loading="lazy">`:v?.videoUrl?`<video controls muted loop playsinline preload="metadata" ${v.posterUrl?`poster="${esc(v.posterUrl)}"`:""} src="${esc(v.videoUrl)}#t=2" aria-label="Actual ${esc(f.model)} local video result"></video>`:`<img src="${esc(w.art)}" alt="Original sample input for ${esc(f.model)}" loading="lazy">`;
   const primary=compact?`<a class="provider-primary" href="${esc(url)}">Open local workflow →</a>`:`<button data-provider="${esc(w.id)}" data-variant="${esc(variant)}">Open local workflow →</button>`;
   return `<article class="workflow-card">${media}<small>${v?'ACTUAL LOCAL RESULT':'ORIGINAL SAMPLE INPUT'}</small><span class="badge">${esc(f.model)}</span><h3>${esc(f.title)}</h3><p>${esc(f.summary)}</p><p class="provider-readiness" data-readiness="${esc(w.id)}">${v?'Local render completed · review the result':'Local graph + model downloads'}</p><div class="provider-card-actions">${primary}${compact?'':link(f.cloudUrl??w.cloudUrl,'Cloud alternative')}</div></article>`;
  }).join('');
  if(!compact){
   section.querySelectorAll('[data-provider]').forEach(b=>b.addEventListener('click',()=>show(b.dataset.provider,b.dataset.variant,true,true)));
   const params=new URLSearchParams(location.search),id=params.get('providerWorkflow'),entry=data.find(w=>w.id===id);
   if(entry){section.hidden=false;}if(entry)await show(id,params.get('providerVariant')??entry.featured?.variant??'default',false);
  }
 }
}catch(e){if(compact)section.hidden=true;else section.querySelector('[data-provider-detail]').textContent=e.message;}
