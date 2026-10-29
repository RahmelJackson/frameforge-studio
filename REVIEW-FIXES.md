## Quick installer and first-run acceptance · 0.8.11

The source now includes Windows Start/Stop files, a POSIX launcher for macOS/Linux and a Node quickstart command. A suitable installed Node is reused; otherwise the shell launcher fetches a version/checksum-pinned official runtime without administrator access or system PATH changes. Studio opens a new illustrated welcome flow with three setup paths and can run without ComfyUI, Python or weights for browsing and supported online graph preparation.

Optional media/vision setup runs only the whitelisted isolated CPU profile after an explicit download click. A pinned uv helper can fetch managed Python. Package setup keeps ComfyUI untouched, reports errors, allows one installer at a time and updates the running Studio’s media interpreter on success. Arbitrary commands/arguments and cross-origin setup requests are refused; hosted mode blocks these setup endpoints. Cloud and Civitai still handle their own sign-in and payments. No keys were introduced.

Actual Windows acceptance used a clean source copy and forced the private Node bootstrap. The official archive checksum passed. Its real in-app media installer downloaded private Python and the pinned packages, and uploads/check helpers became ready with the same server still running. An independent import check confirmed no Torch in that environment. No models, CUDA, ComfyUI installation or paid generation were involved. The first test caught a PowerShell module-discovery incompatibility; hashing and archive extraction now use built-in .NET APIs instead of those optional modules.

245 regression tests passed locally, including clean launch, foreign-port avoidance, owned-process stop, setup-action allowlisting and retry, source packaging and previous MCP compatibility. Existing local generation readiness was preserved. macOS/Linux scripts have reviewed platform pins and paths but need native acceptance; advanced GPU processor installation and provider account-side generation remain outside this claim.

## GitHub installation and integration audit · 0.8.10

The clean source download now starts with no personal configuration, model files, Python environments or optional storage folders. Tested an exact package copy in a different directory, selected another ComfyUI model folder containing spaces, and verified the choice persisted. The audit did not download weights or start paid generation.

Fixed developer-specific D: model paths in optional video, identity, style, speech and transcription tools. Portable model manifests now follow the user’s chosen model folder. Replaced the required Windows caption font with a system-font and Pillow fallback. Optional LatentSync installers no longer demand the original developer’s D: junction. The legacy engine launcher tolerates an absent private model-path YAML. Personal drive migration and saved research scripts are omitted from distribution.

Corrected old README navigation, release details, MCP entrypoint and assistant instructions. The full MCP server supports previous visual resource URLs including v11. ComfyUI installation instructions now start with Quick tools. Normal local ports remain defaults, with configurable Studio/engine connections.

Validation: **242 regression tests passed**, including the exact public-source clean-install test, selected-model-root checks, Python paths/fonts and MCP visual resource compatibility. In the public checkout without private runtimes, 213 tests passed and 29 optional media/runtime tests were skipped. A concurrent-test packaging race was also fixed by keeping temporary project files outside source. No new GPU render was needed for this portability change.

Remaining integration limits: Comfy Cloud and Civitai are external handoffs with account-side sign-in, availability, cost and execution. Custom App Mode URLs require actually publishing those apps in Cloud; exported JSON alone does not create one. The ComfyUI extension connects to a Studio on the same computer and transfers prepared graph snapshots; it does not synchronize arbitrary edits in both directions. Optional advanced Python processors remain Windows-focused, while the lightweight Node website and native graph export do not require those environments. The native MCP panel depends on client support and existing client processes may need a restart to load a plugin update. LoRA training remains planned.

## Consolidated workspaces · release 0.8.9

- [x] Website and native MCP panel share six destinations: Explore, Images, Video, Audio, Library and Advanced. Settings remains a utility action.
- [x] Films lives inside Video; Library contains Workflows, Creative recipes and Saved results. Existing project URLs and media stay available.
- [x] Advanced provides visual 3D, SAM & precision and LoRA training sections. Image selection and video tracking also have direct entries in their own workspaces.
- [x] Larger illustrated workspace openings, guided next steps and restrained, reduced-motion-aware animation. Native 3D recipes expose graph inspection/export and native controls rather than an unsupported generic Run form.
- [ ] LoRA training runner, dataset export/caption controls and held-out evaluation. Advanced → LoRA training shows this status and the currently available reference tools; it does not claim training is installed.

## Local 3D props enabled · release 0.8.8

The 66-node prop graph now starts with a bounded TRELLIS.2 preview: 1024 shape and texture resolution, 50,000 target faces, 256 remesh resolution and smaller normal/AO bakes. Original upstream bytes and provenance stay pinned. Pixal3D remains an editable alternative, with its own generation acceptance pending. Quick edits update both widget encodings used by current ComfyUI.

