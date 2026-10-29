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
