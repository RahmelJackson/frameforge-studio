# Review follow-up

This tracks the source and usability review of commit `24017e5`. The larger creative-quality goals remain in [REMAINING-CHECKLIST.md](REMAINING-CHECKLIST.md).

## Completed

- [x] Judge allowance: seven accepted runs per signed browser visitor, within the existing shared cap of 35. Reopening the invitation does not reset the browser's allowance.
- [x] One judge or studio generation at a time. Busy/offline checks and definite submission rejections do not consume a run. Accepted failures still count; uncertain submissions pause safely and reconcile by request ID.
- [x] Technical failure and verification-blocked states release the judge queue. Lost acknowledgements and restarts do not blindly resubmit work.
- [x] Visitor-owned history and result downloads. Correct invitations remain usable after failed-login flooding, and session duration follows invitation expiry.
- [x] LTX, FLUX 3, Klein, MiniMax, H3 and VFX are discoverable in the shared task catalog, finder, guide and plugin catalog. The guided matcher also recognizes their local graph packages.
- [x] Real generated result covers for local LTX/H3 video and the FLUX image edit. Local setup and package actions come before Cloud alternatives.
- [x] Open-weights mode retains only the exact reviewed local bonus graphs. Partner variants and edited/unreviewed graphs remain blocked by the server.
- [x] Smaller artwork, cached 480-pixel image thumbnails, lazy gallery loading, 24-card pagination, coalesced refreshes, compact job summaries and slower idle polling.
- [x] Studio guide lives in navigation and no longer floats over results, captions or footer controls. Narrow side navigation retains labels; phone navigation uses labelled horizontal links.
- [x] Home has a single main path: introduction, featured local results, starting material, Explore link and recent work. Live community feeds no longer load on Home.
- [x] Consistent page-title format, corrected repeated Explore breadcrumb, clearer local readiness wording, and the three narrow model tests recorded on Progress.
- [x] Judge page documents and showcases the three saved local model results, with matching graph/model lock downloads. The obsolete preview server is stopped; the documented judge port is 4329.
- [x] Source-only test runs explicitly skip optional Python integrations when their runtime is absent. Installed runtimes must pass those integrations. Source manifests are regenerated with release updates.

## Still to do

- [ ] Replace remaining machine-specific paths in advanced optional model/setup scripts with a shared configurable model root. The basic source-only UI, workflow discovery, export and setup guidance already work without those installations.
- [ ] Reproduce advanced optional pipelines on another configured computer. Source-only passing tests do not establish every GPU workflow's portability or creative quality.
- [ ] Continue the creative acceptance goals on Progress. These UI and reliability fixes do not close character consistency, swaps, difficult motion, lip realism or broader relighting quality.

The visitor allowance identifies a browser cookie, not a person. Another browser or cleared cookies can create a new visitor session; the shared cap still limits all accepted runs. The private invitation and judge ledger must never be published.


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

The judge route now uses the real studio pages with per-visitor data/process isolation, a visible seven-run bar and the existing global 35-run ledger / single-render gate. A separate full-site test session completed Kokoro narration, saved it, served playback and changed its allowance from seven to six. The live ledger was preserved at 35 available shared runs.

Image Canvas now supports native SAM 3.1 text, box and keep/exclude-point masks, brush/eraser refinement and PNG download. Three real selection runs and a browser-based Qwen edit were checked. Text/click masks selected the green knob; the box mask selected its outer ring, requiring review/touch-up. The Qwen edit changed the knob to blue and independently retained every outside-mask source pixel. SAM appeared through the running MCP catalog as well as the site. Fifteen broad quality goals remain open.

## Judge community viewer follow-up

The judge privacy filter now recognizes a Windows drive path only at a path boundary. It preserves HTTPS community images/video, attribution links and model-download URLs, while continuing to hide local file paths and machine endpoints. The prior pattern matched the final letter of HTTPS and broke these links. Regression checks cover both URL preservation and private-path filtering. The welcome banner uses the creator’s warmer wording.
