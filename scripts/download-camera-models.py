"""Install the five additional official Fun Camera assets with SHA-256 checks."""
import concurrent.futures
import importlib.util
import json
from pathlib import Path
import shutil
import urllib.request

root = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('downloader', root / 'scripts/download-models.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
files = [
    ('diffusion_models', 'wan2.2_fun_camera_high_noise_14B_fp8_scaled.safetensors'),
    ('diffusion_models', 'wan2.2_fun_camera_low_noise_14B_fp8_scaled.safetensors'),
    ('loras', 'wan2.2_i2v_lightx2v_4steps_lora_v1_high_noise.safetensors'),
    ('loras', 'wan2.2_i2v_lightx2v_4steps_lora_v1_low_noise.safetensors'),
    ('vae', 'wan_2.1_vae.safetensors'),
]
needed = 0
for kind, name in files:
    catalog = json.load(urllib.request.urlopen(f'https://huggingface.co/api/models/{module.REPO}/tree/{module.MODEL_REVISION}/split_files/{kind}', timeout=30))
    entry = next(item for item in catalog if item['path'].endswith('/' + name))
    target = root / 'runtime/models' / kind / name
    if not target.exists():
        partial = target.with_suffix('.partial')
        needed += max(0, entry['size'] - (partial.stat().st_size if partial.exists() else 0))
print(f'Additional download: {needed / 1024**3:.2f} GiB', flush=True)
if shutil.disk_usage(root).free < needed + 8 * 1024**3:
    raise RuntimeError('Insufficient free disk space; preserve at least 8 GiB after the download.')
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
    records = list(pool.map(module.download, files))
(root / 'runtime/camera-models-manifest.json').write_text(json.dumps(records, indent=2), encoding='utf-8')
