if(typeof document!=='undefined'&&document.body.dataset.page==='create'){
 const form=document.querySelector('#shot-form');if(form){const note=document.createElement('p');note.className='video-model-route';note.innerHTML='Choose <strong>LTX 2.5, MiniMax H3 or Wan</strong> under <strong>Workflow & run options</strong>. Use your starting image, prompt and seed here. LTX/H3 use their listed fixed preview profile; Wan camera, length and look controls apply only to Wan. <a href="/setup?workflow=ltx-vfx">Check model downloads ↗</a>';(form.querySelector('.workbench-scroll')??form).prepend(note);}
}
