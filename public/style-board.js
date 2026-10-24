const $=s=>document.querySelector(s),esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function styleBoardControls(change,notice){
 let images=[],label='Selected references',boards=[],uploading=false;
 function render(){
  $('#style-reference-cards').innerHTML=images.map((name,i)=>`<figure><img src="/assets/${name}" alt="Style reference ${i+1}"><button type="button" data-style-remove="${i}" aria-label="Remove style reference ${i+1}">Remove</button></figure>`).join('');
  $('#style-reference-status').textContent=images.length?`${label} · ${images.length} card${images.length===1?'':'s'} · equal weight`:'Choose a saved board or upload 1–16 different reference images.';
 }
 function set(refs,name){if(!refs.length||refs.length>16||new Set(refs).size!==refs.length)throw Error('Choose 1–16 different image cards. Remove repeated cards first.');images=[...refs];label=String(name||'Selected references').slice(0,120);render();change();}
 $('#style-reference-upload').onchange=async e=>{try{
  const files=[...e.target.files];if(!files.length)return;if(images.length+files.length>16)throw Error('Use up to 16 style cards.');uploading=true;change();const added=[];
  for(const file of files){if(file.size>25*1024*1024)throw Error('Each reference must be smaller than 25 MB.');const res=await fetch('/api/assets',{method:'POST',headers:{'Content-Type':file.type},body:file}),value=await res.json();if(!res.ok)throw Error(value.error);added.push(value.name);}
  set([...images,...added],'Selected references');notice('Style cards selected. Describe the new subject.');
 }catch(e){notice(e.message);}finally{uploading=false;$('#style-reference-upload').value='';change();}};
 $('#style-reference-cards').onclick=e=>{const button=e.target.closest('[data-style-remove]');if(!button)return;images.splice(Number(button.dataset.styleRemove),1);label='Selected references';render();change();};
 $('#clear-style-references').onclick=()=>{images=[];label='Selected references';render();change();};
 $('#use-style-board').onclick=()=>{try{const board=boards.find(b=>b.id===$('#style-board-select').value);if(!board)throw Error('Choose a saved board.');set(board.cards.map(c=>c.asset),board.name);notice('All board cards selected. Their saved positions do not guide the new scene.');}catch(e){notice(e.message);}};
 function modeChange(){$('#style-content-controls').hidden=$('#style-mode').value!=='subtract';change();}
 $('#style-mode').onchange=modeChange;for(const id of ['style-strength','style-content','style-content-strength'])$('#'+id).oninput=()=>change();render();
 return {busy:()=>uploading,mode:()=>$('#style-mode').value,input:()=>{if(!images.length)throw Error('Choose some style reference cards first.');return {styleImages:[...images],styleLabel:label,styleStrength:Number($('#style-strength').value),styleMode:$('#style-mode').value,styleContent:$('#style-content').value,styleContentStrength:Number($('#style-content-strength').value)};},fromBoard:b=>set(b.cards.map(c=>c.asset),b.name),restore:r=>{if(r.tool!=='style-board')return;set(r.styleImages,r.styleLabel);$('#style-strength').value=r.styleStrength;$('#style-mode').value=r.styleMode??'layers';$('#style-content').value=r.styleContent??'';$('#style-content-strength').value=r.styleContentStrength??.5;modeChange();},refresh:values=>{boards=values;const selected=$('#style-board-select').value;$('#style-board-select').innerHTML='<option value="">Choose a saved board</option>'+boards.map(b=>`<option value="${b.id}">${esc(b.name)} · ${b.cards.length} cards</option>`).join('');if(boards.some(b=>b.id===selected))$('#style-board-select').value=selected;}};
}
