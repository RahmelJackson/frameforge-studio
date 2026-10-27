# Official Comfy examples versus Frameforge

Checked October 24, 2026 against the rendered apps, the Hub catalog and the linked official source repositories. A similar task name does **not** establish the same graph, model or quality. The challenge describes these as inspiration, not a requirement to replicate every example. [Rules and timeline](https://comfy.org/open-source-higgsfield#timeline).

## Three example apps

| Official example | What Frameforge has | What is still missing |
| --- | --- | --- |
| [Cinematic Studio](https://comfy.org/hub/apps/cinematic-studio/) | Cinematic still controls, prompt-directed lens/angle/focus, separate relighting, Director shot recipes and an editable local graph. | Full combined camera/light/grade picker parity and broad visual acceptance. The linked source uses hosted Router FLUX.2 Pro, not a portable Comfy graph. Our local Z-Image route is a different implementation. |
| [Re-shoot](https://comfy.org/hub/apps/reshoot/) | Generated camera moves, tracked crop/reframing and experimental viewpoint tools. | True depth-based re-shooting of a source video. The official repo combines MoGe, CrossView Warp and MiniMax H3 with a camera preview. We do not have that graph or its weights installed; do not present cropping as re-shooting. |
| [Openjutsu](https://comfy.org/hub/apps/openjutsu/) | Experimental reference-video motion transfer, masked edits and character/face tools. | Dependable whole-character replacement through motion, occlusion and changing viewpoints. The app takes a video plus a character image and keeps source audio. The separate published Hub replacement recipe uses SCAIL-2; that exact recipe is not installed here. |

Primary implementation sources: [Cinematic source and request flow](https://github.com/Comfy-Org/comfy-cinematic-studio), [Re-shoot source](https://github.com/Comfy-Org/comfy-reshoot), [Re-shoot node/model setup](https://github.com/Comfy-Org/comfy-reshoot/blob/main/build/model-files.md), [Hub character replacement](https://comfy.org/hub/workflows/replace-character/).

Re-shoot's guide reports a **96 GB GPU demonstration**, with smaller configurations untested. That is not proof it cannot ever run on a 4090, and not a measured 4090 minimum. Porting/quantization/offload would require new testing; no large model downloads or paid deployment were started. The original graphs can be inspected in [its workflow folder](https://github.com/Comfy-Org/comfy-reshoot/tree/main/workflows). The Hub replacement graph is available from the official [workflow download](https://comfy.org/workflow-graphs/replace-character.json), with [Cloud template](https://cloud.comfy.org/?template=video_wan21_scail2_character_replacement). Source availability alone does not certify every model's terms.

## Hub coverage

These are the major tasks visible in [the official directory](https://comfy.org/hub/workflows/). “Alternative” means a real existing Frameforge route with a different model/pipeline; quality limits remain on the research checklist. None of the following implies the exact upstream graph is bundled.

| Hub task | Frameforge status |
| --- | --- |
| Image → video | Local Wan 2.2 plus LTX 2.5 and H3 graph packages, with saved narrow local examples. Broad output quality is not established. |
| Multi-reference video | Partial: reference/motion tools. The saved H3 image-to-video test does not validate multi-reference video. |
| First/last frames and camera | Alternative: Wan keyframes/camera; continuity and control acceptance remain partial. |
| Video background/object editing | Partial: masked VACE/editing stages; difficult motion remains open. |
| Video frame expansion | Partial: generated borders and tracked-still methods; scene reconstruction remains limited. |
| Motion transfer | Partial: existing VACE/pose tools; exact Wan Animate recipe absent. |
| Talking characters | Partial: local speech and lip sync; exact LTX recipe absent. |
| Character replacement | Partial: experiments; exact SCAIL-2 recipe absent. |
| Singing characters | Missing: no validated InfiniteTalk singing pipeline. |
| Reference-sheet animation | Partial: references/storyboards; no exact LTX sheet pipeline. |
| Character turnaround | Alternative: trained Qwen angle adapter; identity fidelity remains open. |
| Material changes | Partial: Qwen edits and material masks; semantic correctness remains open. |
| New still viewpoint | Partial: Qwen trained angle adapter, not a new captured view. |
| Product mockup / outfit / product scene | Partial: generic image/reference/masked editing; no validated dedicated product/garment suite. |
| Product photo → video | Alternative: generate/edit still then Wan animation; no matching provider chain verified. |
| Image/video restoration | Alternative: Real-ESRGAN and finishing; SeedVR2/Topaz/HitPaw recipes absent. |
| Archival restoration | Missing as a dedicated validated workflow. |
| Region editing | Alternative: Qwen masked edits and original-pixel preservation. |
| Still border expansion | Available in Image Canvas, with an actual edge-extension test and outside-mask pixel checks. General seam/scene quality still needs review. |
| Image object selection | Available: native SAM 3.1 text/box/point masks and brush/eraser refinement. Box/object correctness needs visual review. |
| Image → 3D / editable 3D scenes | Missing: no mesh generation, 3D preview/export, scene editor or camera handoff. Image viewpoints are a separate tool. |
| Editable image layers | Missing: Qwen-Image-Layered graph not installed. |
| Background removal | No dedicated validated BiRefNet recipe; existing masks are not equivalent. |
| Reference lighting | Partial: Qwen relight and restrained transfer experiments. |
| Object removal from still | Partial: masked/generic edit; exact BRIA recipe absent. |

## Next priorities

1. Finish the reproducible submission demo with existing successful native graphs and explicit limits.
2. Add an audited, separately labeled Hub recipe import path with exact node/model sources before attempting more quality claims. Prioritize a small background-removal or editable-layers recipe over immediately downloading the large Re-shoot stack.
3. Treat SCAIL-2 and CrossView/H3 as new research candidates. Benchmark a bounded original clip, measure memory/time and inspect motion before promoting either to a supported local workflow.

The visual MCP panel reuses the studio's branding, explained recipe data and backend operations. It is a compact MCP Apps interface, not every website editor embedded in a chat. The full website remains the complete production surface. Actual rendering depends on host support and needs client-side acceptance testing.
