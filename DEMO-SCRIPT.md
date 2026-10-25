# Frameforge: 115-second demonstration

Record at 1080p with a readable browser scale. Follow one idea through the studio. Use original or cleared media. Cut generation waits with a visible “time shortened” caption. Have a real completed image, motion clip and speech result ready before recording.

| Time | Show | Say |
| --- | --- | --- |
| 0:00–0:10 | Home: moving original artwork, then a real finished result playing. | “This is Frameforge: an open-source creative studio built around ComfyUI. It helps you turn an idea into an image, a moving shot and a story.” |
| 0:10–0:25 | Open **Studio guide**. Ask: “Animate a photo, add narration and captions.” Show the linked steps. Expand **Local AI & connections** and show the installed chat model when available. | “Start with what you want to make. The studio guide connects you to the right tools and explains the steps. Use guided matching, or connect LM Studio, Ollama or your own compatible model server.” |
| 0:25–0:40 | Library → Workflows. Choose a recipe. Show inputs, output, setup check and missing-model download links. | “Every recipe explains what you bring, what you get and which files you need. Connect your own ComfyUI and download the required models separately.” |
| 0:40–0:55 | Open the actual node graph. Select a node, inspect a setting and show the workflow download. | “The workflow is visible and editable. Inspect the real graph, adjust it, or download it for the native ComfyUI editor.” |
| 0:55–1:10 | Setup creation routes: existing ComfyUI, install guide, Comfy Cloud and Civitai. Briefly show each external preparation page. | “Run locally, prepare a graph for Comfy Cloud, or take an image prompt and model references to Civitai. Cloud sign-in, pricing and generation stay with the provider.” |
| 1:10–1:22 | Enable **Open weights only**. Show the catalog change and one local recipe. | “Prefer the reviewed open-weight workflows? This switch filters the choices and enforces the supported execution policy. A locked launch keeps that profile on.” |
| 1:22–1:43 | Actual assistant client: call `studio_workflows`, inspect a recipe, then show a saved generated image using `studio_preview`. Show the embedded panel only if this host renders it. | “The same studio also works through MCP. Claude or Codex can discover recipes, check setup, inspect graphs and work with saved jobs. Image and audio previews return through MCP. Compatible visual hosts can show the studio panel inside the conversation.” |
| 1:43–1:55 | Back to the website: show the connected film workspace, a real clip playing, a speech result, then GitHub. | “Bring the results into a film with narration and captions. The source, workflow guides and setup instructions are public. Your models and credentials stay out of the repository.” |

## Recording prompts

Studio guide: **“Animate a photo, add narration and captions.”**

MCP client: **“Use Frameforge to show its workflow library. Explain the image creation recipe and check its setup. Then show the preview of saved job 49439472-0c79-4d5e-93f1-e8b3edbd8828. Do not generate, install anything, change policy or inspect other files.”** This ID exists only on the development machine; use your own saved job ID after a fresh installation.

## Claims and fallbacks

- **Open weights only is not a universal “local only” or privacy switch.** It restricts reviewed execution routes; model licenses still apply. Existing imported media is not retroactively certified. The user-facing label is deliberately precise.
- Comfy Cloud uses an external workflow/import handoff. Civitai uses a prompt/model-reference brief, not a ComfyUI graph import. Do not show either as an integrated paid-run service.
- If your model server is unavailable, show **Guided catalog matching** and keep the narration conditional. Do not label a catalog answer as a local LLM response.
- MCP provides 17 tools with local creation enabled, not every website editor embedded in chat. Do not claim universal visual support in all Codex/Claude clients.
- Until a real client renders it successfully, show the actual MCP tool call and image result, followed by the full website. If you show the browser test host, label it **MCP panel development preview**.
- The concept art in the splash and recipe cards is original presentation artwork, not evidence of the named local workflow's output. Use real rendered results for the output shots.
- Check the film for black frames and play the video/audio before recording. A technical pass or poster does not prove motion or creative quality.

## Before recording

- [ ] Choose one coherent idea and cleared input media.
- [ ] Confirm the local assistant model, or use the guided-mode wording.
- [ ] Complete an actual target-client MCP connection and save its result.
- [ ] Verify embedded visual rendering separately from tool/image support.
- [ ] Preview the final video and speech; remove any black or failed samples.
- [ ] Record the eight shots, shorten waits explicitly and keep the final cut at 115 seconds.
- [ ] Review the challenge checklist before submitting; this script does not submit an entry.
