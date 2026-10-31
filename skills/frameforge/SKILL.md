---
name: frameforge
description: Open Frameforge's visual ComfyUI studio, find and explain creative workflows, inspect graphs and model requirements, or make images, videos, speech and films with the user's connected local engine. Use for Frameforge workflow and production requests; ordinary coding tasks do not need this skill.
---

# Frameforge Studio

For "open Frameforge", "show the studio", or a workflow-library request, call the connected Frameforge `studio_workflows` tool immediately. It returns both the live catalog and the picture-rich MCP Apps resource. Let the host display that resource; do not substitute a screenshot or the read-only browser preview for a working MCP panel. If the client cannot render it, explain that limit and offer the returned `studioUrl` as a normal website link.

Use the returned catalog rather than inventing recipe IDs or asserting model parity with a hosted service. Explain the chosen workflow's input, output, main stages and dependencies in plain language. Use `workflow_requirements` and `comfy_status` to distinguish a ready local recipe from a missing installation. `studio_graph` returns the actual graph and model download information. Model files and ComfyUI are separate installations, not part of this plugin.

For authorized local creation, prepare and inspect a graph before `studio_run_workflow`. Use `studio_generate` or `studio_audio` for documented multi-stage processors. Import only media the user has authorized; `studio_import_asset` is restricted to the configured import folder. The plugin defaults that folder to its bundled original concept artwork. For personal files outside it, use the website's upload controls or help configure a deliberately chosen media folder.

Give each new creation an explicit UUID `requestId`. If a submission times out or its result is ambiguous, reuse that ID and inspect saved jobs/engine history before retrying. Do not create a new ID merely because a response was lost. Poll `studio_job` and use `studio_preview` for actual generated images, audio and video posters/contact sheets. `studio_media` supports bounded saved video/audio playback and transcript review (12 MiB maximum); it never fetches arbitrary URLs. Original concept artwork is inspiration, not evidence of a successful render. Watch the actual video to judge motion; listen to speech to judge delivery. Keep technical checks separate from human creative approval.

`studio_policy` changes the shared studio's Open weights only profile; use it when requested. Local-only execution and open model weights are different properties. Do not disable an active profile to bypass a failed workflow. Cloud preparation/export is an external graph/input handoff; Civitai receives a prompt/model brief. The plugin cannot submit paid jobs, install models, execute a shell, delete assets or approve creative results.

For a film, use saved source IDs and current revision/signature values from project/Director tools. Reuse the same saved production work across the website and assistant. The native panel includes speech/transcription and film timeline controls; advanced audio/video requests and film layers use JSON controls. Do not claim every specialized website editor is reproduced. It does not load a nested website. The returned local URLs are for this computer, not public share links.


For connected productions, use `studio_recipe_library` to read shared subjects, motions, frozen plans and batch states. `capabilities: true` reports recipe readiness; still inspect individual requirements and graphs. `studio_recipe` saves references/plans and prepares graphs. `queue` explicitly starts sequential variations and requires the saved signature and requestId; reuse that ID after an ambiguous response. A reference-story extracts source frames and uses user-written shot actions, not automatic video interpretation. Never describe technical mask/graph checks as approval of character consistency or motion quality.

The main destinations are Explore, Images, Video, Audio, Library and Advanced. Films is inside Video. Library contains Workflows, Creative recipes and Saved results. Advanced contains 3D, SAM & precision and LoRA training. The training section currently shows reference preparation and planned setup; do not claim that a trainer is installed. SAM selection and tracking are also directly available in Images and Video.

Use `studio_creator_library` for shared canvas, cast and story records, and `studio_creator` for explicitly requested saves, timed story/project handoffs, dataset/timeline exports and CPU finishing. Reuse saved IDs and revisions; a finish needs an explicit requestId. Suggest-next routing is deterministic, not a vision analysis. Character export prepares a FLUX.1 dataset/config with held-out images; no trainer is installed or run by that export. The specialized 3D viewer and orbit recording live in the website/ComfyUI Studio, not the native chat panel.
