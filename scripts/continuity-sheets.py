"""Prepare explicit reference roles; keep originals and hash every card."""
import json,sys,uuid,hashlib,math
from pathlib import Path
from PIL import Image,ImageOps,ImageDraw,ImageFont
manifest=Path(sys.argv[1]);data=json.loads(manifest.read_text(encoding='utf-8'));assets=Path(sys.argv[2]);pack=data['pack'];provenance={};result={}
def sheet(cards,label):
 for name,_ in cards:
  file=assets/name;provenance[name]=hashlib.sha256(file.read_bytes()).hexdigest()
 if len(cards)==1:return cards[0][0]
 columns=2;rows=math.ceil(len(cards)/columns);width=1024;height=rows*512;canvas=Image.new('RGB',(width,height),'#202522');draw=ImageDraw.Draw(canvas);font=ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf',20)
 for i,(name,role) in enumerate(cards):
  with Image.open(assets/name) as source:image=ImageOps.exif_transpose(source).convert('RGB');image=ImageOps.contain(image,(492,462))
  x=(i%columns)*512;y=(i//columns)*512;canvas.paste(image,(x+(512-image.width)//2,y+36+(464-image.height)//2));draw.text((x+12,y+8),role,fill='white',font=font)
 name=str(uuid.uuid4())+'.png';canvas.save(assets/name);return name
for role in ['character','location']:
 cards=[(name,role+' reference '+str(i+1)) for i,name in enumerate(pack[role]['assets'])]
 result[role]=sheet(cards,role) if cards else None
# One photograph can serve several roles; show it once to avoid repeating its objects.
combined={}
for role in ['prop','style']:
 for i,name in enumerate(pack[role]['assets']):combined.setdefault(name,[]).append(role+' reference '+str(i+1))
cards=[(name,' / '.join(labels)) for name,labels in combined.items()];result['direction']=sheet(cards,'prop/style') if cards else None
world={}
for role in ['location','prop','style']:
 for i,name in enumerate(pack[role]['assets']):world.setdefault(name,[]).append(role+' '+str(i+1))
result['world']=sheet([(name,' / '.join(labels)) for name,labels in world.items()],'world') if world else None
for name,checksum in provenance.items():
 if hashlib.sha256((assets/name).read_bytes()).hexdigest()!=checksum:raise ValueError('A reference changed while preparing the pack.')
result['provenance']=provenance;manifest.with_name('sheets.json').write_text(json.dumps(result,indent=2),encoding='utf-8');print(json.dumps(result))
