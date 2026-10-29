"""Independent style request, reference, attention and whole-board mean checks."""
import json,hashlib
from workspace_paths import model_root, load_json
from pathlib import Path
import numpy as np
def digest(path):
 with Path(path).open('rb') as handle:return hashlib.file_digest(handle,'sha256').hexdigest()
def check_attention(meta,strength):
 active=meta['activeProcessors']
 if bool(active)!=(strength>0) or meta['inactiveProcessors']<1 or any(not x['name'].startswith('up_blocks.0.attentions.1.') or len(x['scales'])!=1 or abs(x['scales'][0]-strength)>1e-8 or not np.isfinite(x['scales'][0]) for x in active):raise ValueError('Unexpected style/layout attention scales.')
 return len(active)
def check(directory,request,assets):
 manifest=load_json((directory/'style-manifest.json').read_text(encoding='utf-8'));meta=load_json((directory/'style.json').read_text(encoding='utf-8'));completed=load_json((directory/'completed.json').read_text(encoding='utf-8'))
 if completed['styleMetadataSha256']!=digest(directory/'style.json') or completed['rawSha256']!=digest(directory/'raw.png') or meta['rawSha256']!=completed['rawSha256']:raise ValueError('Style metadata or raw image changed.')
 subtract=request.get('styleMode')=='subtract';method='instantstyle-up-only-content-subtraction-v2' if subtract else 'instantstyle-up-only-global-mean-v1'
 expected={k:request[k] for k in ['styleImages','styleStrength','prompt','seed','size','steps']+(['styleMode','styleContent','styleContentStrength'] if subtract else [])}
 if meta['settings']!=expected or manifest['request']!=request or meta['attention']!='style-only' or meta['method']!=method:raise ValueError('Style settings or attention route changed.')
 check_attention(meta,request['styleStrength'])
 rows=manifest['sources']
 if [x['asset'] for x in rows]!=request['styleImages'] or len(meta['sources'])!=len(rows):raise ValueError('Whole-board reference count/order changed.')
 from PIL import Image,ImageOps
 for row,saved in zip(rows,meta['sources']):
  file=assets/row['asset']
  if Path(row['path']).resolve()!=file.resolve() or saved['asset']!=row['asset'] or saved['sha256']!=row['sha256'] or digest(file)!=row['sha256']:raise ValueError('A saved style card changed.')
  if list(ImageOps.exif_transpose(Image.open(file)).size)!=saved['originalSize']:raise ValueError('Style card dimensions changed.')
 lockfile=Path(__file__).resolve().parents[1]/'setup'/('style-content-models.lock.json' if subtract else 'style-models.lock.json');lock=load_json(lockfile.read_text(encoding='utf-8'))
 if digest(lockfile)!=meta['modelLockSha256'] or meta['models']!=[lock['base'],*lock['files']]:raise ValueError('Style model lock changed.')
 for item in meta['models']:
  if Path(item['path']).stat().st_size!=item['bytes'] or digest(item['path'])!=item['sha256']:raise ValueError('Style model bytes changed.')
 embedding=directory/'style-embeddings.npz'
 if digest(embedding)!=meta['embeddingSha256']:raise ValueError('Style embedding artifact changed.')
 with np.load(embedding,allow_pickle=False) as data:
  cards=data['cards'];average=data['average']
  if cards.ndim!=2 or len(cards)!=len(rows) or not np.isfinite(cards).all() or not np.isfinite(average).all() or np.any(np.linalg.norm(cards,axis=1)<1e-8) or not np.array_equal(np.sum(cards,axis=0,dtype=np.float32)/len(rows),average):raise ValueError('Not the equal mean of every card.')
  if subtract:
   content=data['content'];conditioned=data['conditioned']
   if average.shape!=(1280,) or content.shape!=average.shape or conditioned.shape!=average.shape or not np.isfinite(content).all() or np.linalg.norm(content)<1e-8 or not np.array_equal(average-content*request['styleContentStrength'],conditioned):raise ValueError('Content subtraction changed or uses incompatible embeddings.')
  contributions=[float(np.linalg.norm(average-(np.delete(cards,i,axis=0).sum(axis=0,dtype=np.float32)/(len(cards)-1)))) for i in range(len(cards))] if len(cards)>1 else [None]
 active=meta['activeProcessors']
 return {'valid':True,'method':meta['method'],'cards':len(rows),'references':[{'asset':x['asset'],'sha256':x['sha256']} for x in rows],'equalMeanExact':True,'contentSubtractionChecked':subtract,'leaveOneOutEmbeddingDifference':contributions,'styleOnlyProcessors':len(active),'layoutConditioning':False,'metadataSha256':digest(directory/'style.json'),'limitations':meta['limitations']}
