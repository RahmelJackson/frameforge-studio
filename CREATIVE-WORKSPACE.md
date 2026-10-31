# A connected creative workspace

Open **Images → Creative canvas**, or `/creator`. This is one shared local workspace across the browser, ComfyUI's Quick/Full Studio and the assistant tools. Saving a board or character makes it available to those interfaces; simultaneous edits use revision checks.

## Canvas and 3D

Add saved images/clips, upload media, or import a self-contained GLB. Drag a card by its title, resize its corner, pan empty space and use Ctrl/Cmd + wheel to zoom. Arrow keys move a selected card. Fit cards and Focus canvas help on smaller screens.

An imported 3D prop has an offline PBR viewer, orbit controls, front/side views and a saved camera pose. Capture view makes an image from the actual model. Record orbit makes a three-second WebM of the viewport, reusable in editing and film tools. It is a viewer and camera capture, not a multi-object scene editor or a camera-conditioned AI render.

GLBs must embed their resources and use supported, uncompressed geometry/textures. Local uploads are capped at 80 MiB. A 100-card board is the current limit. Removing a card does not delete its original media. Suggest next links a compatible saved input to another tool; this is deterministic routing, not automatic visual analysis or automatic generation.

## Timed story formats

Choose fruit romance, an explainer, a small narrative or a product story. Pick 15, 30 or 60 seconds, an aspect and optionally a saved character. The original format creates timed, editable beats with repeated cast/context and an approximate narration budget. Longer beats are split into parts of ten seconds or less.

Open as a film project preserves each beat's target and the character's reference image. Repeating that action opens the same project. Review prompts, generate or select clips, add sound/captions, then assemble. A clip shorter than its planned beat cannot silently complete the timeline. Planning alone does not generate a film or guarantee identity consistency.

## Effects, transitions and loops

Choose actual saved clips and trim their ranges before making a version. Golden hour, Silver screen and Soft glow are CPU finishing effects. Dissolve, dip to black and wipe combine two clips and retain source audio. Looping exports silent MP4 and GIF, using either ping-pong motion or a cross-blended wrap. These are editing operations, not generative transitions. Compare the original and the saved result before using it.

One finishing export runs at a time. Each source range is 0.25–6 seconds locally. A request ID prevents an uncertain retry from starting the same export twice. Media tools require the isolated CPU media environment; no new generative weights are required. Loop diagnostics describe frame differences and do not certify seamless motion.

The Library also includes Comfy's **Animate Diff High Res Loops** native graph. Its custom nodes and several manual model sources need setup and an actual render check. It is excluded from the reviewed Open weights profile until dependencies and terms are resolved. A graph import is not generation evidence.

## Reusable cast and training preparation

Save a name, trigger, notes, reference captions and a separate held-out set. Reuse a character in images, animation, recipes, a canvas or a timed story before training anything.

Training export requires rights confirmation, at least five training images and one distinct held-out image, captions containing the trigger, and no byte-identical duplicate files. The ZIP includes images, captions, hashes, separate train/holdout folders and a starting **FLUX.1-dev / Ostris AI Toolkit** configuration. Synthetic acceptance fixtures only tested packaging; they are not a recommended training dataset.

**Frameforge does not install or run that trainer yet.** Install AI Toolkit separately, accept its base-model terms, review GPU settings and set the extracted dataset path. Training and held-out likeness/overfitting evaluation remain separate work. A FLUX.1 LoRA is not automatically compatible with FLUX 3, Qwen, Z-Image or video models.

## Editable timeline handoff

Save a film in Timeline, then choose Export editable timeline. The ZIP includes original clips, trims, order, cross-dissolve handles, separate WAV tracks, subtitles and an OpenTimelineIO file. Keep its media folder beside the timeline. Titles, overlays and some mixing settings are metadata or separate files, with explicit warnings; use a rendered MP4 as a reference. This has not been round-trip tested in Resolve or another professional editor.

## Assistant access

`studio_creator_library` reads the same catalog and saved boards/cast/stories. With writes enabled, `studio_creator` saves boards and characters, prepares stories, opens their film projects, exports datasets/timelines, suggests compatible steps and explicitly finishes clips. The native panel provides shared production controls; the specialized 3D viewport and orbit recorder live in the website/embedded ComfyUI Studio. No arbitrary shell or arbitrary external file access is added.

## Verification scope

Real local acceptance covered the existing generated GLB, camera-view capture, a recorded orbit, eight fully decoded finishing exports, a six-image dataset ZIP with a held-out split, repeatable cast-bound film plans and an editable timeline ZIP. This does not establish trained-character quality, generative transition quality, all imported graph readiness or professional-editor round-trip fidelity.
