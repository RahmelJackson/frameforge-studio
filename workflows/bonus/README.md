# Featured local workflows

Home and Library put the local LTX, FLUX 3 Image Klein and H3 recipes first. Each card explains its input and result, links the required models, and opens the downloadable ComfyUI graph. Cloud alternatives remain separate and require the user's account and credits. Frameforge does not submit these paid jobs or collect their credentials.

The original upstream JSON files are pinned to Comfy-Org/workflow_templates commit `67984637eefcd4825dcf5c134e39034785be1682`. The manifest preserves source URLs and hashes. Upstream graphs retain their MIT license; model weights have separate terms and are not distributed with the source.

## Tested local profiles

| Workflow | Included graph | Actual local test |
| --- | --- | --- |
| LTX 2.5 VFX | `frameforge-ltx-atmosphere.json` | 640 × 384, 121 frames at 24 fps, 5.04 seconds with generated audio. Visible violet smoke; no black frames. |
| FLUX 3 Image Klein edit | `frameforge-flux3-image-edit.json` | 1248 × 832 product edit, 16 steps, CFG 1, local prompt upsampler enabled. The original green control knob becomes cobalt blue. |
| MiniMax H3 I2V | `frameforge-h3-local.json` | 640 × 384, 56 frames at 24 fps, 2.33 seconds with generated audio, eight-step Turbo LoRA. Moving clouds; no black frames. |

These tests ran on local ComfyUI 0.42.0 and an RTX 4090. They verify the listed profiles only. Creative acceptance, larger settings and broader edit or motion quality still require review. Actual results and executed graphs are saved in the operator's local evidence folders, separate from this repository and model weights. Cards use an actual result only when its completed local report exists; a fresh installation shows clearly labelled original sample inputs.

## Models and graphs

Use the original `public/explore-art/product-concept.png` for FLUX and `observatory-concept.png` for LTX and H3. The run package includes the correct input image, graph, model references and instructions.

- LTX uses the five files pinned by `ltx-models.lock.json`. The tested graph omits its disabled prompt-enhancer branch, avoiding an unused Gemma E2B dependency. Review [Lightricks' model terms](https://huggingface.co/Lightricks/LTX-2.5).
- Local FLUX uses the four files pinned by `flux3-image-models.lock.json`: the distilled INT8 image model, INT8 Qwen3-VL encoder, W4A8 prompt upsampler and FLUX VAE. Review [BFL's model terms](https://huggingface.co/black-forest-labs/flux-3-image-klein-comfy). This image model is separate from the paid FLUX 3 Video workflow.
- H3 uses the five files pinned by `h3-models.lock.json`. Review [MiniMax's model license and territorial availability](https://huggingface.co/MiniMaxAI/MiniMax-H3/blob/main/LICENSE); excluded territories require separate authorization.

The local LTX and H3 downloads are ComfyUI API-format graphs. **File > Open** imports them into an editable native canvas. FLUX retains the official canvas format. Upload the included input, check settings, then run in the compatible local engine. Prepared graphs and model presence alone do not establish generation quality.

## External alternatives and submission evidence

`frameforge-flux3-product.json` is the separate paid FLUX 3 image-to-video graph. `frameforge-h3-keyframes.json` is the paid H3 first/last-frame route; its two sample endpoints are the same observatory image, so replace them for another transition. Neither paid route has been run here. The LTX DFR graph is reference material with additional requirements.

For bonus evidence, retain the actual output, executed graph, prompt, seed, profile, inputs and model provenance, then show the result and creation flow in the demo. Organizers determine eligibility under the [challenge rules](https://comfy.org/open-source-higgsfield).
