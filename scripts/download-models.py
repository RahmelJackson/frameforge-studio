"""Download the three official Wan 2.2 5B assets and verify SHA-256."""
import concurrent.futures
import hashlib
import json
from pathlib import Path
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
REPO = "Comfy-Org/Wan_2.2_ComfyUI_Repackaged"
LOCK_PATH = ROOT / 'setup/models.lock.json'
LOCK = json.loads(LOCK_PATH.read_text(encoding='utf-8')) if LOCK_PATH.exists() else {}
MODEL_REVISION = LOCK.get('revision', 'main')
FILES = {
    "diffusion_models": "wan2.2_ti2v_5B_fp16.safetensors",
    "text_encoders": "umt5_xxl_fp8_e4m3fn_scaled.safetensors",
    "vae": "wan2.2_vae.safetensors",
}

def download(item):
    kind, name = item
    catalog = json.load(urllib.request.urlopen(f"https://huggingface.co/api/models/{REPO}/tree/{MODEL_REVISION}/split_files/{kind}", timeout=30))
    entry = next(x for x in catalog if x["path"].endswith("/" + name))
    expected = entry["lfs"]["oid"]
    pinned = next((item for item in LOCK.get('files',[]) if item['directory']==kind and item['name']==name),None)
    if pinned and (pinned['sha256'] != expected or pinned['bytes'] != entry['size']):
        raise RuntimeError(f'Pinned model metadata mismatch: {name}')
    target = ROOT / "runtime" / "models" / kind / name
    target.parent.mkdir(parents=True, exist_ok=True)
    if target.exists() and target.stat().st_size == entry["size"]:
        with target.open("rb") as f:
            if hashlib.file_digest(f, "sha256").hexdigest() == expected:
                print(f"VERIFIED {name}", flush=True)
                return {"path": str(target), "sha256": expected, "bytes": entry["size"]}
    partial = target.with_suffix(".partial")
    start = partial.stat().st_size if partial.exists() else 0
    url = f"https://huggingface.co/{REPO}/resolve/{MODEL_REVISION}/{entry['path']}"
    req = urllib.request.Request(url, headers={"Range": f"bytes={start}-"} if start else {})
    with urllib.request.urlopen(req, timeout=120) as response:
        append = start > 0 and response.status == 206
        count = start if append else 0
        checkpoint = count
        with partial.open("ab" if append else "wb") as f:
            while chunk := response.read(8 * 1024 * 1024):
                f.write(chunk)
                count += len(chunk)
                if count - checkpoint >= 1024**3:
                    print(f"DOWNLOAD {name} {count / entry['size']:.0%}", flush=True)
                    checkpoint = count
    if partial.stat().st_size != entry["size"]:
        raise RuntimeError(f"Incomplete download: {name}")
    with partial.open("rb") as f:
        actual = hashlib.file_digest(f, "sha256").hexdigest()
    if actual != expected:
        raise RuntimeError(f"SHA-256 mismatch: {name}; remove its .partial file before retrying")
    partial.replace(target)
    print(f"VERIFIED {name}", flush=True)
    return {"path": str(target), "sha256": actual, "bytes": entry["size"]}

if __name__ == "__main__":
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        records = list(pool.map(download, FILES.items()))
    (ROOT / "runtime" / "models-manifest.json").write_text(json.dumps(records, indent=2))
