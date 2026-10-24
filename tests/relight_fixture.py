"""Create a genuinely checked lighting proposal for the offline API test."""
import pathlib,sys,json,importlib.util,subprocess
import numpy as np
from PIL import Image
ROOT=pathlib.Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'scripts'))
from video_media import encode,inspect
spec=importlib.util.spec_from_file_location('processor',ROOT/'scripts/process-video.py');processor=importlib.util.module_from_spec(spec);spec.loader.exec_module(processor)
data=pathlib.Path(sys.argv[1]);source_id=sys.argv[2];proposal_id=sys.argv[3];request=json.loads(sys.argv[4]);assets=data/'assets';assets.mkdir()
source_dir=data/'jobs'/source_id;source_dir.mkdir(parents=True);source=source_dir/'output.mp4'
rgb=np.random.default_rng(92).integers(30,180,(160,160,3),dtype='uint8');encode((Image.fromarray(rgb) for _ in range(16)),source,(160,160),16);info=inspect(source)
(source_dir/'job.json').write_text(json.dumps({'id':source_id,'requestId':source_id,'createdAt':'2026-10-19T00:00:00Z','status':'review-ready','request':{},'video':'output.mp4','report':{**info,'technicalPass':True},'review':None}))
directory=data/'jobs'/proposal_id;directory.mkdir();manifest={'request':request,'source':{**info,'path':str(source)},'assets':str(assets)};(directory/'manifest.json').write_text(json.dumps(manifest));prepared=processor.render(manifest,directory,'prepare')
encode((Image.new('RGB',prepared['size'],(190,180,170)) for _ in range(prepared['frames'])),directory/'raw.mp4',prepared['size'],16)
processor.render(manifest,directory,'finalize');subprocess.run([sys.executable,str(ROOT/'scripts/verify-video-tool.py'),str(directory)],check=True,stdout=subprocess.DEVNULL)
report=json.loads((directory/'report.json').read_text());assert report['technicalPass'],report
(directory/'job.json').write_text(json.dumps({'id':proposal_id,'requestId':proposal_id,'createdAt':'2026-10-19T00:00:01Z','status':'review-ready','request':request,'video':'output.mp4','finalized':True,'report':report,'review':None}))
