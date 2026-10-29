## Fresh-download audit · release 0.8.10

- [x] Optional model paths resolve against the chosen ComfyUI model folder, rather than a developer-specific drive. This computer’s existing storage selection is preserved in ignored configuration.
- [x] Fresh-install storage checks tolerate optional folders that do not exist yet. Portable caption/font fallbacks replace a required Windows font.
- [x] Previous MCP visual-resource addresses remain compatible, including v11. Public setup instructions describe the current consolidated interface and full MCP server.
- [x] Developer-only drive migration and saved research scripts are excluded from the public source package. Private judge code and credentials remain excluded.
- [ ] Cloud/Civitai account-side generation and custom published App Mode links still require provider-side acceptance. No paid runs were started during this audit.
- [ ] Optional advanced Python installers remain Windows-focused; native ComfyUI graphs depend on the destination engine’s nodes, model terms and hardware.

## Consolidated workspaces · release 0.8.9

- [x] Website and native MCP panel share six destinations: Explore, Images, Video, Audio, Library and Advanced. Settings remains a utility action.
- [x] Films lives inside Video; Library contains Workflows, Creative recipes and Saved results. Existing project URLs and media stay available.
- [x] Advanced provides visual 3D, SAM & precision and LoRA training sections. Image selection and video tracking also have direct entries in their own workspaces.
- [x] Larger illustrated workspace openings, guided next steps and restrained, reduced-motion-aware animation. Native 3D recipes expose graph inspection/export and native controls rather than an unsupported generic Run form.
- [ ] LoRA training runner, dataset export/caption controls and held-out evaluation. Advanced → LoRA training shows this status and the currently available reference tools; it does not claim training is installed.

## Seamless ComfyUI tools & graph handoff · release 0.8.6

- [x] Compact Quick tools toolbar on the graph, with Video / Images / Audio choices, direct links to controls, Full Studio and one-click current-graph JSON export.
- [x] Per-workflow quick export beside its file/model check. The regular website downloads a graph + inputs + model-list package; the embedded Studio sends the graph and checked media to a separate native ComfyUI tab.
- [x] Direct handoff for the Library graph inspector and local LTX / FLUX / H3 sample workflows, preserving each selected sample/effect and original input.
- [x] Input checksum validation, unique filenames, native media-picker refresh, safe loader-path remapping and no automatic execution. Original graph tabs stay available.
- [x] Browser acceptance: a real 12-node Wan graph plus one image opened in a new ComfyUI tab without a missing-media warning. Current graph JSON export and regular website ZIP export also passed. No generation, paid call or model download used for this acceptance.

Limits: direct inputs are capped at 80 MiB each / 100 MiB total / 20 files. Graphs are capped at 4 MiB / 500 nodes. Larger handoffs use the existing package. Starter placeholders and missing custom nodes/models still need selection/setup. Prepared generation-stage graphs retain their Studio finalization caveats.

## Full Studio inside ComfyUI · release 0.8.5

- [x] Complete running Studio in a native ComfyUI sidebar entry: Home, Images, Video, Audio, Library, Guide, saved work and settings share the same local app and files.
- [x] Studio / Split / Graph modes, keyboard-resizable divider, responsive layout, persistent graph and embedded app while switching. The Frameforge launch sidebar folds away in Split so the graph has room.
- [x] Exact-origin loopback view and parent frame policy, with reconnect/reload guidance if Studio starts later. The regular website retains its anti-framing policy.
- [x] Existing image/video/audio output nodes open their imported results in the embedded editor instead of redirecting to a browser.
- [x] Actual ComfyUI browser acceptance: embedded workspace navigation, local engine/file readiness, Video sample upload and a real 3.96-second Kokoro narration created inside the Audio editor. No Cloud credits or model downloads used.

Both local apps must be running. External provider sign-in opens on that provider. Historical 0.8.5 used explicit file import; release 0.8.6 adds a separate-tab handoff above. Switching layout alone never replaces a workflow. Native file-chooser automation was unavailable for the cross-origin iframe; the upload route was exercised with the editor’s bundled sample.

## Guided workspace openings · release 0.8.4

- [x] Images, Video, Audio and Workflows open with an original-art introduction, three short starting steps, visual workflow suggestions and a Guide shortcut. Starting ideas can be collapsed while working.
- [x] Workspace introductions render with the initial page HTML. The old title no longer flashes before being replaced. Navigation uses a gentle 520 ms page fade without sliding or an experimental cross-document transition; in-page tool changes use one fade. Reduced-motion preferences remain respected.
- [x] One model inventory beside the workflow shows installed, missing and unchecked files, exact destinations, source/terms links and the download size. One button installs only that workflow’s missing files. Installed files and unrelated workflows are skipped.
- [x] The same inventory is available in Settings, the Library graph inspector, and the local LTX / FLUX / H3 workflow details. Completed downloads refresh the file check.
- [x] ComfyUI handoff nodes have wider controls, brief instructions, an Open Studio button and saved-result feedback. A real LoadImage → Frameforge output → Studio import round trip passed with bundled artwork and no generative model. The image, video and audio nodes are registered in the primary local engine.

Historical scope of 0.8.4: the full Studio opened separately. Release 0.8.5 above adds the complete embedded website. Creative-quality limits remain unchanged.

## Workspace guidance & setup · release 0.8.3

- [x] One expressive title and short creative brief in Images, Video, editing and Audio, with a compact original-art tile. Library, Story, Director and Timeline use the same title hierarchy.
- [x] Images → Video → Audio → Library order after Explore, in both navigation layouts. Native MCP workspaces use that same primary order.
- [x] Visible, per-workflow model/download strip beside the selected local model. File links and bulk missing-file downloads are available before source media or graph preparation. Storage and terms controls remain explicit.
- [x] First/last-frame mode checks the actual Wan Fun Inpaint graph's three model dependencies, rather than listing ordinary Wan generation weights.
- [x] Prominent Get set up action, choice of existing/install/Cloud/Civitai routes first, and a three-step introduction. Navigation preferences follow the essential connection/model steps.
- [x] Settings section bar measures the active navigation height, wraps on small screens, highlights the current section and keeps anchor targets clear of its sticky area.
- [x] Small workspace entrances, saved-result arrivals, hover/press feedback and progressive page transitions. Reduced-motion preferences disable these effects. No simulated generation progress is shown.

The larger editing-window, Library list/detail, full-canvas and live intermediate generation-preview work remains open. No new weights or paid generations were needed for this interface update.

## Compact visual opening · release 0.8.2

