import {dialogueComposer as presetComposer} from './dialogue-form.js';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function dialogueComposer(root,voices,onChange,notice,getReferences=()=>[]){
 root.innerHTML='<label>Dialogue engine<select id="dialogue-engine"><option value="preset">Installed preset voices</option><option value="expressive">Expressive reference voices · English</option></select></label><div data-preset></div><div data-expressive hidden></div>';
 const select=root.querySelector('#dialogue-engine'),presetRoot=root.querySelector('[data-preset]'),neuralRoot=root.querySelector('[data-expressive]');
 const preset=presetComposer(presetRoot,voices,onChange,notice);
 let speakers=[{id:'host',name:'Host',voice:'af_heart'},{id:'guest',name:'Guest',voice:'am_michael'}],lines=[{speaker:'host',text:'',speed:1,pauseBefore:0,exaggeration:.5,cfgWeight:.5},{speaker:'guest',text:'',speed:1,pauseBefore:.3,exaggeration:.5,cfgWeight:.5}];
 try{const old=JSON.parse(localStorage.getItem('frameforge-expressive-dialogue-draft')??'null');if(old?.speakers?.length&&old?.lines?.length){speakers=old.speakers;lines=old.lines;}}catch{}
 const read=()=>select.value==='preset'?{...preset.read(),dialogueEngine:'preset'}:{dialogueEngine:'expressive',speakers:structuredClone(speakers),lines:structuredClone(lines)};
 const save=()=>{try{localStorage.setItem('frameforge-expressive-dialogue-draft',JSON.stringify({speakers,lines}));}catch{}onChange();};
 function render(){
  const refs=getReferences();
  neuralRoot.innerHTML=`<p class="micro">Choose 2–12 seconds of clean speech for each voice. English, up to eight lines, 800 characters and 30 seconds. Expression and pacing guide delivery; they do not guarantee an emotion. Speaker names and turns come from your script.</p>
  <label>Add a voice reference WAV<input type="file" data-reference-upload accept="audio/wav,.wav"></label>
  <div class="dialogue-speakers">${speakers.map((s,i)=>`<fieldset><legend>Speaker ${i+1}</legend><label>Name<input data-speaker-name="${i}" value="${esc(s.name)}" maxlength="40"></label>
  <label>Voice reference<select data-speaker-reference="${i}"><option value="">Choose a clean voice reference</option>${refs.map(v=>`<option value="${esc(v.value)}" ${v.value===s.targetVoice?.kind+':'+s.targetVoice?.id?'selected':''}>${esc(v.label)}</option>`).join('')}</select></label>
  ${speakers.length>1?`<button type="button" class="secondary" data-remove-speaker="${i}">Remove speaker</button>`:''}</fieldset>`).join('')}</div>
  <button type="button" class="secondary" data-add-speaker ${speakers.length>=4?'disabled':''}>Add speaker</button>
  <div class="dialogue-lines">${lines.map((l,i)=>`<fieldset><legend>Line ${i+1}</legend><label>Speaker<select data-line-speaker="${i}">${speakers.map(s=>`<option value="${s.id}" ${s.id===l.speaker?'selected':''}>${esc(s.name)}</option>`).join('')}</select></label><label>Words<textarea data-line-text="${i}" rows="3" maxlength="350">${esc(l.text)}</textarea></label>
  <div class="settings-row"><label>Expressiveness<input data-line-expression="${i}" type="number" min="0" max="1.5" step="0.1" value="${l.exaggeration??.5}"></label><label>Pacing guidance<input data-line-guidance="${i}" type="number" min="0" max="1" step="0.1" value="${l.cfgWeight??.5}"></label><label>Pause before (s)<input data-line-pause="${i}" type="number" min="0" max="2" step="0.1" value="${l.pauseBefore}"></label></div>
  <div class="review-actions"><button type="button" class="secondary" data-line-up="${i}" ${i?'':'disabled'}>Move earlier</button><button type="button" class="secondary" data-remove-line="${i}" ${lines.length===1?'disabled':''}>Remove line</button></div></fieldset>`).join('')}</div>
  <button type="button" class="secondary" data-add-line ${lines.length>=8?'disabled':''}>Add dialogue line</button>`;
 }
 select.onchange=()=>{presetRoot.hidden=select.value!=='preset';neuralRoot.hidden=select.value!=='expressive';if(!neuralRoot.hidden)render();onChange();};
 neuralRoot.oninput=e=>{const t=e.target,d=t.dataset;
  if(d.speakerName!=null){speakers[+d.speakerName].name=t.value;neuralRoot.querySelectorAll('[data-line-speaker] option').forEach(o=>{if(o.value===speakers[+d.speakerName].id)o.textContent=t.value;});}
  if(d.speakerReference!=null){const [kind,id]=t.value.split(':');speakers[+d.speakerReference].targetVoice={kind,id};}
  for(const [field,key] of [['lineSpeaker','speaker'],['lineText','text'],['linePause','pauseBefore'],['lineExpression','exaggeration'],['lineGuidance','cfgWeight']])if(d[field]!=null)lines[+d[field]][key]=['speaker','text'].includes(key)?t.value:Number(t.value);
  if(!('referenceUpload'in d))save();
 };
 neuralRoot.onchange=async e=>{if(!('referenceUpload'in e.target.dataset))return;try{const file=e.target.files[0];if(!file||file.size>25*1024*1024)throw Error('Choose a WAV up to 25 MB.');const response=await fetch('/api/audio-assets',{method:'POST',headers:{'Content-Type':'audio/wav'},body:file});const value=await response.json();if(!response.ok)throw Error(value.error);document.dispatchEvent(new CustomEvent('dialogue-reference-added',{detail:{...value,name:file.name}}));render();notice('Voice reference saved. Assign it to a speaker.');}catch(error){notice(error.message);}};
 neuralRoot.onclick=e=>{const t=e.target.closest('button');if(!t)return;const d=t.dataset;
  if('addSpeaker'in d&&speakers.length<4)speakers.push({id:crypto.randomUUID(),name:'Speaker '+(speakers.length+1),voice:voices[0].id});
  if(d.removeSpeaker!=null){const s=speakers[+d.removeSpeaker];if(lines.some(l=>l.speaker===s.id)){notice('Assign this speaker’s lines to someone else first.');return;}speakers.splice(+d.removeSpeaker,1);}
  if('addLine'in d&&lines.length<8)lines.push({speaker:speakers[lines.length%speakers.length].id,text:'',speed:1,pauseBefore:.3,exaggeration:.5,cfgWeight:.5});
  if(d.removeLine!=null&&lines.length>1)lines.splice(+d.removeLine,1);if(d.lineUp!=null&&+d.lineUp>0){const i=+d.lineUp;[lines[i-1],lines[i]]=[lines[i],lines[i-1]];}save();render();
 };
 return {read,restore:r=>{select.value=r.dialogueEngine??'preset';if(select.value==='expressive'){speakers=structuredClone(r.speakers);lines=structuredClone(r.lines);save();}else preset.restore(r);select.onchange();}};
}
