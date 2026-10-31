## Optional quick-launch runtimes

The quick launcher downloads Node.js from its official archive only when a suitable installation is missing. The optional managed CPU setup downloads uv from Astral's official GitHub releases, then uv-managed CPython from python-build-standalone and pinned packages from PyPI. These runtimes are not bundled in the source release. Their licenses and notices remain with the downloaded software. Node.js, uv, CPython and each package retain their own terms; see setup/quickstart-runtime.lock.json and QUICKSTART.md for sources and scope.

# Third-party sources and separate installations

Frameforge's original interface and adapters are licensed under the MIT License in the root `LICENSE` file. Third-party material retains its own license; the root license does not replace the notices listed below.

- ComfyUI and its ecosystem are separate installations. Source: https://github.com/Comfy-Org/ComfyUI. Their code and custom-node licenses apply to those installations.
- The graphs in `workflows/upstream/` originate from https://github.com/Comfy-Org/workflow_templates; their bundled MIT license and Comfy Org copyright remain in `workflows/upstream/LICENSE`. Preserve their provenance. Local graphs are generated from Frameforge builders. Some templates call paid services; a JSON graph is not a license to the provider's model weights.
- Model download manifests link to the original repositories and revision-specific files. Each model retains its own terms. No weights are included in the source package.
- Ollama is optional and separately installed: https://github.com/ollama/ollama. Its runtime and each downloaded language model have separate terms; none are packaged here.
- Built-in `public/explore-art/*-concept.png` illustrations were created for this studio. The other built-in SVG illustrations are project assets. They are illustrative, not evidence of generation quality. User saved outputs and third-party Civitai images/videos are excluded from the source package.
- The source archive replaces the legacy sample-image entry with the original observatory concept illustration (PNG image content behind the legacy sample filename). The original sample JPEG, the original machine's ComfyUI source snapshot and its drive-specific model-path YAML are excluded.
- Civitai is an external discovery source. Creator credit, original-page links and any displayed prompt/model information accompany community examples. Media are loaded from the provider rather than redistributed in the repository. Upstream licenses and API/site terms still apply.

This file records provenance. It does not relicense third-party code, models, hosted services or community media.

## Inter typeface

Inter Variable is bundled locally from the official distribution at https://rsms.me/inter/font-files/InterVariable.woff2. Copyright Rasmus Andersson. SIL Open Font License 1.1; full license: public/fonts/Inter-LICENSE.txt. Original project: https://github.com/rsms/inter. The font is not covered by Frameforge's MIT license.

Bundled InterVariable.woff2 SHA-256: `693b77d4f32ee9b8bfc995589b5fad5e99adf2832738661f5402f9978429a8e3`.

## Native workflow expansion (0.8.7)

Comfy-Org/workflow_templates graphs in workflows/native are pinned to 14220b8bd3e86baa852959f17039613191e66656. Their source and model provenance are recorded in workflows/native/catalog.json. They retain the upstream MIT license, reproduced in workflows/bonus/LICENSE. Lightricks/ComfyUI-LTXVideo graphs are pinned to 220e1d45aa0469f518e982102fca4dca92a61862; its Apache-2.0 license is reproduced in workflows/native/LTX-LICENSE.txt. Original upstream JSON is retained. nativePacket pins model links, removes the stale T2A link 13811, and derives clearly marked V2V variants by selecting the documented adapter and prompts. Model weights are not bundled and retain their own terms, including LTX, FLUX and MiniMax restrictions.

## Creative canvas
Three.js r180 (MIT) is bundled offline in public/vendor/three, including GLTFLoader, OrbitControls and BufferGeometryUtils. Bare imports were changed to local relative imports; the upstream license is included there. Source: https://github.com/mrdoob/three.js/tree/r180.
The Animate Diff High Res Loops graph retains the Comfy-Org workflow_templates MIT license. Its pinned source commit and checksum are in workflows/native/catalog.json. This recipe is not generation-tested or included in the locked open-weights profile.
Character dataset configuration follows the AI Toolkit FLUX.1 example: https://github.com/ostris/ai-toolkit/blob/main/config/examples/train_lora_flux_24gb.yaml. AI Toolkit, its dependencies and base weights are separate installations and retain their own terms.

## Workflow additions (October 31, 2026)

- `workflows/native/MiniMax-H3-Loop.json`, `MiniMax-H3-Loop-Turbo-v2.json` and `MiniMax-H3-Loop-Control.json` come from https://github.com/pxl-pshr/ComfyUI-MiniMaxH3-Loop at commit 85f968d0742e1563fe2cb1de0e163f6d33f3689a. That project is licensed under GPL-3.0; these three files remain under GPL-3.0 and are not covered by Frameforge's MIT license. Its custom nodes are a separate installation.
- `workflows/native/LTX-2.5_ICLoRA_Layout_To_Render_Two_Stage_Distilled.json` comes from the gated Hugging Face repository Lightricks/LTX-2.5-22b-IC-LoRA-Layout-To-Render at revision bd765d5592f0ae78457162852a353b6a375cb00f and retains Lightricks' terms (see workflows/native/LTX-LICENSE.txt and the model card).
- `image_qwen_image_edit_2511_style_transfer.json` is an unmodified copy of Comfy-Org/workflow_templates `image_qwen_image_edit_2511.json`; with `image_flux3_klein_t2i.json`, `utility_seedvr2_3b_int8_upscale_video.json` and `utility-gan_upscaler.json` it is pinned to workflow_templates commit c067929d7e9cc0f3fd15be348fa1a1d85da15946 under the upstream MIT license. Frameforge applies the style LoRA settings in memory.
- The FLUX 3 Klein training export writes a command for diffusers' `examples/dreambooth/train_dreambooth_lora_flux3_klein.py` (Apache-2.0, https://github.com/huggingface/diffusers at commit 86ef420b17363c28e36ebad6b58555e9aa8feda2). No diffusers code is included; it is a separate installation.
- The Explainer template's sample source links to NASA Space Place (https://spaceplace.nasa.gov/blue-sky/en/); no NASA content is copied.
- The Style Transfer LoRA (dx8152/Qwen-Image-Edit-2511-Style-Transfer) is Apache-2.0. SeedVR2 weights are Apache-2.0. FLUX 3 Klein base weights are under the FLUX Kommunity License. No weights are included in the source package.
