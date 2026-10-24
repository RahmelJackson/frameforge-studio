import json,tempfile,pathlib,subprocess,sys,uuid,hashlib
from PIL import Image
with tempfile.TemporaryDirectory(prefix='frameforge-ref-sheet-') as temp:
 root=pathlib.Path(temp);assets=root/'assets';assets.mkdir();names=[]
 for color in ['red','blue','lime','yellow']:
  name=str(uuid.uuid4())+'.png';Image.new('RGB',(128,128),color).save(assets/name);names.append(name)
 pack={'character':{'assets':[names[0]]},'location':{'assets':[names[1]]},'prop':{'assets':[names[2]]},'style':{'assets':[names[3]]}}
 manifest=root/'pack.json';manifest.write_text(json.dumps({'pack':pack}),encoding='utf-8');result=subprocess.run([sys.executable,'scripts/continuity-sheets.py',str(manifest),str(assets)],capture_output=True,text=True,check=True);data=json.loads(result.stdout);assert data['character']==names[0] and data['location']==names[1];assert len(data['provenance'])==4
 for name,checksum in data['provenance'].items():assert hashlib.sha256((assets/name).read_bytes()).hexdigest()==checksum
 with Image.open(assets/data['direction'] ) as sheet:
  assert sheet.size==(1024,512);assert sheet.getpixel((256,280))==(0,255,0);assert sheet.getpixel((768,280))==(255,255,0)
 pack['style']['assets']=[names[2],names[3]];manifest.write_text(json.dumps({'pack':pack}),encoding='utf-8');dedup=json.loads(subprocess.check_output([sys.executable,'scripts/continuity-sheets.py',str(manifest),str(assets)],text=True));assert len(dedup['provenance'])==4
 with Image.open(assets/dedup['direction']) as sheet:assert sheet.size==(1024,512),'Repeated role card was duplicated'
 spec=__import__('importlib.util',fromlist=['spec_from_file_location']);module_spec=spec.spec_from_file_location('verify',pathlib.Path('scripts/verify-image.py'));module=spec.module_from_spec(module_spec);module_spec.loader.exec_module(module)
 output=root/'output';output.mkdir();Image.new('RGB',(128,128),'blue').save(assets/names[0]);raw=root/'raw.png';Image.new('RGB',(768,768),'red').save(raw)
 request={'tool':'continuity','asset':names[0],'aspect':'square','continuity':{'provenance':data['provenance']}}
 report=module.check(raw,request,assets,output);assert not report['technicalPass'];assert any(not c['pass'] and 'Reference unchanged' in c['name'] for c in report['checks'])
print('All role cards and original checksums retained in reference sheets')
