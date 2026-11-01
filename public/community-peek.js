// A row of this week's Civitai picks on the Library page. Pictures load straight
// from Civitai; clicking one opens Community inspiration on Home.
const box=document.getElementById('community-peek'),row=document.getElementById('community-peek-row');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
if(box&&row&&document.body.dataset.openWeightsOnly!=='true')fetch('/api/explore/civitai?type=image&sort=popular').then(r=>r.ok?r.json():Promise.reject()).then(v=>{const items=(v.items??[]).filter(i=>i.image).slice(0,14);if(items.length<4)return;
 row.innerHTML=items.map(i=>`<a href="/#inspiration" title="${esc(i.model||'Community image')} by @${esc(i.creator)}"><img src="${esc(i.image)}" alt="Community image by ${esc(i.creator)}" loading="lazy" referrerpolicy="no-referrer"><span>@${esc(i.creator)}</span></a>`).join('');
 for(const img of row.querySelectorAll('img'))img.addEventListener('error',()=>img.closest('a').remove(),{once:true});box.hidden=false;}).catch(()=>{});
