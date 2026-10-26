const section=document.querySelector('#provider-workflows');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const link=(url,text)=>`<a href="${esc(url)}" target="_blank" rel="noopener">${esc(text)} ↗</a>`;
async function show(id,variant='default'){
 const output=section.querySelector('[data-provider-detail]');
 output.textContent='Loading the exact workflow…';
 try{
  const base='/api/provider-workflows/'+encodeURIComponent(id),suffix=variant==='local'?'?variant=local':'';
  const response=await fetch(base+suffix),p=await response.json();
  if(!response.ok)throw Error(p.error??'Could not load the provider workflow.');
  const sample=p.id==='flux3-video'?'product-concept.png':'observatory-concept.png';
  output.innerHTML=`<p class="eyebrow">${esc(p.model)} / ${p.execution==='local'?'LOCAL SETUP':'PAID EXTERNAL RUN'}</p>
   <h3>${esc(p.title)}</h3><p>${esc(p.summary)}</p>
   <p><strong>Bring:</strong> ${esc(p.input)}<br><strong>Make:</strong> ${esc(p.output)}</p>
   <ol>${p.steps.map(s=>'<li>'+esc(s)+'</li>').join('')}</ol>
   ${p.example?'<p><strong>Try this prompt:</strong> '+esc(p.example)+'</p>':''}
   <div class="actions"><a class="primary" href="${base}/download${suffix}" download>Download ${esc(p.model)} graph ↓</a>
   ${link(p.cloudUrl,p.variant==='local'?'Open Cloud alternative':p.id==='ltx-vfx'?'Open official base Cloud template':'Open matching Comfy Cloud template')}
   <a href="/explore-art/${sample}" download="${sample}">Download original input image ↓</a>
   ${link(p.guide,'Official model & setup guide')}
   ${p.localFile&&p.variant!=='local'?'<button data-provider-local>Inspect local H3 alternative</button>':''}</div>
   <p class="help-limit">${esc(p.limits)}</p><p><strong>Core model:</strong> ${esc(p.bonus)}</p>
   <p><strong>Status:</strong> ${esc(p.status)}. Save an actual result and the executed graph before claiming bonus evidence.</p>
   ${p.models.length?'<h3>Model downloads from the official graph</h3><p>Choose the files used by your branch in native ComfyUI. Optional prompt enhancement is disabled in the LTX sample.</p>'+p.models.map(m=>'<p>'+link(m.url,m.name)+'<br><small>ComfyUI/models/'+esc(m.directory)+'/</small></p>').join(''):'<p>This selected route uses a hosted model. No local weights are required for the Cloud template.</p>'}
   <details><summary>Inspect ${p.nodeTypes.length} native node types</summary><ul>${p.nodeTypes.map(t=>'<li><code>'+esc(t)+'</code></li>').join('')}</ul><p>Use native ComfyUI for nested subgraphs and provider settings. The downloaded JSON retains them.</p></details>
   <details><summary>View the complete ComfyUI JSON</summary><pre>${esc(JSON.stringify(p.graph,null,2))}</pre></details>
   <p><small>${link(p.source,'Official upstream graph')}<br>Upstream commit: ${esc(p.upstreamCommit)}<br>Download SHA-256: ${esc(p.sha256)}</small></p>`;
  output.querySelector('[data-provider-local]')?.addEventListener('click',()=>show(id,'local'));
  output.scrollIntoView({behavior:'smooth',block:'start'});
 }catch(e){output.textContent=e.message;}
}
try{
 const response=await fetch('/api/provider-workflows'),data=await response.json();
 if(!response.ok)throw Error(data.error??'Provider workflows unavailable.');
 if(!data.length)section.innerHTML='<h2>Provider workflows</h2><p>Open weights only is enabled. This profile shows the reviewed local graphs above; provider templates and these unreviewed model routes are hidden.</p>';
 else{
  section.querySelector('[data-provider-cards]').innerHTML=data.map(w=>`<button class="workflow-card" data-provider="${esc(w.id)}"><img src="${esc(w.art)}" alt="Original Frameforge concept artwork, not a generated ${esc(w.model)} result"><small>Original sample input</small><span class="badge">${esc(w.model)} · ${w.execution==='local'?'LOCAL SETUP':'PAID CLOUD'}</span><h3>${esc(w.title)}</h3><p>${esc(w.summary)}</p><b>Inspect graph, setup & downloads →</b></button>`).join('');
  section.querySelectorAll('[data-provider]').forEach(b=>b.addEventListener('click',()=>show(b.dataset.provider)));
  const id=new URLSearchParams(location.search).get('providerWorkflow');
  if(data.some(w=>w.id===id))await show(id);
 }
}catch(e){section.querySelector('[data-provider-detail]').textContent=e.message;}
