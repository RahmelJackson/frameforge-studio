import hashlib,urllib.request
from pathlib import Path
def digest(path):
 with Path(path).open('rb') as f:return hashlib.file_digest(f,'sha256').hexdigest()
def fetch(url):return urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'Frameforge-local-style'}),timeout=60)
def download(item):
 p=Path(item['path']);p.parent.mkdir(parents=True,exist_ok=True)
 if p.exists():
  if p.stat().st_size!=item['bytes'] or digest(p)!=item['sha256']:raise ValueError('Existing model differs: '+str(p))
  return
 part=p.with_suffix(p.suffix+'.partial');offset=part.stat().st_size if part.exists() else 0
 request=urllib.request.Request(item['url'],headers={'User-Agent':'Frameforge-local-style',**({'Range':f'bytes={offset}-'} if offset else {})})
 with urllib.request.urlopen(request,timeout=60) as response:
  if offset and response.status!=206:raise ValueError('Download resume not honored; partial retained')
  with part.open('ab' if offset else 'xb') as out:
   while data:=response.read(4*1024*1024):out.write(data)
 if part.stat().st_size!=item['bytes'] or digest(part)!=item['sha256']:raise ValueError('Downloaded bytes differ: '+str(p))
 part.replace(p);print('Checked '+p.name,flush=True)
