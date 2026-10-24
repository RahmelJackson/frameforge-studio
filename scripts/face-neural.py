"""Pinned local FaceFusion processor; same-process CLI keeps cancellation bounded."""
import hashlib,json,os,runpy,sys,time
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def sha(file):
    with Path(file).open('rb') as stream:return hashlib.file_digest(stream,'sha256').hexdigest()
def inventory(folder):return {str(p.relative_to(folder)).replace('\\','/'):sha(p) for p in sorted(folder.rglob('*.py'))}
source=Path((ROOT/'runtime/facefusion-download/source-path.txt').read_text().strip())
if source.resolve().parent!=(ROOT/'runtime/facefusion-download').resolve():raise ValueError('Unexpected face runtime location.')
sys.path.insert(0,str(source));os.environ['PATH']=str(ROOT/'runtime/facefusion-bin')+os.pathsep+os.environ['PATH']
os.chdir(source)
os.environ['GRADIO_ANALYTICS_ENABLED']='False'
OPTIONS=['--processors','face_swapper','--face-swapper-model','hyperswap_1a_256','--face-swapper-pixel-boost','256x256','--face-selector-mode','one','--face-detector-model','yolo_face','--face-landmarker-model','2dfan4','--face-occluder-model','xseg_1','--face-parser-model','bisenet_resnet_34','--face-mask-types','box','occlusion','region','--face-mask-regions','skin','left-eyebrow','right-eyebrow','left-eye','right-eye','nose','mouth','upper-lip','lower-lip','--execution-providers','cpu','--execution-thread-count','8','--download-providers','github','--log-level','warn']
lockfile=ROOT/'setup/facefusion.lock.json'
def profile(model='hyperswap',beard=False):
    options=list(OPTIONS)
    options[options.index('--face-swapper-model')+1]='inswapper_128' if model=='inswapper' else 'hyperswap_1a_256'
    if beard:
        start=options.index('--face-mask-types');end=options.index('--execution-providers')
        options[start:end]=['--face-mask-types','box','occlusion']
    return options

if sys.argv[1]=='--setup':
    from facefusion.program import create_program
    from facefusion.args import apply_args
    from facefusion import core,state_manager
    sys.argv=['facefusion.py','headless-run',*profile('inswapper' if '--inswapper' in sys.argv else 'hyperswap')]
    args=vars(create_program().parse_args());apply_args(args,state_manager.init_item)
    if not core.common_pre_check() or not core.processors_pre_check():raise RuntimeError('FaceFusion model preparation failed.')
    models=[{'path':str(p.relative_to(source)).replace('\\','/'),'sha256':sha(p),'bytes':p.stat().st_size} for p in sorted((source/'.assets/models').glob('*.onnx'))]
    lock={'version':'3.9.1','revision':'7247081','source':str(source.relative_to(ROOT)).replace('\\','/'),'sourceSha256':sha(ROOT/'runtime/facefusion-download/source.zip'),'pythonSources':inventory(source),'models':models,'options':OPTIONS,'execution':'CPU','terms':'Local research only: HyperSwap ResearchRAIL and ArcFace non-commercial; not cleared for commercial distribution.'}
    lock['binaries']=json.loads(lockfile.read_text()).get('binaries',{}) if lockfile.exists() else {}
    lock['profiles']=['hyperswap','inswapper'];lock['terms']+=' InSwapper/InsightFace: non-commercial research only.'
    lockfile.write_text(json.dumps(lock,indent=2),encoding='utf-8');print(json.dumps({'prepared':len(models),'bytes':sum(m['bytes'] for m in models)}));sys.exit(0)
lock=json.loads(lockfile.read_text())
if inventory(source)!=lock['pythonSources'] or OPTIONS!=lock['options']:raise ValueError('FaceFusion processor changed; restore the pinned runtime.')
for name,checksum in lock.get('binaries',{}).items():
    if sha(ROOT/'runtime/facefusion-bin'/name)!=checksum:raise ValueError('Face media tool changed; restore the pinned executable.')
for m in lock['models']:
    if sha(source/m['path'])!=m['sha256']:raise ValueError('FaceFusion model changed; restore the pinned weights.')
if sys.argv[1]=='--check':print(json.dumps({'ready':True,'models':len(lock['models']),'execution':'CPU','researchOnly':True}));sys.exit(0)
directory=Path(sys.argv[1]).resolve();job=json.loads((directory/'job.json').read_text());preflight=json.loads((directory/'face-preflight.json').read_text());assets=directory.parents[1]/'assets';r=job['request']
if sha(assets/r['asset'])!=preflight['sourceSha256'] or sha(assets/r['reference'])!=preflight['referenceSha256'] or sha(directory/'auto-mask.png')!=preflight['maskSha256'] or sha(directory/'face-target.png')!=preflight['preparedTargetSha256'] or sha(directory/'face-reference.png')!=preflight['preparedReferenceSha256']:raise ValueError('Face preflight inputs changed.')
(directory/'face-runtime.json').write_text(json.dumps(lock,indent=2),encoding='utf-8')
options=profile(r.get('swapModel','hyperswap'),r.get('includeBeard',False))
start=time.monotonic();sys.argv=['facefusion.py','headless-run','-s',str(directory/'face-reference.png'),'-t',str(directory/'face-target.png'),'-o',str(directory/'raw.png'),'--jobs-path',str(directory/'facefusion-jobs'),'--temp-path',str(directory/'temp'),*options]
try:runpy.run_path(str(source/'facefusion.py'),run_name='__main__')
except SystemExit as e:
    if e.code not in [0,None]:raise RuntimeError('Local FaceFusion stopped with code '+str(e.code))
if not (directory/'raw.png').exists():raise RuntimeError('FaceFusion produced no candidate.')
report={**preflight,'method':'facefusion-'+r.get('swapModel','hyperswap')+'-bounded-v2','selectedOptions':options,'swapModel':r.get('swapModel','hyperswap'),'includeBeard':r.get('includeBeard',False),'runtimeLockSha256':sha(directory/'face-runtime.json'),'models':lock['models'],'version':lock['version'],'execution':'CPU','enhancer':False,'seconds':time.monotonic()-start,'terms':lock['terms']}
(directory/'vision.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps({'complete':True,'seconds':report['seconds']}))
