const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icons={create:'✦',cinema:'▣',edit:'✎',inpaint:'◌',upscale:'↗',relight:'☼',character:'♙',continuity:'▧','face-anchor':'◎','prop-place':'⊞',finish:'✂',shorts:'▯',interpolate:'≈',reframe:'⊡',motion:'≋',extend:'→',speech:'♪',dialogue:'☷',transcribe:'T',dub:'文',lipsync:'◡'};
export function mountToolPicker(select,{groups,description=id=>[...select.options].find(o=>o.value===id)?.dataset.description??'',remember=true}={}){
 if(!select||select.dataset.visualPicker)return;select.dataset.visualPicker='true';
 const picker=document.createElement('div');picker.className='tool-picker';picker.setAttribute('aria-label','Choose a workflow');select.before(picker);select.classList.add('tool-picker-native');
 let openGroup='',signature='';const key='frameforge.lastTool.'+select.id;
 function options(){return [...select.options].filter(o=>o.value);}
 function draw(){const opts=options();if(!opts.length)return;const grouped=groups?groups.map(g=>({...g,tools:g.ids.flatMap(id=>{const o=opts.find(o=>o.value===id);return o?[o]:[]})})).filter(g=>g.tools.length):[{label:'Tools',tools:opts}];
  const assigned=new Set(grouped.flatMap(g=>g.tools.map(o=>o.value))),extra=opts.filter(o=>!assigned.has(o.value));if(extra.length)grouped.push({label:'More tools',tools:extra});
  const selectedGroup=grouped.find(g=>g.tools.some(o=>o.value===select.value));if(!grouped.some(g=>g.label===openGroup))openGroup=selectedGroup?.label??grouped[0].label;
  picker.innerHTML=`<div class="tool-groups" role="group" aria-label="Tool groups">${grouped.map((g,i)=>`<button type="button" data-tool-group="${i}" aria-pressed="${g.label===openGroup}">${esc(g.label)}</button>`).join('')}</div><div class="tool-cards">${(grouped.find(g=>g.label===openGroup)?.tools??[]).map(o=>`<button type="button" data-pick-tool="${esc(o.value)}" aria-pressed="${o.value===select.value}" ${o.disabled?'disabled title="Not available in the current execution profile"':''}><span aria-hidden="true">${icons[o.value]??'◇'}</span><strong>${esc(o.textContent)}</strong><small>${esc(description(o.value))}</small></button>`).join('')}</div>`;
  picker.querySelectorAll('[data-tool-group]').forEach(b=>b.onclick=()=>{openGroup=grouped[Number(b.dataset.toolGroup)].label;draw();});picker.querySelectorAll('[data-pick-tool]').forEach(b=>b.onclick=()=>{select.value=b.dataset.pickTool;select.dispatchEvent(new Event('change',{bubbles:true}));});
 }
 const change=()=>{openGroup='';if(remember)try{localStorage.setItem(key,select.value);}catch{}draw();};select.addEventListener('change',change);
 new MutationObserver(()=>{const next=options().map(o=>o.value+o.textContent+o.disabled+o.dataset.description).join('|');if(next===signature)return;signature=next;draw();}).observe(select,{childList:true,subtree:true,attributes:true,attributeFilter:['disabled','data-description']});draw();return {refresh:()=>{openGroup='';draw();}};
}
