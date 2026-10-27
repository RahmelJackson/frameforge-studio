# Find a workflow and follow it through the studio

Updated October 27, 2026. The main navigation has five destinations. Top bar and Side bar remain mutually exclusive, and both expose the navigation switch, Local only control and My work link.

| Workspace | Purpose | Start here |
| --- | --- | --- |
| Home | Start and discover inspiration | Describe an idea in the guide box, use a quick start or browse community examples. Saved results are available in My work and the saved library. |
| Library | Different tasks and their model options | Choose a task, compare model/run-location options, inspect the exact graph and get setup/downloads. My work is the separate saved-results view. |
| Images | Stills, a selective-edit Canvas and reference organization | Create & edit, Canvas, saved images, moodboards, characters, photo sets and scene references. |
| Video | Clips and film projects | Generate, Edit & finish, Story, Director and Timeline. A secondary row holds the current page's clip utilities. |
| Audio | Voice, words and dialogue | Speech, transcription, translation, dubbing and lip sync with the actual source material. |

## One Studio guide

Studio guide, Ctrl+K, the Home idea box and Help me choose buttons all open the same non-modal side panel.

- Typing searches supported tasks immediately. No model or generation is needed.
- Enter asks for a suggested plan. Guided matching works without an LLM; choose a connected local model under Answer with for conversational planning.
- With an empty question, starting-material chips and task choices suggest a compatible route for Studio, your ComfyUI editor or an external provider.
- The plan remains open when following a tool link. Close the panel to reclaim its space. The plan is kept in this browser tab's session and Clear plan removes it.
- Model-server and agent connection settings live in Setup. The guide only suggests routes; it does not run media jobs, download models or spend credits.

## Controls, preview and saved work

After a workspace's first visit its introduction collapses. Workflow export and run-location controls now live in a closed disclosure, so the tool and preview appear first. Images, video editing and audio use grouped tool cards; the underlying selectors and all existing tool IDs remain available. The last chosen tool is remembered, with explicit task links taking precedence. Image seed is under More settings.

The preview stays alongside settings on desktop. Images has a recent-results strip; click a still to inspect it or drag it into a source/reference input. Ctrl+Enter (Cmd+Enter on macOS) submits the visible creation form through its existing validation and single-render gate. It does not submit while typing in the guide or My work. The page header mirrors active processing status.

My work opens a non-modal drawer from every workspace. Search generated images, clips, audio and saved moodboard/character references. Use here loads compatible input; it does not generate. Dragging a saved clip into Timeline adds an unsaved shot through the existing editor. Story also accepts checked stills and clips as new draft frames. Save the film plan or timeline explicitly. The complete saved library remains available separately.

Dropping a computer file on Images, Generate, Edit or Audio uses the existing image, footage or WAV upload handler. On Images, dropping onto Additional reference loads a reference rather than replacing the scene. No upload is sent to an external provider.

Image readiness beside Generate links to that tool's actual model/node requirements. These checks work without an input image, including for Masked edit and Real-ESRGAN. Downloads remain explicit source links; model weights are never packaged with the source.

## Image Canvas

Open Images → Canvas. Upload an image, choose My work, or send a generated still using Open in Canvas.

1. Paint a region, drag a box, or enter selection coordinates. Undo selection removes the last stroke/box; Clear removes the selection.
2. Describe an edit, object removal or regional lighting change. The compatible integrated model is Qwen Image Edit. A box is converted to a mask, not presented as FLUX native layout conditioning.
3. Generate using the existing masked ComfyUI graph. The studio restores original pixels outside the mask, saves a new PNG and checks that protection. Compare original toggles the input; the version strip lets you return to earlier saved images. These are saved versions, not Photoshop-style composited layers.
4. To outpaint, drag an edge handle outward or enter edge padding under Extend the image edges. Prepare new edges pads a new source and selects only its borders. Describe the continuation and generate. The four-megapixel input limit includes the new space.
5. Place an original prop opens the existing four-corner placement tool with the current scene. Animate sends the chosen still to Video without generating automatically. Inspect / export prepares the exact local graph and input/mask package.

Two real local tests on October 27 passed the source-pixel preservation checks: a 768 × 768 boxed compass-lid edit and a 896 × 768 edge extension. These examples establish working integration, not general quality acceptance for object removal, lighting or every image.

## LTX effects

Library → Create an atmospheric VFX shot contains an LTX effects selector. The five run packages retain the same local model graph, dimensions, frame count and audio settings, and change only the positive prompt. Violet smoke has the existing saved result. Embers, mist, doorway light and rain are prepared prompt variations, not independently accepted outputs. Download the selected package, import its graph and image in native ComfyUI and run there. No paid Cloud request is submitted.

## Video project handoffs

The five main steps are always in the same order: Generate, Edit & finish, Story, Director and Timeline. Saved clips, Compare takes, Make variations, References, Checks and other creation utilities are below them on Generate. Edit & finish exposes its own edited clips and narrated storyboard. Existing deep links and panel controls remain supported.

Opening a saved film shows its name, working storyboard shot and next incomplete stage in the project bar. Selecting a working shot carries that context into the main steps. Single clip mode leaves the film context.

