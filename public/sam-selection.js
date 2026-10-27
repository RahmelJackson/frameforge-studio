export function mountSAMSelection({host,surface,getSource,getBox,setBusy,applyMask,draw,notice}){
 const section=document.createElement('details');section.className='canvas-extend canvas-sam';section.open=false;section.innerHTML='<summary>Select an object · SAM 3.1</summary><p class="micro">Click, draw a box, or name one visible object. Inspect the mask before editing.</p><label>Object to select<input data-sam-text maxlength="160" placeholder="the green control knob"></label><button type="button" data-sam-run="text">Select described object</button><div class="canvas-small-actions"><button type="button" data-sam-point="1" aria-pressed="false">＋ Keep point</button><button type="button" data-sam-point="0" aria-pressed="false">− Exclude point</button></div><div class="canvas-small-actions"><button type="button" data-sam-run="points">Select clicked points</button><button type="button" data-sam-run="box">Refine last box</button></div><label>Text confidence<input data-sam-threshold type="number" min="0.05" max="0.95" step="0.05" value="0.5"></label><button type="button" data-sam-clear>Clear points</button><p class="micro" data-sam-status role="status">SAM setup is being checked…</p><a data-sam-download hidden download="selection-mask.png">Download mask PNG ↓</a><p class="micro">Text matching can select the wrong object, including when the requested object is absent. Review the overlay. Paint adds to the mask; Erase removes.</p>';
 host.querySelector('.canvas-small-actions').after(section);
 const q=s=>host.querySelector(s);let points=[],pointMode=null,ready=false,busy=false,externalBusy=false,source=null;
 function buttons(){for(const b of host.querySelectorAll('[data-sam-run],[data-sam-point],[data-sam-clear]'))b.disabled=busy||externalBusy||!ready||!getSource();}
 function deactivate(){pointMode=null;host.querySelectorAll('[data-sam-point]').forEach(b=>b.setAttribute('aria-pressed','false'));}
 host.querySelectorAll('[data-sam-point]').forEach(b=>b.onclick=()=>{pointMode=Number(b.dataset.samPoint);host.querySelectorAll('[data-canvas-mode]').forEach(x=>x.setAttribute('aria-pressed','false'));host.querySelectorAll('[data-sam-point]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));q('[data-sam-status]').textContent=pointMode?'Click inside the object to keep.':'Click on a region to exclude.';});
 surface.addEventListener('pointerdown',e=>{if(pointMode===null)return;e.preventDefault();e.stopImmediatePropagation();if(busy||externalBusy||!getSource())return;if(points.length>=16){notice('Use at most 16 points, or clear the points to start again.');return;}const r=surface.getBoundingClientRect();points.push({x:Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),y:Math.max(0,Math.min(1,(e.clientY-r.top)/r.height)),label:pointMode});draw();},true);
 q('[data-sam-clear]').onclick=()=>{points=[];draw();};
 const request=async(url,options)=>{const r=await fetch(url,options),v=await r.json();if(!r.ok)throw Error(v.error??'The selection request failed.');return v;};
 async function select(method){
  const asset=getSource();if(!asset||busy||externalBusy)return;
  const input={kind:'image',tool:'select',asset,prompt:q('[data-sam-text]').value.trim(),segmentMethod:method,segmentThreshold:Number(q('[data-sam-threshold]').value),requestId:crypto.randomUUID()};
  if(method==='text'&&!input.prompt)throw Error('Name one visible object first.');
  if(method==='points'){if(!points.some(p=>p.label===1))throw Error('Add at least one keep point inside the object.');input.segmentPoints=points;}
  if(method==='box'){const box=getBox();if(!box)throw Error('Use Box to draw around the object first.');input.segmentBox={x:box.x/surface.width,y:box.y/surface.height,width:box.width/surface.width,height:box.height/surface.height};}
  busy=true;setBusy(true);buttons();q('[data-sam-download]').hidden=true;
  try{
   let job=await request('/api/jobs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)});
   if(!job.id)throw Error('The selection was not acknowledged. Check My work before trying again.');
   while(['uploading','submitting','submitted','running','processing','verifying','cancelling'].includes(job.status)){q('[data-sam-status]').textContent='Finding the object · '+job.status+'…';await new Promise(r=>setTimeout(r,1500));job=await request('/api/jobs/'+job.id);}
   if(!job.report?.technicalPass||!job.report?.selection)throw Error(job.error??'The mask was empty, filled the picture or failed file checks. Adjust your points, box or description.');
   if(asset!==getSource()||job.request.asset!==asset)throw Error('This selection belongs to a different source. Reopen the original before applying it.');
   const image=new Image();image.src='/outputs/'+job.id+'/output.png';await image.decode();applyMask(image);deactivate();points=[];draw();
   q('[data-sam-status]').textContent=`Mask ready · ${(job.report.selection.coverage*100).toFixed(1)}% selected. Inspect the overlay, then paint or erase to refine. No image edit has run.`;
   q('[data-sam-download]').href=image.src;q('[data-sam-download]').hidden=false;
  }finally{busy=false;setBusy(false);buttons();}
 }
 host.querySelectorAll('[data-sam-run]').forEach(b=>b.onclick=()=>select(b.dataset.samRun).catch(e=>{q('[data-sam-status]').textContent=e.message;notice(e.message);}));
 return {deactivate,reset(){points=[];deactivate();q('[data-sam-download]').hidden=true;q('[data-sam-download]').removeAttribute('href');buttons();},draw(ctx){const radius=Math.max(4,surface.width/100);for(const p of points){ctx.beginPath();ctx.arc(p.x*surface.width,p.y*surface.height,radius,0,2*Math.PI);ctx.fillStyle=p.label?'#d4ff36':'#ff6173';ctx.fill();ctx.strokeStyle='#101610';ctx.lineWidth=Math.max(1,radius/4);ctx.stroke();}},health(value,active){ready=value.connected&&value.images?.select?.ready;externalBusy=active&&!busy;if(source!==getSource()){source=getSource();buttons();}if(!busy&&!q('[data-sam-download]').hasAttribute('href')){if(ready)q('[data-sam-status]').textContent='SAM 3.1 ready · choose an object.';else{q('[data-sam-status]').innerHTML='<a href="/setup?imageTool=select">Connect ComfyUI / get the SAM checkpoint →</a>';}}buttons();}};
}
