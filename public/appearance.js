// Appearance: navigation position, font and text size, reachable from the
// side bar (and the top bar) instead of being buried in Settings. Also scales
// the whole interface on large screens so 1440p/4K displays are filled.
const KEYS={font:'frameforge.font',size:'frameforge.textSize',nav:'frameforge.navigation'};
export const FONTS=[
 {id:'inter',label:'Inter',hint:'Studio default',stack:''},
 {id:'system',label:'System',hint:'Your computer’s interface font',stack:'-apple-system,BlinkMacSystemFont,"Segoe UI Variable Text","Segoe UI",system-ui,sans-serif'},
 {id:'rounded',label:'Rounded',hint:'Soft and friendly',stack:'ui-rounded,"SF Pro Rounded","Nunito","Arial Rounded MT Bold","Segoe UI",system-ui,sans-serif'},
 {id:'readable',label:'Readable',hint:'Wide letters, easy to scan',stack:'Verdana,"Atkinson Hyperlegible","Segoe UI",Tahoma,sans-serif'},
 {id:'editorial',label:'Editorial',hint:'Classic serif',stack:'"Iowan Old Style","Palatino Linotype",Palatino,Georgia,serif'},
 {id:'mono',label:'Mono',hint:'Technical, fixed width',stack:'ui-monospace,"Cascadia Code","SF Mono",Consolas,monospace'}
];
export const SIZES=[{id:'1',label:'Default'},{id:'1.12',label:'Larger'},{id:'1.25',label:'Largest'}];
export function screenScale(w,h){if(w<2000)return 1;return Math.max(1,Math.min(2.4,Math.min(w/1720,h/900)));}
const read=k=>{try{return localStorage.getItem(k);}catch{return null;}};
const write=(k,v)=>{try{localStorage.setItem(k,v);}catch{}};
if(typeof document!=='undefined'){
 const root=document.documentElement;
 function applyFont(id){const font=FONTS.find(f=>f.id===id)??FONTS[0];root.dataset.font=font.id;font.stack?root.style.setProperty('--user-font',font.stack):root.style.removeProperty('--user-font');}
 function applyScale(){const size=Number(read(KEYS.size))||1;const z=(document.body?.dataset.page==='scene'?1:screenScale(innerWidth,innerHeight))*size;if(document.body){z===1?document.body.style.removeProperty('zoom'):document.body.style.setProperty('zoom',String(Math.round(z*100)/100));}}
 applyFont(read(KEYS.font));
 function setNav(v){const select=document.getElementById('navigation-layout');if(select){select.value=v;select.dispatchEvent(new Event('change'));}else{document.body.dataset.navigation=v;write(KEYS.nav,v);document.cookie='frameforge_navigation='+v+'; Path=/; SameSite=Strict; Max-Age=31536000';dispatchEvent(new Event('resize'));}}
 let panel=null;
 function build(){
  panel=document.createElement('div');panel.className='appearance-panel';panel.id='appearance-panel';panel.hidden=true;panel.setAttribute('role','dialog');panel.setAttribute('aria-label','Appearance');
  const h=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text)e.textContent=text;return e;};
  const group=(title,items,current,onPick)=>{const wrap=h('div','appearance-group');wrap.append(h('p','appearance-title',title));const row=h('div','appearance-options');row.setAttribute('role','radiogroup');row.setAttribute('aria-label',title);for(const item of items){const b=h('button','appearance-option');b.type='button';b.setAttribute('role','radio');b.dataset.value=item.id;const name=h('b',null,item.label);if(item.stack)name.style.setProperty('font-family',item.stack);b.append(name);if(item.hint)b.append(h('small',null,item.hint));b.setAttribute('aria-checked',String(item.id===current()));b.addEventListener('click',()=>{onPick(item.id);for(const o of row.children)o.setAttribute('aria-checked',String(o.dataset.value===item.id));});row.append(b);}wrap.append(row);return wrap;};
  panel.append(h('p','appearance-head','Appearance'));
  panel.append(group('Navigation',[{id:'side',label:'Side bar',hint:'Menu on the left'},{id:'top',label:'Top bar',hint:'More room for work'}],()=>document.body.dataset.navigation==='top'?'top':'side',setNav));
  panel.append(group('Font',FONTS,()=>root.dataset.font||'inter',id=>{write(KEYS.font,id);applyFont(id);}));
  panel.append(group('Text size',SIZES,()=>read(KEYS.size)||'1',id=>{write(KEYS.size,id);applyScale();}));
  const note=h('p','appearance-note','Large screens scale up automatically. Saved on this computer.');panel.append(note);
  document.documentElement.append(panel);
 }
 function place(button){const r=button.getBoundingClientRect(),p=panel.getBoundingClientRect();let left=r.left,top=r.top-p.height-8;if(top<8){top=r.bottom+8;left=Math.min(r.right-p.width,innerWidth-p.width-12);}panel.style.setProperty('left',Math.max(12,Math.min(left,innerWidth-p.width-12))+'px');panel.style.setProperty('top',Math.max(8,top)+'px');}
 let opener=null;
 function close(){if(!panel||panel.hidden)return;panel.hidden=true;opener?.setAttribute('aria-expanded','false');opener=null;}
 function toggle(button){if(!panel)build();if(!panel.hidden&&opener===button)return close();opener?.setAttribute('aria-expanded','false');opener=button;panel.hidden=false;button.setAttribute('aria-expanded','true');place(button);panel.querySelector('[aria-checked=true]')?.focus();}
 function addButtons(){
  for(const host of document.querySelectorAll('.workspace-secondary,.workspace-topbar .studio-chrome-actions')){
   if(host.querySelector('.appearance-launch'))continue;
   const b=document.createElement('button');b.type='button';b.className=host.matches('.workspace-secondary')?'appearance-launch':'appearance-launch chrome-control';b.setAttribute('aria-haspopup','dialog');b.setAttribute('aria-expanded','false');b.setAttribute('aria-controls','appearance-panel');b.title='Layout, font and text size';
   b.innerHTML='<span aria-hidden="true" class="appearance-glyph">Aa</span><span class="chrome-label">Appearance</span>';
   b.addEventListener('click',e=>{e.stopPropagation();toggle(b);});
   const settings=host.querySelector('.chrome-settings-link');settings?settings.after(b):host.append(b);
  }
 }
 document.addEventListener('click',e=>{if(panel&&!panel.hidden&&!panel.contains(e.target))close();});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&panel&&!panel.hidden){const o=opener;close();o?.focus();}});
 addEventListener('resize',()=>{applyScale();close();});
 const start=()=>{applyScale();addButtons();};
 document.readyState==='loading'?document.addEventListener('DOMContentLoaded',start):start();
}
