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
