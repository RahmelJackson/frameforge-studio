if(typeof document!=='undefined'&&document.body.dataset.page==='create'){
 const form=document.querySelector('#shot-form');if(form){const note=document.createElement('p');note.className='video-model-route';(form.querySelector('.workbench-scroll')??form).prepend(note);
 const update=()=>{const recipe=form.dataset.providerRecipe??'',fixed=!!recipe;note.innerHTML=fixed?'Starting image + prompt + seed. '+(recipe==='ltx-vfx'?'LTX 2.5 · 640 × 384 · 5 seconds · generated audio.':'MiniMax H3 · 640 × 384 · 2.33 seconds · generated audio.')+' <a href="/setup?workflow='+recipe+'">Check model downloads →</a>':'Choose your Wan settings below, or select LTX / H3 in the Local model picker above.';
 for(const id of ['generation-type','engine','length','preset','look','size','aspect','camera-preset','camera-speed','fps']){const field=form.querySelector('#'+id);if(!field)continue;const row=field.closest('.field-label,label')??field;if(fixed){row.dataset.providerHidden='true';row.hidden=true;}else if(row.dataset.providerHidden){delete row.dataset.providerHidden;row.hidden=false;}}
 form.querySelectorAll('.wan-only,[data-wan-only]').forEach(el=>el.hidden=fixed);
 };new MutationObserver(update).observe(form,{attributes:true,attributeFilter:['data-provider-recipe']});window.addEventListener('frameforge:recipe-changed',update);update();}
}