Local acceptance used ComfyUI 0.43.0, all seven checksum-verified files on D:, and the included product concept image. The first actual run took 36.24 seconds and produced a GLB with 34,403 vertices, 50,000 triangles, three embedded textures and one material. The native graph subsequently ran through ComfyUI's Run button and its 3D viewer displayed the textured prop. Fit to Viewer corrects an inherited wide camera. Unseen surfaces remain inferred; this is one working preview, not acceptance of all 3D workflows. The previous engine environment remains available as a fallback. Existing Wan video generation also passed on the updated engine.

# Review follow-up

This tracks the source and usability review of commit `24017e5`. The larger creative-quality goals remain in [REMAINING-CHECKLIST.md](REMAINING-CHECKLIST.md).

## Completed

- [x] LTX, FLUX 3, Klein, MiniMax, H3 and VFX are discoverable in the shared task catalog, finder, guide and plugin catalog. The guided matcher also recognizes their local graph packages.
- [x] Real generated result covers for local LTX/H3 video and the FLUX image edit. Local setup and package actions come before Cloud alternatives.
- [x] Open-weights mode retains only the exact reviewed local bonus graphs. Partner variants and edited/unreviewed graphs remain blocked by the server.
- [x] Smaller artwork, cached 480-pixel image thumbnails, lazy gallery loading, 24-card pagination, coalesced refreshes, compact job summaries and slower idle polling.
- [x] Studio guide lives in navigation and no longer floats over results, captions or footer controls. Narrow side navigation retains labels; phone navigation uses labelled horizontal links.
- [x] Home has a single main path: introduction, featured local results, starting material, Explore link and recent work. Live community feeds no longer load on Home.
- [x] Consistent page-title format, corrected repeated Explore breadcrumb, clearer local readiness wording, and the three narrow model tests recorded on Progress.
- [x] Source-only test runs explicitly skip optional Python integrations when their runtime is absent. Installed runtimes must pass those integrations. Source manifests are regenerated with release updates.

## Still to do

- [ ] Replace remaining machine-specific paths in advanced optional model/setup scripts with a shared configurable model root. The basic source-only UI, workflow discovery, export and setup guidance already work without those installations.
- [ ] Reproduce advanced optional pipelines on another configured computer. Source-only passing tests do not establish every GPU workflow's portability or creative quality.
- [ ] Continue the creative acceptance goals on Progress. These UI and reliability fixes do not close character consistency, swaps, difficult motion, lip realism or broader relighting quality.



## Navigation follow-up, October 27

- [x] One visible tool row for each image/video workspace. Saved images, Photo sets, Compare takes, Batch queue, References, Checks, story planning and video help remain reachable without a hidden second menu.
- [x] All 17 image tools remain available in Make, Change, Characters & references, and Labs groups. The common tools appear first; no Labs switch hides the rest.
- [x] Workspace introductions appear on the first visit and collapse on subsequent visits in that browser. About this workspace reopens them.
- [x] Navigation layout and the open-weights toggle live in Setup. Other pages show a profile badge when enabled. Narrow windows use a labelled Menu button while preserving the desktop preference.
- [x] Breadcrumbs, active tabs and URLs stay in sync when switching panels. Image drafts survive in-page tab changes.
- [x] Library → Workflows is the home for graph recipes and creative starting points. Explore links there; older Explore recipe links redirect there.
- [x] Internal links use forward arrows. Links to external providers keep their external-link arrow.
- [x] Result menus connect images to animation and references, videos to editing and films, and speech/transcripts to their existing next steps. Film links select the saved clip without adding it or generating anything automatically.

These changes organize the existing studio. They do not remove the Python requirement for local media inspection/finishing, replace the installed ComfyUI engine, or close the creative-quality acceptance goals.

## October 27 delivery


Image Canvas now supports native SAM 3.1 text, box and keep/exclude-point masks, brush/eraser refinement and PNG download. Three real selection runs and a browser-based Qwen edit were checked. Text/click masks selected the green knob; the box mask selected its outer ring, requiring review/touch-up. The Qwen edit changed the knob to blue and independently retained every outside-mask source pixel. SAM appeared through the running MCP catalog as well as the site. Fifteen broad quality goals remain open.

Acceptance for 0.8.9: all 238 project checks pass, including the actual bundled native MCP script and nested workspace switching. Browser checks cover the shared six-destination navigation, working Library recipes, Video sections and a labelled narrow-screen menu without horizontal overflow. No model download or generation was needed for this navigation update.
