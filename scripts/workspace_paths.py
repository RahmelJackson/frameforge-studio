"""Resolve portable model manifests against this installation, never another PC."""
import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def model_root(root=ROOT):
    settings = root / 'config.local.json'
    config = json.loads(settings.read_text(encoding='utf-8-sig')) if settings.exists() else {}
    folder = config.get('modelRoot') or os.environ.get('FRAMEFORGE_MODEL_ROOT')
    if not folder and config.get('comfySource'):
        folder = str(Path(config['comfySource']) / 'models')
    return (root / (folder or 'models')).resolve()

def resolve_paths(value, root=ROOT):
    if isinstance(value, list):
        return [resolve_paths(item, root) for item in value]
    if isinstance(value, dict):
        return {key: resolve_paths(item, root) for key, item in value.items()}
    if isinstance(value, str):
        normalized = value.replace('\\', '/')
        if normalized.startswith('models/'):
            return str(model_root(root) / normalized[7:])
        if normalized.startswith('runtime/'):
            return str(root / normalized)
    return value

def load_json(text):
    return resolve_paths(json.loads(text))
