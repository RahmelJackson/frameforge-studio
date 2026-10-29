"""Restore one pinned pose model in the configured folder, without changing packages or ComfyUI."""
import json
from workspace_paths import model_root, load_json
from pathlib import Path
from importlib.util import spec_from_file_location,module_from_spec
root=Path(__file__).resolve().parents[1]
spec=spec_from_file_location('download_models',root/'scripts/download-advanced-models.py');module=module_from_spec(spec);spec.loader.exec_module(module)
print(module.download(load_json((root/'setup/pose-model.lock.json').read_text())),flush=True)