- [x] Combined cinematic hero, three actual local-result previews, Proof/Rough cut/MCP shortcuts and recipe access into one opening. Community now immediately follows it.
- [x] Accessible muted playback buttons and hover previews for the Home video tiles, with offscreen/background pausing and reduced-motion support. Product preview has a keyboard-accessible before/after slider.
- [x] Bundled official Inter Variable font and OFL license for offline typography; exact font files also served in the private deployment.
- [x] Fixed missing recipe symbols and expanded the film Library entry to a full-width banner. Native ComfyUI graphs and tool routes are retained.
- [ ] Larger editing-window, list/detail Library and full-canvas redesign from the design notes. This release focuses on Home and the small Library fixes above.
- [ ] Live intermediate ComfyUI render previews. The new Home clips are saved results, not live previews.

## Connected creative recipes · release 0.8.1

- [x] Picture-led creative recipes: performance takes, product campaign, reference video to Director plan, and saved-motion remix. Reach them through Video → Creative recipes, Library, the Guide and the native plugin.
- [x] Shared saved subjects, driving clips, fixed source checksums, frozen direction and explicit per-take seeds. Website and MCP use the same data.
- [x] Actual graph preparation and per-recipe workflow/input export; explicit sequential local variations, duplicate-request replay, take comparison and stop-remaining action. A two-image campaign completed serially and replay returned the same batch.
- [x] Original sample subject and motion inputs. Sample artwork is labelled; it is not evidence of successful generation.
- [x] Reference clip → three actual source frames → saved Director plan. Repeated frame extraction and Director creation reuse saved handoffs. Shot descriptions are supplied by the user; automatic vision analysis is not claimed.
- [x] FLUX protected Canvas edits: native crop → model → resize → masked composite graph, with an original-grid preservation check. A real 1536 × 1024 local edit passed every unmasked RGB pixel exactly, including the native graph's raw composite. All input files and model sources remain available. Visual seam quality still depends on selection and generation.
- [x] SAM boxes send a center keep-point; text defaults to a higher confidence threshold. A real box job passed mask-file checks. Its broad object selection still needed refinement; semantic accuracy and reliable absent-object rejection remain open.
- [x] Main image/video/audio controls use document scrolling, with picture-led starting points and no internal controls scrollbar.
- [x] MCP shared recipe discovery, capability readiness, saved subjects/motions/plans and opt-in production tools. Native plugin includes creative recipes and actual saved-take playback.
- [ ] Broader performance, motion-transfer and campaign creative acceptance. These connected flows do not close the parked identity, swap, motion or lighting quality goals.
- [ ] Optional vision-LLM analysis of reference clips, followed by user review. The current recipe extracts frames and uses your notes.

Next model work is tracked in [the model/workflow research plan](MODEL-WORKFLOW-PLAN.md). The organizer-question draft was left untouched. No engine upgrade, new model download or paid run was made in this release.

## Follow-up release 0.7.4

Validation: 218 public tests and 9 private recovery/gateway tests passed. Actual native ComfyUI MP4/WAV handoffs preserved file SHA-256 bytes and created My work records. A 7.375-second two-clip rough cut exported with a replay returning the same export. Browser Proof view on a saved masked edit measured 36,488 changed RGB pixels out of 589,824 (6.19%), and retained its original comparison after reopening. Technical checks do not approve creative quality.


- [x] Selected audio engine requirements: preset dialogue uses only Kokoro; Chatterbox/Turbo, small/large ASR and MuseTalk/LatentSync each have separate lists. Changing engine refreshes requirements. Dubbing requests a source language before listing a translation model.
- [x] Explicit per-workflow downloads with missing-file count and size. Other workflows are not downloaded.
- [x] Website Explore shortcuts for Civitai and Guide; native plugin Explore has a credited Civitai gallery, separate Library and LLM/guided workflow helper.
- [x] Canvas RGB changed-pixel Proof view and selection toolbar; image tools collapse to a selected-tool chip.
- [x] Saved-film Rough cut action builds the selected clips and exports a draft without new AI generation.
- [x] LTX/H3 hide Wan-only settings; grouped Library with film first; Settings section navigation.
- [x] Native ComfyUI IMAGE/VIDEO/AUDIO handoff nodes and imported-media records in My work.
- [x] Exact-result model/source details and native graph remix links where saved graphs exist.
- [x] Isolated CPU media/vision software check/install commands. Advanced GPU environments remain separate.

Still open: account-published custom Cloud App Mode links, automatic installation of all advanced GPU processors, the larger 3D/animation/music pipelines, and the fifteen parked creative-quality goals. No paid Cloud run or new model download was made in this follow-up.

# Workflow acceptance checklist

## Setup and MCP integration · release 0.7.0

- [x] LTX 2.5, FLUX 3 Image Klein and MiniMax H3 check, prepare, inspect, export and run through Studio/MCP. Three real local jobs passed technical checks and appear in the normal library; creative review remains pending.
- [x] Eight local starter graphs in the shared catalog, including the three additional reviewed provider adapters. Fixed preview profiles, explicit request IDs and one local render at a time.
- [x] Owner-only Download all missing queue, selected ComfyUI model folder, resumed transfers, disk checks and size/SHA-256 verification. Gated sources keep manual sign-in/agreement; processor environments remain separate.
- [x] Model lists shown before input uploads for image/video/audio tools, with additional processor lock metadata and manual setup notes where needed.
- [x] Per-assistant Copy setup buttons for Codex, Claude, LM Studio, Hermes and Antigravity, plus recent real MCP-request status.
- [x] Cloud/Civitai result drop zone, recorded as imported media in the local library.
- [x] Native ComfyUI image-output bridge: actual saved PNG imported into Studio with identical bytes. Video/audio bridge nodes added in 0.7.4.
- [ ] Custom Comfy Cloud App Mode share URLs published and tested in an authorized Cloud account.
- [ ] Complete automatic installation of every advanced processor and finish every advanced processor installation.

Read [the integration release guide](INTEGRATION-UPGRADE.md) for exact recipe IDs, tested profiles and remaining limits. The creative-quality goals below are unchanged.


## Suggested workflow coverage

