const bar=document.createElement('section');bar.className='judge-bar';bar.setAttribute('aria-label','Judge demo allowance');bar.innerHTML='<div><strong>Judge studio · your invitation to create</strong><p>Runs on the creator’s local GPU. Please be kind.</p><small>The full website · short previews · your own saved work</small></div><div class="judge-bar-status"><div><b data-judge-allowance>Checking your 7 demo runs…</b><br><progress max="7" value="7" aria-label="Demo runs remaining"></progress></div><p role="status" aria-live="polite" data-judge-status>Checking the shared GPU…</p></div>';
(document.querySelector('main')??document.body).prepend(bar);
const allowance=bar.querySelector('[data-judge-allowance]'),status=bar.querySelector('[data-judge-status]'),progress=bar.querySelector('progress');
let polling=false;
async function update(){if(polling||document.hidden)return;polling=true;try{const r=await fetch('/api/status'),v=await r.json();if(!r.ok)throw Error(v.error??'Reopen your judge invitation.');allowance.textContent=`${v.remaining} of ${v.limit} demo runs left`;progress.max=v.limit;progress.value=v.remaining;bar.dataset.busy=String(v.busy);status.textContent=v.busy?(v.activeRequestId?'Your preview is running. Keep browsing while it finishes.':v.busyMessage??'Another judge is rendering. Please wait; no run has been used.'):!v.engineConnected?'The creator’s engine is offline. You can still explore workflows.':!v.remaining?'Your demos are complete. Keep exploring or download a workflow.':!v.sharedRemaining?'The shared GPU allowance is used. Browsing and workflow downloads still work.':'GPU ready · one render at a time. Waiting does not use a run.';}catch(e){status.textContent=e.message;}finally{polling=false;}}
function previewControls(){
 for(const control of document.querySelectorAll('#length,#clip-length')){if([...control.options??[]].some(o=>o.value==='preview'))control.value='preview';for(const o of control.options??[])if(o.value!=='preview')o.disabled=true;}
 for(const control of document.querySelectorAll('#profile,#generation-profile')){control.value='standard';for(const o of control.options??[])if(o.value!=='standard')o.disabled=true;}
 for(const control of document.querySelectorAll('#camera-sampling')){control.value='fast';for(const o of control.options??[])if(o.value!=='fast')o.disabled=true;}
 for(const input of document.querySelectorAll('#speech-text,#audio-text'))input.maxLength=300;
 for(const link of document.querySelectorAll('a[href]')){let u;try{u=new URL(link.href);}catch{continue;}if(['127.0.0.1','localhost'].includes(u.hostname)&&u.origin!==location.origin){link.removeAttribute('href');link.title='This engine belongs to the creator. Download the graph to use your own ComfyUI.';}}
}
previewControls();update();setInterval(update,5000);document.addEventListener('visibilitychange',update);
document.addEventListener('submit',()=>setTimeout(update,700));window.addEventListener('focus',update);
// Dynamic tool forms keep their normal behavior and receive the same demo hints.
new MutationObserver(()=>previewControls()).observe(document.body,{childList:true,subtree:true});
