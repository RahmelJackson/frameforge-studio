const input=document.getElementById('studio'),state=document.getElementById('state');
chrome.storage.sync.get('studio').then(v=>{input.value=v.studio||'http://127.0.0.1:4317';});
document.getElementById('save').onclick=async()=>{try{const u=new URL(input.value.trim());if(!/^https?:$/.test(u.protocol))throw Error('Use an http(s) address.');await chrome.storage.sync.set({studio:u.origin});state.textContent='Saved.';}catch(e){state.textContent=e.message;}};
