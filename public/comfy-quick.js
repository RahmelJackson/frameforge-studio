// The real tool forms in a compact ComfyUI workspace, with no second editor.
let active=false;
export function setQuickMode(value){
 active=value===true;document.documentElement.classList.toggle('comfy-quick',active);
 if(!document.querySelector('[data-comfy-quick-style]')){const link=document.createElement('link');link.rel='stylesheet';link.href='/comfy-quick.css';link.dataset.comfyQuickStyle='';document.head.append(link);}
 let bar=document.querySelector('[data-comfy-quick-nav]');
 if(!bar){bar=document.createElement('nav');bar.dataset.comfyQuickNav='';bar.setAttribute('aria-label','Quick workspace');bar.innerHTML='<a href="/images?tool=create">Images</a><a href="/create">Video</a><a href="/audio?tool=speech">Audio</a><a href="/library?collection=workflows">Workflows</a><span>Use the controls below. Your prepared graph opens alongside.</span>';document.body.prepend(bar);}
 bar.querySelector('span').textContent=location.pathname==='/audio'?'Create and listen here. Studio speech tools use their local audio pipeline.':'Use the controls below. Your prepared graph opens alongside.';
 for(const a of bar.querySelectorAll('a')){const current=new URL(a.href).pathname===location.pathname;a.toggleAttribute('aria-current',current);if(current)a.setAttribute('aria-current','page');}
 if(document.querySelector('.studio-grid>form')&&!bar.querySelector('[data-quick-pane]')){const panes=document.createElement('div');panes.className='quick-panes';panes.setAttribute('role','group');panes.setAttribute('aria-label','Quick workspace panel');for(const [id,title] of [['controls','Controls'],['result','Result & saved takes']]){const b=document.createElement('button');b.type='button';b.dataset.quickPane=id;b.textContent=title;b.onclick=()=>showPane(id);panes.append(b);}bar.append(panes);showPane('controls');window.addEventListener('frameforge:quick-result',()=>showPane('result'));}
 window.frameforgeQuick=active;window.dispatchEvent(new Event('frameforge:quick-mode'));window.dispatchEvent(new Event('resize'));
}
function showPane(id){document.documentElement.dataset.quickPane=id;for(const b of document.querySelectorAll('[data-quick-pane]'))b.setAttribute('aria-pressed',String(b.dataset.quickPane===id));}
