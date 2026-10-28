# Model and workflow upgrades: evidence before replacement

This is a follow-up research plan, not a claim that the models below are installed, integrated or quality-approved. Preserve the tested ComfyUI engines during the submission build. Add one model family at a time with recorded terms, file hashes, exact workflow/checkpoint compatibility and a held-out comparison. The fifteen broad quality goals remain open.

## Completed in 0.8.0

- Connected production recipes, shared subjects/motions and serial variation review.
- Protected FLUX Canvas masking using native crop/resize/composite nodes. The live test retained every unmasked pixel at the original dimensions.
- SAM box center conditioning and higher text threshold. Mask validity passed; the real box still overselected an object, so semantic selection is not signed off.

## Next, in order

1. **Multi-reference image conditioning.** Prefer the already integrated Qwen Image Edit 2511 reference path for identity/scene tests before adding another legacy adapter. Its official card supports multiple images and describes consistency, lighting and viewpoint improvements. Test front, side and rear views using view-appropriate criteria. A hidden face is not a failed face match.
2. **LTX Ingredients / utility adapters.** Verify each official adapter's exact base checkpoint and nodes. LTX's own documentation warns that the 2.5 Ingredients workflow currently loads a 2.3 checkpoint while the 2.5 adapter card specifies another checkpoint. Do not simply put a new adapter into the smoke workflow and call it compatible. Separate tests for reference-sheet identity, clean plates, borders and detail reconstruction.
3. **Background removal and music.** BiRefNet and ACE-Step 1.5 have official native ComfyUI templates. Check this computer's node versions before promising native availability. BiRefNet's official guide places its model in `models/background_removal`. ACE-Step has all-in-one and split model paths; record component terms and hashes before adding a starter to the locked profile. Neither is integrated in 0.8.0.
4. **Whole-character animation, depth and 3D.** Evaluate SCAIL-2 / Wan Animate, MoGe / depth guidance and TRELLIS in an isolated engine against the retained failures. Validate licenses and actual Windows nodes first. Separate pose-extraction error from generator error. Preserve exact prop markings through pixel compositing instead of asking a generative model to redraw them.
5. **Speech and dubbing.** Evaluate Qwen3-TTS and per-speaker separation/transcription against current speech baselines. Keep one voice reference per speaker and original dialogue timing. Listening and human lip/tooth/profile review remain required.

## Acceptance before checking off

- Record exact model and dependency versions, source/license URLs and file hashes.
- Prepare/export a real graph with its actual inputs. Show missing files before a render.
- Compare a held-out example against the current retained failure, not only a new easy example.
- Save the actual decoded result and its limitations. File checks do not certify appearance, identity, acting, motion or music quality.
- Keep legacy paths available as labelled alternatives; do not delete weights or replace the working engine during submission preparation.

## Primary sources checked on 2026-10-27

- [Comfy challenge requirements](https://comfy.org/open-source-higgsfield)
- [Kling MCP and reusable assets/motions](https://kling.ai/app/mcp/guide)
- [Kling production workflow](https://kling.ai/blog/kling-mcp-cinematic-performance-workflow?tab=all)
- [Qwen Image Edit 2511 official model card](https://huggingface.co/Qwen/Qwen-Image-Edit-2511)
- [LTX official adapter compatibility and workflows](https://docs.ltx.io/open-source-model/integration-tools/ic-lo-ra-adapters)
- [Native BiRefNet guide](https://docs.comfy.org/tutorials/utility/remove-background-birefnet)
- [Native ACE-Step 1.5 guide](https://docs.comfy.org/tutorials/audio/ace-step/ace-step-v1-5)