Not every requested workflow is built. **Image-to-3D objects, editable 3D scenes and 3D camera handoffs are missing.** SAM image selection, Canvas masked edits/outpainting and local LTX/FLUX/H3 graph packages are present. See [the complete coverage audit](WORKSPACE-GUIDE.md#suggested-workflows-current-coverage) for available, partial and missing capabilities. The 15 quality goals below remain separate.

## Connected workspaces and Image Canvas · 2026-10-27

- [x] Five workspaces, one Studio guide, distinct Library outcomes and saved film/shot context.
- [x] Compact returning-visit headers, grouped tool cards, collapsed graph/run setup and remembered tools.
- [x] My work drawer for generated images, clips, audio and saved visual references, with compatible drag/drop handoffs.
- [x] Canvas paint/box selections, original-pixel protection, edge padding/handles, version comparison and prop/animation handoffs.
- [x] Real local Canvas edit and outpainting tests passed. Every unmasked pixel equals its input in both saved reports.
- [x] Image-tool-specific model download guidance works before uploading an input image.
- [x] Five selectable local LTX prompt packages; downloaded mist package inspected. Only original violet smoke has a tested video result.
- [ ] Native FLUX layout boxes in Canvas and additional compatible/custom model adapters.
- [ ] Region-only upscale/compositing and richer composited layers.
- [ ] 3D scene/prop tools and camera handoffs.
- [ ] Dedicated ad-builder UI, talking photos, background removal and generated music.
- [ ] Broader creative acceptance for generation quality and the new LTX variants. The 15 parked quality goals remain open.

Use [the workspace guide](WORKSPACE-GUIDE.md) for the complete interaction flow and verification limits.


## MCP and challenge preparation · 2026-10-24

- [x] Local STDIO MCP server: ten default read-only tools, ten opt-in creation/production tools, native previews and client configuration guides.
- [x] Open-weights toggle, locked launcher, filtered native graphs and server checks on execution/export; no paid submissions or automatic weight installs.
- [x] Real strict-profile MCP image render with request replay returning the same job, plus local Kokoro speech and a checked WAV handoff for film tracks.
- [x] Public source instructions distinguish app code, upstream templates and model terms.
- [x] Visual MCP Apps resource with matching studio branding, workspaces, recipe explanations, real setup/graph preparation and stale-input protection; local bridge and mobile checks completed.
- [x] Compare the official Cinematic Studio, Re-shoot, Openjutsu and visible Hub tasks against actual implementation; save exact missing pipelines in COMFY-HUB-COMPARISON.md.
- [ ] Native client acceptance of the visual panel in each targeted Codex/Claude product. The local bridge test is not a client certification.
- [ ] Clean second-machine reproduction of the chosen GPU/Python demo; actual model hash and dependency records.
- [ ] Record a ≤2-minute demonstration explaining the contribution; register, publish a tagged social link and submit the official form before October 30 at noon Eastern.
- [ ] Confirm the Open Weights Only interpretation with organizers for this mixed-provider repository plus locked local profile. Eligibility is not guaranteed by the toggle.

See [MCP setup](MCP-GUIDE.md), [profile scope](OPEN-WEIGHTS.md) and [the challenge checklist](CHALLENGE-CHECKLIST.md). The 15 parked creative quality goals below remain open.

## Easier setup and online generation · 2026-10-24

- [x] Four clear starting paths: existing ComfyUI, install locally, Comfy Cloud only and Civitai images.
- [x] Find running ComfyUI on common local ports; choose and save its address explicitly.
- [x] Prepare text-only Cloud image/video/speech graphs without a local engine, models or Python helpers.
- [x] Native model-download metadata in starter/prepared graphs, plus existing manual source/folder/hash guides.
- [x] Civitai external image brief with copy/download, original example/model references and provider-side cost review.
- [ ] Complete account-side Cloud imports/runs and Civitai generation; no paid generation was submitted for this update.
- [x] Check ComfyUI's missing-model guidance on an installation without weights: Z-Image import shows all three dependencies and individual/bulk download controls; no large file download was started.

The Civitai route is an external prompt handoff, not an in-studio API runner. Cloud node/model availability and provider prices are checked at the provider. The 15 creative quality research goals remain parked.

## Website and distribution update · 2026-10-24

- [x] Visual workspace covers and a lighter mobile presentation.
- [x] Studio guide with optional local LLM answers, real task links and catalog-based handoffs.
- [x] Read-only MCP workflow, ComfyUI queue and model-requirement tools.
- [x] Workflow-specific local setup check, model source links and install folders.
- [x] Clean source-package builder and fresh-install instructions; no bundled weights or personal media.
- [x] Choose GitHub destination RahmelJackson/frameforge-studio and MIT for original code; include the license and preserve third-party notices in the source package. The owner subsequently selected public visibility for the open-source submission.
- [x] Create the public GitHub repository with a purpose-led description.
- [x] Upload the reviewed source snapshot and verify the public README, files, MIT license and clean-clone startup. A fresh clone matches all 426 source hashes, repackages successfully and prepares a Cloud image graph with its local engine deliberately offline.

Suggested chains still require manual generation, review and media selection. The 15 creative quality research goals below retain their existing status.


Updated October 24, 2026: the priority is finishing one complete short film with saved projects, selected media, sound, captions and MP4 export. The 15 broad quality goals are parked as research; their failures and evidence remain recorded.

Research status: Parked

## Active film workflow

- [x] One project page for script, storyboard selections, clips, sound/captions and export.
- [x] Save the plan and reopen it without losing selected media or timeline edits.
- [x] Inspect stills/clips with manual review controls and checksum-bound approval gates. Demonstration creative approval remains pending.
- [x] Build a timeline and preserve matching trims, narration, music and captions.
- [x] Export a checked demonstration MP4 with picture, narration, music and subtitles.
- [x] Download the MP4, SRT captions and project notes.
- [x] Retain export request records and refuse duplicate starts after a controlled interruption; completed-request replay creates no new file.
- [x] Reopen the saved demonstration after restarting the website.

## Completed foundations

- [x] Seven main workspaces, with Library/workflows, generation/editing, Story/Director/Timeline and image references grouped together.
- [x] Purpose blurbs, per-tab hints, contextual connection help and a guided workflow chooser with real local/Cloud compatibility checks.
- [x] Saved-image → animation, selected-take → editing and Story ↔ Timeline project handoffs.
- [x] Civitai pictures requested by default, with source attribution, a hide control and clear fallback when media is blocked.


- [x] Explore tab: Civitai image/video discovery metadata, credited source links, shared prompts and model references; six guided local/Cloud recipes.
- [x] Charcoal/lime home with original artwork, continuous gallery motion, pause/offscreen/reduced-motion handling and more visual entry points.
- [ ] Direct external Civitai image/video playback acceptance in an unrestricted browser. This browser blocks its redirected media host; source links and picture fallbacks remain available.


- [x] Exclusive top or side navigation; full-height sidebar without reserved top-bar space.
- [x] Animated home with pause/reduced-motion controls, starting-material journeys, task finder, first-task guides and clearer input/output cards.

- [x] Visible unified Library for saved visuals, voice results, transcripts, uploads and film projects; category/search/review filters and exact-result handoffs.
- [x] Plain-language guides for all 14 starter workflows, with purpose, inputs/output, steps, examples and limits; prepared-tool and node explanations, plus guides inside exported packages.

- [x] Integrated workflow panels in Images, Generate video, Edit video and Voice & dialogue; graph inspection/editing, model/source downloads and local/Cloud choices.
- [x] Edited local workflow submission verified with a real Z-Image preview, retained prompt/graph edits and passing file checks.
- [x] External ComfyUI / Comfy Cloud handoffs with graph + source-file ZIPs, exact model links and import steps. Cloud credentials and paid runs are handled externally; this studio collects no Cloud keys. See COMFYUI-WORKSPACE.md for the remaining account/import and release checks.
- [x] Local image/video generation, saved jobs, recovery, downloads and manual review.
- [x] Image editing/masking/upscaling, reference packs, boards, shot sets and film assembly.
- [x] Local speech, transcription, narrow English-to-Spanish dubbing and experimental lip sync.
- [x] Saved music, ambience and sound-effect selection, preview and film/video handoffs.
- [x] Restrained neutral video exposure adjustment, with measured bounds and preservation checks.
- [x] Original face-reference crops with exact pixel/provenance checks and no-face/multiple-face rejection.
- [x] Optional original face crop in continuity runs, independent composition guide, frozen original pack.
- [x] Local FaceFusion research integration, region/occlusion masks, no enhancer, exact protection outside the outer mask, saved results and separate light finishing. Quality remains experimental.

- [x] Tracked material recolor with chosen fabric color, retained luminance/folds, zero-strength control and exact outside-mask pixels in a lossless master.
- [x] Native FILM 2x interpolation, original-frame restoration, retained duration/audio and detected-cut protection; tested on two portraits and a moving-object/cut fixture.

- [x] Automatic visible clothing parser, category/point controls, optional garment-tone separation and inspectable per-frame masks. Missed cuffs / edges remain open.
- [x] Lossless video-frame handoff, saved appearance keyframes and native VACE 14B option; first burgundy-leather video case passes narrowly.
- [x] RIFE alternative, fast-motion / occlusion fixture, saved risk measurement and optional original-frame holds.
- [x] Native PhotoMaker / SDXL identity experiment and alternate InSwapper / beard-boundary controls. These integrations run; their difficult visual cases remain open.
- [x] Scripted dialogue with assigned local voices, speaker names, per-line pace and measured pauses. Three real two-speaker scenes checked in English and Spanish.
- [x] Captioned or narration-only video exports, editable/splittable captions, SRT/WebVTT downloads, original/speech levels and optional sound ducking. Three saved video exports checked.
- [x] Recheck saved audio/video files without regenerating media; changed files are refused and prior sources remain bound by checksums.
- [x] Permanent “What's left” page with ready/open filters, search, next steps and downloadable checklist.

- [x] Local speech-to-speech voice conversion with source/target checks, retained timing and editor handoff; the first English preset-voice case preserves all script words and improves target-voice similarity.
- [x] Local expressive English speech with a target reference, seed, expressiveness and pacing guidance; saved settings and actual UI submission checked.
- [x] Automatic Spanish-to-English dubbing in addition to English-to-Spanish; a controlled 8 dB noisy two-voice transcription also retains every known word.
- [x] Subject-following portrait/square crop with lossless source-pixel checks and refusal when tracking is lost. Generated missing edges remain open.
- [x] Measured Wan 5B longer and larger profiles: 241 frames / 10.04 seconds at 768×432, and 49 frames / 2.04 seconds at 1024×576. These profiles are tested separately.
- [x] Experimental forward/backward continuation, reference-edge motion and sketch-animation controls, with original context preservation and retained visual failures.

- [x] Guided line-art animation from a sketch reference and driving outlines; upward balloon motion and articulated robot example checked.
- [x] Optional brief tracking-gap holds with unique appearance reacquisition within half a second; permanent loss and ambiguous duplicate subjects are refused.
- [x] Generated-border reframing prototype with the whole fitted original restored exactly in a lossless master. Visible sky seams and invented foreground structures remain quality failures.
- [x] Reference-conditioned expressive dialogue: separate clean references and delivery controls per speaker/line, measured pauses and verified script words.
- [x] User-assigned speaker names and local target voices for individual dubbed segments, saved settings and exact line placement. Automatic speaker identification is still open.
- [x] Faithful 2x resizing alongside AI enhancement, with original-based reconstruction checks and a measured detail comparison.
- [x] Experimental two-English-voice separation before transcription: anonymous 8 kHz previews/downloads and checksum-checked editor/transcript handoffs. Spanish and real-world overlap quality remain open.

- [x] Separate local LatentSync 1.6 lip-sync experiment on D:, with pinned source/weights, adapted face alignment, exact scene protection and a selectable method in Voice & dialogue.
- [x] New SyncNet timing diagnostic with deliberately shifted audio controls: the first fixed-source comparison improves estimated offset from −2 frames to 0 and confidence from 3.35 to 5.33. Adapted preprocessing and one synthetic frontal face do not establish broad phoneme/tooth realism.

- [x] Unified studio home, shared navigation across all eight workspaces and a desktop launcher; direct planner/library links and saved image handoffs checked.
- [x] About 115 GiB of models, runtimes, media, evidence and backups moved to D: with every file verified and existing paths retained. ComfyUI and Desktop model search/download paths configured; a real video preview passed after the move.
- [x] Experimental two-English-voice separation before transcription, with track previews/downloads and checked transcription/editor handoffs. Original source stays unchanged.
- [x] Exact previously failed English overlap repaired: both expected scripts recovered, with +9.42/+10.59 dB separation improvement against known clean sources.
- [x] Different English sentence arrangement submitted through the UI also recovers both scripts (+8.01/+8.74 dB). It uses the same preset voice pair.
- [x] Spanish comparison retained as a quality failure: separation worsens both tracks and ASR loses/leaks words. English preview limits stay visible; broad overlap remains open.
- [x] Sourced next-workflow comparisons recorded for human pose retargeting, lip sync, temporal restoration and still-first border expansion. LatentSync and still-first borders have since been implemented and compared; human retargeting and temporal restoration remain candidates.


- [x] User-marked covered-mouth intervals in lip sync, with edit-strength ramps and exact whole-original-frame holds. Twelve marked frames checked; automatic detection and natural hand occlusions remain open.
- [x] Small border padding, expanded still-guide generation and optional border-tone matching in Edit video. All fitted source pixels and the first selected guide are exact in the lossless master. Small-border color/temporal diagnostics improve; first transition, seams and invented scenery remain open.
- [x] Two filmed LatentSync examples checked: one head-movement sample has stronger timing, while the frontal sample remains inconclusive. Tooth/braces detail softens; broad lip realism stays open.

- [x] Editable body-skeleton guides and a pinned pose-specific model on D:. Standing, seated and raised-arm stills checked. Broad poses follow; likeness, hands, materials, jewelry and lighting remain open. Long PhotoMaker prompts now use a separate full-scene conditioning list; both pre-inference failures are preserved.
- [x] Prepared colored pose-video input for VACE. The first 29-frame human arm lift follows the authored guide, with unchanged input provenance. Hand framing, identity detail, real driving footage, occlusion and proportion retargeting remain open.
- [x] Optional mirrored horizontal camera conditioning, with original picture orientation restored. Two 49-frame scenes show the expected screen motion; knight scale drift improves. Broader geometry, unintended roll and substantial endpoint transitions remain open.
- [x] Tracked expanded-still borders for near-static scenes, without new diffusion. The same observatory's first border join improves 6.97 → 0.91 RGB levels; fitted source and first guide remain exact. Weak texture, large motion and substantial uncovered area are refused. Still seam/invented rock remain open.

- [x] Director production plans: shared scene notes, frozen continuity-pack snapshots, 24 ordered shot briefs, first-frame selection and draft recovery. Actual UI saving and composer handoff checked.
- [x] A searchable library of 18 original camera recipes with sources, explicit local acceptance status and three separately labelled short official examples/excerpts from Higgsfield, LTX and Wan. Saved shots freeze recipe wording/version.
- [x] Corrected camera semantics: native sideways translation is used for tracking; pure pans, tilts and optical zooms use prompt guidance. Complete briefs no longer receive a competing generic movement.
- [x] Exact-setting take matching, separate checksum-bound creative approval, metadata export and duplicate-free ordered film-project assembly. 90 regression tests/readiness pass. Two three-second previews pass file checks; scale/geometry remain open and neither take is automatically approved.

- [x] Original-anchored trained viewpoint controls in Image Studio: two character views, one compass and one greenhouse preview. Requested angles follow; pendant/markings and architecture still drift.
- [x] Point-selected SAM 3.1 video masks, keep/exclude controls, two checked previews including filmed hands crossing a shirt, and an original-source region-edit handoff. Inward edge softness is applied and independently reconstructed; protected pixels stay exact. A matching matte-fabric keyframe improves the low-motion cloth case; incompatible leather guidance is retained as a failure. General semantic material quality remains open.
- [x] Body-pose extraction from real footage, upper/full-body framing, uncertainty refusal and motion-guide handoff. One detected 37-frame guide and one appearance-conditioned video checked. Hands stay in frame, but placement and identity detail drift; full retargeting is open.
- [x] Local Turbo English speech and assigned dialogue with supported event tags, separately pinned weights and checked reference durations. Both generated scripts survive independent transcription exactly; acted delivery and voice realism need listening acceptance.
- [x] Optional larger multilingual transcription profile. Six matched/round-trip checks retained. It corrects dominant-speaker words but still loses overlapping speech; the colored-noise success matches the existing baseline. No speaker detection claim.

- [x] Explicit fast/full camera rendering in Generate and Director, saved settings and exact take matching. The full-sampling cathedral trial reduces scale drift but increases roll; it is a tested alternative, not an accepted geometry fix.
- [x] Optional target-body proportion fitting for detected guides, bound target references and independent per-frame reconstruction. The guide passes; its matched VACE video has larger wrist error, so broad motion transfer remains open.
- [x] A researched next approach and next proof for every one of the same 15 open goals. Two directional-light proposals plus original-detail transfer are saved prototypes; three joint-ASR controls fail to improve overlap/noise and are not promoted into the app.

- [x] Generate new subjects from every selected moodboard card, with 1–16 frozen references, equal weighting, style influence, saved settings and current-canvas handoff. Two boards and three unrelated subjects tested; normal download and video-reference handoff checked in the browser.
- [x] Explicit reference-subject removal with a matching local image/text encoder, separate strength and no-subtraction control. The matched paint teapot loses borrowed stars while keeping brushwork. Ten previews and 106 tests pass technical checks; muted palette, weak soft styles and exact subject details remain open. Models and evidence are on D:.

## Latest completed work

- [x] LTX 2.5 local atmospheric VFX test: 640 × 384, 121 frames, generated audio and no detected black frames. One tested profile; broader quality goals remain open.
- [x] FLUX 3 Image Klein local product edit: 1248 × 832 with the exact graph and pinned model links. Inspect scene preservation; this is a still-image workflow.
- [x] MiniMax H3 local image-to-video test: 640 × 384, 56 frames and generated audio. One tested profile; license and hardware requirements apply.

- [x] Public source release: https://github.com/RahmelJackson/frameforge-studio, with a Higgsfield-inspired project description, feature/setup tables, architecture overview, installation commands, honest limits and MIT/third-party notices. 147 tests and live readiness pass; fresh-clone startup and installation-free Cloud preparation pass. No models, personal media, local settings or previous development Git history were uploaded.

- [x] Four setup paths on Home and Setup: existing ComfyUI, new local installation, Comfy Cloud only and Civitai images; local engine discovery checks ports 8188 and 8000 without changing the saved connection.
- [x] Installation-free Cloud preparation: image, video and speech text-only graphs prepare without local ComfyUI, weights or Python. Browser download retains the typed prompt; reference-based and native recipes remain starter/import handoffs.
- [x] Civitai image handoff: shared Explore prompts and public model/source references carry into a copyable/downloadable brief. Model selection, sign-in, Buzz review and generation happen on Civitai; no direct API runner or paid job was used.
- [x] Native graph model-download metadata: all four native starters retain the same executable API graph while supplying known download URLs and model folders to compatible ComfyUI frontends. A separate empty-model CPU instance verifies Z-Image shows three missing dependencies, folders and Download/Download all controls through View details → Missing Models.
- [x] MIT license and GitHub destination selected: RahmelJackson/frameforge-studio, initially private. Root license/package metadata and third-party exceptions are included in clean source releases. Repository creation, upload and public publication remain separate steps.

- [x] Preview-led home with saved-work imagery, a prompt starter and fast image/video/voice/workflow entry points.
- [x] Remembered Side bar / Top bar navigation, retaining each page’s own tools.
- [x] Eight native video stage graphs with actual prepared footage/masks: upscale, interpolation, prompt edits, relight, motion, extension, outpaint and region edits. A downloaded interpolation graph ran successfully in local ComfyUI.

- [x] Portable ComfyUI workspace with 14 local/paid starter workflows, editable nodes and compatible connections, browser drafts and JSON downloads.
- [x] Model download links, target folders, immutable revisions and checksums; proprietary paid models use official Comfy Cloud template links instead of downloadable weights.
- [x] Native ComfyUI canvas import and API export round trip: all 12 Wan starter nodes and their inputs match. Placeholder media must be selected before generation.
- [x] Saved ComfyUI take graphs with original input/output previews and direct image/video evidence links. Unknown or derived weights are flagged for extra setup.
- [x] Fresh source-copy test: workflow catalog/editor and model links work without installed models, a local configuration file or a running engine. Paid account execution and final GitHub publication review remain pending; see COMFYUI-WORKSPACE.md.

- [x] Make a short film: one saved project for script, storyboard images/clip previews, selected clips and editor/export handoffs. Browser draft recovery, source checks and stale-save protection verified.
- [x] Existing-clip demonstration exported with three shots, original sound, narration, music, titles and captions: 212 frames / 8.833 seconds at 768×432 / 24 fps. MP4, SRT and project-note downloads checked. Creative approval is deliberately pending.
- [x] Persistent export request records, duplicate refusal and saved-project reopening after website restart. The launcher now waits for the website to be ready. The 15 quality goals are parked as research rather than active production tasks.

## Remaining creative acceptance

- [ ] **1. Character consistency:** same character across poses, clothing, lighting and shots. Original-face PhotoMaker and separate edge guidance tested at full size; difficult rear/rainy raised-arm pose and exact likeness still fail. Explicit body-skeleton conditioning now produces the requested broad standing/seated/raised poses; likeness, wardrobe details and lighting still drift, and the raised hand is clipped. The difficult rear/rainy case remains unresolved; body skeletons do not encode rear-facing orientation. Round twelve adds trained quarter/rear viewpoint controls anchored to the original. Broad view direction follows, but pendant shape and fine likeness need acceptance.
- [ ] **2. Location, prop and style:** reliable conditioning and accurate distinctive prop details. Existing exact-pixel placement still needs convincing edges and contact light. The trained compass view retains brass/green appearance but changes markings; the wide greenhouse view changes spatial details. Accurate hidden geometry is not recovered.
- [ ] **3. Face and whole-character swaps:** dependable likeness, beard/hair/occlusion boundaries and face/neck blending. HyperSwap and InSwapper plus extended lower-beard masks tested. Boundary improves, but full reference beard and convincing identity / neck blending still fail.
- [ ] **4. Generated sets/storyboards:** consistent identity, wardrobe, props and shot continuity across the set. A new three-pose set shows better broad body control, but inconsistent pants/jewelry/lighting and likeness remain. An original-anchored quarter/rear pair is retained; generated views remain proposals, not independent identity truth.
- [ ] **5. Moodboard conditioning:** reliable influence across the full board, without subject or layout contamination. All-card style generation and optional reference-subject feature subtraction now run locally, with frozen sources and exact mean/routing checks. Ten previews compare two boards on teapot, robot and bicycle. Lower influence alone still copied stars; matched BigG content subtraction removes that leak and retains paint texture. Paint colors weaken, soft 3D transfer is uneven, and exact wheel counts/colors/details drift. Broad dependable style quality remains open; the actual controls and repaired star case are checked off above.
- [ ] **6. Selective semantic video edits:** requested changes persist while surrounding scene remains intact. Automatic clothing selection and edited-keyframe + VACE 14B now pass the first low-motion burgundy-leather clip, with exact surrounding pixels. Prompt-only edit still fails; broader semantic changes, clothing edges and occlusions need acceptance. SAM 3.1 now tracks explicitly selected clothing, including filmed hands crossing a shirt. Checked source/range/crop-bound reuse and inward-only feathering preserve every unselected pixel. The controlled mask-only trial still looks leather-like with the old leather keyframe. A newly masked matte-woven guide improves that same low-motion video; broader material and occlusion acceptance remain open.
- [ ] **7. Broader relighting:** controlled direction/color, believable shadows, retained texture and temporal stability. Neutral brightness preservation is implemented; full lighting acceptance is open.
- [ ] **8. Reference-video motion transfer:** Reliable transfer of real human movement, with stable identity, proportions, hand framing and occlusion. stronger VACE 14B now follows the moving-box path (mean normalized position error 0.00392, maximum 0.01094) and a drawn robot raising an arm, with stable fixture backgrounds. A new prepared colored-pose video drives a human arm lift over 29 frames. It is an authored guide with a generated first still; the final hand leaves the frame. Real motion extraction, different-identity/proportion retargeting and occlusion remain open. Round twelve extracts actual filmed upper-body joints and uses one fixed fit across the clip. Its new 37-frame appearance video keeps hands visible, but wrist placement/timing and detail drift; body-proportion retargeting and reliable occlusion remain open.
- [ ] **9. Camera and transitions:** Predictable camera moves with stable geometry and coherent start/end transitions. up/down/left, clockwise/anticlockwise roll, static and 0.5/1.5 zoom-speed comparisons now show the expected movement. Faster zoom measures 2.84x cumulative scale versus 1.76x; static drift is about half a pixel. A new mirrored-input/opposite-direction/restored-output route improves the retained rightward knight case: apparent feature displacement −210 px with scale 0.996 versus −110 px / 0.920 previously. The second lunar scene also moves in the expected screen direction (−138 px), but scale drift and about 2–3° unintended roll remain. These are image diagnostics, not calibrated camera poses. Director testing exposed that the engine’s so-called pan/zoom poses are translations. Recipe mappings and composer labels are corrected. An aligned tracking brief reduces roll from 2.79° to 1.66° on the retained cathedral, but image scale changes by about 9.4% versus 0.45% in the baseline; this is mixed evidence, not a closed camera goal. A coherent near-static first/last-frame case passes narrowly; large viewpoint/action transitions remain open.
- [ ] **10. Video extension:** Continue a moving scene in either direction without a visible join or identity drift. VACE 14B forward/backward static-observatory previews remove the earlier unwanted object and preserve the dome in sampled frames/playback; original context remains exact in the master. Dependable continuity on moving subjects, changing cameras and more scenes remains open.
- [x] **11. Longer/higher-resolution profiles:** tested separately on this GPU: 768×432 / 241 frames / 10.04 s in 72.5 s, and 1024×576 / 49 frames / 2.04 s in 42.9 s. Sampled free GPU memory stayed above 7.8 / 8.7 GiB respectively. These are measured examples, not maximum GPU capacity or evidence for combined long+large generation; that combination is disabled.
- [ ] **12. Interpolation/upscale:** Smooth fast motion and restore detail without ghosting or invented texture. FILM/RIFE reconstruct held-out moving-box frames at 39.04/37.73 dB versus 25.68 dB for a simple blend. Faithful resize is now available and scores 31.36 dB against a known original; AI enhancement scores 28.83 dB and changes detail. Earlier fast-motion/occlusion edge errors remain; broader natural motion and faithful neural detail still need acceptance.
- [ ] **13. Reframing:** Follow and resize subjects with convincing missing edges and camera depth. portrait/square subject crops and a six-frame disappearance/reappearance case work, with exact source crops. Brief recovery requires a unique near-exact appearance match within half a second; long/ambiguous loss is refused. Generated borders preserve the whole fitted source exactly, but the first portrait expansion has a sky seam and invented foreground structure. Round ten adds 10% padding, an expanded first-still guide and border-tone matching. The combined small-landscape comparison reduces mean boundary jump 10.83 → 3.53 RGB and later temporal difference 2.23 → 1.29, with exact original pixels. A new tracked-still alternative reduces the first join 6.97 → 0.91 RGB and later border temporal difference 1.29 → 0.40 on the same near-static source, with exact fitted original pixels and first guide. Up to 158 outer pixels hold the initial still. Faint seam and invented rock remain; larger motion/parallax is unsupported. Broader recovery and convincing generated edges remain open.
- [x] **14. Sketch animation:** guided black-line balloon animation now rises clearly with stable outlines on white paper, using a still sketch reference plus driving outline video through VACE 14B. Median ink position rises 47 pixels at 512x288 preview size. A drawn robot arm also follows its guide. This closes controlled guided sketch motion; the separate prompt-only sketch mode still has the retained stationary/stray-ink failure.
- [ ] **15. Speech expression:** Natural expressive acting and distinct, consistent voices across speakers. reference-conditioned expressive dialogue now supports separate speakers, per-line expressiveness/pacing guidance, seed and explicit pauses. Both the benchmark conversation and real UI scene pass timing/reference checks; the benchmark retains every script word in independent ASR. Guaranteed emotion, natural acting and broader voice/language coverage remain open. Turbo event-tag synthesis and separate-reference dialogue now run locally; both scripts round-trip exactly. Event realism, acting range and speaker identity remain unapproved.
- [ ] **16. Lip sync:** Believable lips and teeth, accurate speech timing, profiles and objects covering the mouth. MuseTalk and new LatentSync 1.6 are selectable. The first same-source LatentSync comparison has more restrained mouth shapes and improves the adapted SyncNet estimate from −2 frames to 0 (confidence 3.35 → 5.33); ±8-frame audio-shift controls pass. Exact scene protection remains verified. A different small/turned face is refused before diffusion. Round ten adds two filmed examples: head-movement offset −1 → 0 (confidence 5.53 → 6.36), but fine tooth detail softens; the frontal sample has inconclusive low confidence. User-marked coverage preserves 12 whole original frames exactly in a textured-object composite, without automatic detection. The existing XSeg detector was rejected for clear-mouth false positives. Realistic teeth/lips, true phoneme alignment, profiles and natural hand/object occlusions remain open.
- [x] **17. Voice conversion:** dedicated local Chatterbox speech-to-speech workflow, checked source/target audio, bounded timing and video-editor handoff. The short English Heart-to-Michael preset case retains all words; target similarity rises from 0.521 to 0.789. English preview up to 20 seconds; broader voices, languages and recording conditions remain further acceptance work.
- [ ] **18. Transcription/dubbing:** Accurate words and speaker handling across noise, languages and overlapping speech before dubbing. English/Spanish works in both directions; named target voices can now be assigned per dubbed segment and are placed exactly. A deterministic 3 dB colored-noise two-voice script retains all words. The original mixed-audio ASR loses the second speaker and changes nine to night. New two-track separation repairs that controlled English fixture and a changed English arrangement, retaining every known word. A held-out Spanish mixture gets worse and fails word recovery. Automatic speaker identification, dependable real/multilingual overlap, broader real noise and additional languages remain open. A larger Whisper profile corrects dominant-speaker words in English/Spanish mixtures but still omits the overlapping speaker. The matched Spanish combined-script word error changes from 53.3% to 46.7%, still a failure. Colored-noise transcription matches the prior all-words success.
- [x] **19. Music/SFX selection:** integrated saved soundtrack/effect library and editor exports. Neural music/SFX generation remains a separate optional addition.

## Resolution plan

These are the same fifteen open goals. The proof below is the next bounded test toward each original requirement; passing it does not erase the broader criterion or prior failures. Proposed tools are not installed unless their result is recorded. Research, sources and limitations are in WORKFLOW-SOLUTIONS-ROUND13.md.

| Goal | Current state | Next approach | Next proof |
| --- | --- | --- | --- |
| 1 | Needs approved reference set | Build a multi-view character sheet, then train a dedicated identity LoRA in an isolated trainer. Keep original and deliberately approved views separate from inferred views. | Hold out rear/rainy and raised-arm shots from training; compare face, hair, wardrobe and pendant against approved originals. |
| 2 | Needs exact asset geometry | Use original prop textures and a fixed 3D prop/location or composited original plates for exact markings. Use generation for scene dressing around those assets. | Preserve compass markings in three planned views, with believable edges and contact light; match greenhouse landmarks across shots. |
| 3 | Needs a different swap pipeline | Keep face identity replacement separate from a tracked donor head, hair and beard matte; match pose and light before blending. | Compare the same ginger-beard case plus profile and crossing-hand footage; inspect beard silhouette, neck seam and foreground order. |
| 4 | Needs approved shot anchors | Assemble approved character, wardrobe, location and prop plates; generate each storyboard frame from that shared pack and approve stills before animation. | A six-shot sequence keeps the same face, pants, pendant, compass markings and location layout; reject drifting frames before video. |
| 5 | Built; paint leakage improved, soft styles partial | Use the new all-card style workflow and explicit reference-subject subtraction. The same-encoder control retains stars; subtraction removes them. Lowering ordinary influence did not solve the leak. | Retain palette/brushwork on three unrelated subjects without copied objects/layout; soft-style transfer remains weak. Compare another seed and held-out texture board while preserving requested counts/colors. |
| 6 | Broader cases needed | Continue checked SAM selection plus a compatible edited still and temporal VACE guidance. Use a mask that explicitly protects crossing hands and cuffs. | Re-run cloth versus leather and a filmed crossing-hand garment edit; semantic change persists and all protected pixels remain exact. |
| 7 | Prototype shows a narrower repair | Dedicated IC-Light proposals plus bounded illumination-only transfer onto original pixels. Raw proposals changed face/color; keep them as rejected direct edits. | Opposed-light previews retain original face, teal fabric and fine texture; then test cast shadows/materials before temporal use. |
| 8 | Guide works; video trial regresses | The target-proportion guide reconstructs exactly, but VACE follows it worse in this matched test. Next test an animation-specific retargeting pipeline such as Wan-Animate with its required preprocessing. | Mean detected wrist error rises from 0.079 to 0.194; do not promote this candidate. A new route must improve joint timing/placement while retaining identity and foreground order. |
| 9 | New full-sampling trial is mixed | Compare official full sampling without the acceleration LoRA. For exact rigid trajectories, use an authored 3D scene/camera rather than expecting a prompt to calibrate geometry. | Same-seed cathedral: scale drift improves but roll worsens; do not promote it. A rigid-camera route must retain geometry, horizon and intended parallax in two scenes. |
| 10 | Next moving-boundary test | Add an explicit future pose/edge trajectory and boundary velocity checks to the existing multi-frame VACE context. Plain overlap is already implemented. | Extend the same moving subject both directions; position, speed, appearance and camera motion remain continuous across the join. |
| 12 | Next temporal restoration test | Compare SeedVR2 temporal restoration with faithful resizing and existing FILM/RIFE; keep original-frame recovery and cut protection. | Natural fast hands, thin moving objects and an occlusion reveal: held-out detail improves without double edges, invented texture or lost timing. |
| 13 | Needs background geometry | Use a wider background plate with explicit depth layers or a 3D scene and tracked camera. Generate missing scenery once, then validate it before tracking. | Portrait expansion through meaningful lateral motion has correct depth/parallax and no sky seam; keep fitted original pixels exact. |
| 15 | Needs listening comparison | Test Qwen3-TTS instructed preset voices as a separate acting route; freeze each chosen voice across a dialogue scene. | Same text and voice under neutral, urgent and relieved delivery in English/Spanish; listen for acting, stable timbre and artifacts, then check words. |
| 16 | Next foreground-aware composition | Keep lip generation limited to a clear visible mouth, protect tracked foreground hands/objects in the final composite, and align phonemes separately. | Natural hand crossing, profile and exposed teeth: correct foreground order, no popping/false holds and timing checks corroborated by playback. |
| 18 | New joint-ASR pilot failed overlap | VibeVoice joint speaker/text transcription tested on the original Spanish mix; it still drops the second speaker. Prefer separate actor stems when recording; legacy mixtures need a targeted multilingual extraction test before dubbing. | Recover both speaker scripts and their overlapping time ranges without supplying answer text; then assign target voices and review the dubbed mix. |

## Next implementation order

1. Open Make a short film and resume the saved demonstration or create a named project.
2. Save a script and choose existing images/clips. Watch and manually approve suitable media.
3. Build the timeline, trim in the editor, add narration/music and captions, then save the edit.
4. Export and watch the complete film. Download the MP4 and subtitles; keep the project notes and recovery backup.
5. Keep the 15 experimental quality goals parked. Revisit one only with an explicitly chosen different approach and a bounded comparison.

Evidence: STYLE-BOARD-WORKFLOWS.md, ACCEPTANCE-STYLE-BOARD.md and evidence/style-board/ record the newest controls, ten previews and their limits. WORKFLOW-SOLUTIONS-ROUND13.md, ACCEPTANCE-ROUND13.md and evidence/round13-* preserve the previous resolution plan and comparisons. Round twelve records remain available in ACCEPTANCE-ROUND12.md and ROUND12-WORKFLOWS.md. Earlier failures and DIRECTOR-WORKFLOWS.md remain retained. There are 15 unresolved quality goals parked as research: eight video/speech goals and seven image/character goals. Working tools and narrow successes are listed separately; no take is automatically creatively approved.

## Latest completed work

- [x] Shared Images/Video/Audio workbench with independently scrolling settings and a pinned main action; desktop preview remains alongside it.
- [x] Wrapped image tool groups, compact single descriptions and header padding; SAM masks excluded from recent image results.
- [x] One main Video tab row, Takes & clip tools beside the preview, and four working Audio tabs.
- [x] Real saved-audio waveform, clickable transcript timing and eight recent audio/transcript cards titled by first words.
- [x] Library expanded to 42 distinct task cards, including 20 previously unlisted tools and five existing local alternatives to Cloud-only task choices. Shared guide/MCP task discovery updated.
- [x] Explicit Wan / LTX / H3 / Cloud selector on Video. LTX/H3 now prepare and run their fixed local profiles inside Studio, with native graph export retained.
- [x] SAM 3.1 image selection by text, keep/exclude clicks and box, with a lossless PNG mask, native graph export and shared catalog/setup/MCP discovery.
- [x] Canvas brush and eraser refinement before applying the mask to a protected Qwen edit.
SAM object/edge acceptance remains open: text and clicks selected the product knob; the box case selected its outer ring and needs refinement. Missing-object false positives remain possible. The 15 broader creative-quality goals remain open.

## ComfyUI Quick and suggested workflows, 0.8.7

- [x] Quick is the default tool view inside ComfyUI, with Full Studio on the same page and preserved inputs. Alt+Shift+F opens the chooser from the graph or embedded workspace.
- [x] Real Quick forms, upload, generation, model downloads and Controls / Result views. Preparing a supported local graph copies its inputs into a separate native tab. Native graph edits are not synchronized back into Studio.
- [x] Thirty pinned native workflow choices: TRELLIS.2/Pixal3D prop and multiview generation; MoGe perspective/panorama meshes; BiRefNet cutouts; ACE-Step 1.5 music; Wan S2V talking photo; H3 text, keyframes, references, multiframe timeline and Union control; FLUX 3 creation and reference/layout editing; LTX Ingredients, drawn tracks, Union, outpainting, text-to-audio, native shot controls, generic V2V and Refine Details, plus Alpha, Clean Plate, night, water, colorization, decompression, deblur and Restore adapter variants. Each has exact model sources, hashes, sizes and terms. These are native-editor integrations, with generation acceptance still pending for the new profiles.
- [x] Updated this computer to ComfyUI 0.43.0 in a separate environment, retaining the previous source/runtime as a fallback. All required prop nodes and seven checksum-verified model files are available on D:. TRELLIS.2 generated a textured GLB in 36.24 seconds; the full native graph and orbitable viewer also passed. The default prop profile now uses 1024 geometry/texture and 50,000 faces. This verifies one prop preview, not the other new profiles or exact hidden geometry.
- [ ] Generate and inspect held-out results for those new profiles after installing their required models/custom nodes. Do not treat graph availability as quality acceptance. The large upstream LTX BF16 graphs are distinct from the existing bounded 4090 preview.
- [ ] Layout to Render: official guide names a dedicated two-stage graph, but that graph was absent from the pinned public repository. Do not substitute the generic V2V graph. HDR and pixel upscaler need their exact stacks and acceptance too.
- [ ] An in-Studio 3D asset viewer/scene editor with camera-path previews. Native ComfyUI already provides its own 3D preview for the new prop/mesh graphs.
- [ ] Isolated AI Toolkit LoRA training, dataset/caption controls, held-out evaluation and safe GPU scheduling. No trainer or large model download started automatically.
- [ ] LTX 2.3-only Dub-It, sun relighting and Foley; FastH3; integrated region upscale and training presets. Existing alternatives and quality goals retain their prior status.

Acceptance for 0.8.7: an actual two-second Wan shot and a 4.04-second Kokoro narration were created entirely from Quick in ComfyUI. The shot graph and image input appeared in a separate native tab. Full / Quick switching preserved the current prompt; Alt+Shift+F worked from both the canvas and the embedded workspace. The native 3D graph opened 66 nodes, with its missing models and newer-core requirements visible. No new model weights or paid generations were downloaded/run for this acceptance. All 236 project checks passed.

## Working local 3D props, 0.8.8

- [x] The prop graph starts with the tested TRELLIS.2 preview settings, while preserving the pinned upstream graph and offering Pixal3D as an editable alternative.
- [x] Native Quick controls update both named and positional widget values so a changed setting survives import into ComfyUI.
- [x] A real GLB contains 50,000 triangles, 34,403 vertices and three embedded textures. ComfyUI's native viewer displays it; use Fit to Viewer if an inherited camera frames it too widely.
- [ ] Test Pixal3D, multiview props, scene meshes and the remaining native profiles separately. A working single-image prop does not recover its unseen surfaces accurately.
