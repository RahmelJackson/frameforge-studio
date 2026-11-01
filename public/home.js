const $=s=>document.querySelector(s);
const hero=$('.home-hero'),video=$('#home-cover-video'),button=$('#hero-motion'),reduced=matchMedia('(prefers-reduced-motion: reduce)');let paused=reduced.matches,heroVisible=true;
function paintMotion(){const playing=!video.paused&&!video.ended;button.setAttribute('aria-pressed',String(playing));button.innerHTML=(playing?'Pause motion':'Play motion')+' <span aria-hidden="true">'+(playing?'Ⅱ':'▷')+'</span>';}
async function motion(){const stop=paused||document.hidden||!heroVisible;if(stop)video.pause();else try{await video.play();if(paused||document.hidden||!heroVisible)video.pause();}catch{}paintMotion();}
video.addEventListener('playing',()=>{hero.classList.add('has-video');paintMotion();});video.addEventListener('pause',paintMotion);video.addEventListener('error',()=>{hero.classList.remove('has-video');button.hidden=true;$('#hero-media-label').textContent='THE OBSERVATORY / ORIGINAL CONCEPT ART';});
button.onclick=()=>{paused=!video.paused;motion();};reduced.addEventListener('change',()=>{paused=reduced.matches;motion();});document.addEventListener('visibilitychange',motion);new IntersectionObserver(entries=>{heroVisible=entries[0]?.isIntersecting??true;motion();},{threshold:.05}).observe(hero);motion();
$('#home-guide-form').onsubmit=event=>{event.preventDefault();window.dispatchEvent(new CustomEvent('frameforge:open-guide',{detail:{query:$('#home-guide-query').value}}));};

async function agentActivity(){try{const r=await fetch('/api/assistant/agent-status');if(!r.ok)return;const v=await r.json(),el=document.querySelector('#home-agent-activity');if(!el)return;el.hidden=!v.connected;el.textContent='● MCP connection active · your assistant recently contacted the Studio. No render is implied.';}catch{}}agentActivity();setInterval(agentActivity,30000);
// Studio / Community inspiration switch
{const main=document.querySelector('main'),tabs=[...document.querySelectorAll('[data-home-tab]')];
 const show=(tab,scroll)=>{if(!main)return;main.dataset.homeTab=tab;for(const t of tabs){t.dataset.homeTab===tab?t.setAttribute('aria-current','page'):t.removeAttribute('aria-current');}if(scroll)scrollTo({top:0,behavior:'smooth'});};
 for(const t of tabs)t.addEventListener('click',e=>{e.preventDefault();show(t.dataset.homeTab,true);history.replaceState(null,'',t.dataset.homeTab==='inspiration'?'#inspiration':location.pathname+location.search);});
 if(location.hash==='#inspiration')show('inspiration',false);}
// Community peek: a row of this week's Civitai picks inside the first screen, so
// people see there is more to explore before they scroll.
{const box=document.getElementById('home-peek'),row=document.getElementById('home-peek-row');
 if(box&&document.body.dataset.openWeightsOnly!=='true')fetch('/api/explore/civitai?type=image&sort=popular').then(r=>r.ok?r.json():Promise.reject()).then(v=>{const items=(v.items??[]).filter(i=>i.image).slice(0,12);if(items.length<4)return;
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  row.innerHTML=items.map(i=>`<a href="#inspiration" data-peek="${esc(i.id)}" title="${esc(i.model||'Community image')} by @${esc(i.creator)}"><img src="${esc(i.image)}" alt="Community image by ${esc(i.creator)}" loading="lazy" referrerpolicy="no-referrer"><span>@${esc(i.creator)}</span></a>`).join('');
  for(const img of row.querySelectorAll('img'))img.addEventListener('error',()=>img.closest('a').remove(),{once:true});
  for(const a of row.querySelectorAll('a'))a.addEventListener('click',e=>{e.preventDefault();document.querySelector('.home-explore-tabs [data-home-tab=inspiration]')?.click();});
  box.querySelector('.home-peek-head a').addEventListener('click',e=>{e.preventDefault();document.querySelector('.home-explore-tabs [data-home-tab=inspiration]')?.click();});
  box.hidden=false;}).catch(()=>{});}
