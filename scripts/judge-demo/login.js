const form=document.querySelector('form'),field=document.querySelector('#judge-code'),message=document.querySelector('#judge-login-message');
const fragment=new URLSearchParams(location.hash.slice(1));const invitation=fragment.get('access');
if(invitation){field.value=invitation;history.replaceState(null,'',location.pathname+location.search);}
async function login(event){event?.preventDefault();const button=form.querySelector('button');button.disabled=true;message.textContent='Opening your private studio workspace…';try{const r=await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:field.value})}),v=await r.json();if(!r.ok)throw Error(v.error??'Could not open this invitation.');field.value='';location.replace(location.pathname+location.search);}catch(e){message.textContent=e.message;button.disabled=false;}}
form.addEventListener('submit',login);if(invitation)login();
