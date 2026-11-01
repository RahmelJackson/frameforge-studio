// Visual style picker: a row of art-direction chips shared by Images, Video and Produce.
// The chosen style id is sent with the request and the server adds its full style prompt.
let cache=null;
export async function loadStyles(){cache??=fetch('/api/visual-styles').then(r=>r.ok?r.json():{styles:[],formats:{}}).catch(()=>({styles:[],formats:{}}));return cache;}
const read=k=>{try{return localStorage.getItem(k);}catch{return null;}};
const write=(k,v)=>{try{localStorage.setItem(k,v);}catch{}};
export async function mountStylePicker(host,{key='frameforge.style',initial=null,onChange=()=>{},label='Visual style'}={}){
 const {styles}=await loadStyles();if(!host||!styles.length)return {value:()=>'none',set(){} };
 let value=initial??read(key)??'none';if(!styles.some(s=>s.id===value))value='none';
 host.classList.add('style-picker');host.replaceChildren();
 const head=document.createElement('div');head.className='style-picker-head';
 const title=document.createElement('span');title.className='field-label';title.textContent=label;
 const note=document.createElement('small');note.className='style-picker-note';head.append(title,note);
 const row=document.createElement('div');row.className='style-picker-row';row.setAttribute('role','radiogroup');row.setAttribute('aria-label',label);
 for(const s of styles){const b=document.createElement('button');b.type='button';b.className='style-chip';b.dataset.style=s.id;b.setAttribute('role','radio');b.title=s.prompt||'Use only your own description';
  const sw=document.createElement('span');sw.className='style-chip-swatch';sw.setAttribute('aria-hidden','true');for(const c of s.swatch){const i=document.createElement('i');i.style.setProperty('background',c);sw.append(i);}
  const name=document.createElement('b');name.textContent=s.name;const hint=document.createElement('small');hint.textContent=s.hint;
  b.append(sw,name,hint);b.addEventListener('click',()=>set(s.id,true));row.append(b);}
 host.append(head,row);
 function set(id,user=false){value=styles.some(s=>s.id===id)?id:'none';for(const b of row.children)b.setAttribute('aria-checked',String(b.dataset.style===value));const s=styles.find(x=>x.id===value);note.textContent=value==='none'?'Only your words guide the look':s.hint;if(user){write(key,value);onChange(value,s);}}
 set(value);
 return {value:()=>value,set:id=>set(id,false),style:()=>styles.find(s=>s.id===value)};
}
