# Provider bonus workflows

The upstream JSON files are pinned to Comfy-Org/workflow_templates commit `67984637eefcd4825dcf5c134e39034785be1682`. The manifest records the source URLs, file hashes, model links and the original engine compatibility findings. Upstream graphs retain their MIT license. Model weights have separate terms.

## LTX local VFX candidate

`frameforge-ltx-atmosphere.json` adapts the official LTX 2.5 image-to-video workflow. Use the bundled original `public/explore-art/observatory-concept.png` as the input. It asks LTX to generate a violet luminous mist effect around the doorway, with gentle clouds and quiet ambient sound. LTX is the core video generator, not an overlay or label on a Wan render.

The first preview is 640 × 384, 49 frames at 24 fps, seed 20261026, with prompt enhancement off. Keep the supplied distilled sampling schedule. The graph retains its editable native subgraph; open it to inspect the model loading, sampling, latent upscaling and audio/video decoding.

The original installed ComfyUI 0.22.3 was missing LTXVDualCFGGuider. A separate ComfyUI 0.42.0 preflight has every node used by the basic I2V graph. Model loading, memory fit, generation and creative acceptance are not established by a node check. Two large model files are still required before a real render can establish bonus evidence. The DFR graph is included for reference, with additional model/node requirements, not as the first low-memory run.

Review the LTX model license at https://huggingface.co/Lightricks/LTX-2.5. Download only the model files required by the selected graph. The optional prompt enhancer is not needed while disabled. `ltx-models.lock.json` records exact sizes, hashes and portable destinations when present.

## FLUX 3 and MiniMax H3

`api_bfl_flux3_i2v.json` is the official paid FLUX 3 video graph. Use a compatible Comfy Cloud account, replace the example input and review the cost there. Frameforge does not submit the paid job or collect a key.

`video_minimax_h3_i2v.json` is the official local H3 graph, with its model references. `api_minimax_h3_flf2v.json` is an external paid route. Review H3's model license and territorial availability before local deployment. Neither H3 route has been run by this preparation.

## Qualification evidence

Prepared graphs alone do not qualify. For a provider bonus, save a successful output generated primarily by the named model, the exact executed graph, prompt/seed/settings, required input and model provenance. Show that result and the creation flow in the contest demo. Organizers determine eligibility. Rules: https://comfy.org/open-source-higgsfield

## Studio entry points

Open Library, choose Workflows, and use the Provider workflows section. It includes `frameforge-ltx-atmosphere.json`, `frameforge-flux3-product.json` and `frameforge-h3-keyframes.json`, with original sample images, steps, native graph inspection and downloads. The FLUX and H3 sample graphs adapt the pinned official templates; the original upstream files remain included. The H3 sample uses the observatory as both endpoints for a loop; replace the endpoints for another transition.

The LTX preview disconnects the upstream resolution selector so its 640 x 384 controls are actually used. A two-second duration at 24 fps produces 49 latent frames using the upstream duration * fps + 1 expression. Native subgraphs are retained. These setup corrections do not establish a successful generation.

FLUX 3 Image Klein local weights were released on October 15, 2026: https://huggingface.co/black-forest-labs/flux-3-image-klein-comfy . They generate and edit images, while `frameforge-flux3-product.json` uses the separate hosted FLUX 3 Video model. The local Image Klein checkpoint does not replace the video node.

`h3-models.lock.json` pins the five public files required by the included local H3 I2V graph, including the NVFP4 AWQ text encoder (which does not require a Blackwell GPU). Model license and territorial terms still apply. Files and graph preparation do not establish a successful generation.
