"""Install the pinned official 5B first/last-frame model; reuse encoder and VAE."""
import importlib.util,json,shutil
from pathlib import Path
root=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('downloader',root/'scripts/download-models.py');mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
name='wan2.2_fun_inpaint_5B_bf16.safetensors'
if not (root/'runtime/models/diffusion_models'/name).exists() and shutil.disk_usage(root).free<10000937656+8*1024**3:raise RuntimeError('Keep at least 8 GiB free after model installation.')
record=mod.download(('diffusion_models',name))
(root/'runtime/keyframe-models-manifest.json').write_text(json.dumps([record],indent=2),encoding='utf-8')
