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
