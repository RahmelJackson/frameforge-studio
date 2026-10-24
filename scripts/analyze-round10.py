"""Saved real-speech comparisons; no new media-model generation."""
import json,sys,subprocess
from pathlib import Path
import numpy as np
from PIL import Image,ImageDraw
from video_media import decode_images,sample_images,encode,digest
root=Path(__file__).resolve().parents[1];folder=root/'evidence/acceptance-round10';state=json.loads((folder/'state.json').read_text());results={}
for name in ['real-front','real-turn']:
    directory=root/'data/audio-jobs'/state['jobs'][name]['id'];manifest=json.loads((directory/'manifest.json').read_text());track=json.loads((directory/'lipsync.json').read_text())
    originals=list(sample_images(manifest['source']['path'],(i/25 for i in range(track['frames']))));generated=list(decode_images(directory/'preserved.mkv'))
    baseline=folder/(name+'-original');baseline.mkdir(exist_ok=True)
    if '--sheets-only' not in sys.argv:
        encode(originals,baseline/'preserved.mkv',track['size'],25)
        (baseline/'manifest.json').write_text(json.dumps(manifest,indent=2));(baseline/'lipsync.json').write_text(json.dumps(track,indent=2))
    scores={}
    for label,target in [('original',baseline),('generated',directory)]:
        output=folder/(name+'-'+label+'-timing.json')
        command=[str(root/'runtime/latentsync-env/Scripts/python.exe'),str(root/'scripts/analyze-latentsync.py'),str(target),'--output='+str(output),'--real','--cpu']
        if '--sheets-only' not in sys.argv:
            process=subprocess.run(command,capture_output=True,text=True,timeout=180)
            if process.returncode:raise RuntimeError(process.stderr[-1800:])
        record=json.loads(output.read_text())['results']['latentsync'];scores[label]={'offsetFrames':record['records'][0]['estimatedOffsetFrames'],'confidence':record['records'][0]['confidence'],'shiftedControlPass':record['shiftedControlPass']}
    sheet=Image.new('RGB',(1000,440),'#121619');draw=ImageDraw.Draw(sheet)
    for row,(label,images) in enumerate([('Original filmed mouth',originals),('LatentSync using the source-track audio',generated)]):
        draw.text((6,row*220+5),label,fill='white')
        for column,index in enumerate([5,17,29,41,53]):
            x0,y0,x1,y1=track['trajectory'][index]['crop'];crop=(x0,round(y0+(y1-y0)*.35),x1,y1)
            patch=images[index].crop(crop);patch.thumbnail((186,174));sheet.paste(patch,(column*200+7,row*220+27));draw.text((column*200+7,row*220+204),f'{index/25:.2f}s',fill='white')
    sheet.save(folder/(name+'-mouth-comparison.jpg'),quality=95)
    results[name]={'jobId':state['jobs'][name]['id'],'frames':track['frames'],'sourceSha256':manifest['source']['sha256'],'speechSha256':manifest['audio']['sha256'],'outputSha256':digest(directory/'preserved.mkv'),'timing':scores,'creativeApproval':'pending'}
covered=root/'data/audio-jobs'/state['jobs']['marked-cover']['id'];report=json.loads((covered/'report.json').read_text());results['marked-cover']={'jobId':covered.name,'technicalPass':report['technicalPass'],'lipSync':report['media']['lipSync'],'holdCheck':next(c for c in report['checks'] if c['name'].startswith('Marked covered-mouth')),'note':'User-marked textured-object composite; not natural or automatically detected hand coverage.'}
(folder/'lip-quality.json').write_text(json.dumps(results,indent=2));print(json.dumps(results,indent=2))
