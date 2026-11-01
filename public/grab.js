const error=new URLSearchParams(location.hash.slice(1)).get('error');if(error)document.getElementById('grab-status').textContent=error;
