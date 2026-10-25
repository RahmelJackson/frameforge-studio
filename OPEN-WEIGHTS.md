# Open weights only

Frameforge's original application code is MIT licensed. Downloadable model weights have their own terms; **open weights does not mean every model is OSI-approved or unrestricted**. Upstream ComfyUI templates and custom nodes retain their licenses. No weights are bundled in this repository.

The navigation toggle selects a persistent execution profile for this local studio. For a demonstration that cannot switch back through the UI, run:

```sh
npm run start:open
```

Stop an ordinary studio on the same port first. Alternatively set `FRAMEFORGE_OPEN_WEIGHTS_ONLY=1` when starting `server.mjs`. The locked launcher rejects attempts to turn the profile off. Use a separate `STUDIO_DATA` directory and unused `PORT` if you want an isolated demonstration. Avoid running two backends against the same data directory.

## Included scope

| Recipe | Model family | Use |
| --- | --- | --- |
| `z-image` | Z-Image Turbo, Qwen encoder, FLUX AE | Create a still or a prompt-directed cinematic still |
| `qwen-edit` | Qwen Image Edit 2511 and Lightning adapter | Edit, masked edit and prompt-directed relighting |
| `wan-i2v` | Wan 2.2 5B | Animate a still or generate from text |
| `wan-camera` | Wan 2.2 Fun Camera and acceleration adapters | Experimental camera direction |

The exact required files, upstream sources, pinned revisions, sizes and SHA-256 values are in `workflows/models.json` and each recipe's **Setup & models** panel. Native JSON graphs live in `workflows/local/`. Source/license links accompany downloads. Users download into their own ComfyUI model folders, not this repository. Model names in edited graphs must exist in the reviewed manifest; loader types must be on the reviewed node allowlist. Real-ESRGAN image upscaling also uses its manifest entry.

Local finishing supports `finish`, `shorts`, `story` and ordinary `reframe`, using existing media/soundtracks without generated missing edges or Windows speech. Local Kokoro narration and Whisper **small** transcription are permitted after their separately pinned audio setup. These audio/finishing pipelines use local Python helpers; they are not standalone ComfyUI graphs.

## Enforcement

- Server checks cover catalog lookup, setup lookup, graph preparation, edited-graph execution/export, batch requests, generation and speech requests.
- Partner templates, paid-model handoffs, Civitai API browsing, unknown graph nodes and unknown loader selections are rejected. The four graph recipes remain visible in the catalog.
- Unreviewed face/identity/motion/expressive/dubbing/LLM routes are excluded from this profile. The optional chat assistant uses its deterministic guide instead of calling an unverified LLM.
- Film narration must be an existing WAV/Kokoro result, not Windows SAPI. Film/media editing remains available; imported media is **not** certified as open-model output.
- A strict MCP connection sends the policy header on every request and cannot loosen a server's locked/global policy.
- New graph renders store the execution profile, reviewed node types and model source names in the saved job. Existing results are not retroactively relabeled.

The profile is an application allowlist, **not a sandbox around ComfyUI or a supply-chain attestation**. Verify actual installed file hashes and custom-node code, avoid untrusted plugins, and review imported media rights. A filename match does not prove the installed bytes are genuine. Hardware, model quality and available VRAM still limit results.

## Challenge interpretation

The official Open Weights Only category excludes partner nodes and closed-source APIs. Use the locked local profile for the demonstrated creation path and disclose the ordinary app's optional external provider links. This mixed-provider repository is **not automatically certified eligible** by having a toggle. Organizers determine whether that separation satisfies the category; request clarification before claiming it. See the [submission checklist](CHALLENGE-CHECKLIST.md).
