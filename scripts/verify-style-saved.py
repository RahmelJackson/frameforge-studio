"""Recheck the retained style experiment without submitting any inference."""
import json,hashlib,time
from pathlib import Path
from PIL import Image,ImageOps,ImageDraw,ImageFont
from studio_fonts import studio_font
import numpy as np
from check_style import check,digest
ROOT=Path(__file__).resolve().parents[1];EVIDENCE=ROOT/'evidence/style-board'
def main():
 state=json.loads((EVIDENCE/'state.json').read_text(encoding='utf-8'))
 if len(state['cases'])>state['budget'] or len({x['jobId'] for x in state['cases'].values()})!=len(state['cases']):raise ValueError('Render budget or unique job binding failed')
 rows=[]
 for label,entry in state['cases'].items():
  d=ROOT/'data/jobs'/entry['jobId'];job=json.loads((d/'job.json').read_text(encoding='utf-8'));report=json.loads((d/'report.json').read_text(encoding='utf-8'));meta=json.loads((d/'style.json').read_text(encoding='utf-8'))
  if job['requestId']!=entry['requestId'] or any(job['request'][k]!=v for k,v in entry['request'].items()) or job['status']!='review-ready' or not report['technicalPass']:raise ValueError('Saved request/status mismatch: '+label)
  if digest(d/'output.png')!=report['sha256'] or digest(d/'raw.png')!=report['rawSha256']:raise ValueError('Output checksum changed: '+label)
  checked=check(d,job['request'],ROOT/'data/assets')
  if checked['metadataSha256']!=report['style']['metadataSha256']:raise ValueError('Checked style report is stale: '+label)
  with Image.open(d/'output.png') as image:
   image.load()
   if list(image.size)!=job['request']['size'] or np.asarray(image).std()<=1:raise ValueError('Image decode/content check failed: '+label)
  rows.append({'case':label,'jobId':entry['jobId'],'sha256':report['sha256'],'rawSha256':report['rawSha256'],'cards':checked['cards'],'method':meta['method'],'seconds':meta['seconds'],'peakAllocatedBytes':meta['peakAllocatedBytes'],'sourceContributions':checked['leaveOneOutEmbeddingDifference'],'entryPoint':entry.get('entryPoint','local API'),'creativeApproval':None})
  print(json.dumps({'checked':label,'cards':checked['cards']}),flush=True)
 # These are labeled inspection sheets, not altered generation candidates.
 def sheet(labels,name,columns):
  size=384;canvas=Image.new('RGB',(columns*size,((len(labels)+columns-1)//columns)*(size+34)),(20,24,20));draw=ImageDraw.Draw(canvas)
  font=studio_font(17)
  for i,label in enumerate(labels):
   image=ImageOps.contain(Image.open(ROOT/'data/jobs'/state['cases'][label]['jobId']/'output.png').convert('RGB'),(size,size))
   x=(i%columns)*size;y=(i//columns)*(size+34);canvas.paste(image,(x+(size-image.width)//2,y));draw.text((x+8,y+size+7),label,fill=(230,239,218),font=font)
  canvas.save(EVIDENCE/name,quality=94)
 sheet(['paint-teapot-subtract-control','paint-teapot-filtered'],'content-control-comparison.jpg',2)
 sheet([f'{board}-{subject}-filtered' for board in ['paint','soft'] for subject in ['teapot','robot','bicycle']],'six-subjects.jpg',3)
 summary={'at':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'technicalPass':True,'renders':len(rows),'budget':state['budget'],'cases':rows,'creativeApproval':None,'scope':'Two boards, three subjects, one seed. No broad style-quality approval. Earlier failed/control previews retained.','runtimeSecondsRange':[min(x['seconds'] for x in rows),max(x['seconds'] for x in rows)],'peakAllocatedGiB':max(x['peakAllocatedBytes'] for x in rows)/2**30}
 (EVIDENCE/'saved-verification.json').write_text(json.dumps(summary,indent=2),encoding='utf-8');print(json.dumps({'technicalPass':True,'renders':len(rows),'peakAllocatedGiB':summary['peakAllocatedGiB']}))
if __name__=='__main__':main()
