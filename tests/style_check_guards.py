"""Tampered evidence must never become a checked style-board result."""
import json,sys,tempfile,copy
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from check_style import check,digest,check_attention
from PIL import Image
def rejects(fn,word):
 try:fn();raise AssertionError('Tampered evidence accepted')
 except ValueError as e:assert word in str(e),str(e)
with tempfile.TemporaryDirectory(prefix='frameforge-style-guard-') as temporary:
 directory=Path(temporary);assets=directory/'assets';assets.mkdir();asset='11111111-1111-1111-1111-111111111111.png';source=assets/asset
 Image.new('RGB',(13,17),'red').save(source);Image.new('RGB',(16,16),'blue').save(directory/'raw.png')
 request={'styleImages':[asset],'styleStrength':.8,'prompt':'A teapot','seed':1,'size':[16,16],'steps':30}
 row={'asset':asset,'path':str(source),'sha256':digest(source)}
 manifest={'request':request,'sources':[row]};meta={'settings':copy.deepcopy(request),'rawSha256':digest(directory/'raw.png'),'attention':'style-only','method':'instantstyle-up-only-global-mean-v1','sources':[{**row,'originalSize':[13,17]}],'activeProcessors':[{'name':'up_blocks.0.attentions.1.transformer_blocks.0.attn2.processor','scales':[.8]}],'inactiveProcessors':69}
 (directory/'style-manifest.json').write_text(json.dumps(manifest),encoding='utf-8')
 def save(value):
  (directory/'style.json').write_text(json.dumps(value),encoding='utf-8');(directory/'completed.json').write_text(json.dumps({'styleMetadataSha256':digest(directory/'style.json'),'rawSha256':digest(directory/'raw.png')}),encoding='utf-8')
 save(meta);(directory/'style.json').write_text('{}',encoding='utf-8');rejects(lambda:check(directory,request,assets),'changed')
 bad=copy.deepcopy(meta);bad['settings']['seed']=2;save(bad);rejects(lambda:check(directory,request,assets),'settings')
 bad=copy.deepcopy(meta);bad['activeProcessors'][0]['name']='down_blocks.2.attentions.1.processor';save(bad);rejects(lambda:check(directory,request,assets),'attention scales')
 save(meta);Image.new('RGB',(13,17),'green').save(source);rejects(lambda:check(directory,request,assets),'style card changed')
 assert check_attention(meta,.8)==1
 for invalid,strength in [({**meta,'activeProcessors':[]},.8),(meta,0),({**meta,'inactiveProcessors':0},.8),({**meta,'activeProcessors':[{'name':'up_blocks.0.attentions.1.x','scales':[float('nan')]}]},.8)]:rejects(lambda:check_attention(invalid,strength),'attention scales')
print('Altered output bindings, settings, reference bytes, layout attention and nonfinite scales rejected.')