In Story, save plan edits before following Generate this shot. The generation tool loads the saved shot notes. If those notes are empty, it can reuse the selected take's original prompt and available image reference. It does not fabricate a brief or start a render. Review the controls before generating.

After selecting a checked clip, Use selected clip for this shot saves only that frame's take selection. The existing saved-story signature rejects stale updates from another tab. Media approval and assembled-film review remain separate; selecting a take does not approve it or rebuild the timeline automatically.

Director still has a separate production plan. Its approved-take assembly creates a film; grouping the views does not silently merge unrelated plans.

## Home and inspiration

Home is ordered as Start, local model examples and Inspiration. The short getting-started explanation appears on the first visit and can be dismissed. Saved results live in My work and the saved library rather than a second recent-work section on Home. Home does not fetch the personal job, audio or project lists on load.

The full Civitai browser includes image/video and sort filters, shared prompts, creator/model links and prompt handoffs into the guide or a tool. It requests community metadata when the section enters view. Local only disables the external feed. Remote pictures and playback depend on the source and the browser's independent media policy; source links remain available.

Old /explore links redirect to Home's inspiration section and preserve filter parameters. Old studio-recipe links redirect to Library. Home's original artwork and motion remain separate from community work and from saved model test results.

## Verification scope

Source tests cover distinct workflow grouping, legacy redirects, five-step navigation, valid project/shot context, non-mutating take selection, saved-story persistence and stale-tab rejection. Browser checks cover instant guide search, guided planning without inference, a plan surviving a tool handoff, the inspiration browser and a saved shot brief opening in Generate. No new paid Cloud run or creative-quality acceptance is implied by these interface checks.

## Remaining work from the workspace proposal

- [x] Five workspaces, one guide, grouped Library tasks and a film project bar.
- [x] Judge failure/busy handling, 7 runs per visitor, 35 shared and one active render, covered by isolated queue tests.
- [x] Compact returning-visit headers, grouped tool cards and collapsed workflow setup.
- [x] My work drawer, recent stills, compatible media handoffs and keyboard submit.
- [x] Canvas paint/box masks, source protection, edge extension, versions/comparison and prop/animation handoffs.
- [x] Tool-specific image setup/download guidance before uploading an input.
- [x] Five selectable LTX prompt packages, with only the original smoke sample claimed as tested.
- [ ] Native FLUX layout boxes integrated into Canvas, additional compatible model adapters and custom model selection. FLUX's existing native workflow remains available in Library.
- [ ] Region-only upscale/compositing and richer composited layer editing. Full-image Real-ESRGAN upscale remains available.
- [ ] 3D scene editing, generated 3D props and 3D camera handoffs.
- [ ] A dedicated guided ad-builder UI, talking-photo workflow, background-removal model setup and integrated music generation.
- [ ] Broader visual-quality acceptance of the existing generation tools. The separate parked quality goals remain open.

## Judge studio and SAM image selection

The protected judge link now serves the actual studio pages, with an allowance bar. Every signed browser visitor receives seven runs within the existing shared 35-run cap. Personal results and saved projects are isolated per visitor; only model files and the creator’s local GPU engine are shared. Waiting/offline requests do not spend a run. Accepted or uncertain submissions keep a slot, and a global reservation allows one media run at a time. Cloud handoffs use the visitor’s own external account. Hosted machine settings, bulk jobs and modified graph execution remain unavailable. See scripts/judge-demo/README.md for limits and deployment.

In Images → Canvas, open a still and expand Select an object · SAM 3.1. Name a visible object, use Keep / Exclude point, or draw a Box and choose Refine last box. SAM creates a saved, lossless PNG mask using the native ComfyUI checkpoint. Inspect the overlay; Paint adds and Erase removes. Generate selected edit then runs Qwen with that mask and restores unselected original pixels. The mask operation and image edit are two separate renders. Setup lists the one SAM checkpoint; Library, Studio guide and MCP discover the same workflow.

October 27 local acceptance: text and point prompts selected the visible green product knob. A box around it returned its outer ring instead of its full surface, so box masks still need manual review/touch-up. Selection file checks reject empty/full-frame masks and confirm source dimensions; they do not establish object correctness. The native text, point and box graphs retain inputs through editable-canvas/API export. The current native text detector can also return a false match for an absent object; never treat a description as an automatic semantic approval.

### Follow-up proposals from the October 27 review

Completed: full-site judge sessions, visible allowance, SAM image selection and editable PNG masks. Already present: still outpainting, image-version comparison, local model download metadata and the LTX effect-prompt pack. Broader remaining proposals include four-path onboarding, external Cloud App Mode publishing and result import, action buttons on errors, larger accessibility text, Wan 14B / Animate, SeedVR2, generated Foley/music, training and 3D/depth guides. These remain follow-up work, not additional quality goals checked off. Wan dimension recommendations and any model/license claims need source-specific validation before changing existing measured profiles. The 15 broad creative-quality goals remain open.

The SAM → Canvas → Qwen handoff was also run through the browser: the knob changed to cobalt blue, the final image retained its original 1280 × 853 grid, and the independent report confirmed every pixel outside the selected mask equals the original. This is narrow product-edit evidence, not broad segmentation or semantic-edit acceptance.
