"""Extract the official adapter LoRA; never load an arbitrary pickle."""
import hashlib,json
from pathlib import Path
import torch
from safetensors.torch import save_file
root=Path(__file__).resolve().parents[1];lock=json.loads((root/'setup/photomaker-derived.lock.json').read_text());source=Path(lock['source']);target=Path(lock['path'])
with source.open('rb') as f:checksum=hashlib.file_digest(f,'sha256').hexdigest()
if checksum!=lock['sourceSha256']:raise ValueError('Restore the pinned official PhotoMaker source.')
if not target.resolve().is_relative_to(Path('D:/FrameforgeModels/storybuilder/loras').resolve()):raise ValueError('Unexpected adapter destination.')
weights=torch.load(source,map_location='cpu',weights_only=True)['lora_weights'];target.parent.mkdir(parents=True,exist_ok=True);temporary=target.with_suffix('.pending.safetensors')
save_file({k:v.contiguous() for k,v in weights.items()},str(temporary))
with temporary.open('rb') as f:checksum=hashlib.file_digest(f,'sha256').hexdigest()
if checksum!=lock['sha256']:raise ValueError('Extracted adapter differs from the pinned result; preserve it for inspection.')
temporary.replace(target);print(json.dumps({'verified':str(target),'sha256':checksum}))
