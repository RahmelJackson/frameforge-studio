// Hover menus for the main navigation, in the spirit of a store's mega menu:
// hovering Images, Video, Audio, Library or Advanced shows what you can make
// (large links), the section's tools (small links) and helpful next places.
// Side bar: the menu opens beside the rail. Top bar: it drops down under it.
import {WORKSPACES} from './studio-map.js';
import {WORKSPACE_GOALS} from './workspace-intros.js';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const GOALS={home:null,images:'images',video:'create',audio:'audio',library:'workflows',advanced:'advanced'};
const HOME=[['/produce','Produce a whole video'],['/templates','Browse templates'],['/scene','Block a scene in 3D'],['/#inspiration','Community inspiration'],['/recipes','Creative recipes']];
const TOOLS={video:['/produce','/create','/video-tools','/film','/short-film','/director','/recipes','/video-tools?tool=segment','/create?view=compare']};
const MORE={
 home:[['/setup','Set up ComfyUI'],['/online','Comfy Cloud & Civitai'],['/setup#agent-connections','Claude or Codex (MCP)'],['/checklist','Progress & known limits']],
 images:[['/templates?want=picture','Image templates'],['/images?view=collection','Saved images'],['/creator?tab=characters','Train a character LoRA'],['/setup#workflow-models','Models & downloads']],
 video:[['/templates?want=video','Video templates'],['/create?view=gallery','Saved clips'],['/scene','3D scene'],['/setup#workflow-models','Models & downloads']],
 audio:[['/templates?want=sound','Sound templates'],['/audio?tool=transcribe','Subtitles'],['/film','Add sound to a film'],['/setup#workflow-models','Models & downloads']],
 library:[['/templates','Find by what you have'],['/native-workflows','Open a ComfyUI graph'],['/library?collection=saved','Saved results'],['/setup#workflow-models','Models & downloads']],
 advanced:[['/scene','3D scene timeline'],['/creator?tab=characters','LoRA trainer'],['/native-workflows','All graphs'],['/setup','Engine & settings']]
};
export function menuFor(id){const w=WORKSPACES.find(w=>w.id===id);if(!w)return null;
 const goals=GOALS[id]?(WORKSPACE_GOALS[GOALS[id]]?.goals??[]).map(([href,title])=>[href,title]):HOME;
 let tools=(w.tabs??[]).map(t=>[t.url,t.label]);if(TOOLS[id])tools=TOOLS[id].map(u=>tools.find(t=>t[0]===u)).filter(Boolean);
 return {id,name:w.name,url:w.url,goals:goals.slice(0,7),tools:tools.slice(0,9),more:MORE[id]??[]};}
if(typeof document!=='undefined'&&matchMedia('(hover:hover) and (pointer:fine)').matches){
 let panel=null,openFor=null,openTimer=0,closeTimer=0;
 const zoom=()=>parseFloat(getComputedStyle(document.body).zoom)||1;
 function render(m){return `<div class="nav-menu-inner"><div class="nav-menu-col nav-menu-make"><p>${id2label(m)}</p>${m.goals.map(([h,t])=>`<a href="${esc(h)}">${esc(t)}</a>`).join('')}</div>${m.tools.length?`<div class="nav-menu-col"><p>${esc(m.name)} tools</p>${m.tools.map(([h,t])=>`<a href="${esc(h)}">${esc(t)}</a>`).join('')}</div>`:''}<div class="nav-menu-col"><p>More</p>${m.more.map(([h,t])=>`<a href="${esc(h)}">${esc(t)}</a>`).join('')}<button type="button" data-find-tool>Ask the Guide ✦</button></div></div>`;}
 const id2label=m=>m.id==='home'?'Start here':m.id==='library'?'Find something':'Make with '+esc(m.name);
 function place(link){const z=zoom(),top=document.body.dataset.navigation==='top',r=link.getBoundingClientRect();
  if(top){const bar=link.closest('.workspace-topbar')?.getBoundingClientRect()??r;panel.dataset.mode='top';panel.style.setProperty('left','0px');panel.style.setProperty('top',bar.bottom/z+'px');panel.style.setProperty('width',innerWidth/z+'px');}
  else{const rail=link.closest('aside')?.getBoundingClientRect()??r;panel.dataset.mode='side';panel.style.removeProperty('width');panel.style.setProperty('left',(rail.right+6)/z+'px');const h=panel.offsetHeight;panel.style.setProperty('top',Math.max(8,Math.min(r.top/z-14,innerHeight/z-h-8))+'px');}}
 function open(link){const id=link.dataset.navMenu,m=menuFor(id);if(!m)return;clearTimeout(closeTimer);if(!panel){panel=document.createElement('nav');panel.className='nav-menu';panel.setAttribute('aria-label','Section menu');panel.addEventListener('pointerenter',()=>clearTimeout(closeTimer));panel.addEventListener('pointerleave',scheduleClose);panel.addEventListener('keydown',e=>{if(e.key==='Escape'){const l=openFor;close();l?.focus();}});document.body.append(panel);}
  if(openFor!==link){panel.innerHTML=render(m);openFor?.setAttribute('aria-expanded','false');}openFor=link;link.setAttribute('aria-expanded','true');panel.hidden=false;place(link);requestAnimationFrame(()=>panel.classList.add('open'));}
 function close(){clearTimeout(openTimer);if(!panel)return;panel.classList.remove('open');panel.hidden=true;openFor?.setAttribute('aria-expanded','false');openFor=null;}
 function scheduleClose(){clearTimeout(openTimer);clearTimeout(closeTimer);closeTimer=setTimeout(close,220);}
 function wire(){for(const link of document.querySelectorAll('.workspace-navigation a.workspace-link')){if(link.dataset.navMenu)continue;const path=new URL(link.href).pathname,w=WORKSPACES.find(w=>w.url===path);if(!w)continue;link.dataset.navMenu=w.id;link.setAttribute('aria-haspopup','true');link.removeAttribute('title');link.setAttribute('aria-expanded','false');
   link.addEventListener('pointerenter',()=>{clearTimeout(closeTimer);clearTimeout(openTimer);openTimer=setTimeout(()=>open(link),panel&&!panel.hidden?0:140);});
   link.addEventListener('pointerleave',scheduleClose);
   link.addEventListener('keydown',e=>{if(e.key==='ArrowDown'||e.key==='ArrowRight'&&document.body.dataset.navigation!=='top'){e.preventDefault();open(link);panel.querySelector('a')?.focus();}if(e.key==='Escape')close();});}}
 document.addEventListener('focusin',e=>{if(panel&&!panel.hidden&&!panel.contains(e.target)&&e.target!==openFor)close();});
 addEventListener('resize',close);addEventListener('scroll',()=>{if(document.body.dataset.navigation==='top')close();},{passive:true});
 document.readyState==='loading'?document.addEventListener('DOMContentLoaded',wire):wire();
}
