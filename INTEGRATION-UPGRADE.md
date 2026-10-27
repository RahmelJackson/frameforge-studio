## Follow-up release 0.7.2

- [x] Explicit per-workflow downloads with missing-file count and size. Other workflows are not downloaded.
- [x] Website Explore shortcuts for Civitai and Guide; native plugin Explore has a credited Civitai gallery, separate Library and LLM/guided workflow helper.
- [x] Canvas RGB changed-pixel Proof view and selection toolbar; image tools collapse to a selected-tool chip.
- [x] Saved-film Rough cut action builds the selected clips and exports a draft without new AI generation.
- [x] LTX/H3 hide Wan-only settings; grouped Library with film first; Settings section navigation.
- [x] Native ComfyUI IMAGE/VIDEO/AUDIO handoff nodes and imported-media records in My work.
- [x] Exact-result model/source details and native graph remix links where saved graphs exist.
- [x] Isolated CPU media/vision software check/install commands. Advanced GPU environments remain separate.

Still open: account-published custom Cloud App Mode links, automatic installation of all advanced GPU processors, FLUX protected Canvas masking, the larger 3D/animation/music pipelines, and the fifteen parked creative-quality goals. No paid Cloud run or new model download was made in this follow-up.

# Connected workflow release 0.7.0

## Use a local model from Studio or your assistant

The same prepare, inspect, run and review path now supports eight local graph starters. The additional three are:

| Recipe ID | Workspace | Inputs | Bounded local profile |
| --- | --- | --- | --- |
| `ltx-vfx` | Video | Starting image, effect/audio prompt, seed | LTX 2.5, 640 × 384, 121 frames, 24 fps |
| `minimax-h3-local` | Video | Starting image, motion/audio prompt, seed | H3, 640 × 384, 56 frames, 24 fps, eight-step LoRA |
| `flux3-image` | Images | Starting image, edit instruction, seed | FLUX 3 Image Klein, one megapixel, 16 steps, local prompt upsampler |

Choose **Local model** at the top of the image/video settings. Add an image and prompt. **Workflow & run options** shows the graph, model downloads, Studio run, native ComfyUI export and supported external handoffs. Provider previews keep their tested profiles; changing graph topology or model settings requires a separately reviewed adapter. Wan camera/look/length controls are hidden for these recipes.

For MCP, call `workflow_requirements` with the recipe ID. Import an authorized image, then call `studio_prepare_workflow` with `context=images` for FLUX or `context=create` for LTX/H3, `provider=local`, `task=<recipe ID>`, and `input={asset,prompt,seed}`. Inspect the graph. Run with `studio_run_workflow` and an explicit request UUID, then poll `studio_job`. Reuse that UUID after an ambiguous response. Technical checks do not approve creative quality.

The three new local runs were exercised through the real MCP adapter and Studio queue. Their actual saved results passed decoding and dimension/timing checks. FLUX saved a 1248 × 832 still; LTX saved 121 frames and H3 saved 56 frames. All outputs retain pending creative review. This verifies the integration and these profiles, not universal generation quality.

## Download only missing files

Setup and the workspaces now show dependencies before uploads. Video processing, image style/vision and audio model locks supply source links, sizes, checksums and installation notes. Some advanced processors still need their separate Python/source installation. A model list does not install that software or certify output quality.

In **Models & local setup**, review source terms, choose an existing model folder your ComfyUI scans, then use **Download all missing**. The owner-only download queue installs trusted manifest files sequentially, supports range resumption, checks disk space and SHA-256, and retains an interrupted partial file. It refuses conflicting existing files. Gated sources still require your browser sign-in/agreement or a manual download; Studio does not capture an account token or accept model terms for you. Refresh ComfyUI's model lists afterward.

`modelRoot` in private `config.local.json` stores the selected ComfyUI model folder. The folder must also be present in that engine's `extra_model_paths.yaml`. Separate Studio processor files use their documented runtime destinations. Keep all large folders on the drive you selected.

## Assistant setup

Setup has individual **Copy setup** buttons for Codex, Claude Desktop, LM Studio, Hermes and Antigravity. Creation tools remain opt-in. A recent-request badge records actual MCP/agent API activity; it does not infer connection merely because a configuration was copied. The [official Codex MCP configuration documentation](https://learn.chatgpt.com/docs/extend/mcp#configure-with-configtoml) defines the TOML format used by the Codex copy button. Other clients retain their documented JSON/YAML configuration formats.

## Native ComfyUI image bridge

Download the bridge from Setup, or copy `assets/comfyui-frameforge` into your ComfyUI's active `custom_nodes` folder. If ComfyUI runs with a separate `--base-directory`, use that base directory's `custom_nodes` folder. Restart when idle. Add **Frameforge · send image to Studio** after an `IMAGE` output, run the graph, and explicitly send its saved PNG into Studio. Both applications must run on the same machine. The node imports an image; it does not automatically generate or approve anything. Video/audio bridge nodes added in 0.7.2.

The included Windows launcher allows only this bridge when it is installed, keeping other custom nodes disabled. `comfyPython` may select a separate complete engine environment; `python` remains the Studio media-helper environment.

## Comfy Cloud and imported results

Official template links stay available. A result drop zone brings downloaded Cloud/Civitai images, clips or WAVs into the local media library as imports. No paid run, credential collection or automatic cloud upload was added.

**Custom Cloud App Mode share links remain pending.** They require an app saved and shared in the creator's Cloud account. Frameforge does not invent a URL or claim a downloaded graph is already imported. The [official App Mode guide](https://docs.comfy.org/interface/app-mode) explains selecting inputs/outputs, saving the app and creating its share link.

## Still open

- Publish and test custom Cloud App Mode share links in an authorized Cloud account.
- Finish cross-platform installation of advanced local processors. Native media return nodes are present in 0.7.2.
- Integrate the separately listed 3D, Wan Animate, SeedVR2, generated music/Foley and identity-training pipelines.
- Continue the fifteen parked creative-quality goals only with new, bounded comparisons and explicit review. This release does not close them.
