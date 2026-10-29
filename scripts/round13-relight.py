"""Bounded IC-Light still comparison adapted from its pinned official Apache-2.0 demo.

The source image is a full-portrait condition, not a verified foreground cutout.
This experiment never writes an app approval or marks a quality goal complete.
No installed packages are changed. Run --download first, then --render only
with the team's exclusive GPU slot. Existing started cases are never replayed.
"""
from __future__ import annotations
from workspace_paths import model_root, load_json

import argparse
import hashlib
import json
import math
import os
from pathlib import Path
import platform
import shutil
import sys
import time
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
LOCK = ROOT / "setup/round13-relight.lock.json"
MODELS = (model_root()/"relight")
EVIDENCE = ROOT / "evidence/round13-relight"
SOURCE = ROOT / "data/assets/34659372-3bbb-4bbf-87c3-e3fa0a74f791.png"
POSITIVE = ("portrait photograph of a woman with short black curly hair, brown skin, "
            "teal linen button-up shirt and a tiny round silver pendant, neutral gray "
            "studio background, soft directional studio lighting, natural skin texture")
NEGATIVE = "drawing, painting, cartoon, bad anatomy, distorted face, oversaturated, harsh flash"


def digest(path):
    h = hashlib.sha256()
    with Path(path).open("rb") as f:
        for block in iter(lambda: f.read(4 * 1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()


def save(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(value, indent=2, ensure_ascii=False), encoding="utf-8")
    temporary.replace(path)


def read_lock():
    spec = load_json(LOCK.read_text(encoding="utf-8"))
    assert sum(f["bytes"] for f in spec["files"]) < 5_000_000_000
    assert MODELS.resolve().as_posix().lower().startswith("d:/frameforgemodels/storybuilder/relight")
    return spec


def model_file(item):
    p = (MODELS / item["local"]).resolve()
    if not p.is_relative_to(MODELS.resolve()):
        raise ValueError("Model path escapes the pinned relight directory")
    return p


def download(spec):
    MODELS.mkdir(parents=True, exist_ok=True)
    if shutil.disk_usage(MODELS).free < 6_000_000_000:
        raise RuntimeError("At least 6 GB free on model drive required")
    for item in spec["files"]:
        p = model_file(item)
        if p.exists():
            if p.stat().st_size == item["bytes"] and digest(p) == item["sha256"]:
                print("already checked", item["local"], flush=True)
                continue
            raise RuntimeError(f"Existing model mismatch; preserving {p}")
        p.parent.mkdir(parents=True, exist_ok=True)
        temporary = p.with_suffix(p.suffix + ".part")
        if temporary.exists():
            raise RuntimeError(f"Preserved interrupted download requires inspection: {temporary}")
        print("download", item["local"], item["bytes"], flush=True)
        req = urllib.request.Request(item["url"], headers={"User-Agent": "Frameforge-local-research"})
        with urllib.request.urlopen(req, timeout=60) as response, temporary.open("xb") as output:
            shutil.copyfileobj(response, output, 4 * 1024 * 1024)
        if temporary.stat().st_size != item["bytes"] or digest(temporary) != item["sha256"]:
            raise RuntimeError(f"Downloaded model mismatch; preserving {temporary}")
        temporary.replace(p)
    checked = verify_models(spec)
    save(EVIDENCE / "model-readiness.json", checked)
    print(json.dumps({"ready": True, "bytes": checked["bytes"], "files": len(checked["files"])}), flush=True)


def verify_models(spec):
    files = []
    for item in spec["files"]:
        path = model_file(item)
        actual = digest(path)
        if path.stat().st_size != item["bytes"] or actual != item["sha256"]:
            raise RuntimeError(f"Pinned model changed: {path}")
        files.append({"path": str(path), "bytes": path.stat().st_size, "sha256": actual})
    return {"ready": True, "bytes": sum(i["bytes"] for i in files), "files": files,
            "lockSha256": digest(LOCK), "checkedAt": time.time()}


def verify():
    from PIL import Image
    import numpy as np
    spec = read_lock()
    models = verify_models(spec)
    report = load_json((EVIDENCE / "run.json").read_text(encoding="utf-8"))
    assert digest(SOURCE) == report["source"]["sha256"]
    assert digest(EVIDENCE / "original.png") == report["source"]["copySha256"]
    assert digest(LOCK) == report["lockSha256"]
    checks = []
    for direction in ("left", "right"):
        case = report["cases"][direction]
        assert case["status"] == "complete"
        p = EVIDENCE / case["file"]
        assert digest(p) == case["sha256"]
        im = Image.open(p).convert("RGB")
        im.load()
        assert list(im.size) == report["settings"]["size"]
        a = np.asarray(im)
        assert a.std() > 5
        checks.append({"direction": direction, "sha256": digest(p), "size": list(im.size),
                       "standardDeviation": float(a.std()), "technicalPass": True})
    result = {"technicalPass": True, "creativeApproval": None,
              "sourceUnchanged": True, "checks": checks, "modelBytes": models["bytes"]}
    save(EVIDENCE / "verification.json", result)
    print(json.dumps(result), flush=True)


def render(spec):
    import numpy as np
    import torch
    import diffusers
    import transformers
    import safetensors.torch as sf
    from PIL import Image, ImageDraw
    from diffusers import StableDiffusionImg2ImgPipeline, UNet2DConditionModel, AutoencoderKL, DPMSolverMultistepScheduler
    from diffusers.models.attention_processor import AttnProcessor2_0
    from transformers import CLIPTextModel, CLIPTokenizer

    run_path = EVIDENCE / "run.json"
    if run_path.exists():
        raise RuntimeError("Comparison already recorded or started. Inspect run.json; never replay implicitly.")
    models = verify_models(spec)
    if not torch.cuda.is_available():
        raise RuntimeError("CUDA required for bounded preview")
    free, total = torch.cuda.mem_get_info()
    if free < 7_000_000_000:
        raise RuntimeError("Less than 7 GB free VRAM; release other renderers before this comparison")
    EVIDENCE.mkdir(parents=True, exist_ok=True)
    src = Image.open(SOURCE).convert("RGB")
    if src.size != (576, 1024):
        raise ValueError("Original Mara benchmark dimensions changed")
    source_copy = EVIDENCE / "original.png"
    shutil.copyfile(SOURCE, source_copy)
    width, height = 288, 512
    source_pixels = np.asarray(src.resize((width, height), Image.Resampling.LANCZOS))
    Image.fromarray(source_pixels).save(EVIDENCE / "condition.png")
    settings = {"size": [width, height], "seed": 20261023, "stepsPerPass": 25,
                "lowresDenoise": 0.9, "refineDenoise": 0.5, "guidance": 2.0,
                "refineScale": 1.0, "positive": POSITIVE, "negative": NEGATIVE,
                "conditioning": "full original portrait including backdrop; no foreground mask",
                "changingVariable": "left-to-right versus right-to-left grayscale light latent only"}
    report = {"schema": 1, "status": "loading", "startedAt": time.time(), "creativeApproval": None,
              "source": {"path": str(SOURCE), "sha256": digest(SOURCE), "size": list(src.size),
                         "copySha256": digest(source_copy)}, "settings": settings,
              "lockSha256": digest(LOCK), "modelReadiness": models, "cases": {},
              "runtime": {"python": platform.python_version(), "torch": torch.__version__,
                          "diffusers": diffusers.__version__, "transformers": transformers.__version__,
                          "device": torch.cuda.get_device_name(), "initialFreeVram": free},
              "adaptation": {"upstream": spec["upstream"], "changes": ["No Bria background removal; full portrait condition explicitly retained", "No UI server", "Two directions only, one seed, 512-pixel maximum side", "Second refinement stays at original preview resolution"]}}
    save(run_path, report)
    base = MODELS / "realistic-vision-v51"
    local = dict(local_files_only=True)
    tokenizer = CLIPTokenizer.from_pretrained(base, subfolder="tokenizer", **local)
    text_encoder = CLIPTextModel.from_pretrained(base, subfolder="text_encoder", torch_dtype=torch.float16, use_safetensors=True, **local)
    vae = AutoencoderKL.from_pretrained(base, subfolder="vae", torch_dtype=torch.bfloat16, use_safetensors=True, **local)
    unet = UNet2DConditionModel.from_pretrained(base, subfolder="unet", torch_dtype=torch.float32, use_safetensors=True, **local)
    with torch.no_grad():
        old = unet.conv_in
        widened = torch.nn.Conv2d(8, old.out_channels, old.kernel_size, old.stride, old.padding)
        widened.weight.zero_()
        widened.weight[:, :4].copy_(old.weight)
        widened.bias = old.bias
        unet.conv_in = widened
        offset = sf.load_file(MODELS / "iclight_sd15_fc.safetensors")
        original = unet.state_dict()
        if original.keys() != offset.keys():
            raise ValueError("IC-Light offset keys do not match widened SD1.5 UNet")
        unet.load_state_dict({key: original[key] + offset[key] for key in original}, strict=True)
        del offset, original
    unet_original_forward = unet.forward

    def conditioned_forward(sample, timestep, encoder_hidden_states, **kwargs):
        extra = kwargs.pop("cross_attention_kwargs")
        condition = extra["concat_conds"].to(sample)
        if sample.shape[0] % condition.shape[0]:
            raise ValueError("Foreground conditioning batch mismatch")
        condition = torch.cat([condition] * (sample.shape[0] // condition.shape[0]), dim=0)
        return unet_original_forward(torch.cat([sample, condition], dim=1), timestep,
                                     encoder_hidden_states, cross_attention_kwargs={}, **kwargs)

    unet.forward = conditioned_forward
    unet.to(device="cuda", dtype=torch.float16)
    vae.to(device="cuda", dtype=torch.bfloat16)
    text_encoder.to(device="cuda", dtype=torch.float16)
    unet.set_attn_processor(AttnProcessor2_0())
    vae.set_attn_processor(AttnProcessor2_0())

    def scheduler():
        return DPMSolverMultistepScheduler(num_train_timesteps=1000, beta_start=0.00085,
            beta_end=0.012, algorithm_type="sde-dpmsolver++", use_karras_sigmas=True, steps_offset=1)

    pipe = StableDiffusionImg2ImgPipeline(vae=vae, text_encoder=text_encoder, tokenizer=tokenizer,
        unet=unet, scheduler=scheduler(), safety_checker=None, requires_safety_checker=False,
        feature_extractor=None, image_encoder=None)
    pipe.set_progress_bar_config(disable=False)

    def tensor(pixels):
        # Upstream uses127 so neutral127 maps tozero.
        return torch.from_numpy(np.asarray(pixels).copy()).float().permute(2, 0, 1).unsqueeze(0).to("cuda", torch.bfloat16) / 127.0 - 1.0

    def encode(pixels):
        return vae.encode(tensor(pixels)).latent_dist.mode() * vae.config.scaling_factor

    def prompt(text):
        tokens = tokenizer(text, padding="max_length", max_length=tokenizer.model_max_length,
                           truncation=True, return_tensors="pt")
        if len(tokenizer(text, truncation=False)["input_ids"]) > tokenizer.model_max_length:
            raise ValueError("Probe prompt exceeds one CLIP chunk")
        return text_encoder(tokens.input_ids.to("cuda"))[0]

    try:
        with torch.inference_mode():
            cond, uncond = prompt(POSITIVE), prompt(NEGATIVE)
            foreground = encode(source_pixels)
            for direction in ("left", "right"):
                start = time.perf_counter()
                report["cases"][direction] = {"status": "started", "startedAt": time.time()}
                report["status"] = "rendering"
                save(run_path, report)
                torch.cuda.reset_peak_memory_stats()
                rng = torch.Generator(device="cuda").manual_seed(settings["seed"])
                gradient = np.linspace(255, 0, width) if direction == "left" else np.linspace(0, 255, width)
                background = np.stack([np.tile(gradient, (height, 1))] * 3, axis=-1).astype(np.uint8)
                Image.fromarray(background).save(EVIDENCE / f"{direction}-light.png")
                pipe.scheduler = scheduler()
                first = pipe(image=encode(background).to(torch.float16), strength=settings["lowresDenoise"],
                    prompt_embeds=cond, negative_prompt_embeds=uncond,
                    num_inference_steps=round(settings["stepsPerPass"] / settings["lowresDenoise"]),
                    generator=rng, output_type="latent", guidance_scale=settings["guidance"],
                    cross_attention_kwargs={"concat_conds": foreground}).images
                intermediate = vae.decode(first.to(torch.bfloat16) / vae.config.scaling_factor).sample
                pixels = (intermediate[0].permute(1, 2, 0).float().cpu().numpy() * 127.5 + 127.5).clip(0, 255).astype(np.uint8)
                pipe.scheduler = scheduler()
                final = pipe(image=encode(pixels).to(torch.float16), strength=settings["refineDenoise"],
                    prompt_embeds=cond, negative_prompt_embeds=uncond,
                    num_inference_steps=round(settings["stepsPerPass"] / settings["refineDenoise"]),
                    generator=rng, output_type="latent", guidance_scale=settings["guidance"],
                    cross_attention_kwargs={"concat_conds": foreground}).images
                decoded = vae.decode(final.to(torch.bfloat16) / vae.config.scaling_factor).sample
                result = (decoded[0].permute(1, 2, 0).float().cpu().numpy() * 127.5 + 127.5).clip(0, 255).astype(np.uint8)
                output = EVIDENCE / f"{direction}.png"
                Image.fromarray(result).save(output)
                report["cases"][direction].update(status="complete", file=output.name, sha256=digest(output),
                    seconds=time.perf_counter() - start, peakAllocatedBytes=torch.cuda.max_memory_allocated(),
                    peakReservedBytes=torch.cuda.max_memory_reserved(), finishedAt=time.time())
                save(run_path, report)
                print(json.dumps(report["cases"][direction]), flush=True)
        sheet = Image.new("RGB", (width * 3, height + 32), "#16181c")
        draw = ImageDraw.Draw(sheet)
        for i, (label, file) in enumerate([("Original (resized)", "condition.png"), ("Light from image-left", "left.png"), ("Light from image-right", "right.png")]):
            draw.text((i * width + 8, 9), label, fill="white")
            sheet.paste(Image.open(EVIDENCE / file), (i * width, 32))
        sheet.save(EVIDENCE / "comparison.png")
        report["status"] = "complete"
        report["finishedAt"] = time.time()
        save(run_path, report)
        verify()
    except Exception as exc:
        report["status"] = "failed"
        report["error"] = f"{type(exc).__name__}: {exc}"
        save(run_path, report)
        raise


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--download", action="store_true")
    group.add_argument("--render", action="store_true")
    group.add_argument("--verify", action="store_true")
    args = parser.parse_args()
    if args.download:
        download(read_lock())
    elif args.render:
        render(read_lock())
    else:
        verify()
